import { EnhancedParsedSignal } from './enhancedSignalParser'
import { ChannelConfig } from '../types/channelConfig'
import { logger } from '../utils/logger'

/**
 * Time Filter - Check if current time/day is allowed for trading
 */
export function passesTimeFilter(timeFilter: ChannelConfig['timeFilter']): boolean {
  if (!timeFilter.enableTimeFilter) return true

  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sunday, 1=Monday, etc.
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  // Check day of week
  const dayAllowed = [
    timeFilter.tradeOnSunday,    // 0
    timeFilter.tradeOnMonday,    // 1
    timeFilter.tradeOnTuesday,   // 2
    timeFilter.tradeOnWednesday, // 3
    timeFilter.tradeOnThursday,  // 4
    timeFilter.tradeOnFriday,    // 5
    timeFilter.tradeOnSaturday   // 6
  ][dayOfWeek]

  if (!dayAllowed) {
    logger.debug(`Trade rejected: ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek]} not allowed`)
    return false
  }

  // Check time range
  if (currentTime < timeFilter.startTime || currentTime > timeFilter.endTime) {
    logger.debug(`Trade rejected: Time ${currentTime} outside range ${timeFilter.startTime}-${timeFilter.endTime}`)
    return false
  }

  return true
}

/**
 * Trade Filters - Apply skip conditions (ignore without SL/TP, etc.)
 */
export function applyTradeFilters(
  signal: EnhancedParsedSignal,
  config: ChannelConfig
): EnhancedParsedSignal | null {
  const filters = config.tradeFilters

  // Skip if no SL and filter is enabled
  if (filters.ignoreWithoutSL && !signal.stopLoss) {
    logger.debug('Signal rejected: No Stop Loss')
    return null
  }

  // Skip if no TP and filter is enabled
  if (filters.ignoreWithoutTP && (!signal.takeProfits || signal.takeProfits.length === 0)) {
    logger.debug('Signal rejected: No Take Profit')
    return null
  }

  // Force market execution if enabled
  if (filters.forceMarketExecution) {
    if (signal.direction.includes('STOP') || signal.direction.includes('LIMIT')) {
      signal.direction = signal.direction.includes('SELL') ? 'SELL' : 'BUY'
      signal.forceMarket = true
      logger.debug('Forcing market execution for pending order')
    }
  }

  return signal
}

/**
 * SL/TP Override - Replace signal SL/TP with predefined values or calculate by RR
 */
export function applySLTPOverrides(
  signal: EnhancedParsedSignal,
  config: ChannelConfig
): EnhancedParsedSignal {
  const override = config.sltpOverride
  const entryPrice = Array.isArray(signal.entryPrice) ? signal.entryPrice[0] : signal.entryPrice

  if (!entryPrice) return signal

  // Override SL
  if (override.slOverrideMode === 'use_predefined' && override.predefinedSL > 0) {
    const pipValue = getPipValue(signal.symbol)
    const isBuy = signal.direction.includes('BUY')
    signal.stopLoss = entryPrice + (override.predefinedSL * pipValue * (isBuy ? -1 : 1))
    logger.debug(`SL overridden: ${signal.stopLoss} (${override.predefinedSL} pips)`)
  }

  // Override TP or use RR mode
  if (override.tpOverrideMode === 'use_predefined' || override.enableRRMode) {
    const isBuy = signal.direction.includes('BUY')
    const pipValue = getPipValue(signal.symbol)

    if (override.enableRRMode && signal.stopLoss) {
      // Calculate TP based on RR ratio
      const slDistance = Math.abs(entryPrice - signal.stopLoss)
      signal.takeProfits = override.rrRatio.map(rr => {
        const tpDistance = slDistance * rr
        return entryPrice + tpDistance * (isBuy ? 1 : -1)
      }).filter(tp => tp > 0)
      logger.debug(`TP calculated by RR: ${signal.takeProfits.length} levels`)
    } else {
      // Use predefined TPs
      signal.takeProfits = override.predefinedTP
        .filter(tp => tp > 0)
        .map(tpPips => entryPrice + (tpPips * pipValue * (isBuy ? 1 : -1)))
      logger.debug(`TP overridden: ${signal.takeProfits.length} levels`)
    }
  }

  // Calculate spread in SL/TP if enabled
  if (override.calculateSpreadInSLTP) {
    // Spread calculation will be handled by EA based on live market data
    logger.debug('Spread calculation enabled (will be applied by EA)')
  }

  return signal
}

/**
 * Signal Modifications - Reverse, adjust entry/SL/TP by pips
 */
