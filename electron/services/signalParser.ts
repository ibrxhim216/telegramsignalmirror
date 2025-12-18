import natural from 'natural'
import { logger } from '../utils/logger'

export interface ParsedSignal {
  symbol: string
  direction: 'BUY' | 'SELL' | 'BUY STOP' | 'SELL STOP' | 'BUY LIMIT' | 'SELL LIMIT'
  entryPrice?: number | number[]
  stopLoss?: number
  takeProfits?: number[]
  confidence: number
  rawText: string
}

export class SignalParser {
  private tokenizer: natural.WordTokenizer

  constructor() {
    this.tokenizer = new natural.WordTokenizer()
  }

  parse(text: string): ParsedSignal | null {
    try {
      const normalized = text.toUpperCase()

      // Extract symbol
      const symbol = this.extractSymbol(normalized)
      if (!symbol) {
        logger.debug('No symbol found in message')
        return null
      }

      // Extract direction
      const direction = this.extractDirection(normalized)
      if (!direction) {
        logger.debug('No direction found in message')
        return null
      }

      // Extract entry price(s)
      const entryPrice = this.extractEntryPrice(normalized, symbol)

      // Extract stop loss
      const stopLoss = this.extractStopLoss(normalized)

      // Extract take profits
      const takeProfits = this.extractTakeProfits(normalized)

      // Calculate confidence score
      const confidence = this.calculateConfidence(symbol, direction, entryPrice, stopLoss, takeProfits)

      if (confidence < 0.5) {
        logger.debug('Low confidence signal, ignoring')
        return null
      }

      return {
        symbol,
        direction,
        entryPrice,
        stopLoss,
        takeProfits,
        confidence,
        rawText: text,
      }
    } catch (error: any) {
      logger.error('Signal parsing error:', error)
      return null
    }
  }

  private extractSymbol(text: string): string | null {
    // Common forex pairs
    const forexPairs = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
      'EURJPY', 'GBPJPY', 'EURGBP', 'AUDJPY', 'EURAUD', 'EURCHF', 'AUDNZD',
      'GBPAUD', 'GBPCAD', 'GBPCHF', 'CADCHF', 'CADJPY', 'AUDCAD', 'NZDJPY',
    ]

    // Gold and metals
    const metals = ['XAUUSD', 'XAGUSD', 'GOLD', 'SILVER']

    // Indices
    const indices = [
      'US30', 'NAS100', 'SPX500', 'GER30', 'UK100', 'JPN225', 'AUS200',
      'US100', 'USTEC', 'SPX', 'DOW', 'NASDAQ'
    ]

    // Crypto
    const crypto = ['BTCUSD', 'ETHUSD', 'BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'BNBUSDT']

    const allSymbols = [...forexPairs, ...metals, ...indices, ...crypto]

    // Look for exact matches
    for (const symbol of allSymbols) {
      if (text.includes(symbol)) {
        return symbol
      }
    }

    // Look for patterns like EUR/USD, GBP/JPY
    const slashPattern = /([A-Z]{3})[\/\s]([A-Z]{3})/
    const match = text.match(slashPattern)
    if (match) {
      return match[1] + match[2]
    }

    // Look for 6-letter currency pairs
    const pairPattern = /\b([A-Z]{6})\b/
    const pairMatch = text.match(pairPattern)
    if (pairMatch) {
      return pairMatch[1]
    }

    return null
  }

  private extractDirection(text: string): ParsedSignal['direction'] | null {
    if (text.includes('BUY STOP')) return 'BUY STOP'
    if (text.includes('SELL STOP')) return 'SELL STOP'
    if (text.includes('BUY LIMIT')) return 'BUY LIMIT'
    if (text.includes('SELL LIMIT')) return 'SELL LIMIT'
    if (text.includes('BUY') || text.includes('LONG')) return 'BUY'
    if (text.includes('SELL') || text.includes('SHORT')) return 'SELL'

    return null
  }

