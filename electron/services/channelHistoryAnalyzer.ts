/**
 * Channel History Analyzer
 *
 * Takes a batch of exported channel messages and asks Claude (one call) to describe the
 * provider's signal format and draft a channel configuration: keywords, format flags,
 * and a handful of representative example messages.
 *
 * DESIGN NOTE — keep this module free of Electron / app-specific imports.
 * It depends only on `@anthropic-ai/sdk` and environment variables, so the cloud worker
 * can import the same file unchanged. Logging is injected by the caller.
 */

import Anthropic from '@anthropic-ai/sdk'

/** One exported message. Text only — media-only posts are never included. */
export interface HistoryMessage {
  id: number
  date: string            // ISO-8601
  text: string
  replyToMsgId: number | null
  hasMedia: boolean       // true when the text was a caption on an image/file
}

/** Draft configuration produced from history. Shape mirrors the app's DetectedKeywords. */
export interface ChannelAnalysis {
  signalKeywords: {
    entryPoint?: string[]
    buy?: string[]
    sell?: string[]
    stopLoss?: string[]
    takeProfit?: string[]
  }
  updateKeywords: {
    closeFull?: string[]
    closeHalf?: string[]
    closePartial?: string[]
    breakEven?: string[]
    setTP?: string[]
    setSL?: string[]
    deletePending?: string[]
  }
  additionalKeywords: {
    layer?: string[]
    closeAll?: string[]
    deleteAll?: string[]
    ignoreKeyword?: string[]
    skipKeyword?: string[]
  }
  advancedSettings: {
    entryRangeStrategy?: 'first' | 'last' | 'middle'
    splitEntryMode?: boolean
    slInPips?: boolean
    tpInPips?: boolean
    tpFormatMode?: 'comma_separated' | 'separate_keywords'
  }
  detectedTPFormat: 'comma_separated' | 'separate_keywords'
  confidence: number
  suggestions: string[]
  summary: string
  examples: {
    signals: string[]     // 3–8 verbatim new-signal messages that best represent the format(s)
    updates: string[]     // 3–8 verbatim management messages (close / move SL / TP change)
  }
  stats: {
    messagesAnalyzed: number
    bytesAnalyzed: number
    oldest: string | null
    newest: string | null
    estimatedSignals: number
  }
}

export interface AnalyzeOptions {
  channelName?: string
  model?: string
  maxInputChars?: number   // hard cap on prompt size; oldest messages are dropped first
  log?: (message: string) => void
}

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const DEFAULT_MAX_INPUT_CHARS = 160_000  // ~40k tokens; comfortably inside Haiku's window

const ANALYSIS_PROMPT = `You are configuring an automated trade copier for a Telegram signal channel.
You will be given a chronological export of the channel's recent messages (text only).

Your job: describe how THIS provider formats signals and trade-management messages, then
draft a configuration the copier can use. Be conservative — only include keywords you
actually observe in the messages. Prefer short, literal tokens exactly as the provider writes them.

Return ONLY valid JSON with this shape:
{
  "signalKeywords": {
    "entryPoint": ["..."],     // words/labels that precede the entry price, e.g. "ENTRY", "@", "BUY LIMIT"
    "buy": ["..."],            // e.g. "BUY", "BUY LIMIT", "BUY NOW", "LONG"
    "sell": ["..."],           // e.g. "SELL", "SELL LIMIT", "SHORT"
    "stopLoss": ["..."],       // e.g. "SL", "STOP LOSS", "STOP"
    "takeProfit": ["..."]      // e.g. "TP", "TP1", "TARGET", "TAKE PROFIT"
  },
  "updateKeywords": {
    "closeFull": ["..."],      // e.g. "close now", "exit", "close this trade"
    "closeHalf": ["..."],      // e.g. "close half", "book half"
    "closePartial": ["..."],   // e.g. "close 50%", "book partial"
    "breakEven": ["..."],      // e.g. "breakeven", "sl at cost", "move sl to entry"
    "setTP": ["..."],          // e.g. "target updated", "new tp"
    "setSL": ["..."],          // e.g. "move sl to", "sl move"
    "deletePending": ["..."]   // e.g. "cancel limit", "cancel order", "ignore this signal"
  },
  "additionalKeywords": {
    "layer": ["..."],          // re-entry / add-more phrases, e.g. "reentry", "add more", "MORE @"
    "closeAll": ["..."],       // e.g. "close all"
    "deleteAll": ["..."],      // e.g. "cancel all pending"
    "ignoreKeyword": ["..."],  // phrases marking a post as NOT a real signal, e.g. "personal trade", "not an official signal"
    "skipKeyword": ["..."]     // phrases meaning "skip this one", e.g. "no confirmation = no trade"
  },
  "advancedSettings": {
    "entryRangeStrategy": "first" | "last" | "middle",   // how a range like "4028/32" should be treated if NOT split
    "splitEntryMode": true | false,   // true if the provider routinely gives TWO entry levels meant as two orders ("4028/32", "MORE @")
    "slInPips": true | false,         // true only if SL is written as a pip distance rather than a price
    "tpInPips": true | false,         // true only if TPs are written as pip distances rather than prices
    "tpFormatMode": "comma_separated" | "separate_keywords"  // "TP: 100, 150" vs "TP1: 100 / TP2: 150"
  },
  "detectedTPFormat": "comma_separated" | "separate_keywords",
  "confidence": 0.0-1.0,     // how consistent and unambiguous the provider's format is
  "suggestions": ["..."],    // 2–6 short notes a human should know before enabling this channel (quirks, risks, edge cases)
  "summary": "...",          // 2–4 sentences: instruments traded, typical signal shape, how management messages look
  "examples": {
    "signals": ["..."],      // 3–8 VERBATIM messages that are clear new-trade signals, covering each distinct format you saw
    "updates": ["..."]       // 3–8 VERBATIM trade-management messages (close, move SL, TP change, cancel)
  },
  "estimatedSignals": 0      // rough count of new-trade signals in the export
}

Rules:
- Keywords are matched by substring, and closeFull is checked BEFORE closePartial/closeHalf.
  So NEVER emit a bare generic word like "close", "exit", "book", "sl", "tp" as a management keyword —
  use the distinguishing phrase instead ("close now", "close this trade", "close 50%", "book half").
- Do not put the same phrase in more than one keyword list.
- Copy example messages VERBATIM. Do not paraphrase or trim them.
- If the provider uses abbreviated ranges like "4028/32" (meaning 4028 and 4032), say so in suggestions.
- If entries are frequently posted without TPs and TPs arrive in a later message, say so in suggestions.
- If the provider uses "hedge" posts, mention it in suggestions.
- Never invent keywords you did not see.`

