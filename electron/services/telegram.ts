import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { NewMessage, NewMessageEvent } from 'telegram/events'
import { EditedMessage } from 'telegram/events/EditedMessage'
import { EventEmitter } from 'events'
import { getDatabase, saveDatabase } from '../database'
import { logger } from '../utils/logger'
import { SignalParser } from './signalParser'
import { enhancedSignalParser } from './enhancedSignalParser'
import { channelConfigService } from './channelConfigService'
import { signalModificationParser } from './signalModificationParser'
import { ChannelConfig } from '../types/channelConfig'
import { splitEntryEnabled } from '../utils/features'

// Fingerprint of a recently-processed signal, for dedup / TP-update-follow-up detection
interface RecentSignal {
  channelId: number
  symbol: string
  direction: string
  entry1: number
  entry2: number | null
  sl: number
  hadTPs: boolean
  tps: number[]      // TPs seen so far, so a repost with DIFFERENT TPs is forwarded as an update
  timestamp: number  // Date.now()
}

/** JSON.parse that returns null instead of throwing (stored parsed_data may be absent or malformed). */
function safeJson(s: string): any {
  try { return JSON.parse(s) } catch { return null }
}

export class TelegramService extends EventEmitter {
  private client: TelegramClient | null = null
  private session: StringSession
  private phoneNumber: string = ''
  private signalParser: SignalParser
  private monitoringChannels: number[] = []
  private channelConfigs: Map<number, ChannelConfig> = new Map()
  private processedMessageIds: Set<string> = new Set() // Track processed Telegram messages
  private recentSignals: RecentSignal[] = [] // For deduping follow-up signal messages
  private connecting: boolean = false // True between connect() and the 'connected'/'error' event

  constructor(signalParser: SignalParser) {
    super()
    this.session = new StringSession('')
    this.signalParser = signalParser
  }

  async connect(phoneNumber: string) {
    try {
      // Read Telegram API credentials from environment variables at runtime
      const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0')
      const API_HASH = process.env.TELEGRAM_API_HASH || ''

      // Check if Telegram API credentials are configured
      if (!API_ID || !API_HASH) {
        const errorMessage = 'Telegram API credentials not configured. Please add your TELEGRAM_API_ID and TELEGRAM_API_HASH to connect to Telegram.'
        logger.error(errorMessage)
        this.emit('error', errorMessage)
        throw new Error(errorMessage)
      }

      this.phoneNumber = phoneNumber
      this.connecting = true

      // Load session from database if exists
      const db = getDatabase()
      const result = db.exec('SELECT telegram_session FROM users WHERE phone_number = ?', [phoneNumber])

      if (result.length > 0 && result[0].values.length > 0) {
        const sessionString = result[0].values[0][0] as string
        this.session = new StringSession(sessionString)
        logger.info('Loaded existing Telegram session')
      }

      this.client = new TelegramClient(this.session, API_ID, API_HASH, {
        connectionRetries: 5,
      })

      // Start connection in background (non-blocking)
      // This allows events to fire while authentication is in progress
      this.client.start({
        phoneNumber: async () => phoneNumber,
        password: async () => {
          // If 2FA is enabled, prompt for password
          return new Promise((resolve) => {
            this.emit('passwordRequired')
            this.once('passwordProvided', resolve)
          })
        },
        phoneCode: async () => {
          // Prompt user for verification code
          return new Promise((resolve) => {
            this.emit('codeRequired')
            this.once('codeProvided', resolve)
          })
        },
        onError: (err) => {
          logger.error('Telegram auth error:', err)
          this.emit('error', err.message)
        },
      }).then(() => {
        // Save session to database after successful connection
        const sessionString = this.session.save()
        db.run(`
          INSERT INTO users (phone_number, telegram_session)
          VALUES (?, ?)
          ON CONFLICT(phone_number)
          DO UPDATE SET telegram_session = ?, updated_at = CURRENT_TIMESTAMP
        `, [phoneNumber, sessionString, sessionString])
        saveDatabase()

        this.connecting = false
        logger.info('Telegram connected successfully')
        this.emit('connected')
      }).catch((error: any) => {
        this.connecting = false
        logger.error('Telegram connection error:', error)
        this.emit('error', error.message)
      })

      // Return immediately - events will handle UI updates
      logger.info('Telegram connection started, waiting for verification...')
    } catch (error: any) {
      this.connecting = false
      logger.error('Telegram connection error:', error)
      this.emit('error', error.message)
      throw error
    }
  }

