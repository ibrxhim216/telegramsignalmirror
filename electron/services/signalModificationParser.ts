/**
 * Signal Modification Parser
 *
 * Parses modification messages (replies to original signals)
 * Examples: "Move to BE", "Close 50%", "Cancel order"
 */

import { logger } from '../utils/logger'
import type {
  ModificationType,
  SignalModification,
  parsePercentage,
  parsePrice,
  parsePips
} from '../types/signalModification'
import type { ChannelConfig } from '../types/channelConfig'

// Re-export helper functions
export { parsePercentage, parsePrice, parsePips } from '../types/signalModification'

export class SignalModificationParser {
  /**
   * Parse a modification message (ONLY called for replies to specific signals)
   */
  parseModification(
    text: string,
    config: ChannelConfig,
    originalSignalId: string,
    messageId: number,
    replyToMessageId: number,
    channelId: number
  ): SignalModification | null {
    const textLower = text.toLowerCase().trim()

    // Try to match each modification type
    // IMPORTANT: Pass isReply=true since this function is ONLY called for replies
    const modificationType = this.detectModificationType(textLower, config, true)

    if (!modificationType) {
      logger.debug(`No modification detected in message: ${text.substring(0, 50)}`)
      return null
    }

    logger.info(`Detected modification type: ${modificationType}`)

    // Extract modification parameters based on type
    const modification: SignalModification = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      signalId: originalSignalId,
      messageId,
      replyToMessageId,
      channelId,
      type: modificationType,
      rawText: text,
      parsedAt: new Date().toISOString(),
      status: 'pending',
      affectedTickets: []
    }

    // Extract values based on modification type
    switch (modificationType) {
      case 'move_to_breakeven':
        // No additional params needed
        break

      case 'close_partial':
        {
          const { parsePercentage } = require('../types/signalModification')
          modification.percentage = parsePercentage(textLower)
          if (!modification.percentage) {
            // If no percentage found, default to 100% (close entire position)
            // This handles cases like replying with just "close" to a specific trade
            logger.info(`No percentage found in "${text}", defaulting to 100%`)
            modification.percentage = 100
          }

          // Track whether this was "close" or "delete" intent
          // This helps the modification service send the correct command type to EA
          if (this.matchesKeywords(textLower, config.updateKeywords.deletePending)) {
            modification.originalAction = 'delete'
            logger.debug('Original action: delete (pending order)')
          } else {
            modification.originalAction = 'close'
            logger.debug('Original action: close (active position)')
          }
        }
        break

      case 'close_all':
        // No additional params needed
        break

      case 'cancel_pending':
        // No additional params needed
        break

      case 'update_sl':
        {
          const { parsePrice, parsePips } = require('../types/signalModification')
          // Try to parse as price first
          modification.price = parsePrice(textLower)
          if (!modification.price) {
            // Try as pips
            modification.pips = parsePips(textLower)
          }
          if (!modification.price && !modification.pips) {
            logger.warn(`Could not parse SL value from: ${text}`)
            return null
          }
        }
        break

      case 'update_tp':
        {
          const { parsePrice, parsePips } = require('../types/signalModification')
          // Try to parse as price first
          modification.price = parsePrice(textLower)
          if (!modification.price) {
            // Try as pips
            modification.pips = parsePips(textLower)
          }
          if (!modification.price && !modification.pips) {
            logger.warn(`Could not parse TP value from: ${text}`)
            return null
          }
        }
        break

      case 'enable_trailing':
        {
          const { parsePips } = require('../types/signalModification')
          // Try to extract trailing distance
          modification.pips = parsePips(textLower)
          // If no pips specified, use default from channel config
          if (!modification.pips) {
            modification.pips = config.trailingStop.trailingDistancePips
          }
        }
        break

      case 'disable_trailing':
        // No additional params needed
        break

      case 'update_entry':
        {
          const { parsePrice } = require('../types/signalModification')
          modification.price = parsePrice(textLower)
          if (!modification.price) {
            logger.warn(`Could not parse entry price from: ${text}`)
            return null
          }
        }
        break
    }

