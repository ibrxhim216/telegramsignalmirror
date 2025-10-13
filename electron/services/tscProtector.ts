/**
 * TSC Protector Service
 *
 * Protects trading accounts with daily profit/loss limits,
 * trade count limits, and FIFO mode for prop firms
 */

import { EventEmitter } from 'events'
import { getDatabase, saveDatabase } from '../database'
import {
  ProtectorSettings,
  DailyProtectorStats,
  ProtectorStatus,
  ProtectorLimitHitEvent,
  FIFOTradeInfo,
  DEFAULT_PROTECTOR_SETTINGS,
} from '../types/protectorConfig'
import { ActiveTrade } from './tradeManager'
import { logger } from '../utils/logger'

export class TSCProtector extends EventEmitter {
  private settings: Map<string, ProtectorSettings> = new Map()
  private dailyStats: Map<string, DailyProtectorStats> = new Map()
  private resetTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    super()
    // Don't load from database in constructor - will be initialized later
  }

  /**
   * Initialize protector service (call after database is ready)
   */
  init() {
    this.loadSettings()
    this.loadDailyStats()
    this.scheduleResets()
  }

  /**
   * Load protector settings from database
   */
  private loadSettings() {
    try {
      const db = getDatabase()
      const rows = db.exec(`
        SELECT key, value FROM settings
        WHERE key LIKE 'protector_%'
      `)

      if (rows.length > 0 && rows[0].values.length > 0) {
        for (const row of rows[0].values) {
          const key = row[0] as string
          const value = row[1] as string

          // Extract account number from key: protector_MT4_12345
          const match = key.match(/protector_(.+)_(.+)/)
          if (match) {
            const platform = match[1]
            const accountNumber = match[2]
            const accountKey = `${platform}_${accountNumber}`

            try {
              const settings = JSON.parse(value) as ProtectorSettings
              this.settings.set(accountKey, settings)
              logger.info(`Loaded protector settings for ${accountKey}`)
            } catch (error) {
              logger.error(`Failed to parse protector settings for ${accountKey}:`, error)
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load protector settings:', error)
    }
  }

  /**
   * Load daily stats from database
   */
  private loadDailyStats() {
    try {
      const db = getDatabase()
      const today = new Date().toISOString().split('T')[0]

      const rows = db.exec(`
        SELECT key, value FROM settings
        WHERE key LIKE 'protector_stats_%'
      `)

      if (rows.length > 0 && rows[0].values.length > 0) {
        for (const row of rows[0].values) {
          const key = row[0] as string
          const value = row[1] as string

          try {
            const stats = JSON.parse(value) as DailyProtectorStats

            // Only load today's stats
            if (stats.date === today) {
              const accountKey = `${stats.accountNumber}`
              this.dailyStats.set(accountKey, stats)
              logger.info(`Loaded daily stats for ${accountKey}: ${stats.tradesOpened} trades, P/L: ${stats.profitLoss}`)
            }
          } catch (error) {
            logger.error(`Failed to parse daily stats for ${key}:`, error)
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load daily stats:', error)
    }
  }

  /**
   * Save protector settings to database
   */
  saveSettings(settings: ProtectorSettings): boolean {
    try {
      const accountKey = `${settings.platform}_${settings.accountNumber}`
      const db = getDatabase()

      db.run(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `, [`protector_${accountKey}`, JSON.stringify(settings)])

      saveDatabase()
      this.settings.set(accountKey, settings)

      logger.info(`Saved protector settings for ${accountKey}`)
      return true
    } catch (error) {
      logger.error('Failed to save protector settings:', error)
      return false
    }
  }

  /**
   * Get protector settings for an account
   */
  getSettings(accountNumber: string, platform: string = 'MT4'): ProtectorSettings | null {
    const accountKey = `${platform}_${accountNumber}`
    return this.settings.get(accountKey) || null
  }

  /**
   * Create default settings for an account
   */
  createDefaultSettings(accountNumber: string, platform: string = 'MT4'): ProtectorSettings {
    const settings: ProtectorSettings = {
      ...DEFAULT_PROTECTOR_SETTINGS,
      accountNumber,
      platform,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.saveSettings(settings)
    return settings
  }

  /**
   * Get or create daily stats for an account
   */
  private getDailyStats(accountNumber: string): DailyProtectorStats {
    const today = new Date().toISOString().split('T')[0]
    let stats = this.dailyStats.get(accountNumber)

    // Create new stats if doesn't exist or date changed
    if (!stats || stats.date !== today) {
      stats = {
        accountNumber,
        date: today,
        tradesOpened: 0,
        tradesClosed: 0,
        profitLoss: 0,
        profitLossPercent: 0,
        limitHit: false,
        resetAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      }
      this.dailyStats.set(accountNumber, stats)
      this.saveDailyStats(accountNumber)
    }

    return stats
  }

  /**
   * Save daily stats to database
   */
  private saveDailyStats(accountNumber: string) {
    try {
      const stats = this.dailyStats.get(accountNumber)
      if (!stats) return

      const db = getDatabase()
      db.run(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `, [`protector_stats_${accountNumber}`, JSON.stringify(stats)])

      saveDatabase()
    } catch (error) {
      logger.error('Failed to save daily stats:', error)
    }
  }

  /**
   * Check if a new trade can be opened
   */
  canOpenTrade(accountNumber: string, platform: string = 'MT4'): { allowed: boolean; reason?: string } {
    const accountKey = `${platform}_${accountNumber}`
    const settings = this.settings.get(accountKey)

    if (!settings || !settings.enabled) {
      return { allowed: true }
    }

    const stats = this.getDailyStats(accountNumber)

    // Check if already hit a limit
    if (stats.limitHit && settings.pauseTradingUntilReset && !settings.allowCloseOnlyMode) {
      return {
        allowed: false,
        reason: `Daily limit already hit (${stats.limitType}). Trading paused until reset.`,
      }
    }

    // Check max trades per day
    if (settings.maxTradesPerDayEnabled) {
      if (stats.tradesOpened >= settings.maxTradesPerDay) {
        return {
          allowed: false,
          reason: `Maximum trades per day reached (${settings.maxTradesPerDay})`,
        }
      }
    }

    // Check daily loss limit
    if (settings.dailyLossLimitEnabled && stats.profitLoss < 0) {
      const lossLimit = settings.useLossPercent
        ? (settings.dailyLossLimitPercent / 100) * this.getAccountBalance(accountNumber)
        : settings.dailyLossLimit

      if (Math.abs(stats.profitLoss) >= lossLimit) {
        return {
          allowed: false,
          reason: `Daily loss limit reached ($${Math.abs(stats.profitLoss).toFixed(2)} / $${lossLimit.toFixed(2)})`,
        }
      }
    }

    // Check daily profit target (stop trading after hitting target)
    if (settings.dailyProfitTargetEnabled && settings.stopNewTradesOnLimit) {
      const profitTarget = settings.useProfitPercent
        ? (settings.dailyProfitTargetPercent / 100) * this.getAccountBalance(accountNumber)
        : settings.dailyProfitTarget

      if (stats.profitLoss >= profitTarget) {
        return {
          allowed: false,
          reason: `Daily profit target reached ($${stats.profitLoss.toFixed(2)} / $${profitTarget.toFixed(2)})`,
        }
      }
    }

    return { allowed: true }
  }

  /**
   * Record a trade opening
   */
  onTradeOpened(trade: ActiveTrade) {
    const stats = this.getDailyStats(trade.accountNumber)
    stats.tradesOpened++
    stats.lastUpdated = new Date().toISOString()
    this.saveDailyStats(trade.accountNumber)

    logger.info(`📊 TSC Protector: Trade opened. Total today: ${stats.tradesOpened}`)

    // Check limits after opening
    this.checkLimits(trade.accountNumber, trade.platform)
  }

  /**
   * Record a trade closing
   */
  onTradeClosed(trade: ActiveTrade, profit: number) {
    const stats = this.getDailyStats(trade.accountNumber)
    stats.tradesClosed++
    stats.profitLoss += profit
    stats.lastUpdated = new Date().toISOString()

    // Calculate P/L percent
    const balance = this.getAccountBalance(trade.accountNumber)
    if (balance > 0) {
      stats.profitLossPercent = (stats.profitLoss / balance) * 100
    }

    this.saveDailyStats(trade.accountNumber)

    logger.info(`📊 TSC Protector: Trade closed with $${profit.toFixed(2)}. Today's P/L: $${stats.profitLoss.toFixed(2)} (${stats.profitLossPercent.toFixed(2)}%)`)

    // Check limits after closing
    this.checkLimits(trade.accountNumber, trade.platform)
  }

  /**
   * Check all limits and trigger actions if needed
   */
  private checkLimits(accountNumber: string, platform: string = 'MT4') {
    const accountKey = `${platform}_${accountNumber}`
    const settings = this.settings.get(accountKey)

    if (!settings || !settings.enabled) {
      return
    }

    const stats = this.getDailyStats(accountNumber)
    const balance = this.getAccountBalance(accountNumber)

    // Check profit target
    if (settings.dailyProfitTargetEnabled) {
      const profitTarget = settings.useProfitPercent
        ? (settings.dailyProfitTargetPercent / 100) * balance
        : settings.dailyProfitTarget

      if (stats.profitLoss >= profitTarget) {
        this.handleLimitHit(accountNumber, platform, 'profit', stats.profitLoss, profitTarget, settings)
        return
      }
    }

    // Check loss limit
    if (settings.dailyLossLimitEnabled && stats.profitLoss < 0) {
      const lossLimit = settings.useLossPercent
        ? (settings.dailyLossLimitPercent / 100) * balance
        : settings.dailyLossLimit

      if (Math.abs(stats.profitLoss) >= lossLimit) {
        this.handleLimitHit(accountNumber, platform, 'loss', Math.abs(stats.profitLoss), lossLimit, settings)
        return
      }
    }

    // Check trade count limit
    if (settings.maxTradesPerDayEnabled) {
      if (stats.tradesOpened >= settings.maxTradesPerDay) {
        this.handleLimitHit(accountNumber, platform, 'trades', stats.tradesOpened, settings.maxTradesPerDay, settings)
        return
      }
    }
  }

  /**
   * Handle limit hit - trigger appropriate action
   */
  private handleLimitHit(
    accountNumber: string,
    platform: string,
    limitType: 'profit' | 'loss' | 'trades' | 'equity',
    currentValue: number,
    limitValue: number,
    settings: ProtectorSettings
  ) {
    const stats = this.getDailyStats(accountNumber)

    // Prevent multiple triggers
    if (stats.limitHit && stats.limitType === limitType) {
      return
    }

    stats.limitHit = true
    stats.limitType = limitType
    this.saveDailyStats(accountNumber)

    logger.warn(`⚠️ TSC PROTECTOR: ${limitType.toUpperCase()} LIMIT HIT for ${accountNumber}`)
    logger.warn(`   Current: ${currentValue.toFixed(2)}, Limit: ${limitValue.toFixed(2)}`)

    // Determine action
    let actionTaken: 'close_all' | 'stop_new_trades' | 'notify_only' = 'notify_only'

    if (limitType === 'profit' && settings.closeAllOnProfitTarget) {
      actionTaken = 'close_all'
      this.closeAllPositions(accountNumber, platform, `Profit target hit: $${currentValue.toFixed(2)}`)
    } else if (limitType === 'loss' && settings.closeAllOnLossLimit) {
      actionTaken = 'close_all'
      this.closeAllPositions(accountNumber, platform, `Loss limit hit: $${currentValue.toFixed(2)}`)
    } else if (settings.stopNewTradesOnLimit) {
      actionTaken = 'stop_new_trades'
      logger.warn(`🚫 New trades stopped for ${accountNumber} until reset`)
    }

    // Emit event
    const event: ProtectorLimitHitEvent = {
      accountNumber,
      limitType,
      currentValue,
      limitValue,
      timestamp: new Date().toISOString(),
      actionTaken,
    }

    this.emit('limitHit', event)

    if (settings.notifyOnLimitHit) {
      this.emit('notification', {
        type: 'warning',
        title: 'TSC Protector Alert',
        message: `${limitType.toUpperCase()} limit hit for account ${accountNumber}. Action: ${actionTaken.replace('_', ' ')}`,
      })
    }
  }

  /**
   * Close all positions for an account
   */
  private closeAllPositions(accountNumber: string, platform: string, reason: string) {
    logger.warn(`🛑 TSC PROTECTOR: Closing all positions for ${accountNumber}`)
    logger.warn(`   Reason: ${reason}`)

    // Emit close all command (will be picked up by modification handler)
    this.emit('closeAll', {
      accountNumber,
      platform,
      reason,
    })
  }

  /**
   * Get protector status for an account
   */
  getStatus(accountNumber: string, platform: string = 'MT4'): ProtectorStatus {
    const accountKey = `${platform}_${accountNumber}`
    const settings = this.settings.get(accountKey)
    const stats = this.getDailyStats(accountNumber)
    const balance = this.getAccountBalance(accountNumber)

    const canOpenResult = this.canOpenTrade(accountNumber, platform)

    // Calculate limits
    const profitTarget = settings?.dailyProfitTargetEnabled
      ? settings.useProfitPercent
        ? (settings.dailyProfitTargetPercent / 100) * balance
        : settings.dailyProfitTarget
      : null

    const lossLimit = settings?.dailyLossLimitEnabled
      ? settings.useLossPercent
        ? (settings.dailyLossLimitPercent / 100) * balance
        : settings.dailyLossLimit
      : null

    const tradesLimit = settings?.maxTradesPerDayEnabled ? settings.maxTradesPerDay : null

    // Calculate time until reset
    const timeUntilReset = this.getTimeUntilReset(settings?.resetTime || '00:00', settings?.timezone || 'UTC')

    return {
      accountNumber,
      isActive: settings?.enabled || false,
      todayStats: stats,
      canOpenNewTrade: canOpenResult.allowed,
      reason: canOpenResult.reason,
      timeUntilReset,
      limits: {
        profitTarget,
        profitReached: stats.profitLoss > 0 ? stats.profitLoss : 0,
        profitRemaining: profitTarget ? Math.max(0, profitTarget - stats.profitLoss) : null,
        lossLimit,
        lossReached: stats.profitLoss < 0 ? Math.abs(stats.profitLoss) : 0,
        lossRemaining: lossLimit ? Math.max(0, lossLimit - Math.abs(stats.profitLoss)) : null,
        tradesLimit,
        tradesOpened: stats.tradesOpened,
        tradesRemaining: tradesLimit ? Math.max(0, tradesLimit - stats.tradesOpened) : null,
      },
    }
  }

  /**
   * Schedule daily resets
   */
  private scheduleResets() {
    // Schedule reset check every minute
    setInterval(() => {
      this.checkResets()
    }, 60000)
  }

  /**
   * Check if any accounts need to be reset
   */
  private checkResets() {
    const now = new Date()
    const currentTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`

    for (const [accountKey, settings] of this.settings) {
      if (settings.enabled && settings.resetTime === currentTime) {
        logger.info(`🔄 TSC Protector: Resetting stats for ${accountKey}`)
        this.resetDailyStats(settings.accountNumber)
      }
    }
  }

  /**
   * Reset daily stats for an account
   */
  private resetDailyStats(accountNumber: string) {
    this.dailyStats.delete(accountNumber)
    this.getDailyStats(accountNumber) // This will create fresh stats
    logger.info(`✅ Daily stats reset for ${accountNumber}`)

    this.emit('statsReset', { accountNumber, timestamp: new Date().toISOString() })
  }

  /**
   * Get account balance (placeholder - should integrate with actual balance tracking)
   */
  private getAccountBalance(accountNumber: string): number {
    // TODO: Integrate with actual account balance tracking
    // For now, return a default value
    return 10000
  }

  /**
   * Calculate milliseconds until next reset
   */
  private getTimeUntilReset(resetTime: string, timezone: string): number {
    const now = new Date()
    const [hours, minutes] = resetTime.split(':').map(Number)

    const resetDate = new Date(now)
    resetDate.setUTCHours(hours, minutes, 0, 0)

    // If reset time has passed today, schedule for tomorrow
    if (resetDate.getTime() <= now.getTime()) {
      resetDate.setDate(resetDate.getDate() + 1)
    }

    return resetDate.getTime() - now.getTime()
  }

  /**
   * Get FIFO ordered trades (oldest first)
   */
  getFIFOOrderedTrades(trades: FIFOTradeInfo[]): FIFOTradeInfo[] {
    return trades.sort((a, b) => {
      const timeA = new Date(a.openTime).getTime()
      const timeB = new Date(b.openTime).getTime()
      return timeA - timeB
    })
  }
}

// Singleton instance
export const tscProtector = new TSCProtector()
