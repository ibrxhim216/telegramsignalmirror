import Anthropic from '@anthropic-ai/sdk'
import { logger } from '../utils/logger'
import { EnhancedParsedSignal, ParsedUpdate } from './enhancedSignalParser'
import { ChannelConfig } from '../types/channelConfig'

export interface LLMParseResult {
  type: 'new_signal' | 'update' | 'none'
  // New signal fields
  symbol?: string
  direction?: 'BUY' | 'SELL' | 'BUY LIMIT' | 'SELL LIMIT' | 'BUY STOP' | 'SELL STOP'
  entry?: number | number[]
  sl?: number
  tps?: number[]
  orderType?: 'MARKET' | 'LIMIT' | 'STOP'
  riskMultiplier?: number // 0.5 for "half risk"/"small position", 1.0 default
  isHedge?: boolean // true if signal explicitly says "hedge" — EA will match lots to open positions
  // Update fields
  action?: 'closeFull' | 'closePartial' | 'closeHalf' | 'closeByEntry' |
           'setSL' | 'setTP' | 'breakEven' | 'deletePending' |
           'closeAll' | 'deleteAll' | 'removeSL'
  percentage?: number
  value?: number | number[]
  // Confidence
  confidence?: number
  reasoning?: string
}

const SYSTEM_PROMPT = `You are a trading signal parser for a gold (XAUUSD) Telegram channel called XAUHQ.

Your job is to classify each message and extract actionable trading information.

Return ONLY valid JSON matching this schema:
{
  "type": "new_signal" | "update" | "none",

  // If type = "new_signal":
  "symbol": "XAUUSD",
  "direction": "BUY" | "SELL" | "BUY LIMIT" | "SELL LIMIT" | "BUY STOP" | "SELL STOP",
  "entry": number | [number, number],  // single price or range [low, high]
  "sl": number | null,                 // REQUIRED for new signals, null if missing
  "tps": [number, ...],               // array of take profit prices, empty if none
  "orderType": "MARKET" | "LIMIT" | "STOP",
  "riskMultiplier": 1.0 | 0.5,        // 0.5 if provider says "half risk"/"small position"/"risky"; 1.0 otherwise
  "isHedge": true | false,            // true ONLY if the message contains "hedge"/"HEDGE"/"hedging" AND tps is empty (see HEDGE RULES) — EA will match lots to sum of open opposite-direction positions instead of using risk-based sizing
  "confidence": 0.0-1.0,

  // If type = "update":
  "action": one of: closeFull | closePartial | closeHalf | closeByEntry | setSL | setTP | breakEven | deletePending | closeAll | deleteAll | removeSL,
  "percentage": number,               // for closePartial (0-100)
  "value": number | number[],         // for setSL (price), setTP (prices), closeByEntry (entry price)

  // Always:
  "reasoning": "brief explanation"
}

RULES FOR NEW SIGNALS:
- Only classify as "new_signal" if there is a clear DIRECTION (buy/sell) AND a stop loss price
- If SL is missing, return type "none" — do NOT create a trade without SL
- Entry can be a range like "4700/09" meaning 4700 to 4709
- "BUY NOW", "BUY LIMIT", "BUY STOP" are all BUY direction
- "MARKET" order if price is current, "LIMIT" if below market for buy/above for sell, "STOP" if above market for buy

TWO-TIER ENTRY DETECTION ("MORE @" pattern):
- Some signals list TWO separate entry lines: a primary range and a "MORE @" deeper range.
- Example:
    📈 GOLD BUY LIMIT @ 2510/12
    MORE @ 2502/06
    ❌ SL 2500
- These are meant to be TWO tiers of entries, exactly like a split entry.
- When you see this pattern, collapse EACH range to ONE representative price and return entry as [primary, more]:
  * For a range like "2510/12", take the FIRST (nearer-to-market) price → 2510
  * For "MORE @ 2502/06", take the FIRST → 2502
  * Final: entry = [2510, 2502] (2 elements)
- Same pattern for SELL: "SELL 3420/22" + "MORE SELL @ 3425/28" → entry = [3420, 3425]
- If the message has THREE tiers ("ADD @ 3051 / MORE @ 3054/56"), take the two OUTER-most (deepest primary and deepest MORE) or the first + last.
- Never return more than 2 entries in the entry array — the trading system only supports 2-tier split entry.

CONDITIONAL / CONTINGENT SIGNALS — return type "none":
- Signals that require an event to happen FIRST are NOT actionable now — return type "none".
- Examples:
  * "if your sl hit please open new buy here 4911 and sl 4908" (conditional on prior SL)
  * "If gold reaches breakeven, please maintain a pending order at 3054/56 for reentry"
  * "if price breaks 1965, signal invalid" (conditional invalidation — no action to take)
  * "wait for confirmation before entering" (no immediate action)
  * "if TP1 hits, add more at X" (conditional on TP)
- Signals prefixed with "personal trade", "not an official signal", "just my own trade", "ignore" — return type "none"

RISK MULTIPLIER RULES (set on new_signal only):
- Default riskMultiplier = 1.0 (normal signal)
- Set riskMultiplier = 0.5 if ANY of these appear in the message:
  * "half risk", "small position", "small lot size", "use small", "use half"
  * "RISKY", "risky trade", "against the trend"
  * "0.50%", "0.5%" explicitly stated as the risk (when the default is 1%)
- The multiplier is used by the EA to reduce position size — 0.5 means half the normal lots

HEDGE RULES (set on new_signal only):
- Default isHedge = false
- Set isHedge = true ONLY for SHORT hedge-modifier signals that lack TPs. Example:
    "hedge
     GOLD SELL NOW 4474
     SL 4475.5"
  These have direction+entry+SL but NO take profits — they're pure size-matched insurance legs.
- Do NOT set isHedge = true if the message is a full signal block with TPs, even if labeled HEDGE:
    "HEDGE 📉 GOLD SELL 3420/22
     🎯 TP 3410/3400/3390
     ❌ SL 3424"
  This is a full labeled signal — treat as a NORMAL new_signal (isHedge = false).
  These have their own TPs and should size by the standard risk budget, not by opposite-position lots.
- Rule of thumb: isHedge = true ⟺ "hedge" keyword present AND tps array is empty.
- When isHedge = true, the EA matches lots to the sum of open opposite-direction positions and places a single order.
- isHedge takes precedence over riskMultiplier.

RULES FOR UPDATES (no new position, modifying existing):
CRITICAL: Any message that modifies, closes, or cancels an existing trade is type="update" — NEVER "new_signal".
The type field must be "update" whenever you set an action. "new_signal" is ONLY for messages opening a brand new trade with direction+entry+SL.

- "move sl to X", "sl move to X", "sl at X" → type="update", action=setSL, value=X
- "targets: A/B/C", "TP A/B/C", "TP1 A TP2 B TP3 C", "please follow these targets: A, B, C" → type="update", action=setTP, value=[A, B, C]
- "TARGET UPDATED" followed by TP prices → type="update", action=setTP, value=[all TPs]
- "move sl to breakeven", "sl at breakeven", "be hit", "move sl at cost/entry" → type="update", action=breakEven
- "close now", "exit now", "close this trade" → type="update", action=closeFull
- "close 50%", "close half", "book half" → type="update", action=closePartial, percentage=50
- "close X%" → type="update", action=closePartial, percentage=X
- "close upper/lower buy/sell trade (price)" → type="update", action=closeByEntry, value=price
- "close only upper/lower limit X" → type="update", action=deletePending, value=X (targets specific pending order price)
- "close/cancel the X pending" → type="update", action=deletePending, value=X
- "cancel limit order", "cancel order", "ignore this signal" → type="update", action=deletePending (no value = all pending)
- "close all" → type="update", action=closeAll
- "tp1 hit", "target hit", "sl hit", "be hit", "booooom", daily summaries → type="none" (informational only)
- "REST CLOSE AT [price]" → type="update", action=setSL, value=price (moving SL up to lock in profit)
- "trail sl to entry after tp1" → this is an instruction embedded in a signal, ignore as update (return none for the update part)
- Reentry suggestions without explicit SL → type="none"

RULES FOR "UPDATED" / "UPDATE" LABELED MESSAGES:
- "Updated" or "UPDATE" at the start of a message is just a label — inspect what follows:
  - If followed by a full new signal (direction + entry + SL) → classify as "new_signal"
  - If followed by a modification instruction (move sl, close, etc.) → classify as "update"
  - If followed by a status report (sl hit, tp hit, results) → classify as "none"
- Never treat "Updated" itself as an action

IMPORTANT: Most messages are informational. When in doubt, return "none".`