    logger.info(`Parsed modification: ${JSON.stringify(modification)}`)
    return modification
  }

  /**
   * Detect modification type from text
   */
  private detectModificationType(
    text: string,
    config: ChannelConfig,
    isReply: boolean = false
  ): ModificationType | null {
    const keywords = config.updateKeywords
    const additional = config.additionalKeywords

    // Check each modification type

    // 1. Move to Breakeven
    if (this.matchesKeywords(text, keywords.breakEven)) {
      return 'move_to_breakeven'
    }

    // 2. Close All - ONLY check if NOT a reply to specific signal
    //    If it's a reply, skip this check entirely (handled below as close_partial)
    if (!isReply && (this.matchesKeywords(text, additional.closeAll) ||
                     this.matchesKeywords(text, keywords.closeFull))) {
      return 'close_all'
    }

    // 3. Close Partial OR close/delete keywords on a reply (treat as close 100%)
    //    This handles both active trades and pending orders on replies
    if (this.matchesKeywords(text, keywords.closePartial) ||
        this.matchesKeywords(text, keywords.closeHalf) ||
        this.matchesKeywords(text, keywords.closeTP1) ||
        this.matchesKeywords(text, keywords.closeTP2) ||
        this.matchesKeywords(text, keywords.closeTP3) ||
        this.matchesKeywords(text, keywords.closeTP4) ||
        (isReply && this.matchesKeywords(text, keywords.closeFull)) ||
        (isReply && this.matchesKeywords(text, keywords.deletePending))) {
      return 'close_partial'
    }

    // 4. Cancel Pending - ONLY check if NOT a reply to specific signal
    //    If it's a reply, skip this check (handled above as close_partial)
    if (!isReply && (this.matchesKeywords(text, keywords.deletePending) ||
                     this.matchesKeywords(text, additional.deleteAll))) {
      return 'cancel_pending'
    }

    // 5. Update SL
    if (this.matchesKeywords(text, keywords.setSL)) {
      return 'update_sl'
    }

    // 6. Update TP
    if (this.matchesKeywords(text, keywords.setTP) ||
        this.matchesKeywords(text, keywords.setTP1) ||
        this.matchesKeywords(text, keywords.setTP2) ||
        this.matchesKeywords(text, keywords.setTP3) ||
        this.matchesKeywords(text, keywords.setTP4) ||
        this.matchesKeywords(text, keywords.setTP5)) {
      return 'update_tp'
    }

    // 7. Enable/Disable Trailing
    // Check for "stop trailing" or "disable trail" first
    if (/stop\s+trail|disable\s+trail|remove\s+trail|cancel\s+trail/i.test(text)) {
      return 'disable_trailing'
    }
    if (/trail|trailing/i.test(text)) {
      return 'enable_trailing'
    }

    // 8. Update Entry (for pending orders)
    // This needs to be checked carefully to avoid false positives
    if (/(?:entry|price)\s+(?:to|at|:)\s*\d+/i.test(text) && /pending|limit|stop/i.test(text)) {
      return 'update_entry'
    }

    return null
  }

  /**
   * Check if text matches any of the keywords
   */
  private matchesKeywords(text: string, keywords: string[]): boolean {
    if (keywords.length === 0) return false

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase()
      // Use word boundaries to avoid false matches
      const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (regex.test(text)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if this message should be processed as a modification
   */
  shouldProcessAsModification(
    isReply: boolean,
    config: ChannelConfig
  ): boolean {
    if (!config.signalModifications.enabled) {
      return false
    }

    if (config.signalModifications.detectRepliesOnly && !isReply) {
      return false
    }

    return true
  }

  /**
   * Check if modification requires confirmation
   */
  requiresConfirmation(
    modificationType: ModificationType,
    config: ChannelConfig
  ): boolean {
    if (!config.signalModifications.autoApply) {
      // If auto-apply is disabled, everything requires confirmation
      return true
    }

    // Check if this specific type requires confirmation
    const requireConfirmationList = config.signalModifications.requireConfirmationFor

    // Map modification types to keyword identifiers
    const typeToKeyword: Record<string, string> = {
      'close_all': 'closeAll',
      'cancel_pending': 'deleteAll',
      'move_to_breakeven': 'breakEven',
      'close_partial': 'closePartial',
      'update_sl': 'setSL',
      'update_tp': 'setTP',
      'enable_trailing': 'trail',
      'disable_trailing': 'trail',
      'update_entry': 'updateEntry'
    }

    const keywordId = typeToKeyword[modificationType]
    return requireConfirmationList.includes(keywordId)
  }
}

// Singleton instance
export const signalModificationParser = new SignalModificationParser()