/**
 * Trim the export to fit the prompt budget, dropping the OLDEST messages first.
 * Returns the kept messages (still chronological) and the byte count kept.
 */
function fitToBudget(messages: HistoryMessage[], maxChars: number): { kept: HistoryMessage[]; chars: number } {
  // Walk from newest to oldest so the most recent formatting is always represented.
  const newestFirst = [...messages].sort((a, b) => b.id - a.id)
  const kept: HistoryMessage[] = []
  let chars = 0
  for (const m of newestFirst) {
    const cost = m.text.length + 40 // header overhead per message
    if (chars + cost > maxChars) break
    kept.push(m)
    chars += cost
  }
  kept.sort((a, b) => a.id - b.id)
  return { kept, chars }
}

function formatForPrompt(messages: HistoryMessage[]): string {
  return messages
    .map(m => {
      const reply = m.replyToMsgId ? ` (reply to #${m.replyToMsgId})` : ''
      const media = m.hasMedia ? ' [caption]' : ''
      return `--- #${m.id} ${m.date}${reply}${media}\n${m.text}`
    })
    .join('\n\n')
}

/** Coerce anything model-shaped into a clean string[] (dedupe, trim, drop empties). */
function cleanList(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of v) {
    if (typeof item !== 'string') continue
    const s = item.trim()
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
    if (out.length >= max) break
  }
  return out
}

function cleanBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function cleanEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

/**
 * Management keywords are matched by substring and evaluated in a fixed priority order
 * (closeAll → … → closeFull → closeHalf → closePartial → …). A bare generic token such as
 * "close" in closeFull would therefore hijack "close 50%". This pass:
 *   1. drops single generic words that can never be safely matched on their own,
 *   2. removes any keyword that also appears in a higher-priority list (exact match), and
 *   3. removes closeFull entries that are a substring of a closeHalf/closePartial entry.
 */
const GENERIC_TOKENS = new Set(['close', 'closed', 'exit', 'book', 'sl', 'tp', 'stop', 'target', 'targets', 'update', 'updated', 'now', 'trade'])

function sanitizeManagementKeywords(
  update: ChannelAnalysis['updateKeywords'],
  additional: ChannelAnalysis['additionalKeywords']
): { update: ChannelAnalysis['updateKeywords']; additional: ChannelAnalysis['additionalKeywords'] } {
  const norm = (s: string) => s.trim().toLowerCase()
  const dropGeneric = (list: string[] = []) => list.filter(k => !GENERIC_TOKENS.has(norm(k)))

  const u: ChannelAnalysis['updateKeywords'] = {
    closeFull: dropGeneric(update.closeFull),
    closeHalf: dropGeneric(update.closeHalf),
    closePartial: dropGeneric(update.closePartial),
    breakEven: dropGeneric(update.breakEven),
    setTP: dropGeneric(update.setTP),
    setSL: dropGeneric(update.setSL),
    deletePending: dropGeneric(update.deletePending)
  }
  const a: ChannelAnalysis['additionalKeywords'] = {
    layer: dropGeneric(additional.layer),
    closeAll: dropGeneric(additional.closeAll),
    deleteAll: dropGeneric(additional.deleteAll),
    ignoreKeyword: dropGeneric(additional.ignoreKeyword),
    skipKeyword: dropGeneric(additional.skipKeyword)
  }

  // closeAll / deleteAll win over everything — remove exact duplicates from the update lists
  const globalSet = new Set([...(a.closeAll || []), ...(a.deleteAll || [])].map(norm))
  for (const key of Object.keys(u) as (keyof typeof u)[]) {
    u[key] = (u[key] || []).filter(k => !globalSet.has(norm(k)))
  }

  // closeFull must not be a substring of a more specific partial/half phrase
  const partialPhrases = [...(u.closeHalf || []), ...(u.closePartial || [])].map(norm)
  u.closeFull = (u.closeFull || []).filter(k => !partialPhrases.some(p => p !== norm(k) && p.includes(norm(k))))

  return { update: u, additional: a }
}

