import { EventEmitter } from 'events'
import { logger } from '../utils/logger'
import { ParsedSignal } from './signalParser'
import { getDatabase, saveDatabase } from '../database'

export interface CloudSyncConfig {
  enabled: boolean
  apiUrl: string
  authToken?: string
}

export class CloudSyncService extends EventEmitter {
  private config: CloudSyncConfig
  private syncInterval: NodeJS.Timeout | null = null

  constructor(config: CloudSyncConfig) {
    super()
    this.config = config
  }

  /**
   * Get the current authentication token
   */
  getAuthToken(): string | undefined {
    return this.config.authToken
  }

  /**
   * Set authentication token for cloud API
   */
  setAuthToken(token: string) {
    this.config.authToken = token
    logger.info('[Cloud Sync] Auth token updated')
  }

  /**
   * Enable or disable cloud sync
   */
  setEnabled(enabled: boolean) {
    this.config.enabled = enabled
    logger.info(`[Cloud Sync] ${enabled ? 'Enabled' : 'Disabled'}`)
  }

  /**
   * Fetch the authenticated user's trading accounts from cloud and mirror them into
   * the local trading_accounts table. Ensures accountService.getPrimaryAccount() finds
   * a matching account so update commands (setSL, deletePending, etc.) can be routed.
   */
  async syncAccountsFromCloud(): Promise<void> {
    if (!this.config.authToken) {
      logger.debug('[Cloud Sync] No auth token, skipping account sync')
      return
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/api/trading-accounts`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.config.authToken}` }
      })

      if (!response.ok) {
        logger.error(`[Cloud Sync] Failed to fetch trading accounts: ${response.status}`)
        return
      }

      const data: any = await response.json()
      const accounts = data.accounts || []

      if (accounts.length === 0) {
        logger.debug('[Cloud Sync] No cloud trading accounts to sync')
        return
      }

      const db = getDatabase()
      let synced = 0

      for (const acc of accounts) {
        const platform = acc.platform || 'MT5'
        const accountNumber = String(acc.accountNumber || acc.account_number || '')
        if (!accountNumber) continue

        const isActive = acc.isActive === false ? 0 : 1

        // Upsert into local trading_accounts
        const existing = db.exec(
          'SELECT id FROM trading_accounts WHERE account_number = ? AND platform = ?',
          [accountNumber, platform]
        )

        if (existing.length > 0 && existing[0].values.length > 0) {
          db.run(
            'UPDATE trading_accounts SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE account_number = ? AND platform = ?',
            [isActive, accountNumber, platform]
          )
        } else {
          db.run(
            'INSERT INTO trading_accounts (platform, account_number, account_name, is_active) VALUES (?, ?, ?, ?)',
            [platform, accountNumber, acc.accountName || acc.name || null, isActive]
          )
        }
        synced++
      }

      saveDatabase()
      logger.info(`[Cloud Sync] Synced ${synced} trading account(s) from cloud`)
    } catch (error: any) {
      logger.error(`[Cloud Sync] Account sync error: ${error.message}`)
    }
  }

  /**
   * Register a trading account in the cloud so it shows on the website and receives
   * cloud-distributed signals. Called when an EA polls this app with an account we have
   * not seen before. Emits 'accountError' when the cloud rejects it (taken by another
   * user, plan limit reached) so the UI can explain what to do.
   */
  async registerAccount(platform: string, accountNumber: string, accountName?: string): Promise<boolean> {
    if (!this.config.authToken) {
      logger.debug('[Cloud Sync] No auth token, cannot register account in cloud')
      return false
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/api/trading-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.authToken}`
        },
        body: JSON.stringify({ platform, accountNumber, accountName: accountName || `${platform} ${accountNumber}` })
      })

      if (response.ok) {
        logger.info(`[Cloud Sync] Registered trading account ${accountNumber} (${platform}) in cloud`)
        return true
      }

      const body: any = await response.json().catch(() => ({}))
      const message: string = body.message || body.error || `HTTP ${response.status}`

      if (response.status === 409) {
        // Already registered. If it is registered to THIS user the GET sync will pick it up; if it belongs
        // to someone else the user has to sort it out on the website.
        const mine = await this.isAccountMine(accountNumber)
        if (mine) {
          logger.info(`[Cloud Sync] Account ${accountNumber} already registered to this user`)
          return true
        }
        this.emit('accountError', {
          accountNumber,
          message,
          action: 'This account number is registered to a different Telegram Signal Mirror user.'
        })
        return false
      }

      if (response.status === 403) {
        this.emit('accountError', {
          accountNumber,
          message,
          action: body.upgradeRequired
            ? 'Your plan has no free account slots left. Upgrade or remove an account.'
            : 'Your subscription does not allow adding this account.'
        })
        return false
      }

      logger.warn(`[Cloud Sync] Could not register account ${accountNumber}: ${message}`)
      return false
    } catch (error: any) {
      logger.error(`[Cloud Sync] Account registration error: ${error.message}`)
      return false
    }
  }

  private async isAccountMine(accountNumber: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/trading-accounts`, {
        headers: { 'Authorization': `Bearer ${this.config.authToken}` }
      })
      if (!response.ok) return false
      const data: any = await response.json()
      return (data.accounts || []).some((a: any) => String(a.accountNumber) === String(accountNumber))
    } catch {
      return false
    }
  }

  /**
   * Push signal to cloud backend and return the cloud signal ID
   * The cloud server will distribute this signal to all accounts registered by the authenticated user
   */
  async pushSignal(signal: ParsedSignal, channelId?: string, channelName?: string, telegramMessageId?: number, signalGroupId?: string): Promise<string | null> {
    if (!this.config.enabled) {
      logger.debug('[Cloud Sync] Disabled, skipping signal push')
      return null
    }

    if (!this.config.authToken) {
      logger.warn('[Cloud Sync] No auth token, skipping signal push')
      return null
    }

    try {
      const payload = {
        action: signal.direction, // 'BUY' or 'SELL'
        symbol: signal.symbol,
        entryPrice: signal.entryPrice || null,
        entryPrice2: (signal as any).entryPrice2 || null, // Split entry second price
        riskMultiplier: (signal as any).riskMultiplier ?? null, // 0.5 for half-risk signals
        isHedge: (signal as any).isHedge === true ? true : null, // true = EA matches lots to open opposite positions
        stopLoss: signal.stopLoss || null,
        takeProfit: signal.takeProfits && signal.takeProfits.length > 0 ? signal.takeProfits[0] : null, // For backward compatibility
        takeProfits: signal.takeProfits && signal.takeProfits.length > 0 ? signal.takeProfits : null, // Send all TPs for cloud mode multi-TP splitting
        lotSize: signal.lotSize || null,
        comment: signal.comment || 'Telegram signal',
        channelId: channelId || null,
        channelName: channelName || null,
        signalText: signal.rawText || null,
        telegramMessageId: telegramMessageId || null,
        signalGroupId: signalGroupId || null  // Link multi-TP signals together
      }

      logger.info(`[Cloud Sync] Pushing signal to ${this.config.apiUrl}/api/signals`)
      logger.debug(`[Cloud Sync] Payload: ${JSON.stringify(payload)}`)

      const response = await fetch(`${this.config.apiUrl}/api/signals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.authToken}`
        },
        body: JSON.stringify(payload)
      })

      logger.debug(`[Cloud Sync] Response status: ${response.status} ${response.statusText}`)
      logger.debug(`[Cloud Sync] Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`)

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(`[Cloud Sync] Failed to push signal: HTTP ${response.status} ${response.statusText}`)
        logger.error(`[Cloud Sync] Response body: ${errorText}`)
        return null
      }

      const result = await response.json()
      logger.debug(`[Cloud Sync] Full response body: ${JSON.stringify(result)}`)

      // Cloud API returns signalIds as an array (one per account)
      // Use the first signal ID for the mapping
      let signalId = null
      if (result.signalIds && Array.isArray(result.signalIds) && result.signalIds.length > 0) {
        signalId = result.signalIds[0]
      } else if (result.signalId) {
        signalId = result.signalId
      } else if (result.id) {
        signalId = result.id
      }

      logger.info(`[Cloud Sync] Signal pushed successfully: ${signalId} (${result.accountCount || 0} account(s))`)
      return signalId
    } catch (error: any) {
      logger.error(`[Cloud Sync] Error pushing signal: ${error.message}`)
      logger.error(`[Cloud Sync] Error type: ${error.constructor.name}`)
      logger.error(`[Cloud Sync] Error code: ${error.code || 'N/A'}`)
      logger.error(`[Cloud Sync] Error cause: ${error.cause ? JSON.stringify(error.cause) : 'N/A'}`)
      logger.error(`[Cloud Sync] Stack trace: ${error.stack}`)
      return null
    }
  }

  /**
   * Push modification command to cloud backend
   * The cloud server will distribute this modification to all accounts registered by the authenticated user
   */
  async pushModification(modification: any): Promise<boolean> {
    if (!this.config.enabled) {
      logger.debug('[Cloud Sync] Disabled, skipping modification push')
      return false
    }

    if (!this.config.authToken) {
      logger.warn('[Cloud Sync] No auth token, skipping modification push')
      return false
    }

    try {
      // Map modification types from desktop app to EA format
      const typeMapping: Record<string, string> = {
        'cancel_pending': 'delete',
        'close_partial': 'close',
        'close_all': 'close_all',
        'update_sl': 'modify_sl',
        'update_tp': 'modify_tp',
        'move_to_breakeven': 'breakeven',
        'close_tp1': 'close_tp1',
        'close_tp2': 'close_tp2',
        'close_tp3': 'close_tp3',
        'close_tp4': 'close_tp4',
        'set_tp1': 'set_tp1',
        'remove_sl': 'remove_sl'
      }

      let eaType = typeMapping[modification.type] || modification.type

      // Special handling for close_partial: check originalAction
      // If originalAction is 'delete', send 'delete' command to EA (for pending orders)
      if (modification.type === 'close_partial' && modification.originalAction === 'delete') {
        eaType = 'delete'
        logger.debug('[Cloud Sync] close_partial with originalAction=delete -> sending "delete" command')
      }

      const payload = {
        type: eaType,
        signalId: modification.signalId?.toString() || null,
        channelId: modification.channelId?.toString() || null,
        channelName: modification.channelName || null,
        rawText: modification.rawText || null,
        messageId: modification.messageId?.toString() || null,
        // Only send tickets if we actually have them - let cloud API do the lookup if empty
        tickets: (modification.affectedTickets && modification.affectedTickets.length > 0)
          ? modification.affectedTickets
          : null,
        newValue: modification.newValue || null,
        targetEntryPrice: modification.targetEntryPrice || null, // For delete-by-entry
        newTPs: (modification as any).newTPs || null, // For batch TP updates on split entries
        percentage: modification.percentage || null,
        reason: modification.reason || null
      }

      logger.info(`[Cloud Sync] Pushing modification to ${this.config.apiUrl}/api/modifications`)
      logger.debug(`[Cloud Sync] Payload: ${JSON.stringify(payload)}`)

      const response = await fetch(`${this.config.apiUrl}/api/modifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.authToken}`
        },
        body: JSON.stringify(payload)
      })

      logger.debug(`[Cloud Sync] Response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(`[Cloud Sync] Failed to push modification: HTTP ${response.status} ${response.statusText}`)
        logger.error(`[Cloud Sync] Response body: ${errorText}`)
        return false
      }

      const result = await response.json()
      logger.info(`[Cloud Sync] Modification pushed successfully: ${result.modificationId || 'OK'}`)
      return true
    } catch (error: any) {
      logger.error(`[Cloud Sync] Error pushing modification: ${error.message}`)
      logger.error(`[Cloud Sync] Stack trace: ${error.stack}`)
      return false
    }
  }

  /**
   * Test connection to cloud backend
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.info(`[Cloud Sync] Testing connection to ${this.config.apiUrl}/api/health`)

      const response = await fetch(`${this.config.apiUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        logger.error(`[Cloud Sync] Health check failed: ${response.status}`)
        return false
      }

      const result = await response.json()
      logger.info(`[Cloud Sync] Connection successful: ${result.message}`)
      return true
    } catch (error: any) {
      logger.error(`[Cloud Sync] Connection test failed: ${error.message}`)
      return false
    }
  }

  /**
   * Start periodic sync of executed trades from cloud
   */
  startTradeSync(intervalMs: number = 30000) {
    if (!this.config.enabled || !this.config.authToken) {
      logger.warn('[Cloud Sync] Cannot start trade sync - missing configuration')
      return
    }

    // Stop existing interval if any
    this.stopTradeSync()

    logger.info(`[Cloud Sync] Starting trade sync every ${intervalMs / 1000} seconds`)

    // Do initial sync immediately
    this.syncExecutedTrades()

    // Then sync periodically
    this.syncInterval = setInterval(() => {
      this.syncExecutedTrades()
    }, intervalMs)
  }

  /**
   * Stop periodic trade sync
   */
  stopTradeSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      logger.info('[Cloud Sync] Trade sync stopped')
    }
  }

  /**
   * Fetch executed trades from cloud for all user's accounts and store in local database
   */
  async syncExecutedTrades(): Promise<void> {
    if (!this.config.enabled || !this.config.authToken) {
      return
    }

    try {
      logger.debug(`[Cloud Sync] Syncing executed trades from cloud`)

      // Fetch all accounts from local DB (previously synced from cloud)
      const db = getDatabase()
      const accountsResult = db.exec(
        'SELECT account_number FROM trading_accounts WHERE is_active = 1'
      )

      if (accountsResult.length === 0 || accountsResult[0].values.length === 0) {
        logger.debug('[Cloud Sync] No active accounts to sync trades for')
        return
      }

      const accountNumbers = accountsResult[0].values.map((row: any) => row[0] as string)
      const allSignals: any[] = []

      // Fetch trades for each account (endpoint requires ?account= param)
      for (const accountNumber of accountNumbers) {
        const response = await fetch(
          `${this.config.apiUrl}/api/signals/executed?account=${encodeURIComponent(accountNumber)}`,
          {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${this.config.authToken}` }
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          logger.error(`[Cloud Sync] Failed to fetch trades for account ${accountNumber}: ${response.status} — ${errorText}`)
          continue
        }

        const result: any = await response.json()
        const signals = result.signals || []
        // The endpoint response doesn't carry accountNumber — attach the one we queried with.
        // Without this, the insert below binds `undefined`, which sql.js rejects
        // ("tried to bind a value of an unknown type (undefined)").
        for (const s of signals) allSignals.push({ ...s, accountNumber })
      }

      const signals = allSignals

      if (signals.length === 0) {
        logger.debug('[Cloud Sync] No new executed trades to sync')
        return
      }

      let syncedCount = 0

      for (const signal of signals) {
        // Check if we already have this trade
        const existing = db.exec(
          'SELECT id FROM active_trades WHERE ticket_number = ? AND account_number = ?',
          [signal.ticketNumber, signal.accountNumber]
        )

        if (existing.length > 0 && existing[0].values.length > 0) {
          continue // Already synced
        }

        // Insert trade into local database
        db.run(`
          INSERT INTO active_trades (
            ticket_number, symbol, direction, entry_price, stop_loss, take_profit,
            lot_size, account_number, platform, channel_id, opened_at, status,
            cloud_signal_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          // sql.js accepts null but throws on undefined — coalesce every optional field
          signal.ticketNumber ?? null,
          signal.symbol ?? null,
          signal.action ?? null,
          signal.executedPrice ?? signal.entryPrice ?? null,
          signal.stopLoss ?? null,
          signal.takeProfit ?? null,
          signal.lotSize ?? null,
          signal.accountNumber ?? null,
          signal.platform || 'MT5',
          signal.channelId ?? null,
          signal.executedAt || new Date().toISOString(),
          'open',
          signal.cloudSignalId ?? null
        ])

        syncedCount++
      }

      if (syncedCount > 0) {
        saveDatabase()
        logger.info(`[Cloud Sync] Synced ${syncedCount} executed trades from cloud`)
      }
    } catch (error: any) {
      logger.error(`[Cloud Sync] Error syncing executed trades: ${error?.message || error?.toString?.() || 'unknown'}`)
      if (error?.stack) logger.debug(`[Cloud Sync] Stack: ${error.stack}`)
    }
  }
}