class LLMSignalParser {
  private client: Anthropic | null = null
  private warnedMissingKey = false
  /** Why the last parse() returned null (surfaced in the UI so drops are never silent). */
  public lastSkipReason: string | null = null

  private getClient(): Anthropic | null {
    if (this.client) return this.client
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      if (!this.warnedMissingKey) {
        logger.warn('LLM parser disabled: ANTHROPIC_API_KEY not set in environment')
        this.warnedMissingKey = true
      }
      return null
    }
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID
    this.client = new Anthropic({
      apiKey,
      defaultHeaders: workspaceId ? { 'anthropic-workspace-id': workspaceId } : undefined
    })
    return this.client
  }

  async parse(text: string, config: ChannelConfig): Promise<EnhancedParsedSignal | null> {
    try {
      this.lastSkipReason = null
      const client = this.getClient()
      if (!client) { this.lastSkipReason = 'LLM parser disabled (no API key)'; return null }

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `Parse this message:\n\n${text}` }
        ]
      })

      const raw = response.content[0].type === 'text' ? response.content[0].text : ''

      // Extract JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        logger.debug('LLM parser: no JSON in response')
        this.lastSkipReason = 'LLM returned no structured result'
        return null
      }

      const result: LLMParseResult = JSON.parse(jsonMatch[0])

      // Safety: if action is set, force type to "update" (LLM sometimes confuses this)
      if (result.action && result.type !== 'update') {
        logger.debug(`LLM correction: action=${result.action} but type=${result.type} — forcing to update`)
        result.type = 'update'
      }

      logger.info(`LLM parsed: type=${result.type} action=${result.action || '-'} value=${JSON.stringify(result.value) || '-'} pct=${result.percentage || '-'} reasoning="${result.reasoning}"`)

      if (result.type === 'none') {
        this.lastSkipReason = result.reasoning ? `Not actionable: ${result.reasoning}` : 'Not actionable (informational message)'
        return null
      }

      if (result.type === 'new_signal') {
        return this.buildNewSignal(result, config, text)
      }

      if (result.type === 'update') {
        return this.buildUpdate(result, config, text)
      }

      return null
    } catch (error: any) {
      logger.error('LLM signal parser error:', error.message)
      this.lastSkipReason = `LLM error: ${error.message}`
      return null
    }
  }

  private buildNewSignal(result: LLMParseResult, config: ChannelConfig, rawText: string): EnhancedParsedSignal | null {
    // Hard rule: no SL = no trade
    if (!result.sl) {
      logger.debug('LLM new signal rejected: no SL')
      this.lastSkipReason = 'Signal has no stop loss — trades are never opened without one'
      return null
    }

    if (!result.direction || !result.symbol) {
      logger.debug('LLM new signal rejected: missing direction or symbol')
      this.lastSkipReason = 'Could not determine direction or symbol'
      return null
    }

    const entry = result.entry ?? undefined
    const tps = result.tps && result.tps.length > 0 ? result.tps : []

    // Normalize riskMultiplier: only allow 0.5 or 1.0.
    // Must be a real number — `null <= 0.75` is true in JS, so a null from the model
    // would otherwise silently halve every position.
    const rmRaw = result.riskMultiplier
    const riskMultiplier = (typeof rmRaw === 'number' && rmRaw > 0 && rmRaw <= 0.75) ? 0.5 : 1.0
    if (riskMultiplier < 1.0) {
      logger.info(`⚠️  Reduced risk detected: riskMultiplier=${riskMultiplier} (half-risk signal)`)
    }

    // Enforce the hedge rule in code, not just in the prompt:
    // isHedge ⟺ the message actually says "hedge" AND there are no TPs.
    // A full HEDGE-labelled signal block with TPs is a normal signal, not a size-matched leg.
    const mentionsHedge = /hedg/i.test(rawText)
    const isHedge = result.isHedge === true && mentionsHedge && tps.length === 0
    if (result.isHedge === true && !isHedge) {
      logger.info(`ℹ️  Model flagged isHedge but rule not met (hedge keyword=${mentionsHedge}, tps=${tps.length}) — treating as normal signal`)
    }
    if (isHedge) {
      logger.info(`🛡️  Hedge signal detected — EA will match lots to open opposite positions`)
    }

    return {
      symbol: result.symbol,
      direction: result.direction,
      entryPrice: entry,
      stopLoss: result.sl,
      takeProfits: tps,
      confidence: result.confidence ?? 0.85,
      riskMultiplier,
      isHedge,
      llmReasoning: result.reasoning,
      rawText,
      signalType: 'new',
      isIgnored: false,
      isSkipped: false,
      forceMarket: result.orderType === 'MARKET',
      delayMs: config.advancedSettings.delayInMsec
    }
  }

  private buildUpdate(result: LLMParseResult, config: ChannelConfig, rawText: string): EnhancedParsedSignal | null {
    if (!result.action) {
      logger.debug('LLM update rejected: no action')
      return null
    }

    const update: ParsedUpdate = {
      type: result.action as any,
      percentage: result.percentage,
      value: result.value
    }

    return {
      symbol: '',
      direction: 'BUY',
      confidence: 1.0,
      llmReasoning: result.reasoning,
      rawText,
      signalType: 'update',
      update,
      isIgnored: false,
      isSkipped: false,
      forceMarket: false,
      delayMs: config.advancedSettings.delayInMsec
    }
  }
}

export const llmSignalParser = new LLMSignalParser()