  private extractEntryPrice(text: string, symbol: string): number | number[] | undefined {
    const prices: number[] = []

    // 1. Check for range pattern first (4329-4332) - takes first number
    const rangePattern = /([0-9]+\.?[0-9]*)\s*-\s*([0-9]+\.?[0-9]*)/
    const rangeMatch = rangePattern.exec(text)
    if (rangeMatch) {
      const price = parseFloat(rangeMatch[1])
      if (!isNaN(price) && price > 0) {
        return price  // Return first number from range
      }
    }

    // 2. Check for symbol-based pattern (XAUUSD 4329, EURUSD 1.2345)
    const symbolPattern = new RegExp(symbol + '\\s+([0-9]+\\.?[0-9]*)', 'i')
    const symbolMatch = symbolPattern.exec(text)
    if (symbolMatch) {
      const price = parseFloat(symbolMatch[1])
      if (!isNaN(price) && price > 0) {
        prices.push(price)
      }
    }

    // 3. Check for keyword-based patterns (ENTRY:, @, PRICE:)
    const keywordPatterns = [
      /ENTRY[:\s@]+([0-9]+\.?[0-9]*)/gi,
      /ENTER[:\s@]+([0-9]+\.?[0-9]*)/gi,
      /@\s*([0-9]+\.?[0-9]*)/g,
      /PRICE[:\s]+([0-9]+\.?[0-9]*)/gi,
    ]

    for (const pattern of keywordPatterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        const price = parseFloat(match[1])
        if (!isNaN(price) && price > 0) {
          prices.push(price)
        }
      }
    }

    if (prices.length === 0) return undefined
    if (prices.length === 1) return prices[0]
    return prices
  }

  private extractStopLoss(text: string): number | undefined {
    // Look for patterns like "SL: 1.2345", "STOP LOSS: 1.2345", "SL @ 1.2345", "SL 4336"
    const patterns = [
      /SL[:\s@]+([0-9]+\.?[0-9]*)/gi,
      /STOP\s*LOSS[:\s@]+([0-9]+\.?[0-9]*)/gi,
      /STOP[:\s@]+([0-9]+\.?[0-9]*)/gi,
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        const sl = parseFloat(match[1])
        if (!isNaN(sl) && sl > 0) {
          return sl
        }
      }
    }

    // Look for SL in pips
    const pipsPattern = /SL[:\s]+([0-9]+)\s*PIPS?/gi
    const pipsMatch = text.match(pipsPattern)
    if (pipsMatch) {
      const pips = parseFloat(pipsMatch[1])
      if (!isNaN(pips) && pips > 0) {
        // Return negative to indicate pips (will be calculated based on entry)
        return -pips
      }
    }

    return undefined
  }

  private extractTakeProfits(text: string): number[] | undefined {
    // Look for patterns like "TP1: 1.2345", "TP¹ 4325", "TP 1 @ 1.2345", "TAKE PROFIT: 1.2345"
    const patterns = [
      /TP[¹²³⁴⁵]?\s*[:@]?\s*([0-9]+\.?[0-9]*)/gi,  // TP¹ 4325 or TP1: 1.2345 (supports superscripts)
      /TP\s*[1-5]?[:\s@]+([0-9]+\.[0-9]+)/gi,
      /TAKE\s*PROFIT\s*[1-5]?[:\s@]+([0-9]+\.[0-9]+)/gi,
      /TARGET\s*[1-5]?[:\s@]+([0-9]+\.[0-9]+)/gi,
    ]

    const tps: number[] = []

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        const tp = parseFloat(match[1])
        if (!isNaN(tp) && tp > 0) {
          tps.push(tp)
        }
      }
    }

    return tps.length > 0 ? tps : undefined
  }

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
   * Test the parser with a sample signal
   */
  test(text: string): void {
    logger.info('Testing signal parser...')
    logger.info(`Input: ${text}`)
    const result = this.parse(text)
    if (result) {
      logger.info('Parsed result:', result)
    } else {
      logger.info('Failed to parse signal')
    }
  }
}
