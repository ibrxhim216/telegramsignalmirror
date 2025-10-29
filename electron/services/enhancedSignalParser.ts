import { ChannelConfig } from '../types/channelConfig'
import { SignalParser, ParsedSignal } from './signalParser'
import { logger } from '../utils/logger'
import {
  passesTimeFilter,
  applyTradeFilters,
  applySLTPOverrides,
  applyModifications,
  applySymbolMapping
} from './signalFilters'

export type SignalType = 'new' | 'update'

export interface ParsedUpdate {
  type: 'closeTP1' | 'closeTP2' | 'closeTP3' | 'closeTP4' | 'closeFull' | 'closeHalf' | 'closePartial' |
        'breakEven' | 'setTP1' | 'setTP2' | 'setTP3' | 'setTP4' | 'setTP5' | 'setTP' | 'setSL' |
        'deletePending' | 'layer' | 'closeAll' | 'deleteAll' | 'removeSL'
  value?: number | number[]  // New value if setting TP/SL
  percentage?: number        // For partial close
  originalSignalId?: number  // Reference to original signal
}

export interface EnhancedParsedSignal extends ParsedSignal {
  signalType: SignalType
  update?: ParsedUpdate
  isIgnored: boolean
  isSkipped: boolean
  forceMarket: boolean
  delayMs: number
}

export class EnhancedSignalParser {
  private aiParser: SignalParser

  constructor() {
    this.aiParser = new SignalParser()
  }

  /**
   * Parse a signal using channel-specific keyword configuration
   */
  parse(text: string, config: ChannelConfig): EnhancedParsedSignal | null {
    try {
      const normalized = text.toUpperCase()

      // Check if signal should be ignored or skipped
      if (this.matchesKeywords(normalized, config.additionalKeywords.ignoreKeyword)) {
        logger.debug('Signal ignored by ignore keyword')
        return null
      }

      if (this.matchesKeywords(normalized, config.additionalKeywords.skipKeyword)) {
        logger.debug('Signal skipped by skip keyword')
        return null
      }

      // Check time filter
      if (!passesTimeFilter(config.timeFilter)) {
        logger.debug('Signal rejected by time filter')
        return null
      }

      // Check if it's an update command
      const updateType = this.detectUpdateType(normalized, config)
      if (updateType) {
        return this.parseUpdate(text, normalized, config, updateType)
      }

      // Parse as new signal
      let signal = this.parseNewSignal(text, normalized, config)
      if (!signal) return null

      // Apply all modifications and filters
      signal = applyTradeFilters(signal, config)
      if (!signal) return null

      signal = applySLTPOverrides(signal, config)
      signal = applyModifications(signal, config)
      signal = applySymbolMapping(signal, config)
      if (!signal) return null

      return signal
    } catch (error: any) {
      logger.error('Enhanced signal parsing error:', error)
      return null
    }
  }