export function applyModifications(
  signal: EnhancedParsedSignal,
  config: ChannelConfig
): EnhancedParsedSignal {
  const mod = config.modification
  const pipValue = getPipValue(signal.symbol)

  // Reverse signal direction
  if (mod.reverseSignal) {
    if (signal.direction === 'BUY') signal.direction = 'SELL'
    else if (signal.direction === 'SELL') signal.direction = 'BUY'
    else if (signal.direction === 'BUY STOP') signal.direction = 'SELL STOP'
    else if (signal.direction === 'SELL STOP') signal.direction = 'BUY STOP'
    else if (signal.direction === 'BUY LIMIT') signal.direction = 'SELL LIMIT'
    else if (signal.direction === 'SELL LIMIT') signal.direction = 'BUY LIMIT'

    if (mod.reverseSLTPInPips && signal.entryPrice && signal.stopLoss) {
      // Flip SL and TP while keeping pip distances
      const entryPrice = Array.isArray(signal.entryPrice) ? signal.entryPrice[0] : signal.entryPrice
      const slDistance = Math.abs(entryPrice - signal.stopLoss) / pipValue
      const oldSL = signal.stopLoss
      signal.stopLoss = entryPrice + (slDistance * pipValue * (signal.direction.includes('SELL') ? 1 : -1))

      if (signal.takeProfits && signal.takeProfits.length > 0) {
        signal.takeProfits = signal.takeProfits.map(tp => {
          const tpDistance = Math.abs(entryPrice - tp) / pipValue
          return entryPrice + (tpDistance * pipValue * (signal.direction.includes('SELL') ? -1 : 1))
        })
      }
    }

    logger.debug(`Signal reversed: ${signal.direction}`)
  }

  // Modify entry price
  if (mod.entryModificationPips !== 0 && signal.entryPrice) {
    const adjustment = mod.entryModificationPips * pipValue
    if (Array.isArray(signal.entryPrice)) {
      signal.entryPrice = signal.entryPrice.map(e => e + adjustment)
    } else {
      signal.entryPrice = signal.entryPrice + adjustment
    }
    logger.debug(`Entry modified by ${mod.entryModificationPips} pips`)
  }

  // Modify SL
  if (mod.slModificationPips !== 0 && signal.stopLoss) {
    signal.stopLoss = signal.stopLoss + (mod.slModificationPips * pipValue)
    logger.debug(`SL modified by ${mod.slModificationPips} pips`)
  }

  // Modify TP
  if (mod.tpModificationPips !== 0 && signal.takeProfits) {
    const adjustment = mod.tpModificationPips * pipValue
    signal.takeProfits = signal.takeProfits.map(tp => tp + adjustment)
    logger.debug(`TP modified by ${mod.tpModificationPips} pips`)
  }

  return signal
}

/**
 * Symbol Mapping - Apply prefix/suffix, check whitelist/blacklist
 */
export function applySymbolMapping(
  signal: EnhancedParsedSignal,
  config: ChannelConfig
): EnhancedParsedSignal | null {
  const mapping = config.symbolMapping

  // Check excluded symbols
  if (mapping.excludedSymbols.includes(signal.symbol)) {
    logger.debug(`Symbol ${signal.symbol} is excluded`)
    return null
  }

  // Check whitelist (if defined)
  if (mapping.symbolsToTrade.length > 0 && !mapping.symbolsToTrade.includes(signal.symbol)) {
    logger.debug(`Symbol ${signal.symbol} not in whitelist`)
    return null
  }

  // Apply prefix/suffix if enabled
  if (mapping.enableMapping) {
    const shouldSkip = mapping.skipSuffixPrefixList.includes(signal.symbol)
    if (!shouldSkip) {
      const originalSymbol = signal.symbol
      signal.symbol = mapping.symbolPrefix + signal.symbol + mapping.symbolSuffix
      logger.debug(`Symbol mapped: ${originalSymbol} → ${signal.symbol}`)
    }
  }

  return signal
}

/**
 * Get pip value for a symbol
 */
function getPipValue(symbol: string): number {
  if (symbol.includes('JPY')) return 0.01
  if (symbol.includes('XAU') || symbol.includes('GOLD')) return 0.1
  if (symbol.includes('XAG') || symbol.includes('SILVER')) return 0.01
  if (symbol.includes('US30') || symbol.includes('NAS100') || symbol.includes('SPX500')) return 1.0
  if (symbol.includes('BTC')) return 1.0
  if (symbol.includes('ETH')) return 0.1
  return 0.0001 // Default forex
}
