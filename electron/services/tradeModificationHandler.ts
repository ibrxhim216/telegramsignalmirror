import { EventEmitter } from 'events'
import { tradeManager, ActiveTrade } from './tradeManager'
import { logger } from '../utils/logger'
import { EnhancedParsedSignal, ParsedUpdate } from './enhancedSignalParser'

export interface ModificationCommand {
  type: 'close' | 'modify_sl' | 'modify_tp' | 'delete' | 'close_all'
  accountNumber: string
  platform: string
  trades: ActiveTrade[]
  percentage?: number
  newValue?: number | number[]
  reason: string
}

export class TradeModificationHandler extends EventEmitter {
  /**
   * Record a dropped update so the UI can show WHY nothing happened.
   * Emits 'updateSkipped' — main.ts forwards it to the signal feed as a muted card.
   */
  private skip(channelId: number, updateType: string, reason: string): void {
    logger.warn(`Update skipped [${updateType}] channel ${channelId}: ${reason}`)
    this.emit('updateSkipped', { channelId, updateType, reason, timestamp: new Date().toISOString() })
  }

  /**
   * Process an update signal
   */
  async processUpdate(
    updateSignal: EnhancedParsedSignal,
    channelId: number,
    accountNumber: string,
    platform: string = 'MT4'
  ): Promise<void> {
    if (updateSignal.signalType !== 'update' || !updateSignal.update) {
      logger.warn('Not an update signal, ignoring')
      return
    }

    const update = updateSignal.update
    logger.info(`Processing update: ${update.type} for channel ${channelId}`)

    try {
      switch (update.type) {
        case 'closeTP1':
          await this.closeTPLevel(channelId, 1, accountNumber, platform)
          break

        case 'closeTP2':
          await this.closeTPLevel(channelId, 2, accountNumber, platform)
          break

        case 'closeTP3':
          await this.closeTPLevel(channelId, 3, accountNumber, platform)
          break

        case 'closeTP4':
          await this.closeTPLevel(channelId, 4, accountNumber, platform)
          break

        case 'closeFull':
          await this.closeFull(channelId, updateSignal.symbol, accountNumber, platform)
          break

        case 'closeHalf':
          await this.closePartial(channelId, updateSignal.symbol, 50, accountNumber, platform)
          break

        case 'closePartial':
          const percentage = update.percentage || 50
          await this.closePartial(channelId, updateSignal.symbol, percentage, accountNumber, platform)
          break

        case 'breakEven':
          await this.moveToBreakEven(channelId, updateSignal.symbol, accountNumber, platform)
          break

        case 'setTP1':
        case 'setTP2':
        case 'setTP3':
        case 'setTP4':
        case 'setTP5':
        case 'setTP':
          await this.updateTP(channelId, updateSignal.symbol, update.value as number[], accountNumber, platform)
          break

        case 'setSL':
          await this.updateSL(channelId, updateSignal.symbol, update.value as number, accountNumber, platform)
          break

        case 'deletePending':
          // If a target entry price was provided, only delete pending orders matching that price
          if (typeof update.value === 'number') {
            await this.deletePendingByEntry(channelId, update.value, accountNumber, platform)
          } else {
            await this.deletePendingOrders(channelId, updateSignal.symbol, accountNumber, platform)
          }
          break

        case 'layer':
          // Layer is actually a new entry, not a modification
          logger.info('Layer command detected - should be processed as new signal')
          break

        case 'closeAll':
          await this.closeAllTrades(channelId, accountNumber, platform)
          break

        case 'deleteAll':
          await this.deleteAllPendingOrders(channelId, accountNumber, platform)
          break

        case 'removeSL':
          await this.removeSL(channelId, updateSignal.symbol, accountNumber, platform)
          break

        case 'closeByEntry':
          if (typeof update.value === 'number') {
            await this.closeByEntryPrice(channelId, update.value, accountNumber, platform)
          } else {
            logger.warn('closeByEntry: no target entry price in update.value')
          }
          break

        default:
          logger.warn(`Unknown update type: ${update.type}`)
      }
    } catch (error: any) {
      logger.error(`Error processing update ${update.type}:`, error)
    }
  }

