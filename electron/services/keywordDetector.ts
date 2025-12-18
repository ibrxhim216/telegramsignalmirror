import { SignalKeywords, UpdateKeywords, AdditionalKeywords } from '../types/channelConfig'

export interface DetectedKeywords {
  signalKeywords: Partial<SignalKeywords>
  updateKeywords: Partial<UpdateKeywords>
  additionalKeywords: Partial<AdditionalKeywords>
  detectedTPFormat: 'comma_separated' | 'separate_keywords'
  confidence: number
  suggestions: string[]
}

/**
 * Keyword Detector Service
 * Reverse-engineers signal parsing to detect keywords from example signals
 */
export class KeywordDetector {
  /**
   * Analyze an example signal and detect all keywords
   */
  detectKeywords(exampleSignal: string): DetectedKeywords {
    const normalized = exampleSignal.toUpperCase()
    const suggestions: string[] = []

    // Detect signal keywords
    const buy = this.detectBuyKeywords(normalized)
    const sell = this.detectSellKeywords(normalized)
    const stopLoss = this.detectStopLossKeywords(normalized)
    const takeProfit = this.detectTakeProfitKeywords(normalized)
    const entryPoint = this.detectEntryKeywords(normalized)

    // Detect TP format mode
    const detectedTPFormat = this.detectTPFormat(normalized)

    // Detect update keywords (if example contains modifications)
    const updateKeywords = this.detectUpdateKeywords(normalized)

    // Detect additional keywords
    const additionalKeywords = this.detectAdditionalKeywords(normalized)

    // Calculate confidence score
    const confidence = this.calculateConfidence(
      buy,
      sell,
      stopLoss,
      takeProfit,
      entryPoint
    )

    // Generate suggestions
    if (buy.length === 0 && sell.length === 0) {
      suggestions.push('⚠️ Could not detect BUY/SELL keywords. Please ensure your example signal contains "BUY" or "SELL".')
    }
    if (takeProfit.length === 0) {
      suggestions.push('⚠️ Could not detect TP keywords. Common keywords: TP, TARGET, TAKE PROFIT')
    }
    if (stopLoss.length === 0) {
      suggestions.push('⚠️ Could not detect SL keywords. Common keywords: SL, STOP LOSS, STOP')
    }
    if (confidence < 0.5) {
      suggestions.push('⚠️ Low confidence detection. You may need to manually adjust some keywords.')
    }
    if (confidence >= 0.8) {
      suggestions.push('✅ High confidence detection! Keywords should work well.')
    }

    return {
      signalKeywords: {
        buy: buy.length > 0 ? buy : undefined,
        sell: sell.length > 0 ? sell : undefined,
        stopLoss: stopLoss.length > 0 ? stopLoss : undefined,
        takeProfit: takeProfit.length > 0 ? takeProfit : undefined,
        entryPoint: entryPoint.length > 0 ? entryPoint : undefined
      },
      updateKeywords,
      additionalKeywords,
      detectedTPFormat,
      confidence,
      suggestions
    }
  }

