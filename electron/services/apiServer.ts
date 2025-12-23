import express, { Express, Request, Response } from 'express'
import { Server } from 'http'
import { randomUUID } from 'crypto'
import { logger } from '../utils/logger'
import { ParsedSignal } from './signalParser'
import { ModificationCommand } from './tradeModificationHandler'
import { ChannelConfig } from '../types/channelConfig'
import { CloudSyncService } from './cloudSyncService'

interface QueuedSignal {
  id: string
  signal: ParsedSignal
  config: ChannelConfig
  dbSignalId?: number
  channelId?: number
  cloudSignalId?: string  // Cloud API signal ID for acknowledgments
  signalGroupId?: string  // UUID linking multi-TP signals together
}

export class ApiServer {
  private app: Express
  private server: Server | null = null
  private port: number
  private signalQueue: QueuedSignal[] = []
  private processedSignals: Set<string> = new Set()
  private modificationQueue: ModificationCommand[] = []
  private processedModifications: Set<string> = new Set()
  private signalIdMap: Map<string, { dbSignalId: number, channelId: number }> = new Map()
  private cloudSyncService: CloudSyncService | null = null

  constructor(port: number = 3737) {
    this.port = port
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
  }

  /**
   * Set the cloud sync service for pushing signals to cloud
   */
  setCloudSyncService(service: CloudSyncService) {
    this.cloudSyncService = service
    logger.info('[API Server] Cloud sync service configured')
  }