  async sendCode(code: string) {
    try {
      this.emit('codeProvided', code)
      // Return immediately - the connection will emit 'connected' when done
      return { success: true }
    } catch (error: any) {
      logger.error('Error sending code:', error)
      return { success: false, error: error.message }
    }
  }

  async sendPassword(password: string) {
    try {
      this.emit('passwordProvided', password)
      return { success: true }
    } catch (error: any) {
      logger.error('Error sending password:', error)
      return { success: false, error: error.message }
    }
  }

  async getChannels() {
    if (!this.client) {
      throw new Error('Telegram client not connected')
    }

    try {
      // Fetch all channels/groups (no limit) - supports customers with 500+ channels
      const dialogs = await this.client.getDialogs({
        limit: undefined, // Unlimited - fetches all channels
      })

      const channels = dialogs
        .filter(dialog => dialog.isChannel || dialog.isGroup)
        .map(dialog => {
          const entity = dialog.entity as any // Type assertion for Telegram entity
          return {
            id: Number(dialog.id),
            title: dialog.title,
            username: entity?.username || null,
            type: dialog.isChannel ? 'channel' : 'group',
            membersCount: entity?.participantsCount || 0,
          }
        })

      // Save to database
      const db = getDatabase()

      for (const channel of channels) {
        db.run(`
          INSERT INTO channels (id, title, username, type)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id)
          DO UPDATE SET title = ?, username = ?, type = ?, updated_at = CURRENT_TIMESTAMP
        `, [
          channel.id,
          channel.title,
          channel.username,
          channel.type,
          channel.title,
          channel.username,
          channel.type
        ])
      }
      saveDatabase()

      logger.info(`Fetched ${channels.length} channels/groups`)
      return channels
    } catch (error: any) {
      logger.error('Error fetching channels:', error)
      throw error
    }
  }

  async startMonitoring(channelIds: number[]) {
    if (!this.client) {
      throw new Error('Telegram client not connected')
    }

    this.monitoringChannels = channelIds

    // Load configurations for each channel
    this.channelConfigs.clear()
    for (const channelId of channelIds) {
      let config = channelConfigService.getConfig(channelId)

      // If no config exists, create a default one
      if (!config) {
        logger.info(`No config found for channel ${channelId}, creating default config`)
        const db = getDatabase()
        const result = db.exec('SELECT title FROM channels WHERE id = ?', [channelId])
        const channelName = result.length > 0 && result[0].values.length > 0
          ? (result[0].values[0][0] as string)
          : `Channel ${channelId}`

        config = channelConfigService.createDefaultConfig(channelId, channelName)
      }

      // Add to map if enabled
      if (config.isEnabled) {
        this.channelConfigs.set(channelId, config)
        logger.debug(`Loaded config for channel ${channelId}: ${config.channelName}`)
      } else {
        logger.warn(`Channel ${channelId} is disabled, skipping`)
      }
    }

    // Update database
    const db = getDatabase()
    db.run('UPDATE channels SET is_active = 0')
    for (const id of channelIds) {
      db.run('UPDATE channels SET is_active = 1 WHERE id = ?', [id])
    }
    saveDatabase()

    // Remove existing event handlers (pass undefined to remove all)
    this.client.removeEventHandler(undefined as any, undefined as any)

    // Add new message handler
    this.client.addEventHandler(
      async (event: NewMessageEvent) => {
        await this.handleNewMessage(event)
      },
      new NewMessage({})
    )

    // Edited-message handler: providers often edit the first quick post to add TPs or fix the SL.
    // Per-channel opt-in via other.enableEditMessage (checked inside the handler).
    this.client.addEventHandler(
      async (event: any) => {
        await this.handleEditedMessage(event)
      },
      new EditedMessage({})
    )

    logger.info(`Started monitoring ${channelIds.length} channels with enhanced parser`)
  }

  async stopMonitoring() {
    if (!this.client) {
      return
    }

    this.client.removeEventHandler(undefined as any, undefined as any)
    this.monitoringChannels = []
    this.channelConfigs.clear()

    // Update database
    const db = getDatabase()
    db.run('UPDATE channels SET is_active = 0')
    saveDatabase()

    logger.info('Stopped monitoring all channels')
  }

