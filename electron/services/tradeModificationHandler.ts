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
          await this.deletePendingOrders(channelId, updateSignal.symbol, accountNumber, platform)
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
      logger.warn(`No active trades found for channel ${channelId}`)
      return
    }

    // Filter trades that have this TP level
    const tradesToClose = trades.filter(trade => {
      return trade.takeProfits && trade.takeProfits.length >= tpLevel
    })

    if (tradesToClose.length === 0) {
      logger.warn(`No trades with TP${tpLevel} found for channel ${channelId}`)
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
      logger.warn(`No active trades found to close`)
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
      logger.warn(`No active trades found for partial close`)
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
      logger.warn(`No active trades found for breakeven`)
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
    newTPs: number[],
    accountNumber: string,
    platform: string
  ): Promise<void> {
    if (!newTPs || newTPs.length === 0) {
      logger.warn('No TP values provided for update')
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
      logger.warn(`No active trades found for TP update`)
      return
    }

    logger.info(`Updating TP for ${trades.length} trade(s) to ${newTPs}`)

    const command: ModificationCommand = {
      type: 'modify_tp',
      accountNumber,
      platform,
      trades,
      newValue: newTPs,
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
      logger.warn('No SL value provided for update')
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
      logger.warn(`No active trades found for SL update`)
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
      logger.warn(`No pending orders found to delete`)
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
      logger.warn(`No active trades found for channel ${channelId}`)
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
      logger.warn(`No pending orders found for channel ${channelId}`)
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
      logger.warn(`No active trades found for SL removal`)
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
