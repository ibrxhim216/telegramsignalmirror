/**
 * Signal Modification Types
 *
 * Handles modifications to existing trades sent as replies to original signals
 * Examples: "Move to BE", "Close 50%", "Cancel order", "Trail SL"
 */

export type ModificationType =
  | 'move_to_breakeven'      // Move SL to entry (breakeven)
  | 'close_partial'          // Close X% of position
  | 'close_all'              // Close entire position
  | 'cancel_pending'         // Cancel pending order
  | 'update_sl'              // Update SL to new price/level
  | 'update_tp'              // Update TP to new price/level
  | 'enable_trailing'        // Enable trailing stop
  | 'disable_trailing'       // Disable trailing stop
  | 'update_entry'           // Update pending order entry price

export interface ModificationKeywords {
  // Move to Breakeven
  breakeven: string[]        // ["move to be", "sl to entry", "breakeven", "be", "move sl to be"]

  // Close Position
  closePartial: string[]     // ["close", "take profit", "tp hit", "book profit"]
  closeAll: string[]         // ["close all", "exit", "exit all", "close position"]

  // Cancel Pending
  cancel: string[]           // ["cancel", "delete", "remove", "cancel order"]

  // Update SL
  updateSL: string[]         // ["sl to", "move sl", "stop to", "sl:", "stop loss to"]

  // Update TP
  updateTP: string[]         // ["tp to", "target", "new tp", "tp:", "take profit to"]

  // Trailing Stop
  enableTrailing: string[]   // ["trail", "trailing", "activate trail", "trail sl"]
  disableTrailing: string[]  // ["stop trailing", "disable trail", "remove trail"]

  // Update Entry (pending orders)
  updateEntry: string[]      // ["entry to", "change entry", "new entry", "entry:"]
}

export interface SignalModification {
  id: string                 // Unique modification ID
  signalId: string           // Original signal ID this modifies
  messageId: number          // Telegram message ID of modification
  replyToMessageId: number   // Original signal's message ID
  channelId: number          // Channel ID

  type: ModificationType     // Type of modification

  // Modification parameters (depends on type)
  value?: number             // Generic value (percentage, pips, price)
  price?: number             // Specific price level
  pips?: number              // Pips distance
  percentage?: number        // Percentage (for partial close)

  // Metadata
  rawText: string            // Original message text
  parsedAt: string           // When parsed
  appliedAt?: string         // When applied to trades
  status: 'pending' | 'applied' | 'failed' | 'ignored'

  // Applied to which trades
  affectedTickets: string[]  // MT5 ticket numbers affected
  errorMessage?: string      // If failed
}

export interface ModificationSettings {
  enabled: boolean           // Enable modification detection

  // Auto-apply settings
  autoApply: boolean         // Auto-apply modifications without confirmation

  // Selective confirmation - require confirmation for these types
  requireConfirmation: ModificationType[]  // e.g., ['close_all', 'cancel_pending']

  // Keywords (channel-specific)
  keywords: ModificationKeywords

  // Advanced
  detectRepliesOnly: boolean // Only process modifications that are replies
  allowManualModifications: boolean // Allow non-reply modifications (advanced)
}

export const DEFAULT_MODIFICATION_KEYWORDS: ModificationKeywords = {
  breakeven: [
    'move to be',
    'sl to be',
    'sl to entry',
    'breakeven',
    'be',
    'move sl to be',
    'move stop to entry',
    'break even'
  ],

  closePartial: [
    'close',
    'take profit',
    'book profit',
    'partial close',
    'exit',
    'tp hit',
    'target hit'
  ],

  closeAll: [
    'close all',
    'exit all',
    'close position',
    'exit position',
    'full exit',
    'close everything'
  ],

  cancel: [
    'cancel',
    'delete',
    'remove',
    'cancel order',
    'delete order',
    'remove order',
    'cancel pending'
  ],

  updateSL: [
    'sl to',
    'move sl to',
    'stop to',
    'sl:',
    'stop loss to',
    'move stop to',
    'change sl',
    'update sl'
  ],

  updateTP: [
    'tp to',
    'tp:',
    'target',
    'target to',
    'new tp',
    'take profit to',
    'change tp',
    'update tp',
    'new target'
  ],

  enableTrailing: [
    'trail',
    'trailing',
    'activate trail',
    'trail sl',
    'trailing stop',
    'start trailing',
    'enable trail'
  ],

  disableTrailing: [
    'stop trailing',
    'disable trail',
    'remove trail',
    'cancel trailing',
    'no trail'
  ],

  updateEntry: [
    'entry to',
    'change entry',
    'new entry',
    'entry:',
    'update entry',
    'move entry'
  ]
}

export const DEFAULT_MODIFICATION_SETTINGS: ModificationSettings = {
  enabled: true,
  autoApply: true,

  // Require confirmation for risky actions
  requireConfirmation: ['close_all', 'cancel_pending'],

  keywords: DEFAULT_MODIFICATION_KEYWORDS,

  detectRepliesOnly: true,   // Only process replies by default
  allowManualModifications: false
}

/**
 * Parse percentage from text
 * Examples: "50%", "close 50", "half" -> 50
 */
export function parsePercentage(text: string): number | undefined {
  // Check for "half" or "50%" patterns
  if (/\bhalf\b/i.test(text)) return 50
  if (/\bquarter\b/i.test(text)) return 25
  if (/\ball\b/i.test(text)) return 100

  // Match percentage: "50%", "50 %", "50percent"
  const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/i)
  if (percentMatch) return parseFloat(percentMatch[1])

  // Match just number after "close" keyword: "close 50"
  const closeMatch = text.match(/close\s+(\d+(?:\.\d+)?)/i)
  if (closeMatch) return parseFloat(closeMatch[1])

  return undefined
}

/**
 * Parse price from text
 * Examples: "4050.5", "to 4050", "at 4050.25"
 */
export function parsePrice(text: string): number | undefined {
  // Match price patterns: "4050.5", "to 4050", "at 4050.25"
  const priceMatch = text.match(/(?:to|at|:|=)?\s*(\d+(?:\.\d+)?)/i)
  if (priceMatch) {
    const price = parseFloat(priceMatch[1])
    // Basic validation - price should be reasonable (> 0.001)
    if (price > 0.001) return price
  }
  return undefined
}

/**
 * Parse pips from text
 * Examples: "20 pips", "trail by 10", "10 pip"
 */
export function parsePips(text: string): number | undefined {
  // Match pips patterns
  const pipsMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:pips?|points?)/i)
  if (pipsMatch) return parseFloat(pipsMatch[1])

  // Match "by X" pattern for trailing
  const byMatch = text.match(/by\s+(\d+(?:\.\d+)?)/i)
  if (byMatch) return parseFloat(byMatch[1])

  return undefined
}