  private async handleNewMessage(event: NewMessageEvent) {
    try {
      const message = event.message
      const chatId = Number(message.chatId)

      // Check if this channel is being monitored
      if (!this.monitoringChannels.includes(chatId)) {
        return
      }

      const text = message.text

      if (!text) {
        return
      }

      // Prevent duplicate processing of same Telegram message
      // Use both channelId and messageId as unique key
      const messageKey = `${chatId}-${message.id}`
      if (this.processedMessageIds.has(messageKey)) {
        logger.debug(`Skipping duplicate Telegram message: ${messageKey}`)
        return
      }

      // Mark as processed
      this.processedMessageIds.add(messageKey)

      // Clean up old message IDs to prevent memory leak (keep last 1000)
      if (this.processedMessageIds.size > 1000) {
        const idsArray = Array.from(this.processedMessageIds)
        this.processedMessageIds = new Set(idsArray.slice(-1000))
      }

      logger.debug(`New message from channel ${chatId}: ${text.substring(0, 100)}...`)

      // Get channel configuration - ALWAYS reload from database to pick up UI changes
      let channelConfig = channelConfigService.getConfig(chatId)

      // Fallback: If no config exists, create one
      if (!channelConfig) {
        logger.warn(`No config found for channel ${chatId}, creating default config`)
        const db = getDatabase()
        const result = db.exec('SELECT title FROM channels WHERE id = ?', [chatId])
        const channelName = result.length > 0 && result[0].values.length > 0
          ? (result[0].values[0][0] as string)
          : `Channel ${chatId}`

        channelConfig = channelConfigService.createDefaultConfig(chatId, channelName)
        logger.info(`Created default config for channel ${chatId}`)
      }

      // Check if channel is enabled
      if (!channelConfig.isEnabled) {
        logger.debug(`Channel ${chatId} is disabled, skipping message`)
        return
      }

      // Check for forwarded messages if needed
      if (!channelConfig.advancedSettings.readForwarded && message.fwdFrom) {
        logger.debug(`Skipping forwarded message from channel ${chatId}`)
        return
      }

      // Check if this is a reply to another message (modification)
      const isReply = message.replyTo !== undefined && message.replyTo !== null
      const replyToMessageId = isReply ? (message.replyTo as any).replyToMsgId : null

      logger.debug(`Message ${message.id}: isReply=${isReply}, replyTo=${replyToMessageId}`)

      // PRIORITY 1: Process replies to specific signals FIRST (before global commands)
      // This ensures that replying to a trade with "close" only closes THAT trade, not all trades
      if (isReply && replyToMessageId &&
          signalModificationParser.shouldProcessAsModification(isReply, channelConfig)) {

        logger.info(`Processing potential modification (reply to ${replyToMessageId})`)

        // Find the original signal in database
        const db = getDatabase()
        const originalSignalResult = db.exec(
          'SELECT id FROM signals WHERE channel_id = ? AND message_id = ?',
          [chatId, replyToMessageId]
        )

        if (originalSignalResult.length > 0 && originalSignalResult[0].values.length > 0) {
          const originalSignalId = String(originalSignalResult[0].values[0][0])
          logger.info(`[REPLY DEBUG] Found original signal ID: ${originalSignalId} for message_id: ${replyToMessageId}`)

          // Try to parse as modification
          const modification = signalModificationParser.parseModification(
            text,
            channelConfig,
            originalSignalId,
            message.id,
            replyToMessageId,
            chatId
          )

          if (modification) {
            // Store modification in database
            db.run(`
              INSERT INTO signal_modifications (
                id, signal_id, message_id, reply_to_message_id, channel_id,
                type, value, price, pips, percentage, raw_text, parsed_at, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              modification.id,
              modification.signalId,
              modification.messageId,
              modification.replyToMessageId,
              modification.channelId,
              modification.type,
              modification.value || null,
              modification.price || null,
              modification.pips || null,
              modification.percentage || null,
              modification.rawText,
              modification.parsedAt,
              modification.status
            ])
            saveDatabase()

            // Emit modification event
            this.emit('modificationReceived', {
              ...modification,
              channelName: channelConfig.channelName,
              requiresConfirmation: signalModificationParser.requiresConfirmation(
                modification.type,
                channelConfig
              )
            })

            logger.info(`✅ MODIFICATION: ${modification.type} for signal ${originalSignalId}`)
            return // Don't process as regular signal
          } else {
            logger.debug(`Not a valid modification, processing as regular message`)
          }
        } else {
          logger.debug(`Original signal not found for reply ${replyToMessageId}`)
        }
      }

      // PRIORITY 2: Global commands (close all / delete all) will be processed by enhancedSignalParser
      // as update commands, so we don't need special handling here - just let them fall through

      // Save to database
      const db = getDatabase()
      db.run(`
        INSERT INTO signals (channel_id, message_id, message_text)
        VALUES (?, ?, ?)
      `, [chatId, message.id, text])

      // Get the last inserted ID
      const idResult = db.exec('SELECT last_insert_rowid()')
      const signalId = idResult[0].values[0][0] as number

      // Parse the signal using enhanced parser with channel config
      const parsedSignal = await enhancedSignalParser.parse(text, channelConfig)

      if (parsedSignal) {
        // Apply delay if configured
        if (parsedSignal.delayMs > 0) {
          logger.debug(`Applying ${parsedSignal.delayMs}ms delay before processing signal`)
          await new Promise(resolve => setTimeout(resolve, parsedSignal.delayMs))
        }

        // Dedup check: is this new signal a repeat/follow-up of a recent one?
        // Common case from XAUHQ: first message = entry+SL only, second = full signal with TPs.
        // We should NOT open another set of orders — instead, treat the incoming TPs as a
        // TP update for the existing orders.
        //
        // GATED to splitEntryMode channels only. Customers on the standard parser keep the
        // historical behavior (every parsed signal opens) — dedup is an ad-hoc feature.
        if (
          splitEntryEnabled(channelConfig) &&
          parsedSignal.signalType === 'new' &&
          this.isReentrySignal(text) === false
        ) {
          const dupMatch = this.findRecentMatchingSignal(chatId, parsedSignal)
          if (dupMatch) {
            const incomingTPs = parsedSignal.takeProfits || []
            const sameTPs = incomingTPs.length === dupMatch.tps.length &&
              incomingTPs.every((tp, i) => Math.abs(tp - dupMatch.tps[i]) < 0.01)
            const tpsChanged = incomingTPs.length > 0 && (!dupMatch.hadTPs || !sameTPs)

            if (tpsChanged) {
              // Follow-up added or changed TPs (e.g. "TARGET UPDATED" repost) — forward as a TP update
              logger.info(`🔗 Dedup: follow-up signal detected (channel ${chatId}), converting to TP update for previous signal. TPs: ${JSON.stringify(incomingTPs)}`)

              // Update the fingerprint so we don't reprocess if the same TPs are reposted again
              dupMatch.hadTPs = true
              dupMatch.tps = incomingTPs
              dupMatch.timestamp = Date.now()

              const updateSignal: any = {
                symbol: parsedSignal.symbol,
                direction: 'BUY',
                confidence: 1.0,
                rawText: text,
                signalType: 'update',
                update: {
                  type: 'setTP',
                  value: incomingTPs
                },
                llmReasoning: `Dedup: same entries/SL as a signal in the last 30 min — applying these TPs to the existing orders instead of opening new ones`,
                isIgnored: false,
                isSkipped: false,
                forceMarket: false,
                delayMs: 0
              }

              db.run(`UPDATE signals SET parsed_data = ? WHERE id = ?`, [JSON.stringify(updateSignal), signalId])
              saveDatabase()

              this.emit('signalReceived', {
                id: signalId,
                channelId: chatId,
                channelName: channelConfig.channelName,
                messageId: message.id,
                text,
                parsed: updateSignal,
                config: channelConfig,
                timestamp: new Date().toISOString(),
                signalType: 'update',
                isUpdate: true,
              })
              return
            } else {
              logger.info(`🔗 Dedup: duplicate signal detected (channel ${chatId}), skipping to avoid double-open`)
              this.emit('signalReceived', {
                id: signalId,
                channelId: chatId,
                channelName: channelConfig.channelName,
                messageId: message.id,
                text,
                parsed: null,
                config: channelConfig,
                timestamp: new Date().toISOString(),
                signalType: 'skipped',
                skipReason: 'Duplicate of a signal received in the last 30 minutes (same entries and SL) — not re-opened',
                isUpdate: false,
              })
              return
            }
          }

          // Not a dup — record fingerprint for future dedup checks
          this.recordSignalFingerprint(chatId, parsedSignal)
        }

        // Check for split entry (entryPrice is number[])
        // In splitEntryMode: pass BOTH prices in one signal so EA can create 2:1 lot pending orders
        // Otherwise: fall back to legacy behavior of creating N separate signals
        if (
          parsedSignal.signalType === 'new' &&
          Array.isArray(parsedSignal.entryPrice) &&
          parsedSignal.entryPrice.length >= 2 &&
          splitEntryEnabled(channelConfig)
        ) {
          // Order the two prices so entryPrice is the DEEPER entry (the survivor, gets 2/3 risk):
          //   BUY  -> lower price first;  SELL -> higher price first.
          // This must happen HERE, before anything is sent out, because the cloud and the local
          // trades table both assume "first half of tickets = entryPrice, second half = entryPrice2".
          // The EA applies the same rule, so it becomes a no-op there — single source of truth is here.
          const rawPrices = (parsedSignal.entryPrice as number[]).slice(0, 2)
          const baseDir = (parsedSignal.direction || '').toUpperCase().split(' ')[0]
          const splitPrices = baseDir === 'SELL'
            ? [Math.max(...rawPrices), Math.min(...rawPrices)]
            : [Math.min(...rawPrices), Math.max(...rawPrices)]
          const splitSignal = {
            ...parsedSignal,
            entryPrice: splitPrices[0],
            entryPrice2: splitPrices[1]
          } as any

          logger.info(`Split entry detected: E1=${splitPrices[0]} E2=${splitPrices[1]} — sending as single signal with two entries`)

          db.run(`
            UPDATE signals SET parsed_data = ? WHERE id = ?
          `, [JSON.stringify(splitSignal), signalId])
          saveDatabase()

          this.emit('signalReceived', {
            id: signalId,
            channelId: chatId,
            channelName: channelConfig.channelName,
            messageId: message.id,
            text,
            parsed: splitSignal,
            config: channelConfig,
            timestamp: new Date().toISOString(),
            signalType: 'new',
            isUpdate: false,
          })

          logger.info(`✅ NEW Split Signal: ${splitSignal.symbol} ${splitSignal.direction} E1=${splitPrices[0]} E2=${splitPrices[1]} (Confidence: ${(splitSignal.confidence * 100).toFixed(0)}%)`)
        } else if (
          parsedSignal.signalType === 'new' &&
          Array.isArray(parsedSignal.entryPrice) &&
          parsedSignal.entryPrice.length >= 2
        ) {
          // Legacy: split into N separate signals for non-splitEntryMode channels
          const splitPrices = parsedSignal.entryPrice as number[]
          logger.info(`Split entry detected: ${splitPrices.join(', ')} — creating ${splitPrices.length} separate signals`)

          for (let i = 0; i < splitPrices.length; i++) {
            const splitSignal = { ...parsedSignal, entryPrice: splitPrices[i] }

            db.run(`
              INSERT INTO signals (channel_id, message_id, message_text)
              VALUES (?, ?, ?)
            `, [chatId, message.id, text])
            const splitIdResult = db.exec('SELECT last_insert_rowid()')
            const splitSignalId = splitIdResult[0].values[0][0] as number

            db.run(`
              UPDATE signals SET parsed_data = ? WHERE id = ?
            `, [JSON.stringify(splitSignal), splitSignalId])
            saveDatabase()

            this.emit('signalReceived', {
              id: splitSignalId,
              channelId: chatId,
              channelName: channelConfig.channelName,
              messageId: message.id,
              text,
              parsed: splitSignal,
              config: channelConfig,
              timestamp: new Date().toISOString(),
              signalType: 'new',
              isUpdate: false,
            })

            logger.info(`✅ NEW Signal (split ${i + 1}/${splitPrices.length}): ${splitSignal.symbol} ${splitSignal.direction} @ ${splitPrices[i]} (Confidence: ${(splitSignal.confidence * 100).toFixed(0)}%)`)
          }
        } else {
          // Normal single-entry signal (or update command)
          // Update database with parsed data
          db.run(`
            UPDATE signals SET parsed_data = ? WHERE id = ?
          `, [JSON.stringify(parsedSignal), signalId])
          saveDatabase()

          // Emit event with full signal data including channel config
          this.emit('signalReceived', {
            id: signalId,
            channelId: chatId,
            channelName: channelConfig.channelName,
            messageId: message.id,
            text,
            parsed: parsedSignal,
            config: channelConfig,
            timestamp: new Date().toISOString(),
            signalType: parsedSignal.signalType,
            isUpdate: parsedSignal.signalType === 'update',
          })

          if (parsedSignal.signalType === 'new') {
            logger.info(`✅ NEW Signal: ${parsedSignal.symbol} ${parsedSignal.direction} (Confidence: ${(parsedSignal.confidence * 100).toFixed(0)}%)`)
          } else if (parsedSignal.signalType === 'update') {
            logger.info(`🔄 UPDATE Command: ${parsedSignal.update?.type || 'unknown'}`)

            // Wipe fingerprints for this channel on close-all / delete-all so the next
            // re-issued signal is treated as fresh (positions were just closed).
            const wipeTypes = ['closeAll', 'closeFull', 'deleteAll']
            const updType = parsedSignal.update?.type
            if (updType && wipeTypes.includes(updType)) {
              const before = this.recentSignals.length
              this.recentSignals = this.recentSignals.filter(s => s.channelId !== chatId)
              const removed = before - this.recentSignals.length
              if (removed > 0) {
                logger.info(`🧹 Cleared ${removed} recent signal fingerprint(s) for channel ${chatId} due to ${updType}`)
              }
            }
          }
        }
      } else {
        // Never drop silently: surface a "Skipped" card in the feed with the reason.
        const skipReason = enhancedSignalParser.lastSkipReason || 'Not recognized as a signal or update'
        logger.warn(`⚠️ Skipped message from channel ${chatId} (${skipReason}): ${text.substring(0, 100)}`)
        this.emit('signalReceived', {
          id: signalId,
          channelId: chatId,
          channelName: channelConfig.channelName,
          messageId: message.id,
          text,
          parsed: null,
          config: channelConfig,
          timestamp: new Date().toISOString(),
          signalType: 'skipped',
          skipReason,
          isUpdate: false,
        })
      }
    } catch (error: any) {
      logger.error('Error handling new message:', error)
    }
  }

  /**
   * Check if a text contains a "reentry" hint — those should always be treated as new signals,
   * never as duplicates of an earlier signal even if the entries/SL match.
   */
  private isReentrySignal(text: string): boolean {
    const t = text.toLowerCase()
    return /\b(re-?entry|re-?enter|re-?trade|new\s+setup)\b/.test(t)
  }

  /**
   * Look up any recent signal on the same channel that fingerprints as the same trade.
   * Match criteria: symbol, direction, at least one entry within tolerance, SL within tolerance,
   * within the last 30 minutes.
   */
  private findRecentMatchingSignal(channelId: number, sig: any): RecentSignal | null {
    const now = Date.now()
    const maxAgeMs = 30 * 60 * 1000 // 30 minutes
    const entryTol = 2.0 // points
    const slTol = 2.0

    // Prune stale entries
    this.recentSignals = this.recentSignals.filter(s => now - s.timestamp <= maxAgeMs)

    // Extract entries from incoming signal — could be number or [number, number]
    const incomingEntries: number[] = Array.isArray(sig.entryPrice)
      ? sig.entryPrice
      : (typeof sig.entryPrice === 'number' ? [sig.entryPrice] : [])

    if (incomingEntries.length === 0 || !sig.stopLoss) return null

    // Normalize direction to base (BUY/SELL) — LLM may return "BUY", "BUY LIMIT", "BUY STOP"
    const normalizeDir = (d: string) => (d || '').toUpperCase().split(' ')[0]
    const sigDir = normalizeDir(sig.direction)

    for (const s of this.recentSignals) {
      if (s.channelId !== channelId) continue
      if (s.symbol !== sig.symbol) continue
      if (normalizeDir(s.direction) !== sigDir) continue

      // Check SL match
      if (Math.abs(s.sl - sig.stopLoss) > slTol) continue

      // Check that at least one entry from each side matches within tolerance
      const storedEntries = [s.entry1]
      if (s.entry2 !== null) storedEntries.push(s.entry2)

      const overlap = storedEntries.some(se =>
        incomingEntries.some(ie => Math.abs(se - ie) <= entryTol)
      )
      if (overlap) return s
    }

    return null
  }

  /**
   * Record a fingerprint of a signal we just processed, for future dedup checks.
   */
  private recordSignalFingerprint(channelId: number, sig: any): void {
    const entries: number[] = Array.isArray(sig.entryPrice)
      ? sig.entryPrice
      : (typeof sig.entryPrice === 'number' ? [sig.entryPrice] : [])

    if (entries.length === 0 || !sig.stopLoss) return

    const fp: RecentSignal = {
      channelId,
      symbol: sig.symbol,
      direction: sig.direction,
      entry1: entries[0],
      entry2: entries.length >= 2 ? entries[1] : null,
      sl: sig.stopLoss,
      hadTPs: (sig.takeProfits || []).length > 0,
      tps: [...(sig.takeProfits || [])],
      timestamp: Date.now()
    }
    this.recentSignals.push(fp)

    // Cap size to prevent unbounded growth
    if (this.recentSignals.length > 100) {
      this.recentSignals = this.recentSignals.slice(-100)
    }
  }

  /**
   * Handle a provider EDITING an earlier message.
   *
   * Gated per channel by other.enableEditMessage. Behaviour:
   *  - Original never parsed, edit now parses        → process the edit as a fresh message.
   *  - Original was a NEW signal, edit is a NEW signal → never re-open; forward TP/SL changes as updates.
   *  - Original was a NEW signal, edit is an UPDATE    → process the edit as a fresh update message.
   *  - Anything else                                    → ignore (logged).
   */
  private async handleEditedMessage(event: any) {
    try {
      const message = event?.message
      if (!message) return
      const chatId = Number(message.chatId)
      if (!this.monitoringChannels.includes(chatId)) return

      const text: string = message.text || ''
      if (!text.trim()) return

      const channelConfig = channelConfigService.getConfig(chatId)
      if (!channelConfig || !channelConfig.isEnabled) return
      if (!channelConfig.other?.enableEditMessage) {
        logger.debug(`Edit on message ${message.id} ignored — enableEditMessage is off for channel ${chatId}`)
        return
      }

      const db = getDatabase()
      const rows = db.exec(
        'SELECT id, parsed_data, message_text FROM signals WHERE channel_id = ? AND message_id = ? ORDER BY id DESC LIMIT 1',
        [chatId, message.id]
      )
      const row = rows.length > 0 && rows[0].values.length > 0 ? rows[0].values[0] : null
      const originalParsed: any = row && row[1] ? safeJson(String(row[1])) : null
      const originalText: string = row ? String(row[2] ?? '') : ''

      if (originalText.trim() === text.trim()) return // no textual change

      logger.info(`✏️  Edited message ${message.id} on channel ${chatId} (original parsed: ${originalParsed?.signalType ?? 'none'})`)

      const reparsed = await enhancedSignalParser.parse(text, channelConfig)

      // Case: original never became a signal — treat the edit as a brand-new message
      if (!originalParsed || !originalParsed.signalType) {
        if (!reparsed) return
        this.processedMessageIds.delete(`${chatId}-${message.id}`)
        await this.handleNewMessage(event as any)
        return
      }

      // Case: original was a new signal
      if (originalParsed.signalType === 'new') {
        if (!reparsed) return

        if (reparsed.signalType === 'update') {
          // Provider turned the post into an instruction — run it as an update
          this.processedMessageIds.delete(`${chatId}-${message.id}`)
          await this.handleNewMessage(event as any)
          return
        }

        // New → New: forward only the deltas, never re-open orders
        const oldTPs: number[] = Array.isArray(originalParsed.takeProfits) ? originalParsed.takeProfits : []
        const newTPs: number[] = Array.isArray(reparsed.takeProfits) ? reparsed.takeProfits : []
        const tpsChanged = newTPs.length > 0 && (
          newTPs.length !== oldTPs.length || newTPs.some((tp, i) => Math.abs(tp - (oldTPs[i] ?? NaN)) >= 0.01)
        )
        const slChanged = typeof reparsed.stopLoss === 'number' && typeof originalParsed.stopLoss === 'number'
          && Math.abs(reparsed.stopLoss - originalParsed.stopLoss) >= 0.01

        const emitUpdate = (type: 'setTP' | 'setSL', value: number | number[], why: string) => {
          const updateSignal: any = {
            symbol: reparsed.symbol,
            direction: 'BUY',
            confidence: 1.0,
            rawText: text,
            signalType: 'update',
            update: { type, value },
            llmReasoning: why,
            isIgnored: false,
            isSkipped: false,
            forceMarket: false,
            delayMs: 0
          }
          this.emit('signalReceived', {
            id: Date.now() + Math.floor(Math.random() * 1000),
            channelId: chatId,
            channelName: channelConfig.channelName,
            messageId: message.id,
            text,
            parsed: updateSignal,
            config: channelConfig,
            timestamp: new Date().toISOString(),
            signalType: 'update',
            isUpdate: true,
          })
        }

        if (tpsChanged) {
          logger.info(`✏️  Edit added/changed TPs on message ${message.id}: ${JSON.stringify(newTPs)}`)
          emitUpdate('setTP', newTPs, 'Provider edited the original signal and changed the take-profit levels')
        }
        if (slChanged) {
          logger.info(`✏️  Edit changed SL on message ${message.id}: ${originalParsed.stopLoss} → ${reparsed.stopLoss}`)
          emitUpdate('setSL', reparsed.stopLoss as number, 'Provider edited the original signal and moved the stop loss')
        }
        if (!tpsChanged && !slChanged) {
          logger.debug(`✏️  Edit on ${message.id} changed neither TPs nor SL — nothing to do`)
        }

        // Keep the stored parse current so a later edit diffs against the latest version
        db.run('UPDATE signals SET parsed_data = ?, message_text = ? WHERE id = ?', [JSON.stringify(reparsed), text, Number(row![0])])
        saveDatabase()
        return
      }

      logger.debug(`✏️  Edit on ${message.id}: original was '${originalParsed.signalType}', ignoring`)
    } catch (error: any) {
      logger.error('Error handling edited message:', error)
    }
  }

  /**
   * Export recent TEXT messages from a channel the account already has access to.
   * Pages backwards from the newest message in batches of 100 until one of the caps is hit.
   * Media-only posts (no text) are skipped; captions on images are kept.
   *
   * Caps default to: 500 messages, 90 days, 2 MB of text — whichever is reached first.
   */
  async getChannelHistory(
    channelId: number,
    opts: { maxMessages?: number; maxAgeDays?: number; maxBytes?: number } = {}
  ): Promise<{ id: number; date: string; text: string; replyToMsgId: number | null; hasMedia: boolean }[]> {
    if (!this.client) {
      throw new Error('Telegram client not connected')
    }

    const maxMessages = opts.maxMessages ?? 500
    const maxAgeDays = opts.maxAgeDays ?? 90
    const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024
    const cutoffSec = Math.floor(Date.now() / 1000) - maxAgeDays * 24 * 60 * 60

    const entity = await this.client.getEntity(channelId)
    const out: { id: number; date: string; text: string; replyToMsgId: number | null; hasMedia: boolean }[] = []
    let bytes = 0
    let offsetId = 0
    let reachedCap = false

    logger.info(`Exporting history for channel ${channelId}: max ${maxMessages} msgs / ${maxAgeDays} days / ${maxBytes} bytes`)

    while (!reachedCap) {
      const batch: any[] = await this.client.getMessages(entity, { limit: 100, offsetId })
      if (!batch || batch.length === 0) break

      for (const m of batch) {
        const dateSec: number = typeof m.date === 'number' ? m.date : 0
        if (dateSec && dateSec < cutoffSec) { reachedCap = true; break }

        const text: string = (m.message ?? '').toString()
        if (text.trim().length === 0) continue // media-only / service message

        const size = Buffer.byteLength(text, 'utf8')
        if (bytes + size > maxBytes) { reachedCap = true; break }

        out.push({
          id: Number(m.id),
          date: new Date(dateSec * 1000).toISOString(),
          text,
          replyToMsgId: m.replyTo?.replyToMsgId ? Number(m.replyTo.replyToMsgId) : null,
          hasMedia: !!m.media
        })
        bytes += size

        if (out.length >= maxMessages) { reachedCap = true; break }
      }

      offsetId = Number(batch[batch.length - 1].id)
      if (batch.length < 100) break // no more history

      // Gentle pacing between pages to stay clear of flood limits on large channels
      await new Promise(r => setTimeout(r, 250))
    }

    // Return chronological (oldest first)
    out.sort((a, b) => a.id - b.id)
    logger.info(`History export complete: ${out.length} text messages, ${bytes} bytes`)
    return out
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect()
      this.client = null
      logger.info('Telegram disconnected')
    }
  }

  isConnected(): boolean {
    return this.client !== null && (this.client.connected ?? false)
  }

  isConnecting(): boolean {
    return this.connecting
  }

  /** Phone number of the most recently saved Telegram session, if any (used to auto-reconnect on startup). */
  getSavedPhone(): string | null {
    try {
      const db = getDatabase()
      const rows = db.exec(
        "SELECT phone_number FROM users WHERE telegram_session IS NOT NULL AND telegram_session != '' ORDER BY updated_at DESC LIMIT 1"
      )
      if (rows.length > 0 && rows[0].values.length > 0) {
        return String(rows[0].values[0][0])
      }
    } catch (error) {
      logger.error('Failed to read saved Telegram session:', error)
    }
    return null
  }

  /** Channel ids currently being monitored (empty when monitoring is stopped). */
  getMonitoringChannels(): number[] {
    return [...this.monitoringChannels]
  }
}
