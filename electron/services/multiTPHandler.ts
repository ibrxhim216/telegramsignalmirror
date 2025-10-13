/**
 * Multi-TP Handler Service
 *
 * Splits signals with multiple take profit levels into separate orders
 * Manages partial closes, breakeven, and trailing stops
 */

import { EventEmitter } from 'events'
import { getDatabase, saveDatabase } from '../database'
import {
  MultiTPSettings,
  SplitOrder,
  TPHitEvent,
  OrderGroup,
  DEFAULT_MULTI_TP_SETTINGS,
  calculateLotSizes,
  generateGroupId,
} from '../types/multiTPConfig'
import { ParsedSignal } from './signalParser'
import { logger } from '../utils/logger'

export class MultiTPHandler extends EventEmitter {
  private settings: MultiTPSettings = DEFAULT_MULTI_TP_SETTINGS
  private orderGroups: Map<string, OrderGroup> = new Map()

  constructor() {
    super()
    // Don't load from database in constructor - will be initialized later
  }

  /**
   * Initialize multi-TP handler (call after database is ready)
   */
  init() {
    this.loadSettings()
  }

  /**
   * Load multi-TP settings from database
   */
  private loadSettings() {
    try {
      const db = getDatabase()
      const rows = db.exec(`
        SELECT value FROM settings WHERE key = 'multi_tp_settings'
      `)

      if (rows.length > 0 && rows[0].values.length > 0) {
        const value = rows[0].values[0][0] as string
        this.settings = JSON.parse(value)
        logger.info('Multi-TP settings loaded')
      } else {
        // Save default settings
        this.saveSettings(DEFAULT_MULTI_TP_SETTINGS)
      }
    } catch (error) {
      logger.error('Failed to load multi-TP settings:', error)
    }
  }