/**
 * Analyze a channel's exported history and return a draft configuration.
 * Throws if the API key is missing or the model returns something unparseable.
 */
export async function analyzeChannelHistory(
  messages: HistoryMessage[],
  options: AnalyzeOptions = {}
): Promise<ChannelAnalysis> {
  const log = options.log ?? (() => {})
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — history analysis requires it')
  }

  const textOnly = messages.filter(m => m.text && m.text.trim().length > 0)
  if (textOnly.length === 0) {
    throw new Error('No text messages to analyze')
  }

  const { kept, chars } = fitToBudget(textOnly, options.maxInputChars ?? DEFAULT_MAX_INPUT_CHARS)
  log(`Analyzing ${kept.length}/${textOnly.length} messages (${chars} chars)`)

  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID
  const client = new Anthropic({
    apiKey,
    defaultHeaders: workspaceId ? { 'anthropic-workspace-id': workspaceId } : undefined
  })

  const channelLabel = options.channelName ? `Channel: ${options.channelName}\n\n` : ''
  const response = await client.messages.create({
    model: options.model ?? DEFAULT_MODEL,
    max_tokens: 4096,
    system: ANALYSIS_PROMPT,
    messages: [
      { role: 'user', content: `${channelLabel}${formatForPrompt(kept)}` }
    ]
  })

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Model response did not contain JSON')
  }

  let parsed: any
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch (e: any) {
    throw new Error(`Model returned invalid JSON: ${e.message}`)
  }

  // Validate / normalize every field so the UI and config layer never see junk.
  const sk = parsed.signalKeywords ?? {}
  const uk = parsed.updateKeywords ?? {}
  const ak = parsed.additionalKeywords ?? {}
  const adv = parsed.advancedSettings ?? {}
  const ex = parsed.examples ?? {}

  const tpFormat = cleanEnum(parsed.detectedTPFormat ?? adv.tpFormatMode,
    ['comma_separated', 'separate_keywords'] as const, 'separate_keywords')

  const confidenceRaw = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
  const confidence = Math.max(0, Math.min(1, confidenceRaw))

  const dates = kept.map(m => m.date).sort()

  const { update: updateKeywords, additional: additionalKeywords } = sanitizeManagementKeywords(
    {
      closeFull: cleanList(uk.closeFull),
      closeHalf: cleanList(uk.closeHalf),
      closePartial: cleanList(uk.closePartial),
      breakEven: cleanList(uk.breakEven),
      setTP: cleanList(uk.setTP),
      setSL: cleanList(uk.setSL),
      deletePending: cleanList(uk.deletePending)
    },
    {
      layer: cleanList(ak.layer),
      closeAll: cleanList(ak.closeAll),
      deleteAll: cleanList(ak.deleteAll),
      ignoreKeyword: cleanList(ak.ignoreKeyword),
      skipKeyword: cleanList(ak.skipKeyword)
    }
  )

  return {
    signalKeywords: {
      entryPoint: cleanList(sk.entryPoint),
      buy: cleanList(sk.buy),
      sell: cleanList(sk.sell),
      stopLoss: cleanList(sk.stopLoss),
      takeProfit: cleanList(sk.takeProfit)
    },
    updateKeywords,
    additionalKeywords,
    advancedSettings: {
      entryRangeStrategy: cleanEnum(adv.entryRangeStrategy, ['first', 'last', 'middle'] as const, 'first'),
      splitEntryMode: cleanBool(adv.splitEntryMode, false),
      slInPips: cleanBool(adv.slInPips, false),
      tpInPips: cleanBool(adv.tpInPips, false),
      tpFormatMode: tpFormat
    },
    detectedTPFormat: tpFormat,
    confidence,
    suggestions: cleanList(parsed.suggestions, 8),
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    examples: {
      signals: cleanList(ex.signals, 8),
      updates: cleanList(ex.updates, 8)
    },
    stats: {
      messagesAnalyzed: kept.length,
      bytesAnalyzed: chars,
      oldest: dates[0] ?? null,
      newest: dates[dates.length - 1] ?? null,
      estimatedSignals: typeof parsed.estimatedSignals === 'number' ? Math.max(0, Math.round(parsed.estimatedSignals)) : 0
    }
  }
}