  /**
   * Close trades at a specific TP level
   */
  private async closeTPLevel(
    channelId: number,
    tpLevel: number,
    accountNumber: string,
    platform: string
  ): Promise<void> {
    const trades = tradeManager.getTradesByChannel(channelId, accountNumber)

    if (trades.length === 0) {
      this.skip(channelId, `closeTP${tpLevel}`, 'No active trades for this channel to close')
      return
    }

    // Filter trades that have this TP level
    const tradesToClose = trades.filter(trade => {
      return trade.takeProfits && trade.takeProfits.length >= tpLevel
    })

    if (tradesToClose.length === 0) {
      this.skip(channelId, `closeTP${tpLevel}`, `No open trades have a TP${tpLevel} level`)
      return
    }

    logger.info(`Closing TP${tpLevel}: ${tradesToClose.length} trade(s)`)

    const command: ModificationCommand = {
      type: 'close',
      accountNumber,
      platform,
      trades: tradesToClose,
      percentage: 100,
      reason: `Close TP${tpLevel}`
    }

    this.emit('modificationCommand', command)
  }

  /**
   * Close all trades for a symbol (or all trades from channel)
   */
  private async closeFull(
    channelId: number,
    symbol: string | undefined,
    accountNumber: string,
    platform: string
  ): Promise<void> {
    let trades: ActiveTrade[]

    if (symbol) {
      trades = tradeManager.getTradesBySymbol(symbol, accountNumber, platform)
          .filter(t => t.channelId === channelId)
    } else {
      trades = tradeManager.getTradesByChannel(channelId, accountNumber)
    }

    if (trades.length === 0) {
      this.skip(channelId, 'closeFull', 'No active trades for this channel to close')
      return
    }

    logger.info(`Closing FULL: ${trades.length} trade(s)`)

    const command: ModificationCommand = {
      type: 'close',
      accountNumber,
      platform,
      trades,
      percentage: 100,
      reason: 'Close Full'
    }

    this.emit('modificationCommand', command)
  }

  /**
   * Close partial percentage of trades
   */
  private async closePartial(
    channelId: number,
    symbol: string | undefined,
    percentage: number,
    accountNumber: string,
    platform: string
  ): Promise<void> {
    let trades: ActiveTrade[]

    if (symbol) {
      trades = tradeManager.getTradesBySymbol(symbol, accountNumber, platform)
          .filter(t => t.channelId === channelId)
    } else {
      trades = tradeManager.getTradesByChannel(channelId, accountNumber)
    }

    if (trades.length === 0) {
      this.skip(channelId, 'closePartial', 'No active trades for this channel to partially close')
      return
    }

    logger.info(`Closing ${percentage}% of ${trades.length} trade(s)`)

    const command: ModificationCommand = {
      type: 'close',
      accountNumber,
      platform,
      trades,
      percentage,
      reason: `Close ${percentage}%`
    }

    this.emit('modificationCommand', command)
  }

  /**
   * Move stop loss to entry price (breakeven)
   */
  private async moveToBreakEven(
    channelId: number,
    symbol: string | undefined,
    accountNumber: string,
    platform: string
  ): Promise<void> {
    let trades: ActiveTrade[]

    if (symbol) {
      trades = tradeManager.getTradesBySymbol(symbol, accountNumber, platform)
          .filter(t => t.channelId === channelId)
    } else {
      trades = tradeManager.getTradesByChannel(channelId, accountNumber)
    }

    if (trades.length === 0) {
      this.skip(channelId, 'breakEven', 'No active trades for this channel to move to breakeven')
      return
    }

    logger.info(`Moving to breakeven: ${trades.length} trade(s)`)

    // For each trade, set SL to entry price
    for (const trade of trades) {
      const command: ModificationCommand = {
        type: 'modify_sl',
        accountNumber,
        platform,
        trades: [trade],
        newValue: trade.entryPrice,
        reason: 'Move to breakeven'
      }

      this.emit('modificationCommand', command)
    }
  }

  /**
   * Update TP levels
   */
  private async updateTP(
    channelId: number,
    symbol: string | undefined,
    newTPs: number[] | number,
    accountNumber: string,
    platform: string
  ): Promise<void> {
    if (newTPs === undefined || newTPs === null) {
      this.skip(channelId, 'setTP', 'No take-profit value found in the message')
      return
    }

    // Coerce to array for consistent handling
    const tpArray = Array.isArray(newTPs) ? newTPs : [newTPs]
    if (tpArray.length === 0) {
      this.skip(channelId, 'setTP', 'No take-profit value found in the message')
      return
    }

    let trades: ActiveTrade[]

    if (symbol) {
      trades = tradeManager.getTradesBySymbol(symbol, accountNumber, platform)
          .filter(t => t.channelId === channelId)
    } else {
      trades = tradeManager.getTradesByChannel(channelId, accountNumber)
    }

    if (trades.length === 0) {
      logger.warn(`No active trades found locally for TP update`)

      // Cloud-only fallback: emit a batch TP update so cloud maps TPs to tickets
      logger.info(`Emitting cloud-only modification: modify_tp_batch with TPs ${JSON.stringify(tpArray)}`)
      this.emit('cloudOnlyModification', {
        type: 'modify_tp_batch',
        signalId: null,
        channelId,
        newTPs: tpArray,
        reason: `Update TPs to ${tpArray.join(', ')}`
      })
      return
    }

    logger.info(`Updating TP for ${trades.length} trade(s) to ${tpArray}`)

    const command: ModificationCommand = {
      type: 'modify_tp',
      accountNumber,
      platform,
      trades,
      newValue: tpArray,
      reason: 'Update TP'
    }

    this.emit('modificationCommand', command)
  }