  /**
   * Detect BUY keywords
   */
  private detectBuyKeywords(text: string): string[] {
    const keywords: Set<string> = new Set()
    const patterns = [
      /\b(BUY)\b/gi,
      /\b(LONG)\b/gi,
      /\b(COMPRA)\b/gi,  // Spanish
      /\b(ACHETER)\b/gi,  // French
      /\b(BUY\s+STOP)\b/gi,
      /\b(BUY\s+LIMIT)\b/gi
    ]

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        keywords.add(match[1].toLowerCase())
      }
    }

    // Check for common emojis used with BUY
    if (/📈|🟢|🔵|⬆️.*BUY/gi.test(text)) {
      keywords.add('BUY')
    }

    return Array.from(keywords)
  }

  /**
   * Detect SELL keywords
   */
  private detectSellKeywords(text: string): string[] {
    const keywords: Set<string> = new Set()
    const patterns = [
      /\b(SELL)\b/gi,
      /\b(SHORT)\b/gi,
      /\b(VENTA)\b/gi,  // Spanish
      /\b(VENDRE)\b/gi,  // French
      /\b(SELL\s+STOP)\b/gi,
      /\b(SELL\s+LIMIT)\b/gi
    ]

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        keywords.add(match[1].toLowerCase())
      }
    }

    // Check for common emojis used with SELL
    if (/📉|🔴|🔻|⬇️.*SELL/gi.test(text)) {
      keywords.add('SELL')
    }

    return Array.from(keywords)
  }

  /**
   * Detect Stop Loss keywords
   */
  private detectStopLossKeywords(text: string): string[] {
    const keywords: Set<string> = new Set()
    const patterns = [
      /\b(SL|S\.L)\s*[:@\-_*\s]/gi,
      /\b(STOP\s*LOSS)\s*[:@\-_*\s]/gi,
      /\b(STOP)\s*[:@\-_*\s]/gi
    ]

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        const keyword = match[1].trim().replace(/\./g, '').toLowerCase()
        keywords.add(keyword)
      }
    }

    // Check for emoji-based SL
    const emojiPattern = /([🚫❌⛔🔴✖️])[\s]*(SL|STOP)/gi
    const emojiMatches = text.matchAll(emojiPattern)
    for (const match of emojiMatches) {
      keywords.add('SL')
    }

    return Array.from(keywords)
  }

  /**
   * Detect Take Profit keywords
   */
  private detectTakeProfitKeywords(text: string): string[] {
    const keywords: Set<string> = new Set()
    const patterns = [
      /\b(TP|T\.P)\s*[¹²³⁴⁵1-5]?\s*[:@\-_*\s]/gi,
      /\b(TAKE\s*PROFIT)\s*[:@\-_*\s]/gi,
      /\b(TARGET)\s*[:@\-_*\s]/gi,
      /\b(OBJETIVO)\s*[:@\-_*\s]/gi  // Spanish
    ]

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        const keyword = match[1].trim().replace(/\./g, '').toLowerCase()
        keywords.add(keyword)
      }
    }

    // Check for emoji-based TP
    const emojiPattern = /([✅✔️☑️🎯])[\s]*(TP|TARGET)/gi
    const emojiMatches = text.matchAll(emojiPattern)
    for (const match of emojiMatches) {
      keywords.add('TP')
    }

    return Array.from(keywords)
  }

  /**
   * Detect Entry Price keywords
   */
  private detectEntryKeywords(text: string): string[] {
    const keywords: Set<string> = new Set()
    const patterns = [
      /\b(ENTRY|PRICE|AT|ZONA)\s*[:@\-_*\s]/gi,
      /@\s*[0-9]/gi  // @ symbol
    ]

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        if (match[1]) {
          keywords.add(match[1].trim().toLowerCase())
        }
      }
    }

    // Check for @ symbol specifically
    if (/@\s*[0-9]/.test(text)) {
      keywords.add('@')
    }

    return Array.from(keywords)
  }

  /**
   * Detect TP format mode (comma-separated vs numbered)
   */
  private detectTPFormat(text: string): 'comma_separated' | 'separate_keywords' {
    // Check for numbered TP format (TP1, TP2, TP3 or TP¹, TP², TP³)
    const numberedPattern = /TP\s*[¹²³⁴⁵1-5]\s*[:@\-_*]/gi
    const numberedMatches = text.match(numberedPattern)

    if (numberedMatches && numberedMatches.length >= 2) {
      return 'separate_keywords'
    }

    // Check for comma-separated format (TP: 100, 150, 200)
    const commaPattern = /TP\s*[:@\-_*]\s*[0-9]+\.?[0-9]*\s*,/gi
    const commaMatches = text.match(commaPattern)

    if (commaMatches && commaMatches.length > 0) {
      return 'comma_separated'
    }

    // Check for repeated TP keywords (TP 100\nTP 200\nTP 300)
    const repeatedTPPattern = /\bTP\s+[0-9]/gi
    const repeatedMatches = text.match(repeatedTPPattern)

    if (repeatedMatches && repeatedMatches.length >= 2) {
      return 'separate_keywords'
    }

    // Default to separate keywords
    return 'separate_keywords'
  }

  /**
   * Detect update/modification keywords
   */
  private detectUpdateKeywords(text: string): Partial<UpdateKeywords> {
    const keywords: Partial<UpdateKeywords> = {}

    // Close commands
    if (/\b(CLOSE\s+TP\s*1)\b/gi.test(text)) {
      keywords.closeTP1 = ['close tp1']
    }
    if (/\b(CLOSE\s+TP\s*2)\b/gi.test(text)) {
      keywords.closeTP2 = ['close tp2']
    }
    if (/\b(CLOSE\s+FULL|CLOSE\s+ALL)\b/gi.test(text)) {
      keywords.closeFull = ['close full', 'close all']
    }
    if (/\b(CLOSE\s+HALF)\b/gi.test(text)) {
      keywords.closeHalf = ['close half']
    }

    // Break even
    if (/\b(BREAK\s*EVEN|BE|MOVE\s+TO\s+ENTRY)\b/gi.test(text)) {
      keywords.breakEven = ['break even', 'be']
    }

    // Set commands
    if (/\b(SET\s+TP|CHANGE\s+TP|NEW\s+TP)\b/gi.test(text)) {
      keywords.setTP = ['set tp', 'change tp']
    }
    if (/\b(SET\s+SL|CHANGE\s+SL|NEW\s+SL)\b/gi.test(text)) {
      keywords.setSL = ['set sl', 'change sl']
    }

    // Delete
    if (/\b(DELETE|REMOVE|CANCEL)\b/gi.test(text)) {
      keywords.deletePending = ['delete', 'cancel']
    }

    return keywords
  }

  /**
   * Detect additional keywords
   */
  private detectAdditionalKeywords(text: string): Partial<AdditionalKeywords> {
    const keywords: Partial<AdditionalKeywords> = {}

    if (/\b(LAYER|RE\s*ENTRY)\b/gi.test(text)) {
      keywords.layer = ['layer', 're-entry']
    }

    if (/\b(CLOSE\s+ALL)\b/gi.test(text)) {
      keywords.closeAll = ['close all']
    }

    if (/\b(DELETE\s+ALL|REMOVE\s+ALL)\b/gi.test(text)) {
      keywords.deleteAll = ['delete all']
    }

    if (/\b(MARKET|NOW)\b/gi.test(text)) {
      keywords.marketOrder = ['market', 'now']
    }

    if (/\b(REMOVE\s+SL|NO\s+SL)\b/gi.test(text)) {
      keywords.removeSL = ['remove sl', 'no sl']
    }

    return keywords
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    buy: string[],
    sell: string[],
    stopLoss: string[],
    takeProfit: string[],
    entryPoint: string[]
  ): number {
    let score = 0

    // Must have at least BUY or SELL
    if (buy.length > 0 || sell.length > 0) score += 0.4

    // TP is important
    if (takeProfit.length > 0) score += 0.3

    // SL is important
    if (stopLoss.length > 0) score += 0.2

    // Entry is nice to have
    if (entryPoint.length > 0) score += 0.1

    return score
  }

  /**
   * Generate example signals for testing
   */
  generateExamples(): string[] {
    return [
      // Standard format
      `🔔 SELL XAUUSD 4329-4332

✔️TP¹ 4325
✔️TP² 4320
✔️TP³ 4315

🚫SL 4335`,

      // Comma-separated TP
      `BUY EURUSD @ 1.1234

TP: 1.1250, 1.1270, 1.1290
SL: 1.1210`,

      // Simple format
      `LONG BTCUSD
Entry: 45000
TP1: 46000
TP2: 47000
SL: 44000`,

      // Spanish
      `VENTA EURUSD 1.1200

OBJETIVO 1: 1.1180
OBJETIVO 2: 1.1160
STOP LOSS: 1.1220`,

      // Compact format
      `SELL GBPUSD 1.2650
SL 1.2680
TP 1.2620`
    ]
  }
}

// Singleton instance
export const keywordDetector = new KeywordDetector()
