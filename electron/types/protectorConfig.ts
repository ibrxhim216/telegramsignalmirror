/**
 * TSC Protector Configuration Types
 *
 * Protects trading accounts with daily profit/loss limits,
 * trade count limits, and FIFO mode for prop firms
 */

export interface ProtectorSettings {
  // General
  enabled: boolean
  accountNumber: string
  platform: string // MT4, MT5, cTrader, etc.

  // Profit Target
  dailyProfitTargetEnabled: boolean
  dailyProfitTarget: number // Amount in account currency
  dailyProfitTargetPercent: number // Percentage of balance
  useProfitPercent: boolean // Use % instead of fixed amount

  // Loss Limit
  dailyLossLimitEnabled: boolean
  dailyLossLimit: number // Amount in account currency
  dailyLossLimitPercent: number // Percentage of balance
  useLossPercent: boolean // Use % instead of fixed amount

  // Trade Count Limit
  maxTradesPerDayEnabled: boolean
  maxTradesPerDay: number

  // FIFO Mode (for prop firms)
  fifoModeEnabled: boolean
  fifoCloseOldestFirst: boolean

  // Actions on Limit Hit
  closeAllOnProfitTarget: boolean
  closeAllOnLossLimit: boolean
  stopNewTradesOnLimit: boolean
  notifyOnLimitHit: boolean

  // Reset Settings
  resetTime: string // HH:MM format (e.g., "00:00" for midnight)
  timezone: string // e.g., "UTC", "America/New_York"

  // Equity Protection
  equityProtectionEnabled: boolean
  minEquityPercent: number // Stop trading if equity drops below % of balance

  // Advanced
  pauseTradingUntilReset: boolean // If true, no new trades until next reset
  allowCloseOnlyMode: boolean // Allow closing existing trades but no new ones

  // Metadata
  createdAt: string
  updatedAt: string
}

export interface DailyProtectorStats {
  accountNumber: string
  date: string // YYYY-MM-DD format
  tradesOpened: number
  tradesClosed: number
  profitLoss: number
  profitLossPercent: number
  limitHit: boolean
  limitType?: 'profit' | 'loss' | 'trades' | 'equity'
  resetAt: string
  lastUpdated: string
}

export interface ProtectorStatus {
  accountNumber: string
  isActive: boolean
  todayStats: DailyProtectorStats
  canOpenNewTrade: boolean
  reason?: string // Why new trades are blocked
  timeUntilReset: number // Milliseconds until next reset
  limits: {
    profitTarget: number | null
    profitReached: number
    profitRemaining: number | null
    lossLimit: number | null
    lossReached: number
    lossRemaining: number | null
    tradesLimit: number | null
    tradesOpened: number
    tradesRemaining: number | null
  }
}

export const DEFAULT_PROTECTOR_SETTINGS: Omit<ProtectorSettings, 'accountNumber' | 'platform' | 'createdAt' | 'updatedAt'> = {
  enabled: false,

  // Profit Target (disabled by default)
  dailyProfitTargetEnabled: false,
  dailyProfitTarget: 500,
  dailyProfitTargetPercent: 5,
  useProfitPercent: false,

  // Loss Limit (enabled by default - important!)
  dailyLossLimitEnabled: true,
  dailyLossLimit: 200,
  dailyLossLimitPercent: 2,
  useLossPercent: true,

  // Trade Count
  maxTradesPerDayEnabled: false,
  maxTradesPerDay: 10,

  // FIFO
  fifoModeEnabled: false,
  fifoCloseOldestFirst: true,

  // Actions
  closeAllOnProfitTarget: true,
  closeAllOnLossLimit: true,
  stopNewTradesOnLimit: true,
  notifyOnLimitHit: true,

  // Reset
  resetTime: '00:00',
  timezone: 'UTC',

  // Equity
  equityProtectionEnabled: false,
  minEquityPercent: 80,

  // Advanced
  pauseTradingUntilReset: true,
  allowCloseOnlyMode: true,
}

/**
 * Event emitted when protector limit is hit
 */
export interface ProtectorLimitHitEvent {
  accountNumber: string
  limitType: 'profit' | 'loss' | 'trades' | 'equity'
  currentValue: number
  limitValue: number
  timestamp: string
  actionTaken: 'close_all' | 'stop_new_trades' | 'notify_only'
}

/**
 * Trade data for FIFO processing
 */
export interface FIFOTradeInfo {
  ticket: number
  openTime: string
  symbol: string
  lots: number
  profit: number
}