  /**
   * Update SL
   */
  private async updateSL(
    channelId: number,
    symbol: string | undefined,
    newSL: number,
    accountNumber: string,
    platform: string
  ): Promise<void> {
    if (!newSL) {
      this.skip(channelId, 'setSL', 'No stop-loss value found in the message')
      return
    }

    let trades: ActiveTrade[]

    if (symbol) {
      trades = tradeManager.getTradesBySymbol(symbol, accountNumber, platform)
          .filter(t => t.channelId === channelId)
    } else {
      trades = tradeManager.getTradesByChannel(channelId, accountNumber)
    }

    if (trades.length === 0) {
      this.skip(channelId, 'setSL', 'No active trades for this channel to update SL on')
      return
    }

    logger.info(`Updating SL for ${trades.length} trade(s) to ${newSL}`)

    const command: ModificationCommand = {
      type: 'modify_sl',
      accountNumber,
      platform,
      trades,
      newValue: newSL,
      reason: 'Update SL'
    }

    this.emit('modificationCommand', command)
  }

  /**
   * Delete pending orders
   */
  private async deletePendingOrders(
    channelId: number,
    symbol: string | undefined,
    accountNumber: string,
    platform: string
  ): Promise<void> {
    let trades: ActiveTrade[]

    if (symbol) {
      trades = tradeManager.getTradesBySymbol(symbol, accountNumber, platform)
          .filter(t => t.channelId === channelId && t.status === 'pending')
    } else {
      trades = tradeManager.getTradesByChannel(channelId, accountNumber)
          .filter(t => t.status === 'pending')
    }

    if (trades.length === 0) {
      this.skip(channelId, 'deletePending', 'No pending orders for this channel to delete')
      return
    }

    logger.info(`Deleting ${trades.length} pending order(s)`)

    const command: ModificationCommand = {
      type: 'delete',
      accountNumber,
      platform,
      trades,
      reason: 'Delete pending order'
    }

    this.emit('modificationCommand', command)
  }

  /**
   * Close all trades for a channel
   */
  private async closeAllTrades(
    channelId: number,
    accountNumber: string,
    platform: string
  ): Promise<void> {
    const trades = tradeManager.getTradesByChannel(channelId, accountNumber)

    if (trades.length === 0) {
      logger.warn(`No active trades found locally for channel ${channelId}`)

      // In cloud-only mode, emit cloudOnlyModification event
      logger.info(`Emitting cloud-only modification: close_all`)
      this.emit('cloudOnlyModification', {
        type: 'close_all',
        signalId: null, // null signalId indicates global command
        channelId,
        reason: 'Close all trades'
      })
      return
    }

    logger.info(`Closing ALL trades: ${trades.length} trade(s)`)

    const command: ModificationCommand = {
      type: 'close_all',
      accountNumber,
      platform,
      trades,
      percentage: 100,
      reason: 'Close all trades'
    }

    this.emit('modificationCommand', command)
  }

  /**
   * Delete all pending orders for a channel
   */
  private async deleteAllPendingOrders(
    channelId: number,
    accountNumber: string,
    platform: string
  ): Promise<void> {
    const trades = tradeManager.getTradesByChannel(channelId, accountNumber)
        .filter(t => t.status === 'pending')

    if (trades.length === 0) {
      logger.warn(`No pending orders found locally for channel ${channelId}`)

      // In cloud-only mode, emit cloudOnlyModification event
      logger.info(`Emitting cloud-only modification: delete (all pending)`)
      this.emit('cloudOnlyModification', {
        type: 'delete',
        signalId: null, // null signalId indicates global command
        channelId,
        reason: 'Delete all pending orders'
      })
      return
    }

    logger.info(`Deleting ALL pending orders: ${trades.length} order(s)`)

    const command: ModificationCommand = {
      type: 'delete',
      accountNumber,
      platform,
      trades,
      reason: 'Delete all pending orders'
    }

    this.emit('modificationCommand', command)
  }

