/**
 * Signal Modification Service
 *
 * Bridges the new signal modification system (reply-based) with the existing
 * trade modification handler. Finds trades associated with original signals
 * and creates modification commands.
 */

import { EventEmitter } from 'events'
import { logger } from '../utils/logger'
import { getDatabase } from '../database'
import { tradeManager, ActiveTrade } from './tradeManager'
import { tradeModificationHandler, ModificationCommand } from './tradeModificationHandler'
import type { SignalModification } from '../types/signalModification'

export class SignalModificationService extends EventEmitter {
  /**
   * Process a detected signal modification
   */
  async processModification(modification: SignalModification, channelName: string): Promise<void> {
    logger.info(`Processing modification ${modification.id}: ${modification.type}`)

    try {
      // Find trades - either for a specific signal or globally
      const trades = modification.signalId === 'global'
        ? this.findAllTrades()
        : this.findTradesForSignal(modification.signalId)

      if (trades.length === 0) {
        const scope = modification.signalId === 'global' ? 'any account' : `signal ${modification.signalId}`
        logger.warn(`No active trades found for ${scope}`)
        this.updateModificationStatus(modification.id, 'failed', 'No active trades found')
        return
      }

      const scope = modification.signalId === 'global' ? 'all accounts' : `signal ${modification.signalId}`
      logger.info(`Found ${trades.length} trade(s) for ${scope}`)

      // Group trades by account
      const tradesByAccount = this.groupTradesByAccount(trades)

      // Create modification commands for each account
      for (const [accountKey, accountTrades] of tradesByAccount.entries()) {
        const [accountNumber, platform] = accountKey.split(':')

        const command = this.createModificationCommand(
          modification,
          accountTrades,
          accountNumber,
          platform
        )

        if (command) {
          // Emit command to be queued in API server
          this.emit('modificationCommand', command)
          logger.info(`Created modification command for account ${accountNumber}: ${command.type}`)
        }
      }

      // Update status
      this.updateModificationStatus(modification.id, 'applied')

    } catch (error: any) {
      logger.error(`Error processing modification ${modification.id}:`, error)
      this.updateModificationStatus(modification.id, 'failed', error.message)
    }
  }

  /**
   * Find all active trades (for global commands like "close all")
   */
  private findAllTrades(): ActiveTrade[] {
    const db = getDatabase()

    // Find all active trades (both open and pending)
    const result = db.exec(
      'SELECT ticket, account_number, platform, symbol, entry_price, status, signal_id FROM trades WHERE status IN (?, ?)',
      ['open', 'pending']
    )

    if (result.length === 0 || result[0].values.length === 0) {
      logger.warn('No active trades found in database')
      return []
    }

    // Convert database records to ActiveTrade format
    const trades: ActiveTrade[] = []

    for (const row of result[0].values) {
      const ticket = String(row[0])
      const accountNumber = String(row[1])
      const platform = String(row[2])
      const symbol = String(row[3])
      const entryPrice = row[4] ? Number(row[4]) : 0
      const status = String(row[5]) as 'open' | 'pending'
      const signalId = String(row[6])

      trades.push({
        ticket: parseInt(ticket),
        accountNumber,
        platform,
        symbol,
        signalId,
        status,
        channelId: 0,
        entryPrice,
        stopLoss: 0,
        takeProfits: []
      } as ActiveTrade)
    }

    logger.info(`Found ${trades.length} total active trade(s)`)
    return trades
  }

  /**
   * Find trades associated with a signal using database
   */
  private findTradesForSignal(signalId: string): ActiveTrade[] {
    const db = getDatabase()

    // Find trades in database for this signal - include both open and pending trades
    const result = db.exec(
      'SELECT ticket, account_number, platform, symbol, entry_price, status FROM trades WHERE signal_id = ? AND status IN (?, ?)',
      [signalId, 'open', 'pending']
    )

    if (result.length === 0 || result[0].values.length === 0) {
      logger.warn(`No active trades found in database for signal ${signalId}`)
      return []
    }

    // Convert database records to ActiveTrade format
    const trades: ActiveTrade[] = []

    for (const row of result[0].values) {
      const ticket = String(row[0])
      const accountNumber = String(row[1])
      const platform = String(row[2])
      const symbol = String(row[3])
      const entryPrice = row[4] ? Number(row[4]) : 0
      const status = String(row[5]) as 'open' | 'pending'

      trades.push({
        ticket: parseInt(ticket),
        accountNumber,
        platform,
        symbol,
        signalId,
        status, // Use actual status from database
        channelId: 0, // Will be filled by EA
        entryPrice,
        stopLoss: 0,
        takeProfits: []
      } as ActiveTrade)
    }

    logger.info(`Found ${trades.length} trade(s) for signal ${signalId}: ${trades.map(t => t.ticket).join(', ')}`)
    return trades
  }