  /**
   * Save multi-TP settings to database
   */
  saveSettings(settings: MultiTPSettings): boolean {
    try {
      const db = getDatabase()
      db.run(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES ('multi_tp_settings', ?, CURRENT_TIMESTAMP)
      `, [JSON.stringify(settings)])

      saveDatabase()
      this.settings = settings
      logger.info('Multi-TP settings saved')
      return true
    } catch (error) {
      logger.error('Failed to save multi-TP settings:', error)
      return false
    }
  }

  /**
   * Get current settings
   */
  getSettings(): MultiTPSettings {
    return { ...this.settings }
  }

  /**
   * Split a signal into multiple orders based on TP levels
   */
  splitSignal(signal: ParsedSignal, totalLotSize: number, magicNumber: number = 12345): SplitOrder[] {
    if (!this.settings.enabled) {
      logger.info('Multi-TP disabled, returning single order')
      return []
    }

    // Check if signal has multiple TPs
    if (!signal.takeProfits || signal.takeProfits.length <= 1) {
      logger.info('Signal has only one TP, skipping multi-TP split')
      return []
    }

    const tpCount = signal.takeProfits.length
    const groupId = generateGroupId()

    logger.info(`📊 Splitting signal into ${tpCount} orders (Group: ${groupId})`)

    // Calculate lot sizes for each order
    const lotSizes = calculateLotSizes(totalLotSize, tpCount, this.settings)

    // Create split orders
    const splitOrders: SplitOrder[] = []

    for (let i = 0; i < tpCount; i++) {
      const lotSize = lotSizes[i]

      // Skip if lot size is too small
      if (this.settings.skipIfTooSmall && lotSize < this.settings.minLotSize) {
        logger.warn(`Skipping TP${i + 1} order: lot size ${lotSize} below minimum ${this.settings.minLotSize}`)
        continue
      }

      const splitOrder: SplitOrder = {
        originalSignalId: `${signal.symbol}_${Date.now()}`,
        orderNumber: i + 1,
        tpLevel: i + 1,

        symbol: signal.symbol,
        direction: signal.direction,
        entryPrice: Array.isArray(signal.entryPrice) ? signal.entryPrice[0] : (signal.entryPrice || 0),
        stopLoss: Array.isArray(signal.stopLoss) ? signal.stopLoss[0] : (signal.stopLoss || 0),
        takeProfit: signal.takeProfits[i],
        lotSize: Math.max(lotSize, this.settings.minLotSize),

        percentage: (lotSize / totalLotSize) * 100,
        groupId,
        isLastOrder: i === tpCount - 1,

        magicNumber,
        comment: `TP${i + 1} [${groupId.slice(-6)}]`,
      }

      splitOrders.push(splitOrder)

      logger.info(`  ✅ Order ${i + 1}: ${lotSize.toFixed(2)} lots @ TP${i + 1}: ${signal.takeProfits[i]}`)
    }

    // Create order group for tracking
    const orderGroup: OrderGroup = {
      groupId,
      signalId: splitOrders[0].originalSignalId,
      symbol: signal.symbol,
      direction: signal.direction,
      totalLotSize,

      orders: splitOrders,

      ordersOpened: 0,
      ordersClosed: 0,
      tpsHit: [],

      currentSL: Array.isArray(signal.stopLoss) ? signal.stopLoss[0] : (signal.stopLoss || 0),
      isAtBreakeven: false,
      isTrailing: false,

      totalProfit: 0,
      averageEntryPrice: Array.isArray(signal.entryPrice) ? signal.entryPrice[0] : (signal.entryPrice || 0),

      createdAt: new Date().toISOString(),
    }

    this.orderGroups.set(groupId, orderGroup)
    this.saveOrderGroup(orderGroup)

    logger.info(`✅ Created ${splitOrders.length} split orders for ${signal.symbol}`)

    return splitOrders
  }

  /**
   * Record that an order from a group was opened
   */
  onOrderOpened(groupId: string, orderNumber: number, ticket: number) {
    const group = this.orderGroups.get(groupId)
    if (!group) {
      logger.warn(`Order group ${groupId} not found`)
      return
    }

    group.ordersOpened++
    if (group.ordersOpened === 1) {
      group.firstOrderOpenedAt = new Date().toISOString()
    }

    // Update order with ticket number
    const order = group.orders.find(o => o.orderNumber === orderNumber)
    if (order) {
      order.comment += ` #${ticket}`
    }

    this.saveOrderGroup(group)
    logger.info(`📈 Order opened: Group ${groupId}, TP${orderNumber}, Ticket #${ticket}`)
  }

  /**
   * Handle a take profit being hit
   */
  async onTPHit(
    groupId: string,
    tpLevel: number,
    orderTicket: number,
    closePrice: number,
    profit: number
  ): Promise<TPHitEvent> {
    const group = this.orderGroups.get(groupId)
    if (!group) {
      logger.warn(`Order group ${groupId} not found`)
      throw new Error(`Order group ${groupId} not found`)
    }

    logger.info(`🎯 TP${tpLevel} HIT for group ${groupId}!`)

    // Update group stats
    group.ordersClosed++
    group.tpsHit.push(tpLevel)
    group.totalProfit += profit
    group.lastOrderClosedAt = new Date().toISOString()

    // Calculate remaining orders and TP levels
    const remainingOrders = group.ordersOpened - group.ordersClosed
    const allTPLevels = group.orders.map(o => o.tpLevel)
    const remainingTPLevels = allTPLevels.filter(tp => !group.tpsHit.includes(tp))

    logger.info(`   Remaining orders: ${remainingOrders}`)
    logger.info(`   Total profit: $${group.totalProfit.toFixed(2)}`)

    // Determine actions
    const shouldMoveToBreakeven =
      this.settings.moveToBreakevenEnabled &&
      !group.isAtBreakeven &&
      tpLevel >= this.settings.moveToBreakevenAfterTP

    const shouldStartTrailing =
      this.settings.trailingStopEnabled &&
      !group.isTrailing &&
      tpLevel >= this.settings.trailingStopAfterTP

    // Create event
    const event: TPHitEvent = {
      signalId: group.signalId,
      groupId,
      tpLevel,
      symbol: group.symbol,
      orderTicket,
      closePrice,
      profit,
      timestamp: new Date().toISOString(),

      remainingOrders,
      remainingTPLevels,

      shouldMoveToBreakeven,
      shouldStartTrailing,
    }

    // Save updated group
    this.saveOrderGroup(group)

    // Emit event
    this.emit('tpHit', event)

    // Handle breakeven
    if (shouldMoveToBreakeven) {
      await this.moveGroupToBreakeven(group)
    }

    // Handle trailing
    if (shouldStartTrailing) {
      await this.startTrailingStop(group)
    }

    return event
  }

  /**
   * Move all remaining orders in a group to breakeven
   */
  private async moveGroupToBreakeven(group: OrderGroup) {
    logger.info(`🔒 Moving group ${group.groupId} to BREAKEVEN`)

    const breakevenPrice = group.averageEntryPrice + (this.settings.breakevenPipsOffset / 10000)

    group.currentSL = breakevenPrice
    group.isAtBreakeven = true
    this.saveOrderGroup(group)

    // Emit modification command to update SL on remaining orders
    this.emit('modifySL', {
      groupId: group.groupId,
      symbol: group.symbol,
      newSL: breakevenPrice,
      reason: `Breakeven after TP${group.tpsHit[group.tpsHit.length - 1]}`,
    })

    logger.info(`✅ Breakeven set at ${breakevenPrice}`)
  }

  /**
   * Start trailing stop for remaining orders
   */
  private async startTrailingStop(group: OrderGroup) {
    logger.info(`📈 Starting trailing stop for group ${group.groupId}`)

    group.isTrailing = true
    this.saveOrderGroup(group)

    // Emit trailing start event
    this.emit('startTrailing', {
      groupId: group.groupId,
      symbol: group.symbol,
      trailingPips: this.settings.trailingStopPips,
      reason: `Trailing after TP${group.tpsHit[group.tpsHit.length - 1]}`,
    })

    logger.info(`✅ Trailing stop started (${this.settings.trailingStopPips} pips)`)
  }

  /**
   * Handle stop loss hit - optionally close all related orders
   */
  onSLHit(groupId: string, orderTicket: number) {
    const group = this.orderGroups.get(groupId)
    if (!group) return

    logger.warn(`🚨 SL HIT for group ${groupId}, order #${orderTicket}`)

    if (this.settings.closeAllIfSLHit) {
      logger.warn(`   Closing all remaining orders in group`)

      // Emit close all for this group
      this.emit('closeGroup', {
        groupId,
        symbol: group.symbol,
        reason: 'Stop loss hit on one order',
      })
    }
  }

  /**
   * Get order group by ID
   */
  getOrderGroup(groupId: string): OrderGroup | null {
    return this.orderGroups.get(groupId) || null
  }

  /**
   * Get all order groups for a symbol
   */
  getOrderGroupsBySymbol(symbol: string): OrderGroup[] {
    return Array.from(this.orderGroups.values()).filter(g => g.symbol === symbol)
  }

  /**
   * Save order group to database
   */
  private saveOrderGroup(group: OrderGroup) {
    try {
      const db = getDatabase()
      db.run(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `, [`order_group_${group.groupId}`, JSON.stringify(group)])

      saveDatabase()
    } catch (error) {
      logger.error('Failed to save order group:', error)
    }
  }

  /**
   * Load order groups from database
   */
  loadOrderGroups() {
    try {
      const db = getDatabase()
      const rows = db.exec(`
        SELECT key, value FROM settings
        WHERE key LIKE 'order_group_%'
      `)

      if (rows.length > 0 && rows[0].values.length > 0) {
        for (const row of rows[0].values) {
          const value = row[1] as string
          const group = JSON.parse(value) as OrderGroup

          // Only load groups from last 7 days
          const createdDate = new Date(group.createdAt)
          const daysSince = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)

          if (daysSince <= 7) {
            this.orderGroups.set(group.groupId, group)
          }
        }

        logger.info(`Loaded ${this.orderGroups.size} order groups`)
      }
    } catch (error) {
      logger.error('Failed to load order groups:', error)
    }
  }

  /**
   * Clean up old order groups (older than 7 days)
   */
  cleanupOldGroups() {
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

    for (const [groupId, group] of this.orderGroups.entries()) {
      const createdDate = new Date(group.createdAt).getTime()

      if (createdDate < sevenDaysAgo) {
        this.orderGroups.delete(groupId)
        logger.info(`Cleaned up old order group: ${groupId}`)
      }
    }
  }
}

// Singleton instance
export const multiTPHandler = new MultiTPHandler()