  private setupMiddleware() {
    // Parse JSON with error handling
    this.app.use(express.json())

    // Catch JSON parsing errors
    this.app.use((err: any, req: any, res: any, next: any) => {
      if (err instanceof SyntaxError && 'body' in err) {
        logger.error(`[JSON Parse Error] ${err.message}`)
        logger.error(`[JSON Parse Error] Path: ${req.path}`)
        return res.status(400).json({ error: 'Invalid JSON', details: err.message })
      }
      next()
    })

    // CORS headers
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Headers', 'Content-Type')
      next()
    })
  }

  private setupRoutes() {
    // Health check
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() })
    })

    // Get pending signals (for EA to poll)
    this.app.get('/api/signals/pending', (req: Request, res: Response) => {
      const accountNumber = req.query.account as string

      if (!accountNumber) {
        return res.status(400).json({ error: 'Account number required' })
      }

      logger.info(`EA ${accountNumber} polling for signals`)

      if (this.signalQueue.length === 0) {
        return res.json({ signals: [] })
      }

      // Return all pending signals with CLOUD signal ID (not local queue ID)
      // Note: Config is NOT sent because EA uses its own input parameters
      const signals = this.signalQueue.map(({ id, signal, cloudSignalId, signalGroupId }) => ({
        id: cloudSignalId || id,  // Use cloud signal ID if available, fallback to local ID
        signalGroupId: signalGroupId || '',  // UUID for multi-TP signal grouping
        ...signal,
      }))

      res.json({ signals })
    })

    // Acknowledge signal processed (EA confirms it executed the trade)
    this.app.post('/api/signals/ack', async (req: Request, res: Response) => {
      // Log raw body for debugging
      logger.info(`[ACK] Raw request body: ${JSON.stringify(req.body)}`)

      const { signalId, accountNumber, status, message } = req.body

      if (!signalId || !accountNumber) {
        logger.error(`[ACK] Missing fields - signalId: ${signalId}, accountNumber: ${accountNumber}`)
        return res.status(400).json({ error: 'Missing required fields' })
      }

      logger.info(`EA ${accountNumber} acknowledged signal ${signalId}: ${status}`)

      // Forward acknowledgment to cloud if this is a cloud signal ID
      if (this.cloudSyncService && signalId.startsWith('cmh')) { // Cloud signal IDs start with 'cmh'
        try {
          const cloudApiUrl = process.env.CLOUD_API_URL || 'https://telegramsignalmirror.com'
          const authToken = this.cloudSyncService.getAuthToken()

          if (authToken) {
            logger.debug(`[ACK] Forwarding acknowledgment to cloud for signal ${signalId}`)

            const cloudResponse = await fetch(`${cloudApiUrl}/api/signals/acknowledge`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({ signalId, accountNumber, status, message })
            })

            if (cloudResponse.ok) {
              logger.info(`[ACK] Successfully forwarded to cloud`)
            } else {
              logger.error(`[ACK] Failed to forward to cloud: ${cloudResponse.status}`)
            }
          }
        } catch (error: any) {
          logger.error(`[ACK] Error forwarding to cloud: ${error.message}`)
        }
      }

      // If successful, store the ticket-to-signal mapping in database
      if (status === 'success' && message) {
        // EA sends "ticket|entryPrice" in message field
        const parts = message.split('|')
        const ticketNumber = parts[0]
        const actualEntryPrice = parts.length > 1 ? parseFloat(parts[1]) : 0

        try {
          // Look up the database signal ID using our mapping
          const signalMapping = this.signalIdMap.get(signalId)

          if (!signalMapping) {
            logger.error(`No signal mapping found for ${signalId}`)
            // Mark as processed and remove from queue anyway
            this.processedSignals.add(signalId)
            this.signalQueue = this.signalQueue.filter(item => item.id !== signalId)
            return res.json({ success: true })
          }

          const { dbSignalId, channelId } = signalMapping
          const { getDatabase, saveDatabase } = require('../database')
          const db = getDatabase()

          // Get symbol and direction from the signal
          const signalResult = db.exec(
            'SELECT parsed_data FROM signals WHERE id = ?',
            [dbSignalId]
          )

          let symbol = ''
          let direction = 'BUY' // Default
          let tradeStatus = 'open' // Default to open for market orders

          if (signalResult.length > 0 && signalResult[0].values.length > 0) {
            try {
              const parsedData = JSON.parse(signalResult[0].values[0][0] as string)
              symbol = parsedData.symbol || ''
              direction = parsedData.direction || 'BUY'

              // Check if it's a pending order (has entryPrice set)
              // If entryPrice > 0, it's a pending order (EA will determine LIMIT vs STOP)
              if (parsedData.entryPrice && parsedData.entryPrice > 0) {
                tradeStatus = 'pending'
              }
            } catch (e) {
              logger.error(`Failed to parse signal data: ${e}`)
            }
          }

          // Store trade record with ticket number and ACTUAL entry price from EA
          db.run(`
            INSERT INTO trades (signal_id, channel_id, platform, account_number, ticket, symbol, direction, entry_price, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [dbSignalId, channelId, 'MT5', accountNumber, ticketNumber, symbol, direction, actualEntryPrice, tradeStatus])

          saveDatabase()
          logger.info(`✅ Stored trade mapping: Signal ${dbSignalId} (${signalId}) -> Ticket ${ticketNumber} @ ${actualEntryPrice}`)

          // Clean up the mapping after successful storage
          this.signalIdMap.delete(signalId)
        } catch (error: any) {
          logger.error(`Failed to store trade mapping: ${error.message}`)
        }
      }

      // Mark as processed
      this.processedSignals.add(signalId)

      // Remove from queue
      const beforeSize = this.signalQueue.length
      this.signalQueue = this.signalQueue.filter(item => item.id !== signalId)
      const removed = beforeSize - this.signalQueue.length

      if (removed > 0) {
        logger.info(`Signal ${signalId} removed from queue. Queue size: ${this.signalQueue.length}`)
      } else {
        logger.warn(`Signal ${signalId} not found in queue for removal`)
      }

      res.json({ success: true })
    })

    // Get signal queue status
    this.app.get('/api/signals/status', (req: Request, res: Response) => {
      res.json({
        queueSize: this.signalQueue.length,
        processedCount: this.processedSignals.size,
      })
    })

    // Clear all pending signals (admin endpoint)
    this.app.post('/api/signals/clear', (req: Request, res: Response) => {
      this.signalQueue = []
      logger.info('Signal queue cleared')
      res.json({ success: true })
    })

    // Get pending modification commands (for EA to poll)
    this.app.get('/api/modifications/pending', (req: Request, res: Response) => {
      const accountNumber = req.query.account as string

      if (!accountNumber) {
        return res.status(400).json({ error: 'Account number required' })
      }

      // Filter modifications for this account
      const accountModifications = this.modificationQueue.filter(
        cmd => cmd.accountNumber === accountNumber
      )

      if (accountModifications.length === 0) {
        return res.json({ modifications: [] })
      }

      logger.info(`EA ${accountNumber} polling for modifications: ${accountModifications.length} found`)

      // Transform ModificationCommand to EA-friendly format (no nested objects)
      // EA's simple JSON parser can't handle nested objects, so flatten the structure
      const simplifiedModifications = accountModifications
        .map(cmd => ({
          type: cmd.type,
          accountNumber: cmd.accountNumber,
          platform: cmd.platform,
          tickets: cmd.trades.map(t => t.ticket), // Just ticket numbers
          newValue: cmd.newValue,
          percentage: cmd.percentage,
          reason: cmd.reason
        }))
        .filter(cmd => {
          // SAFETY: Never send commands with empty tickets array
          // This prevents the EA from interpreting empty tickets as "all trades"
          if (cmd.tickets.length === 0) {
            logger.warn(`[MOD SAFETY] Blocked modification command with empty tickets array: ${cmd.type}`)
            return false
          }
          return true
        })

      // Log the command being sent for debugging
      if (simplifiedModifications.length > 0) {
        logger.debug(`[MOD DEBUG] Sending modification: ${JSON.stringify(simplifiedModifications[0])}`)
      }

      res.json({ modifications: simplifiedModifications })
    })

    // Acknowledge modification processed
    this.app.post('/api/modifications/ack', (req: Request, res: Response) => {
      const { accountNumber, trades, status } = req.body

      if (!accountNumber || !trades) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      logger.info(`EA ${accountNumber} acknowledged modification for ${trades.length} trade(s): ${status}`)

      // Remove processed modifications
      this.modificationQueue = this.modificationQueue.filter(
        cmd => cmd.accountNumber !== accountNumber
      )

      res.json({ success: true })
    })
  }

  /**
   * Add a new signal to the queue
   */
  async addSignal(signal: ParsedSignal, config: ChannelConfig, dbSignalId?: number, channelId?: number, channelName?: string, telegramMessageId?: number) {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    // Store the mapping from random ID to database signal ID
    if (dbSignalId && channelId) {
      this.signalIdMap.set(id, { dbSignalId, channelId })
      logger.debug(`Stored signal mapping: ${id} -> DB Signal ${dbSignalId}`)
    }

    // Transform signal format for MT5 EA compatibility
    const transformedSignal: any = {
      ...signal,
      // Ensure stopLoss is a number (default to 0 if undefined)
      stopLoss: signal.stopLoss || 0,
      // Extract first TP from takeProfits array and add as takeProfit1
      takeProfit1: signal.takeProfits && signal.takeProfits.length > 0 ? signal.takeProfits[0] : 0,
      takeProfit2: signal.takeProfits && signal.takeProfits.length > 1 ? signal.takeProfits[1] : 0,
      takeProfit3: signal.takeProfits && signal.takeProfits.length > 2 ? signal.takeProfits[2] : 0,
      takeProfit4: signal.takeProfits && signal.takeProfits.length > 3 ? signal.takeProfits[3] : 0,
      takeProfit5: signal.takeProfits && signal.takeProfits.length > 4 ? signal.takeProfits[4] : 0,
    }

    // Push to cloud - if signal has multiple TPs, push separate signals for each TP
    let cloudSignalId: string | undefined
    let signalGroupId: string | undefined  // Will be set if signal has multiple TPs

    if (this.cloudSyncService) {
      try {
        // Check if signal has multiple TPs
        const tpCount = signal.takeProfits?.length || 0

        if (tpCount > 1) {
          // Multiple TPs - push separate signal for each TP level
          // Generate a group ID to link all sub-signals together for group breakeven
          signalGroupId = randomUUID()
          logger.info(`📊 Signal has ${tpCount} TPs - pushing ${tpCount} separate signals to cloud with group ID: ${signalGroupId}`)

          for (let i = 0; i < tpCount; i++) {
            // Create a copy of signal with only this TP
            const singleTPSignal: ParsedSignal = {
              ...signal,
              takeProfits: [signal.takeProfits![i]]
            }

            const cloudId = await this.cloudSyncService.pushSignal(
              singleTPSignal,
              channelId?.toString(),
              channelName,
              telegramMessageId,
              signalGroupId  // Pass the group ID to link multi-TP signals
            )

            if (cloudId && i === 0) {
              // Store first cloud signal ID as primary
              cloudSignalId = cloudId
              logger.debug(`Got cloud signal ID for TP${i + 1}: ${cloudId}`)
            } else if (cloudId) {
              logger.debug(`Got cloud signal ID for TP${i + 1}: ${cloudId}`)
            }
          }

          // Store primary cloud signal ID in database
          if (cloudSignalId && dbSignalId) {
            const { getDatabase, saveDatabase } = require('../database')
            const db = getDatabase()
            db.run('UPDATE signals SET cloud_signal_id = ? WHERE id = ?', [cloudSignalId, dbSignalId])
            saveDatabase()
            logger.debug(`Stored cloud signal ID ${cloudSignalId} for DB signal ${dbSignalId}`)
          }
        } else {
          // Single or no TP - push normally
          const cloudId = await this.cloudSyncService.pushSignal(
            signal,
            channelId?.toString(),
            channelName,
            telegramMessageId
          )
          if (cloudId) {
            cloudSignalId = cloudId
            logger.debug(`Got cloud signal ID: ${cloudSignalId}`)

            // Store cloud signal ID in database if we have a dbSignalId
            if (dbSignalId) {
              const { getDatabase, saveDatabase } = require('../database')
              const db = getDatabase()
              db.run('UPDATE signals SET cloud_signal_id = ? WHERE id = ?', [cloudSignalId, dbSignalId])
              saveDatabase()
              logger.debug(`Stored cloud signal ID ${cloudSignalId} for DB signal ${dbSignalId}`)
            }
          }
        }
      } catch (error: any) {
        logger.error(`[Cloud Sync] Failed to push signal: ${error.message}`)
        // Continue execution even if cloud push fails
      }
    }

    // Add to queue with cloud signal ID and signal group ID
    this.signalQueue.push({ id, signal: transformedSignal, config, dbSignalId, channelId, cloudSignalId, signalGroupId })
    logger.info(`Signal ${id} added to queue. Queue size: ${this.signalQueue.length}`)
    if (signalGroupId) {
      logger.info(`📎 Signal added to group: ${signalGroupId}`)
    }
    logger.debug(`Transformed signal: SL=${transformedSignal.stopLoss}, TP1=${transformedSignal.takeProfit1}`)
  }

  /**
   * Add a modification command to the queue
   */
  addModificationCommand(command: ModificationCommand) {
    this.modificationQueue.push(command)
    logger.info(`Modification command added to queue. Type: ${command.type}, Trades: ${command.trades.length}`)
  }

  /**
   * Start the HTTP API server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          logger.info(`API Server started on http://localhost:${this.port}`)
          resolve()
        })

        this.server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            logger.error(`Port ${this.port} is already in use`)
            reject(new Error(`Port ${this.port} is already in use`))
          } else {
            reject(error)
          }
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Stop the HTTP API server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('API Server stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  /**
   * Get the current queue size
   */
  getQueueSize(): number {
    return this.signalQueue.length
  }
}
