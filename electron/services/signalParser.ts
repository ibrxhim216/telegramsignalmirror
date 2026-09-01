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
    // Check for hashtag symbol pattern first (#POL, #BTC, #XAUUSD, etc.)
    const hashtagPattern = /#([A-Z]{2,10})/
    const hashtagMatch = text.match(hashtagPattern)
    if (hashtagMatch) {
      return hashtagMatch[1]
    }

    // Forex pairs - Major pairs (7)
    const forexMajors = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD'
    ]

    // Forex pairs - Minor pairs (21)
    const forexMinors = [
      'AUDCAD', 'AUDCHF', 'AUDJPY', 'AUDNZD', 'CADCHF', 'CADJPY', 'CHFJPY',
      'EURAUD', 'EURCAD', 'EURCHF', 'EURGBP', 'EURJPY', 'EURNZD',
      'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPJPY', 'GBPNZD',
      'NZDCAD', 'NZDCHF', 'NZDJPY'
    ]

    // Forex pairs - Exotic pairs (33)
    const forexExotics = [
      'AUDSGD', 'CHFSGD', 'EURDKK', 'EURHKD', 'EURNOK', 'EURPLN', 'EURSEK', 'EURSGD', 'EURTRY', 'EURZAR',
      'GBPDKK', 'GBPNOK', 'GBPSEK', 'GBPSGD', 'GBPTRY',
      'NOKJPY', 'NOKSEK', 'SEKJPY', 'SGDJPY',
      'USDCNH', 'USDCZK', 'USDDKK', 'USDHKD', 'USDHUF', 'USDMXN', 'USDNOK', 'USDPLN', 'USDRUB', 'USDSEK', 'USDSGD', 'USDTHB', 'USDTRY', 'USDZAR'
    ]

    // Precious Metals (11)
    const metals = [
      'XAUUSD', 'XAUEUR', 'XAUAUD', 'XAUJPY', 'XAUGBP', 'XAUCHF',
      'XAGUSD', 'XAGEUR', 'XAGAUD',
      'XPTUSD', 'XPDUSD',
      'GOLD', 'SILVER'  // Alternative names
    ]

    // Spot Energies (3)
    const energies = ['XTIUSD', 'XBRUSD', 'XNGUSD']

    // Soft Commodities / Agriculture Futures (8)
    const softCommodities = ['COCOA', 'COFFEE', 'CORN', 'COTTON', 'OJ', 'SOYBEAN', 'SUGAR', 'WHEAT']

    // Indices (23)
    const indices = [
      'AUS200', 'DE40', 'F40', 'JP225', 'STOXX50', 'UK100', 'US30', 'US500', 'USTEC',
      'CA60', 'CHINA50', 'CHINAH', 'ES35', 'HK50', 'IT40', 'MIDDE50', 'NETH25', 'NOR25',
      'SA40', 'SE30', 'SWI20', 'TECDE30', 'US2000',
      // Alternative names
      'GER30', 'NAS100', 'SPX500', 'US100', 'SPX', 'DOW', 'NASDAQ'
    ]

    // Bonds (9)
    const bonds = [
      'EURBOBL', 'EURBUND', 'EURSCHATZ', 'ITBTP10Y', 'JGB10Y', 'UKGB', 'UST05Y', 'UST10Y', 'UST30Y'
    ]

    // Cryptocurrency (30+)
    const crypto = [
      'BTCUSD', 'ETHUSD', 'LTCUSD', 'BCHUSD', 'XRPUSD', 'DSHUSD', 'DOTUSD', 'XLMUSD', 'LNKUSD', 'DOGUSD',
      'XTZUSD', 'UNIUSD', 'ADAUSD', 'BNBUSD', 'EMCUSD', 'NMCUSD', 'PPCUSD', 'AVAXUSD', 'LUNAUSD', 'MATICUSD', 'GLMRUSD', 'KSMUSD',
      // USDT pairs
      'BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT', 'DOGEUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT', 'UNIUSDT',
      'POL', 'POLUSDT', 'MATIC', 'MATICUSDT'
    ]

    // Futures (5)
    const futures = ['DXYIC', 'VIX', 'BRENT', 'WTI', 'GC']

    const allSymbols = [...forexMajors, ...forexMinors, ...forexExotics, ...metals, ...energies, ...softCommodities, ...indices, ...bonds, ...crypto, ...futures]

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

    // 1. Keyword-prefixed entry wins over everything (ENTRY: 4028/32, ENTRY: 4028-4032, ENTRY: 1.2345)
    //    Check slash and dash ranges immediately after the keyword before falling to bare number.
    const keywordRangePatterns = [
      /ENTRY[:\s@]+([0-9]+\.?[0-9]*)[\/-]([0-9]+\.?[0-9]*)/gi,
      /ENTER[:\s@]+([0-9]+\.?[0-9]*)[\/-]([0-9]+\.?[0-9]*)/gi,
    ]
    for (const pattern of keywordRangePatterns) {
      const match = pattern.exec(text)
      if (match) {
        const price = parseFloat(match[1])
        if (!isNaN(price) && price > 0) return price
      }
    }

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
        if (!isNaN(price) && price > 0) prices.push(price)
      }
    }
    if (prices.length > 0) {
      return prices.length === 1 ? prices[0] : prices
    }

    // 2. Symbol-based pattern (XAUUSD 4329, EURUSD 1.2345)
    const symbolPattern = new RegExp(symbol + '\\s+([0-9]+\\.?[0-9]*)', 'i')
    const symbolMatch = symbolPattern.exec(text)
    if (symbolMatch) {
      const price = parseFloat(symbolMatch[1])
      if (!isNaN(price) && price > 0) return price
    }

    // 3. Slash range pattern (4011/21 or 4011/4021) — only if no keyword found
    const abbreviatedRangePattern = /([0-9]+\.?[0-9]*)\/([0-9]+\.?[0-9]*)/
    const abbreviatedMatch = abbreviatedRangePattern.exec(text)
    if (abbreviatedMatch) {
      const price = parseFloat(abbreviatedMatch[1])
      if (!isNaN(price) && price > 0) return price
    }

    // 4. Dash range pattern (4329-4332) — only if no keyword found
    const rangePattern = /([0-9]+\.?[0-9]*)\s*-\s*([0-9]+\.?[0-9]*)/
    const rangeMatch = rangePattern.exec(text)
    if (rangeMatch) {
      const price = parseFloat(rangeMatch[1])
      if (!isNaN(price) && price > 0) return price
    }

    return undefined
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
    // Updated to support TP1-TP10 (previously limited to TP1-TP5)
    const patterns = [
      /TP[¹²³⁴⁵⁶⁷⁸⁹¹⁰]?\s*[:@]?\s*([0-9]+\.?[0-9]*)/gi,  // TP¹ 4325 or TP1: 1.2345 (supports superscripts 1-10)
      /TP\s*(?:[1-9]|10)?[:\s@]+([0-9]+\.[0-9]+)/gi,      // TP 1-10 with decimal
      /TP\s*(?:[1-9]|10)?[:\s@]+([0-9]+)/gi,             // TP 1-10 without decimal (for Gold, indices)
      /TAKE\s*PROFIT\s*(?:[1-9]|10)?[:\s@]+([0-9]+\.[0-9]+)/gi,
      /TARGET\s*(?:[1-9]|10)?[:\s@]+([0-9]+\.[0-9]+)/gi,
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