  /**
   * Group trades by account
   */
  private groupTradesByAccount(trades: ActiveTrade[]): Map<string, ActiveTrade[]> {
    const grouped = new Map<string, ActiveTrade[]>()

    for (const trade of trades) {
      const key = `${trade.accountNumber}:${trade.platform}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(trade)
    }

    return grouped
  }

  /**
   * Create modification command from signal modification
   */
  private createModificationCommand(
    modification: SignalModification,
    trades: ActiveTrade[],
    accountNumber: string,
    platform: string
  ): ModificationCommand | null {
    switch (modification.type) {
      case 'move_to_breakeven':
        return {
          type: 'modify_sl',
          accountNumber,
          platform,
          trades,
          newValue: trades[0]?.entryPrice, // Move SL to entry
          reason: 'Move to breakeven'
        }

      case 'close_partial':
        if (!modification.percentage) {
          logger.warn('No percentage specified for partial close')
          return null
        }

        // Check if original action was "delete" - if so, send delete command for pending orders
        if (modification.originalAction === 'delete') {
          const pendingTrades = trades.filter(t => t.status === 'pending')

          if (pendingTrades.length > 0) {
            logger.info(`Delete action detected for ${pendingTrades.length} pending order(s)`)
            return {
              type: 'delete',
              accountNumber,
              platform,
              trades: pendingTrades,
              reason: modification.percentage === 100
                ? 'Delete pending order'
                : `Delete ${modification.percentage}% of pending`
            }
          } else {
            // No pending trades found, log warning and fall back to close
            logger.warn('Delete action requested but no pending trades found, falling back to close')
          }
        }

        // Default: Close command for active positions
        return {
          type: 'close',
          accountNumber,
          platform,
          trades,
          percentage: modification.percentage,
          reason: `Close ${modification.percentage}%`
        }

      case 'close_all':
        return {
          type: 'close',
          accountNumber,
          platform,
          trades,
          percentage: 100,
          reason: 'Close all'
        }

      case 'cancel_pending':
        // Filter only pending orders
        const pendingTrades = trades.filter(t => t.status === 'pending')
        if (pendingTrades.length === 0) {
          logger.warn('No pending orders to cancel')
          return null
        }
        return {
          type: 'delete',
          accountNumber,
          platform,
          trades: pendingTrades,
          reason: 'Cancel pending orders'
        }

      case 'update_sl':
        if (!modification.price && !modification.pips) {
          logger.warn('No SL value specified')
          return null
        }
        // TODO: If pips, calculate actual price based on trade direction
        return {
          type: 'modify_sl',
          accountNumber,
          platform,
          trades,
          newValue: modification.price || modification.pips,
          reason: 'Update SL'
        }

      case 'update_tp':
        if (!modification.price && !modification.pips) {
          logger.warn('No TP value specified')
          return null
        }
        // TODO: If pips, calculate actual price based on trade direction
        return {
          type: 'modify_tp',
          accountNumber,
          platform,
          trades,
          newValue: [modification.price || modification.pips || 0], // TP as array
          reason: 'Update TP'
        }

      case 'enable_trailing':
        // This would require new command type for EA to start trailing
        logger.warn('Enable trailing not yet implemented in modification commands')
        return null

      case 'disable_trailing':
        // This would require new command type for EA to stop trailing
        logger.warn('Disable trailing not yet implemented in modification commands')
        return null

      case 'update_entry':
        // This would require new command type for EA to modify pending order entry
        logger.warn('Update entry not yet implemented in modification commands')
        return null

      default:
        logger.warn(`Unknown modification type: ${modification.type}`)
        return null
    }
  }

  /**
   * Update modification status in database
   */
  private updateModificationStatus(
    modificationId: string,
    status: 'pending' | 'applied' | 'failed' | 'ignored',
    errorMessage?: string
  ): void {
    const db = getDatabase()

    if (status === 'applied') {
      db.run(
        'UPDATE signal_modifications SET status = ?, applied_at = datetime("now") WHERE id = ?',
        [status, modificationId]
      )
    } else {
      db.run(
        'UPDATE signal_modifications SET status = ?, error_message = ? WHERE id = ?',
        [status, errorMessage || null, modificationId]
      )
    }
  }
}

// Singleton instance
export const signalModificationService = new SignalModificationService()
