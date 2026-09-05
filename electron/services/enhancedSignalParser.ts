import { ChannelConfig } from '../types/channelConfig'
import { SignalParser, ParsedSignal } from './signalParser'
import { logger } from '../utils/logger'
import { llmSignalParser } from './llmSignalParser'
import { splitEntryEnabled } from '../utils/features'
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
        'deletePending' | 'layer' | 'closeAll' | 'deleteAll' | 'removeSL' | 'closeByEntry'
  value?: number | number[]  // New value if setting TP/SL, or target entry price for closeByEntry
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
  riskMultiplier?: number  // 0.5 for half-risk signals; 1.0 default
  isHedge?: boolean        // true if this is a hedge signal — EA will match lots to open opposite positions
  llmReasoning?: string    // Claude's explanation of how it interpreted the message
  entryPrice2?: number     // Split entry second price (added at signal emit time)
}

export class EnhancedSignalParser {
  private aiParser: SignalParser
  /** Why the last parse() returned null. Read by the caller to show a "Skipped" card instead of dropping silently. */
  public lastSkipReason: string | null = null

  constructor() {
    this.aiParser = new SignalParser()
  }

  /**
   * Parse a signal using channel-specific keyword configuration
   */
  async parse(text: string, config: ChannelConfig): Promise<EnhancedParsedSignal | null> {
    this.lastSkipReason = null
    try {
      const normalized = text.toUpperCase()

      // Check if signal should be ignored or skipped
      if (this.matchesKeywords(normalized, config.additionalKeywords.ignoreKeyword)) {
        logger.debug('Signal ignored by ignore keyword')
        this.lastSkipReason = 'Matched an Ignore keyword'
        return null
      }

      if (this.matchesKeywords(normalized, config.additionalKeywords.skipKeyword)) {
        logger.debug('Signal skipped by skip keyword')
        this.lastSkipReason = 'Matched a Skip keyword'
        return null
      }

      // Check time filter
      if (!passesTimeFilter(config.timeFilter)) {
        logger.debug('Signal rejected by time filter')
        this.lastSkipReason = 'Outside the channel time filter'
        return null
      }

      // LLM-only mode: channels with splitEntryMode enabled skip rule-based parsing entirely
      // and route everything through Claude. Safety: LLM refuses to open new trades without SL.
      // GATED by the build flag: customer builds never take this branch, even if a saved config
      // has splitEntryMode=true — they fall through to the rule-based parser below.
      if (splitEntryEnabled(config)) {
        logger.debug('LLM-only mode: routing message to Claude')
        const llmResult = await llmSignalParser.parse(text, config)
        if (!llmResult) {
          this.lastSkipReason = llmSignalParser.lastSkipReason || 'Not recognized as a signal or update'
          return null
        }

        const label = llmResult.signalType === 'update'
          ? llmResult.update?.type
          : `${llmResult.direction} ${llmResult.symbol}`
        logger.info(`✅ LLM parsed: ${llmResult.signalType} ${label}`)

        // Apply filters/overrides for new signals only (updates don't need them)
        if (llmResult.signalType === 'new') {
          const preFilter: EnhancedParsedSignal = llmResult
          let signal: EnhancedParsedSignal | null = llmResult
          signal = applyTradeFilters(signal, config)
          if (!signal) { this.lastSkipReason = this.describeFilterRejection(preFilter, config); return null }
          signal = applySLTPOverrides(signal, config)
          signal = applyModifications(signal, config)
          signal = applySymbolMapping(signal, config)
          if (!signal) { this.lastSkipReason = 'Symbol excluded by symbol mapping settings'; return null }
          return signal
        }
        return llmResult
      }

      // Standard (rule-based) mode for all other channels
      const updateType = this.detectUpdateType(normalized, config)
      if (updateType) {
        return this.parseUpdate(text, normalized, config, updateType)
      }

      let signal = this.parseNewSignal(text, normalized, config)
      if (!signal) {
        if (!this.lastSkipReason) this.lastSkipReason = 'Not recognized as a signal (no matching keywords)'
        return null
      }

      const preFilter = signal
      signal = applyTradeFilters(signal, config)
      if (!signal) { this.lastSkipReason = this.describeFilterRejection(preFilter, config); return null }

      signal = applySLTPOverrides(signal, config)
      signal = applyModifications(signal, config)
      signal = applySymbolMapping(signal, config)
      if (!signal) { this.lastSkipReason = 'Symbol excluded by symbol mapping settings'; return null }

      return signal
    } catch (error: any) {
      logger.error('Enhanced signal parsing error:', error)
      this.lastSkipReason = `Parser error: ${error?.message || error}`
      return null
    }
  }

