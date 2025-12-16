import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { NewMessage, NewMessageEvent } from 'telegram/events'
import { EventEmitter } from 'events'
import { getDatabase, saveDatabase } from '../database'
import { logger } from '../utils/logger'
import { SignalParser } from './signalParser'
import { enhancedSignalParser } from './enhancedSignalParser'
import { channelConfigService } from './channelConfigService'
import { signalModificationParser } from './signalModificationParser'
import { ChannelConfig } from '../types/channelConfig'

export class TelegramService extends EventEmitter {
  private client: TelegramClient | null = null
  private session: StringSession
  private phoneNumber: string = ''
  private signalParser: SignalParser
  private monitoringChannels: number[] = []
  private channelConfigs: Map<number, ChannelConfig> = new Map()
  private processedMessageIds: Set<string> = new Set() // Track processed Telegram messages

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

        logger.info('Telegram connected successfully')
        this.emit('connected')
      }).catch((error: any) => {
        logger.error('Telegram connection error:', error)
        this.emit('error', error.message)
      })

      // Return immediately - events will handle UI updates
      logger.info('Telegram connection started, waiting for verification...')
    } catch (error: any) {
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
      const dialogs = await this.client.getDialogs({
        limit: 100,
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

      // PRIORITY 2: Check for global commands (close all / delete all) - ONLY if NOT a reply
      // This prevents replies from being treated as global commands
      const textLower = text.toLowerCase().trim()
      const isCloseAll = channelConfig.additionalKeywords.closeAll.some(kw =>
        new RegExp(`\\b${kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(textLower)
      )
      const isDeleteAll = channelConfig.additionalKeywords.deleteAll.some(kw =>
        new RegExp(`\\b${kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(textLower)
      )

      if ((isCloseAll || isDeleteAll) && !isReply && channelConfig.signalModifications.enabled) {
        const modificationType = isCloseAll ? 'close_all' : 'cancel_pending'
        logger.info(`Processing global command: ${modificationType}`)

        // Create a fake modification for global command (no specific signal)
        const modification = {
          id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          signalId: 'global', // Special marker for global commands
          messageId: message.id,
          replyToMessageId: 0,
          channelId: chatId,
          type: modificationType as any,
          rawText: text,
          parsedAt: new Date().toISOString(),
          status: 'pending' as const,
          affectedTickets: [],
          channelName: channelConfig.channelName,
          requiresConfirmation: signalModificationParser.requiresConfirmation(
            modificationType as any,
            channelConfig
          )
        }

        // Emit modification event
        this.emit('modificationReceived', modification)

        logger.info(`✅ GLOBAL COMMAND: ${modificationType}`)
        return // Don't process as regular signal
      }

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
      const parsedSignal = enhancedSignalParser.parse(text, channelConfig)

      if (parsedSignal) {
        // Apply delay if configured
        if (parsedSignal.delayMs > 0) {
          logger.debug(`Applying ${parsedSignal.delayMs}ms delay before processing signal`)
          await new Promise(resolve => setTimeout(resolve, parsedSignal.delayMs))
        }

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
        }
      } else {
        logger.warn(`⚠️ Could not parse signal from channel ${chatId}: ${text.substring(0, 100)}`)
      }
    } catch (error: any) {
      logger.error('Error handling new message:', error)
    }
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
}