  /**
   * Parse a new trading signal
   */
  private parseNewSignal(originalText: string, normalized: string, config: ChannelConfig): EnhancedParsedSignal | null {
    // Extract symbol (from AI parser or custom logic)
    const symbol = this.extractSymbol(normalized)
    if (!symbol) {
      logger.debug('No symbol found')

      // Fallback to AI parser if enabled
      if (config.useAIParser) {
        const aiResult = this.aiParser.parse(originalText)
        if (aiResult) {
          return this.convertToEnhanced(aiResult, config)
        }
      }

      return null
    }

    // Extract direction using configured keywords
    const direction = this.extractDirection(normalized, config)
    if (!direction) {
      logger.debug('No direction found')

      // Fallback to AI parser
      if (config.useAIParser) {
        const aiResult = this.aiParser.parse(originalText)
        if (aiResult) {
          return this.convertToEnhanced(aiResult, config)
        }
      }

      return null
    }

    // Extract entry price using configured keywords
    let entryPrice = this.extractEntryPrice(normalized, config)

    // Extract stop loss using configured keywords (may be pips, indicated by negative value)
    let stopLoss = this.extractStopLoss(normalized, config)

    // Extract take profits using configured keywords (may be pips, indicated by negative values)
    let takeProfits = this.extractTakeProfits(normalized, config)

    // Convert pips to actual prices if entry price is available
    if (entryPrice !== undefined && !Array.isArray(entryPrice)) {
      // Convert SL from pips to price
      stopLoss = this.convertSlPipsToPrice(stopLoss, symbol, entryPrice, direction)

      // Convert TP from pips to price
      takeProfits = this.convertTpPipsToPrice(takeProfits, symbol, entryPrice, direction)
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(symbol, direction, entryPrice, stopLoss, takeProfits)

    if (confidence < 0.4) {
      logger.debug('Low confidence signal')

      // Try AI parser as fallback
      if (config.useAIParser) {
        const aiResult = this.aiParser.parse(originalText)
        if (aiResult && aiResult.confidence >= 0.5) {
          return this.convertToEnhanced(aiResult, config)
        }
      }

      return null
    }

    // Check for force market order
    const forceMarket = this.matchesKeywords(normalized, config.additionalKeywords.marketOrder)

    return {
      symbol,
      direction,
      entryPrice,
      stopLoss,
      takeProfits,
      confidence,
      rawText: originalText,
      signalType: 'new',
      isIgnored: false,
      isSkipped: false,
      forceMarket,
      delayMs: config.advancedSettings.delayInMsec
    }
  }

  /**
   * Parse an update/modification command
   */
  private parseUpdate(originalText: string, normalized: string, config: ChannelConfig, updateType: string): EnhancedParsedSignal | null {
    const update: ParsedUpdate = {
      type: updateType as any
    }

    // Extract new values if it's a set command
    if (updateType.startsWith('set')) {
      const values = this.extractNumbers(normalized)
      if (values.length > 0) {
        update.value = values.length === 1 ? values[0] : values
      }
    }

    // Extract percentage for partial close
    if (updateType === 'closePartial') {
      const percentMatch = normalized.match(/(\d+)\s*%/)
      if (percentMatch) {
        update.percentage = parseFloat(percentMatch[1])
      }
    }

    return {
      symbol: '',  // Will be matched to existing trade
      direction: 'BUY',  // Placeholder
      confidence: 1.0,
      rawText: originalText,
      signalType: 'update',
      update,
      isIgnored: false,
      isSkipped: false,
      forceMarket: false,
      delayMs: config.advancedSettings.delayInMsec
    }
  }

  /**
   * Detect if message is an update command
   */
  private detectUpdateType(text: string, config: ChannelConfig): string | null {
    const keywords = config.updateKeywords

    if (this.matchesKeywords(text, keywords.closeTP1)) return 'closeTP1'
    if (this.matchesKeywords(text, keywords.closeTP2)) return 'closeTP2'
    if (this.matchesKeywords(text, keywords.closeTP3)) return 'closeTP3'
    if (this.matchesKeywords(text, keywords.closeTP4)) return 'closeTP4'
    if (this.matchesKeywords(text, keywords.closeFull)) return 'closeFull'
    if (this.matchesKeywords(text, keywords.closeHalf)) return 'closeHalf'
    if (this.matchesKeywords(text, keywords.closePartial)) return 'closePartial'
    if (this.matchesKeywords(text, keywords.breakEven)) return 'breakEven'
    if (this.matchesKeywords(text, keywords.setTP1)) return 'setTP1'
    if (this.matchesKeywords(text, keywords.setTP2)) return 'setTP2'
    if (this.matchesKeywords(text, keywords.setTP3)) return 'setTP3'
    if (this.matchesKeywords(text, keywords.setTP4)) return 'setTP4'
    if (this.matchesKeywords(text, keywords.setTP5)) return 'setTP5'
    if (this.matchesKeywords(text, keywords.setTP)) return 'setTP'
    if (this.matchesKeywords(text, keywords.setSL)) return 'setSL'
    if (this.matchesKeywords(text, keywords.deletePending)) return 'deletePending'

    // Additional keywords
    const addKeywords = config.additionalKeywords
    if (this.matchesKeywords(text, addKeywords.layer)) return 'layer'
    if (this.matchesKeywords(text, addKeywords.closeAll)) return 'closeAll'
    if (this.matchesKeywords(text, addKeywords.deleteAll)) return 'deleteAll'
    if (this.matchesKeywords(text, addKeywords.removeSL)) return 'removeSL'

    return null
  }

  /**
   * Check if text matches any of the keywords
   */
  private matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword.toUpperCase()))
  }

  /**
   * Extract symbol from text (uses AI parser's logic)
   */
  private extractSymbol(text: string): string | null {
    // Reuse AI parser's symbol extraction
    return this.aiParser['extractSymbol'](text)
  }

  /**
   * Extract direction using configured keywords
   */
  private extractDirection(text: string, config: ChannelConfig): ParsedSignal['direction'] | null {
    // Check for pending orders first
    if (text.includes('BUY STOP')) return 'BUY STOP'
    if (text.includes('SELL STOP')) return 'SELL STOP'
    if (text.includes('BUY LIMIT')) return 'BUY LIMIT'
    if (text.includes('SELL LIMIT')) return 'SELL LIMIT'

    // Check configured keywords
    if (this.matchesKeywords(text, config.signalKeywords.buy)) return 'BUY'
    if (this.matchesKeywords(text, config.signalKeywords.sell)) return 'SELL'

    return null
  }

  /**
   * Extract entry price using configured keywords
   */
  private extractEntryPrice(text: string, config: ChannelConfig): number | number[] | undefined {
    const keywords = config.signalKeywords.entryPoint
    const prices: number[] = []

    // Check for pending order formats: "SELL STOP 4114", "SELL STOP - 3338.3", or "BUY LIMIT : 1.2345"
    // Pattern allows: space, dash, or colon as separator
    const pendingOrderPattern = /(BUY|SELL)\s*(STOP|LIMIT)\s+([0-9]+\.?[0-9]*)/gi
    const pendingMatches = text.matchAll(pendingOrderPattern)
    for (const match of pendingMatches) {
      const price = parseFloat(match[3])
      if (!isNaN(price) && price > 0) {
        prices.push(price)
      }
    }

    // Also check for simple "BUY 4300" or "SELL 4300" format (without STOP/LIMIT)
    if (prices.length === 0) {
      const simpleOrderPattern = /(BUY|SELL)\s+([0-9]+\.?[0-9]*)/gi
      const simpleMatches = text.matchAll(simpleOrderPattern)
      for (const match of simpleMatches) {
        const price = parseFloat(match[2])
        if (!isNaN(price) && price > 0) {
          prices.push(price)
          logger.debug(`Extracted entry price from simple format: ${price}`)
        }
      }
    }

    // Check configured entry keywords
    for (const keyword of keywords) {
      const keywordUpper = keyword.toUpperCase()
      const pattern = new RegExp(`${keywordUpper}[:\\s@-]*([0-9]+\\.?[0-9]*)`, 'gi')
      const matches = text.matchAll(pattern)

      for (const match of matches) {
        const price = parseFloat(match[1])
        if (!isNaN(price) && price > 0 && !prices.includes(price)) {
          prices.push(price)
        }
      }
    }

    // Also look for @ symbol specifically
    const atPattern = /@\s*([0-9]+\.?[0-9]*)/g
    const atMatches = text.matchAll(atPattern)
    for (const match of atMatches) {
      const price = parseFloat(match[1])
      if (!isNaN(price) && price > 0 && !prices.includes(price)) {
        prices.push(price)
      }
    }

    if (prices.length === 0) return undefined
    if (prices.length === 1) return prices[0]

    // Use preference from config
    switch (config.advancedSettings.preferEntry) {
      case 'first':
        return prices[0]
      case 'second':
        return prices.length > 1 ? prices[1] : prices[0]
      case 'average':
        return prices.reduce((a, b) => a + b, 0) / prices.length
      case 'all':
        return prices
      default:
        return prices[0]
    }
  }

  /**
   * Extract stop loss using configured keywords
   */
  private extractStopLoss(text: string, config: ChannelConfig): number | undefined {
    let keywords = config.signalKeywords.stopLoss

    // If no keywords configured, use defaults
    if (keywords.length === 0) {
      keywords = ['SL', 'STOP LOSS', 'STOP', 'S.L']
    }

    // When pips mode is enabled, treat ANY number after SL keyword as pips
    if (config.advancedSettings.slInPips) {
      for (const keyword of keywords) {
        const keywordUpper = keyword.toUpperCase()
        // Match pattern: keyword followed by separator and number
        const pattern = new RegExp(`${keywordUpper}[:\\s@\\-_*]+([0-9]+\\.?[0-9]*)`, 'gi')
        const matches = text.matchAll(pattern)

        for (const match of matches) {
          const pips = parseFloat(match[1])
          if (!isNaN(pips) && pips > 0) {
            logger.debug(`Extracted SL in pips mode: ${pips} pips`)
            return -pips // Negative indicates pips
          }
        }
      }
    } else {
      // When pips mode is disabled, extract as price
      for (const keyword of keywords) {
        const keywordUpper = keyword.toUpperCase()
        // Match pattern: keyword followed by separator and number
        const pattern = new RegExp(`${keywordUpper}[:\\s@\\-_*]+([0-9]+\\.?[0-9]*)`, 'gi')
        const matches = text.matchAll(pattern)

        for (const match of matches) {
          const sl = parseFloat(match[1])
          if (!isNaN(sl) && sl > 0) {
            logger.debug(`Extracted SL as price: ${sl}`)
            return sl
          }
        }
      }
    }

    logger.debug('No SL found in signal')
    return undefined
  }

  /**
   * Extract take profits using configured keywords
   */
  private extractTakeProfits(text: string, config: ChannelConfig): number[] | undefined {
    let keywords = config.signalKeywords.takeProfit
    const tps: number[] = []

    // If no keywords configured, use defaults
    if (keywords.length === 0) {
      keywords = ['TP', 'TAKE PROFIT', 'TARGET', 'T.P']
    }

    const formatMode = config.advancedSettings.tpFormatMode
    const inPipsMode = config.advancedSettings.tpInPips

    // Mode 1: Separate Keywords - "TP1: 5, TP2: 10, TP3: 15" OR "TP: 200" (single)
    if (formatMode === 'separate_keywords') {
      for (const keyword of keywords) {
        const keywordUpper = keyword.toUpperCase()

        // First, try to match numbered TPs (TP1, TP2, etc.)
        const numberedPattern = new RegExp(`${keywordUpper}[\\s]*([1-5])[:\\s@\\-_*]+([0-9]+\\.?[0-9]*)`, 'gi')
        const numberedMatches = text.matchAll(numberedPattern)
        let foundNumbered = false

        for (const match of numberedMatches) {
          foundNumbered = true
          const tpIndex = parseInt(match[1]) - 1  // Convert TP1 -> index 0
          const value = parseFloat(match[2])

          if (!isNaN(value) && value > 0 && tpIndex >= 0 && tpIndex < 5) {
            const finalValue = inPipsMode ? -value : value  // Negative indicates pips

            // Ensure array has space for this TP
            while (tps.length <= tpIndex) {
              tps.push(0)
            }

            tps[tpIndex] = finalValue
            logger.debug(`Extracted TP${tpIndex + 1} in ${inPipsMode ? 'pips' : 'price'} mode: ${value}`)
          }
        }

        // If no numbered TPs found, try plain "TP: 200" format (treat as TP1)
        if (!foundNumbered) {
          const plainPattern = new RegExp(`${keywordUpper}[:\\s@\\-_*]+([0-9]+\\.?[0-9]*(?:[\\s,;]+[0-9]+\\.?[0-9]*)*)`, 'gi')
          const plainMatches = text.matchAll(plainPattern)

          for (const match of plainMatches) {
            const valuesString = match[1]
            // Split by comma, semicolon, or whitespace
            const values = valuesString.split(/[,;\s]+/).filter(v => v.trim().length > 0)

            for (const valueStr of values) {
              const value = parseFloat(valueStr)
              if (!isNaN(value) && value > 0) {
                const finalValue = inPipsMode ? -value : value
                if (!tps.includes(finalValue)) {
                  tps.push(finalValue)
                  logger.debug(`Extracted TP in ${inPipsMode ? 'pips' : 'price'} mode: ${value}`)
                }
              }
            }
          }
        }
      }

      // Remove trailing zeros (only for numbered format)
      while (tps.length > 0 && tps[tps.length - 1] === 0) {
        tps.pop()
      }
    }
    // Mode 2: Comma Separated - "TP: 5, 10, 15, 20"
    else if (formatMode === 'comma_separated') {
      for (const keyword of keywords) {
        const keywordUpper = keyword.toUpperCase()
        // Match pattern: keyword followed by comma-separated values
        const pattern = new RegExp(`${keywordUpper}[:\\s@\\-_*]+([0-9]+\\.?[0-9]*(?:[\\s,;]+[0-9]+\\.?[0-9]*)*)`, 'gi')
        const matches = text.matchAll(pattern)

        for (const match of matches) {
          const valuesString = match[1]
          // Split by comma, semicolon, or whitespace
          const values = valuesString.split(/[,;\s]+/).filter(v => v.trim().length > 0)

          for (const valueStr of values) {
            const value = parseFloat(valueStr)
            if (!isNaN(value) && value > 0) {
              const finalValue = inPipsMode ? -value : value
              if (!tps.includes(finalValue)) {
                tps.push(finalValue)
                logger.debug(`Extracted TP in ${inPipsMode ? 'pips' : 'price'} mode: ${value}`)
              }
            }
          }
        }
      }
    }

    if (tps.length > 0) {
      logger.debug(`Total TPs extracted: ${tps.length}`)
    } else {
      logger.debug('No TP found in signal')
    }

    return tps.length > 0 ? tps : undefined
  }

  /**
   * Extract all numbers from text
   */
  private extractNumbers(text: string): number[] {
    const numbers: number[] = []
    const pattern = /([0-9]+\.?[0-9]*)/g
    const matches = text.matchAll(pattern)

    for (const match of matches) {
      const num = parseFloat(match[1])
      if (!isNaN(num)) {
        numbers.push(num)
      }
    }

    return numbers
  }

  /**
   * Convert pips to actual price based on symbol
   */
  private pipsToPrice(pips: number, symbol: string, basePrice: number): number {
    // Get pip value based on symbol
    let pipValue = 0.0001 // Default for most forex pairs (4-decimal)

    // JPY pairs use 2 decimals
    if (symbol.includes('JPY')) {
      pipValue = 0.01
    }
    // Metals and indices typically use different pip values
    else if (symbol.includes('XAU') || symbol.includes('GOLD')) {
      pipValue = 0.1 // Gold: 1 pip = 0.1
    }
    else if (symbol.includes('XAG') || symbol.includes('SILVER')) {
      pipValue = 0.01 // Silver: 1 pip = 0.01
    }
    else if (symbol.includes('US30') || symbol.includes('NAS100') || symbol.includes('SPX500')) {
      pipValue = 1.0 // Indices: 1 pip = 1 point
    }
    // Crypto pairs - typically 1 pip = 0.01 or 0.1 depending on the asset
    else if (symbol.includes('BTC')) {
      pipValue = 1.0 // Bitcoin: 1 pip = 1 dollar
    }
    else if (symbol.includes('ETH')) {
      pipValue = 0.1 // Ethereum: 1 pip = 0.1 dollar
    }

    const result = basePrice + (pips * pipValue)
    logger.debug(`Converted ${Math.abs(pips)} pips to price: ${basePrice} + (${pips} * ${pipValue}) = ${result}`)
    return result
  }

  /**
   * Convert pips values to actual prices for Stop Loss
   */
  private convertSlPipsToPrice(
    sl: number | undefined,
    symbol: string,
    entryPrice: number,
    direction: ParsedSignal['direction']
  ): number | undefined {
    if (sl === undefined || sl >= 0) return sl // Not pips or undefined

    const pips = Math.abs(sl)
    // For SL: SELL orders have SL above entry (positive), BUY orders have SL below (negative)
    const multiplier = direction.includes('SELL') ? 1 : -1
    return this.pipsToPrice(pips * multiplier, symbol, entryPrice)
  }

  /**
   * Convert pips values to actual prices for Take Profit
   */
  private convertTpPipsToPrice(
    tps: number[] | undefined,
    symbol: string,
    entryPrice: number,
    direction: ParsedSignal['direction']
  ): number[] | undefined {
    if (!tps) return undefined

    return tps.map(tp => {
      if (tp < 0) {
        const pips = Math.abs(tp)
        // For TP: SELL orders have TP below entry (negative), BUY orders have TP above (positive)
        const multiplier = direction.includes('SELL') ? -1 : 1
        return this.pipsToPrice(pips * multiplier, symbol, entryPrice)
      }
      return tp // Already a price
    })
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    symbol: string | null,
    direction: string | null,
    entryPrice: number | number[] | undefined,
    stopLoss: number | undefined,
    takeProfits: number[] | undefined
  ): number {
    let score = 0

    if (symbol) score += 0.3
    if (direction) score += 0.3
    if (entryPrice !== undefined) score += 0.15
    if (stopLoss !== undefined) score += 0.15
    if (takeProfits && takeProfits.length > 0) score += 0.1

    return score
  }

  /**
   * Convert AI parser result to enhanced format
   */
  private convertToEnhanced(aiResult: ParsedSignal, config: ChannelConfig): EnhancedParsedSignal {
    return {
      ...aiResult,
      signalType: 'new',
      isIgnored: false,
      isSkipped: false,
      forceMarket: false,
      delayMs: config.advancedSettings.delayInMsec
    }
  }
}

// Singleton instance
export const enhancedSignalParser = new EnhancedSignalParser()