  /** Human-readable reason for a trade-filter rejection, derived from the pre-filter signal. */
  private describeFilterRejection(sig: EnhancedParsedSignal, config: ChannelConfig): string {
    const f = config.tradeFilters
    if (f?.ignoreWithoutSL && !sig.stopLoss) return 'No stop loss in signal (Ignore Without SL is on)'
    if (f?.ignoreWithoutTP && (!sig.takeProfits || sig.takeProfits.length === 0)) return 'No take profit in signal (Ignore Without TP is on)'
    return 'Rejected by trade filters'
  }

  /**
   * Parse a new trading signal
   */
  private parseNewSignal(originalText: string, normalized: string, config: ChannelConfig): EnhancedParsedSignal | null {
    // Extract symbol (from AI parser or custom logic)
    const symbol = this.extractSymbol(normalized)
    if (!symbol) {
      logger.debug('No symbol found')
      this.lastSkipReason = 'No trading symbol found in message'

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
      this.lastSkipReason = 'No BUY/SELL direction found (check Buy/Sell keywords)'

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
    // Pass entry, SL, and direction for smart bare number extraction
    let takeProfits = this.extractTakeProfits(normalized, config, direction, entryPrice, stopLoss)

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
      this.lastSkipReason = `Looks like a signal but too incomplete to trade (confidence ${(confidence * 100).toFixed(0)}%)`

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

    // Extract target entry price for closeByEntry
    // Use the original (non-normalized) text to preserve decimal precision
    if (updateType === 'closeByEntry') {
      const priceInParens = originalText.match(/\(\s*([0-9]+\.?[0-9]*)\s*\)/)
      if (priceInParens) {
        update.value = parseFloat(priceInParens[1])
        logger.debug(`closeByEntry: target entry price = ${update.value}`)
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
    // Check global commands FIRST (more specific) before regular update keywords
    const addKeywords = config.additionalKeywords
    if (this.matchesKeywords(text, addKeywords.closeAll)) return 'closeAll'
    if (this.matchesKeywords(text, addKeywords.deleteAll)) return 'deleteAll'
    if (this.matchesKeywords(text, addKeywords.layer)) return 'layer'
    if (this.matchesKeywords(text, addKeywords.removeSL)) return 'removeSL'

    // Check for close-by-entry price pattern BEFORE generic update keywords
    // Matches messages like: "Close lower sell trade (4584.7) immediately"
    //                         "Close upper sell trade (4593.5) now"
    //                         "Close buy trade (1.2345)"
    const closeByEntryPattern = /close\s+(?:lower|upper|sell\s+trade|buy\s+trade|sell|buy)\b[^(]*\(\s*([0-9]+\.?[0-9]*)\s*\)/i
    if (closeByEntryPattern.test(text)) return 'closeByEntry'

    // Check regular update keywords
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

    return null
  }

  /**
   * Check if text matches any of the keywords (case insensitive)
   */
  private matchesKeywords(text: string, keywords: string[]): boolean {
    const textLower = text.toLowerCase()
    return keywords.some(keyword => textLower.includes(keyword.toLowerCase()))
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

    // 1. Check configured entry keywords FIRST (e.g. "ENTRY: 4028/32" or "ENTRY: 4028-4032")
    //    This must run before range patterns so a TP range like "4085-4100" can't steal the entry.
    for (const keyword of keywords) {
      const keywordUpper = keyword.toUpperCase()
      // Match keyword followed by a slash or dash range (e.g. "ENTRY: 4028/32" or "ENTRY: 4028-4032")
      const rangePattern = new RegExp(`${keywordUpper}[:\\s@\\-_*\`]+[\\(\\[\\s]*([0-9]+\\.?[0-9]*)[\\s]*[/\\-][\\s]*([0-9]+\\.?[0-9]*)`, 'gi')
      for (const match of text.matchAll(rangePattern)) {
        const first = parseFloat(match[1])
        const secondRaw = match[2]
        if (isNaN(first) || first <= 0) continue

        // Reconstruct second price for abbreviated ranges like 4028/32 → 4032
        const firstStr = match[1].replace('.', '')
        const secondStr = secondRaw.replace('.', '')
        let second: number
        if (secondStr.length < firstStr.length) {
          const reconstructed = firstStr.slice(0, firstStr.length - secondStr.length) + secondStr
          const dotPos = match[1].indexOf('.')
          second = dotPos >= 0
            ? parseFloat(reconstructed.slice(0, dotPos) + '.' + reconstructed.slice(dotPos))
            : parseFloat(reconstructed)
        } else {
          second = parseFloat(secondRaw)
        }

        // Determine if this is a true split entry or an abbreviated range.
        // Abbreviated: 4028/32 → reconstructed second (4032) should be very close to raw secondRaw (32 → treated as 4032).
        // Split entry:  4584.7/93.5 → reconstructed second (4584.793.5 nonsense or 459393.5) differs from raw 93.5 by > threshold.
        const rawSecond = parseFloat(secondRaw)
        const splitEntryThreshold = 1.0
        const isSplitEntry = Math.abs(second - rawSecond) > splitEntryThreshold

        // Build-gated: customer builds never receive two entry prices from the rule-based parser,
        // even if a saved config still carries splitEntryMode=true — the range collapses via entryRangeStrategy.
        if (isSplitEntry && splitEntryEnabled(config)) {
          // True split entry: return BOTH prices so the caller can create two orders
          logger.debug(`Detected split entry: [${first}, ${rawSecond}]`)
          return [first, rawSecond]
        }

        const strategy = config.advancedSettings.entryRangeStrategy
        let price: number
        if (strategy === 'last') price = second
        else if (strategy === 'middle') price = (first + second) / 2
        else price = first

        logger.debug(`Extracted entry price from keyword range (${strategy}): ${price} (from ${first}-${second})`)
        return price
      }
      // Match keyword followed by single number
      const singlePattern = new RegExp(`${keywordUpper}[:\\s@\\-_*\`]+[\\(\\[\\s]*([0-9]+\\.?[0-9]*)[\\)\\]\\s]*`, 'gi')
      for (const match of text.matchAll(singlePattern)) {
        const price = parseFloat(match[1])
        if (!isNaN(price) && price > 0 && !prices.includes(price)) {
          prices.push(price)
        }
      }
    }

    if (prices.length > 0) {
      if (prices.length === 1) return prices[0]
      const strategy = config.advancedSettings.entryRangeStrategy
      if (strategy === 'last') return prices[prices.length - 1]
      if (strategy === 'middle') return prices.reduce((a, b) => a + b, 0) / prices.length
      return prices[0]
    }

    // 2. Check for range pattern (4329-4332) — only if no keyword matched above
    const rangePattern = /([0-9]+\.?[0-9]*)\s*-\s*([0-9]+\.?[0-9]*)/
    const rangeMatch = rangePattern.exec(text)
    if (rangeMatch) {
      const firstPrice = parseFloat(rangeMatch[1])
      const lastPrice = parseFloat(rangeMatch[2])

      if (!isNaN(firstPrice) && firstPrice > 0 && !isNaN(lastPrice) && lastPrice > 0) {
        let price: number
        const strategy = config.advancedSettings.entryRangeStrategy

        switch (strategy) {
          case 'first':
            price = firstPrice
            logger.debug(`Extracted entry price from range (first): ${price} (from ${firstPrice}-${lastPrice})`)
            break
          case 'last':
            price = lastPrice
            logger.debug(`Extracted entry price from range (last): ${price} (from ${firstPrice}-${lastPrice})`)
            break
          case 'middle':
            price = (firstPrice + lastPrice) / 2
            logger.debug(`Extracted entry price from range (middle): ${price} (from ${firstPrice}-${lastPrice})`)
            break
          default:
            price = firstPrice
            logger.debug(`Extracted entry price from range (default first): ${price} (from ${firstPrice}-${lastPrice})`)
        }

        return price
      }
    }

    // 3. Check for symbol-based pattern (XAUUSD 4329, EURUSD 1.2345)
    const symbol = this.extractSymbol(text)
    if (symbol) {
      const symbolPattern = new RegExp(symbol + '\\s+([0-9]+\\.?[0-9]*)', 'i')
      const symbolMatch = symbolPattern.exec(text)
      if (symbolMatch) {
        const price = parseFloat(symbolMatch[1])
        if (!isNaN(price) && price > 0) {
          prices.push(price)
          logger.debug(`Extracted entry price from symbol-adjacent format: ${price}`)
        }
      }
    }

    // 3. Check for pending order formats: "SELL STOP 4114", "SELL STOP - 3338.3", or "BUY LIMIT : 1.2345"
    // Pattern allows: space, dash, or colon as separator
    const pendingOrderPattern = /(BUY|SELL)\s*(STOP|LIMIT)\s+([0-9]+\.?[0-9]*)/gi
    const pendingMatches = text.matchAll(pendingOrderPattern)
    for (const match of pendingMatches) {
      const price = parseFloat(match[3])
      if (!isNaN(price) && price > 0) {
        prices.push(price)
      }
    }

    // 4. Also check for simple "BUY 4300" or "SELL 4300" format (without STOP/LIMIT)
    // Allow optional filler words like "NOW", "AT", "PRICE" between direction and number
    if (prices.length === 0) {
      const simpleOrderPattern = /(BUY|SELL)\s+(?:NOW|AT|PRICE)?\s*([0-9]+\.?[0-9]*)/gi
      const simpleMatches = text.matchAll(simpleOrderPattern)
      for (const match of simpleMatches) {
        const price = parseFloat(match[2])
        if (!isNaN(price) && price > 0) {
          prices.push(price)
          logger.debug(`Extracted entry price from simple format: ${price}`)
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

    // Use entryRangeStrategy from config for multiple detected prices
    const strategy = config.advancedSettings.entryRangeStrategy
    switch (strategy) {
      case 'first':
        logger.debug(`Multiple entry prices detected, using first: ${prices[0]} (from ${prices.join(', ')})`)
        return prices[0]
      case 'last':
        const lastPrice = prices[prices.length - 1]
        logger.debug(`Multiple entry prices detected, using last: ${lastPrice} (from ${prices.join(', ')})`)
        return lastPrice
      case 'middle':
        const middlePrice = prices.reduce((a, b) => a + b, 0) / prices.length
        logger.debug(`Multiple entry prices detected, using middle: ${middlePrice} (from ${prices.join(', ')})`)
        return middlePrice
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
        // Match pattern: optional emoji/special chars, then keyword, then separator and number (with optional parentheses/brackets)
        const pattern = new RegExp(`[^A-Z0-9]*${keywordUpper}[:\\s@\\-_*\`]+[\\(\\[\\s]*([0-9]+\\.?[0-9]*)[\\)\\]\\s]*`, 'gi')
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
        // Match pattern: keyword followed by separator and number (with optional parentheses/brackets)
        const pattern = new RegExp(`${keywordUpper}[:\\s@\\-_*\`]+[\\(\\[\\s]*([0-9]+\\.?[0-9]*)[\\)\\]\\s]*`, 'gi')
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
  private extractTakeProfits(
    text: string,
    config: ChannelConfig,
    direction?: ParsedSignal['direction'],
    entryPrice?: number | number[],
    stopLoss?: number
  ): number[] | undefined {
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
      let maxTPIndex = -1  // Track the highest TP index we found

      for (const keyword of keywords) {
        const keywordUpper = keyword.toUpperCase()

        // First, try to match numbered TPs (TP1-TP10)
        // Allow optional unicode/superscript characters after keyword (e.g., TP¹, TP², TP³)
        // Also matches "Open", "Running", etc. for TPs without fixed targets
        // Support optional parentheses/brackets around numbers
        const numberedPattern = new RegExp(`${keywordUpper}[^A-Z0-9]*[\\s]*([1-9]|10)[:\\s@\\-_*\`]+(?:[\\(\\[\\s]*([0-9]+\\.?[0-9]*)[\\)\\]\\s]*|OPEN|RUNNING|HOLD)`, 'gi')
        const numberedMatches = text.matchAll(numberedPattern)
        let foundNumbered = false

        for (const match of numberedMatches) {
          foundNumbered = true
          const tpIndex = parseInt(match[1]) - 1  // Convert TP1 -> index 0
          const valueStr = match[2]  // This will be undefined if "OPEN/RUNNING/HOLD" was matched

          // Track the maximum TP index
          if (tpIndex > maxTPIndex) {
            maxTPIndex = tpIndex
          }

          // Ensure array has space for this TP
          while (tps.length <= tpIndex) {
            tps.push(0)
          }

          // If "Open" (no fixed target), set to 0 (which means "no TP" in MT4/MT5)
          if (!valueStr) {
            tps[tpIndex] = 0
            logger.debug(`TP${tpIndex + 1} marked as Open/Running/Hold - will create order without TP target (TP=0)`)
            continue
          }

          const value = parseFloat(valueStr)

          if (!isNaN(value) && value > 0 && tpIndex >= 0 && tpIndex < 10) {
            const finalValue = inPipsMode ? -value : value  // Negative indicates pips
            tps[tpIndex] = finalValue
            logger.debug(`Extracted TP${tpIndex + 1} in ${inPipsMode ? 'pips' : 'price'} mode: ${value}`)
          }
        }

        // If no numbered TPs found, try plain "TP: 200" format (treat as TP1)
        if (!foundNumbered) {
          // Allow optional unicode/superscript characters after keyword before separator
          // Support optional parentheses/brackets around numbers
          const plainPattern = new RegExp(`${keywordUpper}[^A-Z0-9]*[:\\s@\\-_*\`]+[\\(\\[\\s]*([0-9]+\\.?[0-9]*(?:[\\s,;]+[0-9]+\\.?[0-9]*)*)[\\)\\]\\s]*`, 'gi')
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

      // Only remove trailing zeros that come AFTER the highest TP index we found
      // This preserves intentional zeros (like "TP5: Open") but removes placeholder zeros
      if (maxTPIndex >= 0) {
        while (tps.length > maxTPIndex + 1) {
          tps.pop()
        }
      } else {
        // No numbered TPs found at all, remove trailing zeros as before
        while (tps.length > 0 && tps[tps.length - 1] === 0) {
          tps.pop()
        }
      }
    }
    // Mode 2: Comma Separated - "TP: 5, 10, 15, 20"
    else if (formatMode === 'comma_separated') {
      for (const keyword of keywords) {
        const keywordUpper = keyword.toUpperCase()
        // Match pattern: keyword followed by comma-separated values
        // Allow optional unicode/superscript characters after keyword before separator
        // Support optional parentheses/brackets around numbers
        const pattern = new RegExp(`${keywordUpper}[^A-Z0-9]*[:\\s@\\-_*\`]+[\\(\\[\\s]*([0-9]+\\.?[0-9]*(?:[\\s,;]+[0-9]+\\.?[0-9]*)*)[\\)\\]\\s]*`, 'gi')
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

    // Fallback: Smart bare number extraction if TP keyword found but no TPs extracted
    if (tps.length === 0 && this.hasTpKeyword(text, keywords) && direction && entryPrice !== undefined && !Array.isArray(entryPrice)) {
      logger.debug('TP keyword found but no labeled TPs - attempting smart bare number extraction')
      const bareNumbers = this.extractBareNumberTPs(text, keywords, direction, entryPrice, stopLoss)
      if (bareNumbers && bareNumbers.length > 0) {
        tps.push(...bareNumbers)
        logger.debug(`Extracted ${bareNumbers.length} bare number TPs: ${bareNumbers.join(', ')}`)
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
   * Check if text contains TP-related keywords
   */
  private hasTpKeyword(text: string, keywords: string[]): boolean {
    const textUpper = text.toUpperCase()
    for (const keyword of keywords) {
      if (textUpper.includes(keyword.toUpperCase())) {
        return true
      }
    }
    return false
  }

  /**
   * Extract bare numbers after TP keyword (no TP1, TP2 labels)
   * Only extracts numbers that appear AFTER the TP keyword
   * Applies directional validation: BUY = TPs > Entry, SELL = TPs < Entry
   */
  private extractBareNumberTPs(
    text: string,
    keywords: string[],
    direction: ParsedSignal['direction'],
    entryPrice: number,
    stopLoss?: number
  ): number[] {
    const bareNumbers: number[] = []

    // Find the position of the first TP keyword
    let tpKeywordPos = -1
    const textUpper = text.toUpperCase()

    for (const keyword of keywords) {
      const keywordUpper = keyword.toUpperCase()
      const pos = textUpper.indexOf(keywordUpper)
      if (pos !== -1 && (tpKeywordPos === -1 || pos < tpKeywordPos)) {
        tpKeywordPos = pos
      }
    }

    if (tpKeywordPos === -1) return bareNumbers

    // Find SL keyword position to know where to stop looking for TPs
    let slKeywordPos = -1
    const slKeywords = ['SL', 'STOP LOSS', 'STOP', 'S.L']
    for (const slKeyword of slKeywords) {
      const pos = textUpper.indexOf(slKeyword, tpKeywordPos)
      if (pos !== -1 && (slKeywordPos === -1 || pos < slKeywordPos)) {
        slKeywordPos = pos
      }
    }

    // Extract all numbers that appear AFTER the TP keyword but BEFORE the SL keyword (if found)
    // Skip first 50 characters after TP keyword to avoid grabbing the keyword index itself (e.g., "TARGET 1")
    const startPos = tpKeywordPos + 50
    const endPos = slKeywordPos !== -1 ? slKeywordPos : text.length
    const textBetween = text.substring(startPos, endPos)

    const numberPattern = /([0-9]+\.[0-9]+)/g
    const matches = textBetween.matchAll(numberPattern)

    const isBuy = direction.includes('BUY')
    const isSell = direction.includes('SELL')

    for (const match of matches) {
      const num = parseFloat(match[1])

      // Skip invalid numbers
      if (isNaN(num) || num <= 0) continue

      // Skip if this number is the stop loss
      if (stopLoss !== undefined && Math.abs(num - stopLoss) < 0.001) {
        logger.debug(`Skipping ${num} - matches stop loss`)
        continue
      }

      // Skip if this number is the entry price
      if (Math.abs(num - entryPrice) < 0.001) {
        logger.debug(`Skipping ${num} - matches entry price`)
        continue
      }

      // Directional validation
      if (isBuy && num > entryPrice) {
        // For BUY, TPs should be above entry
        bareNumbers.push(num)
        logger.debug(`Accepted TP ${num} for BUY (above entry ${entryPrice})`)
      } else if (isSell && num < entryPrice) {
        // For SELL, TPs should be below entry
        bareNumbers.push(num)
        logger.debug(`Accepted TP ${num} for SELL (below entry ${entryPrice})`)
      } else {
        logger.debug(`Rejected ${num} - wrong direction (${direction}, entry: ${entryPrice})`)
      }
    }

    // Sort TPs by distance from entry (closest first)
    bareNumbers.sort((a, b) => {
      const distA = Math.abs(a - entryPrice)
      const distB = Math.abs(b - entryPrice)
      return distA - distB
    })

    return bareNumbers
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
