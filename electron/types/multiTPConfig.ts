/**
 * Multi-TP (Multiple Take Profit) Configuration Types
 *
 * Handles splitting a single signal into multiple orders
 * with different take profit levels and partial closes
 */

export interface MultiTPSettings {
  enabled: boolean

  // Split Strategy
  splitStrategy: 'equal' | 'weighted' | 'custom'

  // Equal split: divide equally (25%, 25%, 25%, 25% for 4 TPs)
  // Weighted: close more at earlier TPs (40%, 30%, 20%, 10%)
  // Custom: user-defined percentages

  // Weighted split percentages (must add up to 100)
  tp1Percent: number  // Default: 40%
  tp2Percent: number  // Default: 30%
  tp3Percent: number  // Default: 20%
  tp4Percent: number  // Default: 10%
  tp5Percent: number  // Optional

  // Breakeven Settings
  moveToBreakevenEnabled: boolean
  moveToBreakevenAfterTP: number  // Which TP level triggers breakeven (default: 1)
  breakevenPipsOffset: number     // Add X pips to entry for BE (default: 0)

  // Trailing Stop
  trailingStopEnabled: boolean
  trailingStopAfterTP: number     // Which TP level triggers trailing (default: 2)
  trailingStopPips: number        // Trail by X pips

  // Order Management
  closeAllIfSLHit: boolean        // Close all related orders if one hits SL
  linkOrders: boolean             // Link all orders from same signal

  // Advanced
  minLotSize: number              // Minimum lot size per order (broker limit)
  roundLotSize: boolean           // Round to broker lot step
  skipIfTooSmall: boolean         // Skip order if lot size below minimum
}

export interface SplitOrder {
  originalSignalId: string
  orderNumber: number             // 1, 2, 3, 4 (which TP level)
  tpLevel: number                 // Same as orderNumber

  // Order details
  symbol: string
  direction: string
  entryPrice: number
  stopLoss: number
  takeProfit: number              // The specific TP for this order
  lotSize: number                 // Portion of total lot size

  // Metadata
  percentage: number              // What % of total position this represents
  groupId: string                 // Links all orders from same signal
  isLastOrder: boolean            // Is this the final TP order?

  // MT4/MT5 specifics
  magicNumber: number
  comment: string
}

export interface TPHitEvent {
  signalId: string
  groupId: string
  tpLevel: number                 // Which TP was hit (1, 2, 3, 4)
  symbol: string
  orderTicket: number
  closePrice: number
  profit: number
  timestamp: string

  // Remaining orders
  remainingOrders: number         // How many orders still open
  remainingTPLevels: number[]     // Which TP levels remain [2, 3, 4]

  // Actions to take
  shouldMoveToBreakeven: boolean
  shouldStartTrailing: boolean
}

export interface OrderGroup {
  groupId: string
  signalId: string
  symbol: string
  direction: string
  totalLotSize: number

  // Orders in this group
  orders: SplitOrder[]

  // Status
  ordersOpened: number
  ordersClosed: number
  tpsHit: number[]                // Which TP levels have been hit

  // Current state
  currentSL: number
  isAtBreakeven: boolean
  isTrailing: boolean

  // P&L
  totalProfit: number
  averageEntryPrice: number

  // Timestamps
  createdAt: string
  firstOrderOpenedAt?: string
  lastOrderClosedAt?: string
}

export const DEFAULT_MULTI_TP_SETTINGS: MultiTPSettings = {
  enabled: false,  // Disabled - using EA-based partial close instead

  // Split strategy
  splitStrategy: 'weighted',

  // Weighted split (adds up to 100%)
  tp1Percent: 40,
  tp2Percent: 30,
  tp3Percent: 20,
  tp4Percent: 10,
  tp5Percent: 0,

  // Breakeven
  moveToBreakevenEnabled: true,
  moveToBreakevenAfterTP: 1,      // Move to BE after TP1 hits
  breakevenPipsOffset: 0,         // No offset, exactly at entry

  // Trailing
  trailingStopEnabled: false,     // Disabled by default
  trailingStopAfterTP: 2,
  trailingStopPips: 20,

  // Order management
  closeAllIfSLHit: true,
  linkOrders: true,

  // Advanced
  minLotSize: 0.01,
  roundLotSize: true,
  skipIfTooSmall: true,
}

/**
 * Helper to calculate lot sizes based on split strategy
 */
export function calculateLotSizes(
  totalLotSize: number,
  tpCount: number,
  settings: MultiTPSettings
): number[] {
  const lotSizes: number[] = []

  if (settings.splitStrategy === 'equal') {
    // Equal split
    const perOrderLot = totalLotSize / tpCount
    for (let i = 0; i < tpCount; i++) {
      lotSizes.push(perOrderLot)
    }
  } else if (settings.splitStrategy === 'weighted') {
    // Weighted split based on percentages
    const percentages = [
      settings.tp1Percent,
      settings.tp2Percent,
      settings.tp3Percent,
      settings.tp4Percent,
      settings.tp5Percent,
    ].slice(0, tpCount)

    // Normalize to ensure they add up to 100
    const sum = percentages.reduce((a, b) => a + b, 0)
    const normalized = percentages.map(p => p / sum)

    for (const percent of normalized) {
      lotSizes.push(totalLotSize * percent)
    }
  }

  // Round to broker lot step if enabled
  if (settings.roundLotSize) {
    return lotSizes.map(lot => Math.round(lot * 100) / 100)
  }

  return lotSizes
}

/**
 * Helper to generate unique group ID for linked orders
 */
export function generateGroupId(): string {
  return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
