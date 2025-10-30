import { logger } from '../utils/logger'
import { ParsedSignal } from './signalParser'
import { getDatabase, saveDatabase } from '../database'

export interface CloudSyncConfig {
  enabled: boolean
  apiUrl: string
  authToken?: string
}

export class CloudSyncService {
  private config: CloudSyncConfig
  private accountNumber: string | null = null
  private syncInterval: NodeJS.Timeout | null = null

  constructor(config: CloudSyncConfig) {
    this.config = config
  }

  /**
   * Set the trading account number for cloud sync
   */
  setAccountNumber(accountNumber: string) {
    this.accountNumber = accountNumber
    logger.info(`[Cloud Sync] Account number set: ${accountNumber}`)
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
   * Push signal to cloud backend and return the cloud signal ID
   */
  async pushSignal(signal: ParsedSignal, channelId?: string, channelName?: string): Promise<string | null> {
    if (!this.config.enabled) {
      logger.debug('[Cloud Sync] Disabled, skipping signal push')
      return null
    }

    if (!this.config.authToken) {
      logger.warn('[Cloud Sync] No auth token, skipping signal push')
      return null
    }

    if (!this.accountNumber) {
      logger.warn('[Cloud Sync] No account number set, skipping signal push')
      return null
    }

    try {
      const payload = {
        accountNumber: this.accountNumber,
        action: signal.direction, // 'BUY' or 'SELL'
        symbol: signal.symbol,
        entryPrice: signal.entryPrice || null,
        stopLoss: signal.stopLoss || null,
        takeProfit: signal.takeProfits && signal.takeProfits.length > 0 ? signal.takeProfits[0] : null,
        lotSize: signal.lotSize || null,
        comment: signal.comment || 'Telegram signal',
        channelId: channelId || null,
        channelName: channelName || null,
        signalText: signal.rawText || null
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
      logger.info(`[Cloud Sync] Signal pushed successfully: ${result.signalId}`)
      return result.signalId || null
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

    if (!this.accountNumber) {
      logger.warn('[Cloud Sync] No account number set, skipping modification push')
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

      const eaType = typeMapping[modification.type] || modification.type

      const payload = {
        accountNumber: this.accountNumber,
        type: eaType,
        signalId: modification.signalId?.toString() || null,
        channelId: modification.channelId?.toString() || null,
        channelName: modification.channelName || null,
        rawText: modification.rawText || null,
        messageId: modification.messageId?.toString() || null,
        tickets: modification.affectedTickets || [],
        newValue: modification.newValue || null,
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
    if (!this.config.enabled || !this.config.authToken || !this.accountNumber) {
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
   * Fetch executed trades from cloud and store in local database
   */
  async syncExecutedTrades(): Promise<void> {
    if (!this.config.enabled || !this.config.authToken || !this.accountNumber) {
      return
    }

    try {
      logger.debug(`[Cloud Sync] Syncing executed trades from cloud`)

      const response = await fetch(
        `${this.config.apiUrl}/api/signals/executed?account=${this.accountNumber}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.authToken}`
          }
        }
      )

      if (!response.ok) {
        logger.error(`[Cloud Sync] Failed to fetch executed trades: ${response.status}`)
        return
      }

      const result = await response.json()
      const signals = result.signals || []

      if (signals.length === 0) {
        logger.debug('[Cloud Sync] No new executed trades to sync')
        return
      }

      const db = getDatabase()
      let syncedCount = 0

      for (const signal of signals) {
        // Check if we already have this trade
        const existing = db.exec(
          'SELECT id FROM active_trades WHERE ticket_number = ? AND account_number = ?',
          [signal.ticketNumber, this.accountNumber]
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
          signal.ticketNumber,
          signal.symbol,
          signal.action,
          signal.executedPrice || signal.entryPrice,
          signal.stopLoss,
          signal.takeProfit,
          signal.lotSize,
          this.accountNumber,
          'MT5', // Assume MT5 for cloud sync
          signal.channelId,
          signal.executedAt || new Date().toISOString(),
          'open',
          signal.cloudSignalId
        ])

        syncedCount++
      }

      if (syncedCount > 0) {
        saveDatabase()
        logger.info(`[Cloud Sync] Synced ${syncedCount} executed trades from cloud`)
      }
    } catch (error: any) {
      logger.error(`[Cloud Sync] Error syncing executed trades: ${error.message}`)
    }
  }
}