  /**
   * Delete pending orders whose entry price is near a target price (within 2 points).
   * Used for messages like "close only upper limit 4032" — only cancels matching pending orders.
   */
  private async deletePendingByEntry(
    channelId: number,
    targetPrice: number,
    accountNumber: string,
    platform: string
  ): Promise<void> {
    const allTrades = tradeManager.getTradesByChannel(channelId, accountNumber)
        .filter(t => t.status === 'pending')

    if (allTrades.length === 0) {
      logger.warn(`deletePendingByEntry: no pending orders found locally for channel ${channelId}`)

      // Cloud-only mode: emit a cloud modification with the target entry price
      logger.info(`Emitting cloud-only modification: delete pending @ ~${targetPrice}`)
      this.emit('cloudOnlyModification', {
        type: 'delete',
        signalId: null,
        channelId,
        targetEntryPrice: targetPrice,
        reason: `Delete pending orders at ~${targetPrice}`
      })
      return
    }

    const tolerance = 2.0
    const matchingTrades = allTrades.filter(trade =>
      Math.abs(trade.entryPrice - targetPrice) < tolerance
    )

    if (matchingTrades.length === 0) {
      logger.warn(`deletePendingByEntry: no pending orders with entry price near ${targetPrice} (tolerance ${tolerance}) found among ${allTrades.length} pending order(s)`)

      // Fall back to cloud modification since local trades don't match
      logger.info(`Emitting cloud-only modification: delete pending @ ~${targetPrice}`)
      this.emit('cloudOnlyModification', {
        type: 'delete',
        signalId: null,
        channelId,
        targetEntryPrice: targetPrice,
        reason: `Delete pending orders at ~${targetPrice}`
      })
      return
    }

    logger.info(`deletePendingByEntry: deleting ${matchingTrades.length} pending order(s) with entry near ${targetPrice}`)

    const command: ModificationCommand = {
      type: 'delete',
      accountNumber,
      platform,
      trades: matchingTrades,
      reason: `Delete pending orders at ~${targetPrice}`
    }

    this.emit('modificationCommand', command)
  }

  /**
   * Close trades whose entry price is closest to a target price (within 2 points).
   * Used for messages like "Close lower sell trade (4584.7) immediately."
   */
  private async closeByEntryPrice(
    channelId: number,
    targetPrice: number,
    accountNumber: string,
    platform: string
  ): Promise<void> {
    const allTrades = tradeManager.getTradesByChannel(channelId, accountNumber)

    if (allTrades.length === 0) {
      this.skip(channelId, 'closeByEntry', 'No active trades for this channel')
      return
    }

    // Tolerance: within 2.0 price points of the target entry price
    const tolerance = 2.0
    const matchingTrades = allTrades.filter(trade =>
      Math.abs(trade.entryPrice - targetPrice) < tolerance
    )

    if (matchingTrades.length === 0) {
      this.skip(channelId, 'closeByEntry', `No trade with entry near ${targetPrice} (checked ${allTrades.length} open trade(s), tolerance ${tolerance})`)
      return
    }

    logger.info(`closeByEntry: closing ${matchingTrades.length} trade(s) with entry near ${targetPrice}`)

    const command: ModificationCommand = {
      type: 'close',
      accountNumber,
      platform,
      trades: matchingTrades,
      percentage: 100,
      reason: `Close by entry price ~${targetPrice}`
    }

    this.emit('modificationCommand', command)
  }

  /**
   * Remove stop loss from trades
   */
  private async removeSL(
    channelId: number,
    symbol: string | undefined,
    accountNumber: string,
    platform: string
  ): Promise<void> {
    let trades: ActiveTrade[]

    if (symbol) {
      trades = tradeManager.getTradesBySymbol(symbol, accountNumber, platform)
          .filter(t => t.channelId === channelId)
    } else {
      trades = tradeManager.getTradesByChannel(channelId, accountNumber)
    }

    if (trades.length === 0) {
      this.skip(channelId, 'removeSL', 'No active trades for this channel to remove SL from')
      return
    }

    logger.info(`Removing SL from ${trades.length} trade(s)`)

    const command: ModificationCommand = {
      type: 'modify_sl',
      accountNumber,
      platform,
      trades,
      newValue: 0, // 0 means no SL
      reason: 'Remove SL'
    }

    this.emit('modificationCommand', command)
  }
}

// Singleton instance
export const tradeModificationHandler = new TradeModificationHandler()
