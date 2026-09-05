import { config as dotenvConfig } from 'dotenv'
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'

// Load .env file - in production it's unpacked from app.asar
const isDevelopment = process.env.NODE_ENV === 'development'
console.log('[ENV] isDevelopment:', isDevelopment)
console.log('[ENV] NODE_ENV:', process.env.NODE_ENV)
if (!isDevelopment) {
  // In production, .env is unpacked from app.asar to app.asar.unpacked
  const envPath = path.join(app.getAppPath(), '.env')
  console.log('[ENV] Looking for .env at:', envPath)
  console.log('[ENV] File exists:', fs.existsSync(envPath))
  if (fs.existsSync(envPath)) {
    const result = dotenvConfig({ path: envPath })
    console.log('[ENV] Dotenv load result:', result.error ? result.error.message : 'SUCCESS')
    console.log('[ENV] TELEGRAM_API_ID:', process.env.TELEGRAM_API_ID ? 'SET' : 'NOT SET')
    console.log('[ENV] TELEGRAM_API_HASH:', process.env.TELEGRAM_API_HASH ? 'SET' : 'NOT SET')
  } else {
    console.log('[ENV] ERROR: .env file not found at', envPath)
  }
} else {
  const result = dotenvConfig()
  console.log('[ENV] Dev mode - dotenv result:', result.error ? result.error.message : 'SUCCESS')
  // Dev always runs as the ADVANCED build: layer .env.advanced (keys + ADVANCED_FEATURES) on top.
  // Packaged builds get whichever env file the build script bundled — see build-advanced.js.
  if (fs.existsSync(path.join(process.cwd(), '.env.advanced'))) {
    dotenvConfig({ path: path.join(process.cwd(), '.env.advanced'), override: true })
    console.log('[ENV] Dev mode - .env.advanced layered on top (ADVANCED_FEATURES=', process.env.ADVANCED_FEATURES, ')')
  }
}
import { initDatabase } from './database'
import { TelegramService } from './services/telegram'
import { WebSocketServer } from './services/websocket'
import { SignalParser } from './services/signalParser'
import { ApiServer } from './services/apiServer'
import { CloudSyncService } from './services/cloudSyncService'
import { channelConfigService } from './services/channelConfigService'
import { tradeModificationHandler } from './services/tradeModificationHandler'
import { signalModificationService } from './services/signalModificationService'
import { tscProtector } from './services/tscProtector'
import { multiTPHandler } from './services/multiTPHandler'
import { licenseService, getWebBaseUrl } from './services/licenseService'
import { visionAI } from './services/visionAI'
import { accountService } from './services/accountService'
import { keywordDetector } from './services/keywordDetector'
import { UpdateService } from './services/updateService'
import { logger } from './utils/logger'
import { getDatabase, saveDatabase } from './database'

let mainWindow: BrowserWindow | null = null
let telegramService: TelegramService | null = null
let wsServer: WebSocketServer | null = null
let apiServer: ApiServer | null = null
let signalParser: SignalParser | null = null
let cloudSync: CloudSyncService | null = null
let updateService: UpdateService | null = null

/**
 * Helper function to start or restart trade sync
 * Cloud sync distributes signals to all accounts registered on the user's web portal
 */
function startTradeSyncIfConfigured() {
  if (!cloudSync) return

  const authToken = licenseService.getAuthToken()

  if (authToken) {
    // Stop existing sync if running
    cloudSync.stopTradeSync()

    // Set configuration
    cloudSync.setAuthToken(authToken)

    // Sync trading accounts from cloud so accountService.getPrimaryAccount() works
    cloudSync.syncAccountsFromCloud().catch(err => logger.error('Account sync failed:', err))

    // Start sync - signals will be distributed to all user's accounts
    cloudSync.startTradeSync(30000)
    logger.info('[Cloud Sync] Trade synchronization (re)started')
  } else {
    // Stop sync if not fully configured
    cloudSync.stopTradeSync()
    logger.info('[Cloud Sync] Trade synchronization stopped - missing auth token')
  }
}

// ─── Settings helpers (small key/value table) ───────────────────────────────────
function getSetting(key: string): string | null {
  try {
    const rows = getDatabase().exec('SELECT value FROM settings WHERE key = ?', [key])
    if (rows.length > 0 && rows[0].values.length > 0) return String(rows[0].values[0][0])
  } catch (e: any) {
    logger.warn(`getSetting(${key}) failed: ${e.message}`)
  }
  return null
}

function setSetting(key: string, value: string) {
  try {
    getDatabase().run(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [key, value]
    )
    saveDatabase()
  } catch (e: any) {
    logger.warn(`setSetting(${key}) failed: ${e.message}`)
  }
}

const SETTING_MONITORED_CHANNELS = 'monitored_channels'
const SETTING_MONITORING_ENABLED = 'monitoring_enabled'

function rememberMonitoring(channelIds: number[], enabled: boolean) {
  setSetting(SETTING_MONITORED_CHANNELS, JSON.stringify(channelIds))
  setSetting(SETTING_MONITORING_ENABLED, enabled ? '1' : '0')
}

function getMonitoringState() {
  const channelIds = telegramService?.getMonitoringChannels() || []
  let remembered: number[] = []
  try { remembered = JSON.parse(getSetting(SETTING_MONITORED_CHANNELS) || '[]') } catch { remembered = [] }
  return {
    isMonitoring: channelIds.length > 0,
    channelIds: channelIds.length > 0 ? channelIds : remembered,
    resumeOnStart: getSetting(SETTING_MONITORING_ENABLED) === '1',
  }
}

function broadcastMonitoringState() {
  mainWindow?.webContents.send('telegram:monitoringState', getMonitoringState())
}

/**
 * Resume monitoring the channels the user had selected before the app was last closed.
 * Called once Telegram reconnects on startup, so a VPS reboot does not stop signal copying.
 */
async function resumeMonitoringIfEnabled() {
  if (!telegramService) return
  const state = getMonitoringState()
  if (!state.resumeOnStart || state.channelIds.length === 0) return
  if (telegramService.getMonitoringChannels().length > 0) return // already monitoring
  try {
    await telegramService.startMonitoring(state.channelIds)
    licenseService.setChannelCount(state.channelIds.length)
    logger.info(`▶️  Resumed monitoring ${state.channelIds.length} channel(s) from last session`)
  } catch (e: any) {
    logger.error(`Failed to resume monitoring: ${e.message}`)
  }
  broadcastMonitoringState()
}

/**
 * Reconnect to Telegram automatically when a session was saved on a previous run.
 * Session restore needs no code, so the user lands straight on the dashboard.
 */
const SETTING_TELEGRAM_AUTOCONNECT = 'telegram_autoconnect'

function autoConnectTelegramIfPossible() {
  if (!telegramService) return
  if (telegramService.isConnected() || telegramService.isConnecting()) return
  // Only for signed-in users, and not after an explicit "Disconnect Telegram"
  if (!licenseService.isLoggedIn()) return
  if (getSetting(SETTING_TELEGRAM_AUTOCONNECT) === '0') return
  const phone = telegramService.getSavedPhone()
  if (!phone) {
    logger.info('No saved Telegram session - waiting for the user to sign in')
    return
  }
  logger.info(`Restoring Telegram session for ${phone.replace(/\d(?=\d{3})/g, '*')}`)
  telegramService.connect(phone).catch(err => logger.error('Telegram auto-connect failed:', err))
}

// ─── Deep links (tsm://login?token=...) and single-instance handling ────────────
const PROTOCOL = 'tsm'
let pendingDeepLink: string | null = null
let servicesReady = false

function extractDeepLink(argv: string[]): string | null {
  return argv.find(a => typeof a === 'string' && a.toLowerCase().startsWith(`${PROTOCOL}://`)) || null
}

async function handleDeepLink(rawUrl: string) {
  if (!servicesReady) {
    pendingDeepLink = rawUrl
    return
  }
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    logger.warn(`Ignoring malformed deep link: ${rawUrl}`)
    return
  }
  // tsm://login?token=... → host is "login"
  const action = (url.hostname || url.pathname.replace(/^\/+/, '')).toLowerCase()
  if (action === 'login') {
    const token = url.searchParams.get('token')
    if (!token) return
    logger.info('Deep link: signing in with a token from the website')
    const result = await licenseService.loginWithHandoffToken(token)
    if (result.success) {
      startTradeSyncIfConfigured()
      mainWindow?.webContents.send('auth:loggedIn')
      autoConnectTelegramIfPossible()
    } else {
      mainWindow?.webContents.send('auth:loginFailed', result.error || 'Sign-in link rejected')
    }
    focusMainWindow()
    return
  }
  logger.info(`Deep link action not recognised: ${action}`)
}

function focusMainWindow() {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// Only one copy of the app may run: a second launch (for example from a tsm:// link) hands its
// arguments to the running instance and exits.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const link = extractDeepLink(argv)
    if (link) handleDeepLink(link)
    focusMainWindow()
  })
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
  })
  // Register tsm:// so the website's "Open desktop app" button can reach us
  try {
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL)
    }
  } catch (e: any) {
    logger.warn(`Could not register ${PROTOCOL}:// protocol: ${e.message}`)
  }
  const initialLink = extractDeepLink(process.argv)
  if (initialLink) pendingDeepLink = initialLink
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#1a1a1a',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../assets/icon.png'),
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDevelopment) {
    // Vite dev server running on port 5555
    mainWindow.loadURL('http://localhost:5555')
    mainWindow.webContents.openDevTools()
  } else {
    // In production, load from the packaged app
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  logger.info('Application starting...')

  // Initialize database
  await initDatabase()

  // Initialize services that depend on database (must be done AFTER initDatabase)
  licenseService.init()
  tscProtector.init()
  multiTPHandler.init()
  logger.info('Database-dependent services initialized')

  // Initialize other services
  signalParser = new SignalParser()
  telegramService = new TelegramService(signalParser)
  wsServer = new WebSocketServer(8080)
  apiServer = new ApiServer(3737)

  // Initialize cloud sync service
  cloudSync = new CloudSyncService({
    enabled: true, // Enable by default, can be configured later
    apiUrl: process.env.CLOUD_API_URL || 'https://telegramsignalmirror.com'
  })

  // Start trade sync if configured
  startTradeSyncIfConfigured()

  // Configure API server with cloud sync
  apiServer.setCloudSyncService(cloudSync)

  cloudSync.on('accountError', (errorData) => {
    logger.warn(`[Cloud Sync] Account ${errorData.accountNumber}: ${errorData.message}`)
    mainWindow?.webContents.send('cloudSync:accountError', errorData)
  })

  // Start API server for MT4/MT5 EA communication
  await apiServer.start()

  // Set up event forwarding from backend to renderer
  telegramService.on('codeRequired', () => {
    mainWindow?.webContents.send('telegram:codeRequired')
  })

  telegramService.on('connected', () => {
    mainWindow?.webContents.send('telegram:connected')
    // Pick up where the user left off (survives app restarts and VPS reboots)
    resumeMonitoringIfEnabled()
  })

  // Two-step verification: forward the prompt so the UI can ask for the Telegram cloud password
  telegramService.on('passwordRequired', () => {
    mainWindow?.webContents.send('telegram:passwordRequired')
  })

  telegramService.on('signalReceived', async (signal) => {
    mainWindow?.webContents.send('signal:received', signal)

    // Skipped messages are informational only — shown in the feed, never executed or broadcast
    if (signal.signalType === 'skipped' || !signal.parsed) {
      return
    }

    // Check if it's an update command
    if (signal.isUpdate && signal.parsed) {
      logger.info(`Processing update command: ${signal.parsed.update?.type}`)

      // Get primary trading account
      const primaryAccount = accountService.getPrimaryAccount()

      if (primaryAccount) {
        // Local account exists — process normally (may still emit to cloud if trades stored there)
        tradeModificationHandler.processUpdate(
          signal.parsed,
          signal.channelId,
          primaryAccount.account_number,
          primaryAccount.platform as 'MT4' | 'MT5'
        )
      } else {
        // Cloud-only mode: process ALL update commands with a dummy account
        // The tradeModificationHandler will emit cloudOnlyModification when no local trades match
        logger.info(`Cloud-only mode: routing ${signal.parsed.update?.type} to cloud`)
        tradeModificationHandler.processUpdate(
          signal.parsed,
          signal.channelId,
          'cloud', // Dummy account number
          'MT5'    // Dummy platform
        )
      }
    } else {
      // It's a new signal - process it
      // Cloud sync will distribute to all registered accounts automatically
      const primaryAccount = accountService.getPrimaryAccount()

      // Only run local features (TSC Protector, WebSocket) if there's a local trading account
      if (primaryAccount) {
        const protectorCheck = tscProtector.canOpenTrade(primaryAccount.account_number, primaryAccount.platform as 'MT4' | 'MT5')

        if (!protectorCheck.allowed) {
          logger.warn(`🚫 TSC PROTECTOR blocked signal: ${protectorCheck.reason}`)
          mainWindow?.webContents.send('signal:blocked', {
            signal,
            reason: protectorCheck.reason,
          })
          return
        }

        // Send to WebSocket (local feature)
        wsServer?.broadcast(signal)
      } else {
        logger.info('ℹ️  No local trading account configured - skipping local features (TSC Protector, WebSocket)')
        logger.info('   Signal will still be pushed to cloud for distribution')
      }

      // Send signal to EA without splitting
      // NOTE: Multi-TP Handler is disabled to allow EA's RiskTP1-5 parameters to filter TPs
      // Users can configure which TPs to trade (TP1-TP5) directly in the EA settings
      if (signal.parsed) {
        await apiServer?.addSignal(signal.parsed, signal.config, signal.id, signal.channelId, signal.channelName, signal.messageId)
        logger.debug(`Signal sent to EA with ${signal.parsed.takeProfits?.length || 0} TPs - EA will filter based on RiskTP settings`)
      }

      // DISABLED: Multi-TP Handler splitting logic
      // This was splitting one signal into multiple signals, preventing EA's TP filtering from working
      // if (signal.parsed) {
      //   const multiTPSettings = multiTPHandler.getSettings()
      //   if (multiTPSettings.enabled && signal.parsed.takeProfits && signal.parsed.takeProfits.length > 1) {
      //     const fixedLotSize = 0.01
      //     const splitOrders = multiTPHandler.splitSignal(signal.parsed, fixedLotSize)
      //     if (splitOrders.length > 0) {
      //       logger.info(`📊 Multi-TP: Split signal into ${splitOrders.length} orders`)
      //       for (const splitOrder of splitOrders) {
      //         await apiServer?.addSignal({
      //           ...signal.parsed,
      //           takeProfit: splitOrder.takeProfit,
      //           takeProfits: [splitOrder.takeProfit],
      //           comment: splitOrder.comment,
      //           groupId: splitOrder.groupId,
      //         } as any, signal.config, signal.id, signal.channelId, signal.channelName, signal.messageId)
      //       }
      //     } else {
      //       await apiServer?.addSignal(signal.parsed, signal.config, signal.id, signal.channelId, signal.channelName, signal.messageId)
      //     }
      //   } else {
      //     await apiServer?.addSignal(signal.parsed, signal.config, signal.id, signal.channelId, signal.channelName, signal.messageId)
      //   }
      // }
    }
  })

  // Listen for modification commands from trade modification handler
  tradeModificationHandler.on('modificationCommand', (command) => {
    logger.info(`Sending modification command: ${command.type} for ${command.trades.length} trade(s)`)

    // Add modification command to API server queue
    apiServer?.addModificationCommand(command)

    // Also broadcast via WebSocket for real-time updates
    wsServer?.broadcast({
      type: 'modification',
      command
    })
  })

  // Dropped update commands (nothing to act on, missing value, etc.) — show in the feed so the
  // user sees WHY a provider message produced no trade change instead of assuming a bug.
  tradeModificationHandler.on('updateSkipped', (data: { channelId: number; updateType: string; reason: string; timestamp: string }) => {
    const cfg = channelConfigService.getConfig(data.channelId)
    mainWindow?.webContents.send('signal:received', {
      id: Date.now() + Math.floor(Math.random() * 1000),
      channelId: data.channelId,
      channelName: cfg?.channelName ?? `Channel ${data.channelId}`,
      messageId: 0,
      text: `Update command: ${data.updateType}`,
      parsed: null,
      config: null,
      timestamp: data.timestamp,
      signalType: 'skipped',
      skipReason: data.reason,
      isUpdate: false,
    })
  })

  // Listen for cloud-only modifications from trade modification handler (global commands)
  tradeModificationHandler.on('cloudOnlyModification', async (data: any) => {
    logger.info(`☁️ Cloud-only global command: ${data.type}`)

    // Push directly to cloud - cloud will find all trades for all user accounts
    if (cloudSync) {
      try {
        await cloudSync.pushModification({
          id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          signalId: null, // null indicates global command
          messageId: 0,
          replyToMessageId: 0,
          channelId: data.channelId || 0,
          type: data.type,
          rawText: data.reason || data.type,
          parsedAt: new Date().toISOString(),
          status: 'pending' as const,
          affectedTickets: [],
          percentage: 100,
          targetEntryPrice: data.targetEntryPrice || null, // Forward fuzzy price filter
          newTPs: data.newTPs || null // Forward batch TP array
        })
        const extras = []
        if (data.targetEntryPrice) extras.push(`targetEntry=${data.targetEntryPrice}`)
        if (data.newTPs) extras.push(`newTPs=${JSON.stringify(data.newTPs)}`)
        logger.info(`✅ Global command pushed to cloud successfully${extras.length ? ` (${extras.join(', ')})` : ''}`)
      } catch (error: any) {
        logger.error(`Failed to push global command to cloud: ${error.message}`)
      }
    }
  })

  // Listen for signal modifications (reply-based) from Telegram
  telegramService.on('modificationReceived', async (modification) => {
    logger.info(`📝 Signal modification received: ${modification.type} for signal ${modification.signalId}`)

    // Always show in UI signal feed
    mainWindow?.webContents.send('signal:received', {
      id: modification.id,  // Use modification's unique ID
      channelId: modification.channelId,
      channelName: modification.channelName,
      messageId: modification.messageId,
      text: modification.rawText,
      parsed: {
        symbol: `[${modification.type.toUpperCase().replace(/_/g, ' ')}]`,
        direction: 'MODIFICATION',
        confidence: 1.0
      },
      config: null,
      timestamp: modification.parsedAt,
      signalType: 'modification',
      isUpdate: false,
      modification: modification
    })

    // NOTE: Do NOT push to cloud here - we need to look up trades first!
    // Cloud push happens in signalModificationService.on('modificationCommand') below
    // after trades are looked up and tickets are populated

    // Check if requires confirmation
    if (modification.requiresConfirmation) {
      logger.warn(`⚠️ Modification requires confirmation (not auto-applied): ${modification.type}`)
      // Broadcast to UI for user confirmation
      mainWindow?.webContents.send('modification:confirmation', modification)
      // TODO: Wait for user confirmation before processing
      return
    }

    // Auto-apply modification
    signalModificationService.processModification(modification, modification.channelName)
  })

  // Listen for modification commands from signal modification service
  signalModificationService.on('modificationCommand', async (command) => {
    logger.info(`📤 Signal modification command: ${command.type} for ${command.trades.length} trade(s)`)

    // Add to API server queue for EA to poll
    apiServer?.addModificationCommand(command)

    // Push to cloud AFTER trades are looked up and tickets are populated
    if (cloudSync && command.trades && command.trades.length > 0) {
      try {
        const tickets = command.trades.map(t => t.ticket)
        logger.debug(`[Cloud Push] Sending modification with ${tickets.length} ticket(s): ${tickets.join(', ')}`)

        // Get signal ID from first trade (all trades in a command should have same signal ID)
        const signalId = command.trades[0]?.signalId || ''

        await cloudSync.pushModification({
          id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          signalId,
          messageId: 0, // Not available here
          replyToMessageId: 0,
          channelId: 0, // Not available here
          type: command.type as any,
          rawText: command.reason || '',
          parsedAt: new Date().toISOString(),
          status: 'pending' as const,
          affectedTickets: tickets,
          percentage: command.percentage
        })
      } catch (error: any) {
        logger.error(`Failed to push modification to cloud: ${error.message}`)
      }
    } else if (command.trades.length === 0) {
      logger.warn(`[Cloud Push] Skipping cloud push - no trades found for modification`)
    }

    // Broadcast to UI
    wsServer?.broadcast({
      type: 'signalModification',
      command
    })
  })

  // Listen for cloud-only modifications (when no local trades exist)
  signalModificationService.on('cloudOnlyModification', async (data: any) => {
    const { modification, channelName } = data
    logger.info(`☁️ Cloud-only modification: ${modification.type} for signal ${modification.signalId}`)

    // Push directly to cloud - let cloud API route to correct accounts
    if (cloudSync) {
      try {
        await cloudSync.pushModification(modification)
        logger.info(`✅ Cloud-only modification pushed successfully`)
      } catch (error: any) {
        logger.error(`Failed to push cloud-only modification: ${error.message}`)
      }
    }
  })

  // TSC Protector event listeners
  tscProtector.on('limitHit', (event) => {
    logger.warn(`⚠️ TSC PROTECTOR: ${event.limitType} limit hit for ${event.accountNumber}`)
    mainWindow?.webContents.send('protector:limitHit', event)
  })

  tscProtector.on('closeAll', (data) => {
    logger.warn(`🛑 TSC PROTECTOR: Closing all positions for ${data.accountNumber}`)

    // Send close all command through modification handler
    apiServer?.addModificationCommand({
      type: 'close_all',
      accountNumber: data.accountNumber,
      platform: data.platform,
      trades: [],
      reason: data.reason
    })
  })

  tscProtector.on('notification', (notification) => {
    mainWindow?.webContents.send('protector:notification', notification)
  })

  tscProtector.on('statsReset', (data) => {
    logger.info(`🔄 TSC PROTECTOR: Stats reset for ${data.accountNumber}`)
    mainWindow?.webContents.send('protector:statsReset', data)
  })

  // Multi-TP Handler event listeners
  multiTPHandler.on('tpHit', (event) => {
    logger.info(`🎯 Multi-TP: TP${event.tpLevel} hit for ${event.symbol}`)
    mainWindow?.webContents.send('multiTP:tpHit', event)
  })

  multiTPHandler.on('modifySL', (data) => {
    logger.info(`🔒 Multi-TP: Moving SL to ${data.newSL} for group ${data.groupId}`)

    // Get primary trading account
    const primaryAccount = accountService.getPrimaryAccount()
    if (!primaryAccount) {
      logger.warn('No active trading account configured, skipping SL modification')
      return
    }

    // Send modification command to update SL
    apiServer?.addModificationCommand({
      type: 'modify_sl',
      accountNumber: primaryAccount.account_number,
      platform: primaryAccount.platform,
      trades: [], // TODO: Get trades from group
      newValue: data.newSL,
      reason: data.reason,
    })
  })

  multiTPHandler.on('startTrailing', (data) => {
    logger.info(`📈 Multi-TP: Starting trailing stop for group ${data.groupId}`)
    // Trailing stop implementation would go here
    // For now, just log it
  })

  multiTPHandler.on('closeGroup', (data) => {
    logger.warn(`🚨 Multi-TP: Closing group ${data.groupId} - ${data.reason}`)

    // Get primary trading account
    const primaryAccount = accountService.getPrimaryAccount()
    if (!primaryAccount) {
      logger.warn('No active trading account configured, skipping group close')
      return
    }

    // Send close all command for this group
    apiServer?.addModificationCommand({
      type: 'close',
      accountNumber: primaryAccount.account_number,
      platform: primaryAccount.platform,
      trades: [], // TODO: Get trades from group
      percentage: 100,
      reason: data.reason,
    })
  })

  // License Service event listeners
  licenseService.on('licenseUpdated', (license) => {
    logger.info(`License updated: ${license.tier}`)
    mainWindow?.webContents.send('license:updated', license)
  })

  licenseService.on('licenseActivated', (license) => {
    logger.info(`License activated: ${license.tier}`)
    mainWindow?.webContents.send('license:activated', license)
  })

  licenseService.on('trialStarted', (license) => {
    logger.info('Trial started')
    mainWindow?.webContents.send('license:trialStarted', license)
  })

  licenseService.on('licenseInvalid', (result) => {
    logger.warn(`License invalid: ${result.reason}`)
    mainWindow?.webContents.send('license:invalid', result)
  })

  licenseService.on('licenseExpiringSoon', (result) => {
    logger.warn(`License expiring soon: ${result.daysRemaining} days`)
    mainWindow?.webContents.send('license:expiringSoon', result)
  })

  licenseService.on('licenseDeactivated', (license) => {
    logger.info('License deactivated')
    mainWindow?.webContents.send('license:deactivated', license)
  })

  // Vision AI event listeners
  visionAI.on('analysisComplete', (result) => {
    logger.info(`🔍 Vision AI: Analysis complete for message ${result.image.messageId}`)
    mainWindow?.webContents.send('visionAI:analysisComplete', result)
  })

  visionAI.on('analysisError', (data) => {
    logger.error(`❌ Vision AI: Analysis failed - ${data.error}`)
    mainWindow?.webContents.send('visionAI:analysisError', data)
  })

  visionAI.on('settingsUpdated', (settings) => {
    logger.info('Vision AI settings updated')
    mainWindow?.webContents.send('visionAI:settingsUpdated', settings)
  })

  visionAI.on('statsReset', () => {
    logger.info('Vision AI stats reset')
    mainWindow?.webContents.send('visionAI:statsReset')
  })

  telegramService.on('error', (error) => {
    mainWindow?.webContents.send('telegram:error', error)
  })

  // Initialize Update Service
  updateService = new UpdateService()

  // Update Service event listeners
  updateService.on('update-available', (updateInfo) => {
    logger.info(`Update available: v${updateInfo.latestVersion}`)
    mainWindow?.webContents.send('update-available', updateInfo)
  })

  updateService.on('update-not-available', (updateInfo) => {
    logger.info(`App is up to date: v${updateInfo.latestVersion}`)
    mainWindow?.webContents.send('update-not-available', updateInfo)
  })

  updateService.on('update-progress', (progress) => {
    mainWindow?.webContents.send('update-progress', progress)
  })

  updateService.on('update-downloaded', (updateInfo) => {
    logger.info(`Update downloaded: v${updateInfo.latestVersion}`)
    mainWindow?.webContents.send('update-downloaded', updateInfo)
  })

  updateService.on('error', (error) => {
    logger.error(`Update check error: ${error}`)
  })

  // Installed copies start with Windows unless the user turned it off. A VPS reboot then brings the
  // app, Telegram and monitoring back without anyone logging in.
  applyAutoLaunchDefault()

  // Start auto-update checks
  updateService.startAutoUpdateCheck()

  createWindow()

  servicesReady = true
  if (pendingDeepLink) {
    const link = pendingDeepLink
    pendingDeepLink = null
    handleDeepLink(link)
  }

  // Restore the Telegram session (and then monitoring) without any clicks
  autoConnectTelegramIfPossible()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  logger.info('Application shutting down...')
  if (telegramService) {
    await telegramService.disconnect()
  }
  if (wsServer) {
    wsServer.close()
  }
  if (apiServer) {
    await apiServer.stop()
  }
  if (cloudSync) {
    cloudSync.stopTradeSync()
  }
  if (updateService) {
    updateService.stopAutoUpdateCheck()
  }
})

// IPC Handlers
ipcMain.handle('telegram:connect', async (_, phoneNumber: string) => {
  try {
    setSetting(SETTING_TELEGRAM_AUTOCONNECT, '1')
    await telegramService?.connect(phoneNumber)
    return { success: true }
  } catch (error: any) {
    logger.error('Telegram connection error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('telegram:sendCode', async (_, code: string) => {
  try {
    const result = await telegramService?.sendCode(code)
    logger.info('Code sent to Telegram service')
    return result || { success: true }
  } catch (error: any) {
    logger.error('Code verification error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('telegram:getChannels', async () => {
  try {
    const channels = await telegramService?.getChannels()
    return { success: true, channels }
  } catch (error: any) {
    logger.error('Get channels error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('telegram:startMonitoring', async (_, channelIds: number[]) => {
  try {
    // Note: Channel limits are now unlimited for all tiers per spec
    // Keeping the validation for future use if needed
    const canAdd = licenseService.canAddChannel()
    if (!canAdd.canPerformAction && channelIds.length > 0) {
      logger.warn(`Channel limit check: ${canAdd.reason}`)
      return { success: false, error: canAdd.reason || 'Channel limit reached' }
    }

    await telegramService?.startMonitoring(channelIds)

    // Set channel count to actual number of channels being monitored
    licenseService.setChannelCount(channelIds.length)
    rememberMonitoring(channelIds, true)
    broadcastMonitoringState()

    logger.info(`Started monitoring ${channelIds.length} channels`)
    return { success: true }
  } catch (error: any) {
    logger.error('Start monitoring error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('telegram:stopMonitoring', async () => {
  try {
    await telegramService?.stopMonitoring()

    // Reset channel count to 0 when stopping monitoring
    licenseService.setChannelCount(0)
    // Keep the channel list so the next Start uses it, but do not auto-resume on launch
    rememberMonitoring(getMonitoringState().channelIds, false)
    broadcastMonitoringState()

    logger.info('Stopped monitoring all channels')
    return { success: true }
  } catch (error: any) {
    logger.error('Stop monitoring error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('telegram:disconnect', async () => {
  try {
    // The user asked to disconnect: do not silently reconnect on the next launch
    setSetting(SETTING_TELEGRAM_AUTOCONNECT, '0')
    await telegramService?.disconnect()
    return { success: true }
  } catch (error: any) {
    logger.error('Disconnect error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('telegram:isConnected', async () => {
  try {
    const isConnected = telegramService?.isConnected() || false
    return { success: true, isConnected }
  } catch (error: any) {
    logger.error('Is connected error:', error)
    return { success: false, isConnected: false, error: error.message }
  }
})

ipcMain.handle('telegram:sendPassword', async (_, password: string) => {
  try {
    const result = await telegramService?.sendPassword(password)
    return result || { success: true }
  } catch (error: any) {
    logger.error('2FA password error:', error)
    return { success: false, error: error.message }
  }
})

// Saved-session info so the UI can show "Reconnecting…" instead of the phone form
ipcMain.handle('telegram:getSessionInfo', async () => {
  try {
    const savedPhone = telegramService?.getSavedPhone() || null
    return {
      success: true,
      hasSavedSession: !!savedPhone,
      phone: savedPhone,
      isConnecting: telegramService?.isConnecting() || false,
      isConnected: telegramService?.isConnected() || false,
    }
  } catch (error: any) {
    return { success: false, hasSavedSession: false, error: error.message }
  }
})

ipcMain.handle('telegram:getMonitoringState', async () => {
  try {
    return { success: true, ...getMonitoringState() }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// Open the website already logged in (single sign-on with the stored session token)
ipcMain.handle('web:open', async (_, targetPath?: string) => {
  try {
    const url = licenseService.getWebUrl(targetPath || '/dashboard')
    await shell.openExternal(url)
    return { success: true }
  } catch (error: any) {
    logger.error('Open web error:', error)
    return { success: false, error: error.message }
  }
})

// "Sign in with your browser": the website logs the user in and calls back via tsm://login
ipcMain.handle('web:openDesktopSignIn', async () => {
  try {
    const url = `${getWebBaseUrl()}/auth/desktop?machineId=${encodeURIComponent(licenseService.getMachineId())}`
    await shell.openExternal(url)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('license:loginWithHandoffToken', async (_, token: string) => {
  try {
    const result = await licenseService.loginWithHandoffToken(token)
    if (result.success) startTradeSyncIfConfigured()
    return result
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// Channel Configuration Handlers
ipcMain.handle('channelConfig:get', async (_, channelId: number) => {
  try {
    const config = channelConfigService.getConfig(channelId)
    if (config) {
      return { success: true, config }
    } else {
      return { success: false, error: 'Config not found' }
    }
  } catch (error: any) {
    logger.error('Get config error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('channelConfig:save', async (_, config: any) => {
  try {
    const success = channelConfigService.saveConfig(config)
    return { success }
  } catch (error: any) {
    logger.error('Save config error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('channelConfig:reset', async (_, channelId: number) => {
  try {
    const success = channelConfigService.resetConfig(channelId)
    return { success }
  } catch (error: any) {
    logger.error('Reset config error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('channelConfig:export', async (_, channelId: number) => {
  try {
    const json = channelConfigService.exportConfig(channelId)
    if (json) {
      return { success: true, json }
    } else {
      return { success: false, error: 'Config not found' }
    }
  } catch (error: any) {
    logger.error('Export config error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('channelConfig:import', async (_, channelId: number, configJson: string) => {
  try {
    const success = channelConfigService.importConfig(channelId, configJson)
    return { success }
  } catch (error: any) {
    logger.error('Import config error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('channelConfig:clearConfirmationRequirements', async (_, channelId: number) => {
  try {
    const success = channelConfigService.clearConfirmationRequirements(channelId)
    return { success }
  } catch (error: any) {
    logger.error('Clear confirmation requirements error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('channelConfig:detectKeywords', async (_, exampleSignal: string) => {
  try {
    const detected = keywordDetector.detectKeywords(exampleSignal)
    return { success: true, detected }
  } catch (error: any) {
    logger.error('Detect keywords error:', error)
    return { success: false, error: error.message }
  }
})

// Export a channel's recent text history to a JSON file chosen by the user.
// Text only — media-only posts are skipped, image captions are kept.
ipcMain.handle('channelConfig:exportHistory', async (_, channelId: number, opts?: { maxMessages?: number; maxAgeDays?: number; maxBytes?: number }) => {
  try {
    if (!telegramService?.isConnected()) {
      return { success: false, error: 'Telegram is not connected' }
    }
    const messages = await telegramService.getChannelHistory(channelId, opts)
    if (messages.length === 0) {
      return { success: false, error: 'No text messages found in the selected window' }
    }

    const config = channelConfigService.getConfig(channelId)
    const safeName = (config?.channelName || `channel-${channelId}`).replace(/[^\w\-]+/g, '_').slice(0, 60)
    const stamp = new Date().toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog({
      title: 'Export channel history',
      defaultPath: path.join(app.getPath('documents'), `${safeName}-history-${stamp}.json`),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) {
      return { success: true, canceled: true }
    }

    const payload = {
      channelId,
      channelName: config?.channelName ?? null,
      exportedAt: new Date().toISOString(),
      count: messages.length,
      messages
    }
    const json = JSON.stringify(payload, null, 2)
    fs.writeFileSync(result.filePath, json, 'utf8')
    logger.info(`Exported ${messages.length} messages for channel ${channelId} to ${result.filePath}`)
    return { success: true, path: result.filePath, count: messages.length, bytes: Buffer.byteLength(json, 'utf8') }
  } catch (error: any) {
    logger.error('Export history error:', error)
    return { success: false, error: error.message }
  }
})

// Pull recent history and ask the LLM (one call) to draft a channel configuration.
ipcMain.handle('channelConfig:analyzeHistory', async (_, channelId: number, opts?: { maxMessages?: number; maxAgeDays?: number; maxBytes?: number }) => {
  try {
    // Uses the Anthropic API — advanced (personal) build only. Customer builds never reach this.
    const { isAdvancedBuild } = await import('./utils/features')
    if (!isAdvancedBuild()) {
      return { success: false, error: 'Auto-configure is not available in this build' }
    }
    if (!telegramService?.isConnected()) {
      return { success: false, error: 'Telegram is not connected' }
    }
    const messages = await telegramService.getChannelHistory(channelId, opts)
    if (messages.length === 0) {
      return { success: false, error: 'No text messages found in the selected window' }
    }

    const { analyzeChannelHistory } = await import('./services/channelHistoryAnalyzer')
    const config = channelConfigService.getConfig(channelId)
    const analysis = await analyzeChannelHistory(messages, {
      channelName: config?.channelName,
      log: (m) => logger.info(`[History Analyzer] ${m}`)
    })
    logger.info(`History analysis complete for channel ${channelId}: confidence=${analysis.confidence} signals≈${analysis.stats.estimatedSignals}`)
    return { success: true, analysis }
  } catch (error: any) {
    logger.error('Analyze history error:', error)
    return { success: false, error: error.message }
  }
})

// ─── Build feature flags (renderer hides advanced-only UI when absent) ───────
ipcMain.handle('app:getFeatures', async () => {
  const { isAdvancedBuild } = await import('./utils/features')
  return { success: true, features: { advanced: isAdvancedBuild() } }
})

// ─── EA install / status helpers (setup checklist) ───────────────────────────

interface DetectedTerminal { id: string; platform: 'MT4' | 'MT5'; expertsPath: string; broker?: string; alreadyInstalled: boolean }

/** Scan %APPDATA%\MetaQuotes\Terminal\<hash>\ for MT4/MT5 data folders. */
function detectMtTerminals(): DetectedTerminal[] {
  const out: DetectedTerminal[] = []
  try {
    const root = path.join(app.getPath('appData'), 'MetaQuotes', 'Terminal')
    if (!fs.existsSync(root)) return out
    for (const hash of fs.readdirSync(root)) {
      const base = path.join(root, hash)
      if (!fs.statSync(base).isDirectory()) continue
      let broker: string | undefined
      const origin = path.join(base, 'origin.txt')
      if (fs.existsSync(origin)) {
        // origin.txt holds the terminal install path; last folder is usually the broker name
        const p = fs.readFileSync(origin, 'utf8').replace(/\0/g, '').trim()
        broker = p.split(/[\\/]/).filter(Boolean).pop()
      }
      for (const [folder, platform, ext] of [['MQL5', 'MT5', '.ex5'], ['MQL4', 'MT4', '.ex4']] as const) {
        const experts = path.join(base, folder, 'Experts')
        if (fs.existsSync(experts)) {
          out.push({
            id: `${hash}:${platform}`,
            platform,
            expertsPath: experts,
            broker,
            alreadyInstalled: fs.existsSync(path.join(experts, `TelegramSignalMirror${ext}`))
          })
        }
      }
    }
  } catch (e: any) {
    logger.warn(`detectMtTerminals failed: ${e.message}`)
  }
  return out
}

function bundledEaPath(platform: 'MT4' | 'MT5'): string | null {
  const file = platform === 'MT4' ? 'TelegramSignalMirror.ex4' : 'TelegramSignalMirror.ex5'
  const candidates = [
    path.join(app.getAppPath(), 'assets', 'ea', file),
    path.join(process.resourcesPath || '', 'assets', 'ea', file),
    path.join(__dirname, '..', '..', 'assets', 'ea', file),
    path.join(__dirname, '..', 'assets', 'ea', file)
  ]
  return candidates.find(p => p && fs.existsSync(p)) || null
}

ipcMain.handle('ea:detectTerminals', async () => {
  try {
    return { success: true, terminals: detectMtTerminals() }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('ea:install', async (_, terminalIds: string[]) => {
  try {
    const terminals = detectMtTerminals().filter(t => terminalIds.includes(t.id))
    if (terminals.length === 0) return { success: false, error: 'No matching terminals found' }
    const installed: { id: string; path: string }[] = []
    for (const t of terminals) {
      const src = bundledEaPath(t.platform)
      if (!src) {
        logger.warn(`No bundled EA for ${t.platform}`)
        continue
      }
      const dest = path.join(t.expertsPath, path.basename(src))
      fs.copyFileSync(src, dest)
      installed.push({ id: t.id, path: dest })
      logger.info(`Installed EA → ${dest}`)
    }
    if (installed.length === 0) return { success: false, error: 'EA binary not bundled with this build' }
    return { success: true, installed }
  } catch (error: any) {
    logger.error('EA install error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('ea:status', async () => {
  try {
    const polling = apiServer?.getEaStatus() ?? []
    const accounts = accountService.getAccounts().map(a => ({
      account_number: a.account_number, platform: a.platform, is_active: a.is_active
    }))
    return { success: true, polling, accounts }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// ─── Weekly health summary ───────────────────────────────────────────────────
ipcMain.handle('stats:weekly', async () => {
  try {
    const { getDatabase } = require('./database')
    const db = getDatabase()
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)

    let received = 0, newSignals = 0, updates = 0, skipped = 0
    const rows = db.exec('SELECT parsed_data FROM signals WHERE received_at >= ?', [since])
    if (rows.length > 0) {
      for (const r of rows[0].values) {
        received++
        const raw = r[0] as string | null
        if (!raw) { skipped++; continue }
        try {
          const p = JSON.parse(raw)
          if (p?.signalType === 'new') newSignals++
          else if (p?.signalType === 'update') updates++
          else skipped++
        } catch { skipped++ }
      }
    }

    let executed = 0
    const ex = db.exec('SELECT COUNT(*) FROM active_trades WHERE COALESCE(opened_at, created_at) >= ?', [since])
    if (ex.length > 0 && ex[0].values.length > 0) executed = Number(ex[0].values[0][0]) || 0

    return { success: true, stats: { received, newSignals, updates, skipped, executed, byReason: [] } }
  } catch (error: any) {
    logger.error('Weekly stats error:', error)
    return { success: false, error: error.message }
  }
})

// TSC Protector Handlers
ipcMain.handle('protector:getSettings', async (_, accountNumber: string, platform: string) => {
  try {
    let settings = tscProtector.getSettings(accountNumber, platform)
    if (!settings) {
      settings = tscProtector.createDefaultSettings(accountNumber, platform)
    }
    return { success: true, settings }
  } catch (error: any) {
    logger.error('Get protector settings error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('protector:saveSettings', async (_, settings: any) => {
  try {
    const success = tscProtector.saveSettings(settings)
    return { success }
  } catch (error: any) {
    logger.error('Save protector settings error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('protector:getStatus', async (_, accountNumber: string, platform: string) => {
  try {
    const status = tscProtector.getStatus(accountNumber, platform)
    return { success: true, status }
  } catch (error: any) {
    logger.error('Get protector status error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('protector:canOpenTrade', async (_, accountNumber: string, platform: string) => {
  try {
    const result = tscProtector.canOpenTrade(accountNumber, platform)
    return { success: true, ...result }
  } catch (error: any) {
    logger.error('Check can open trade error:', error)
    return { success: false, error: error.message }
  }
})

// License Handlers
ipcMain.handle('license:get', async () => {
  try {
    const license = licenseService.getCurrentLicense()
    return { success: true, license }
  } catch (error: any) {
    logger.error('Get license error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('license:validate', async () => {
  try {
    const result = licenseService.validateLicense()
    return { success: true, ...result }
  } catch (error: any) {
    logger.error('Validate license error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('license:activate', async (_, request: any) => {
  try {
    const response = await licenseService.activateLicense(request)
    return response
  } catch (error: any) {
    logger.error('Activate license error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('license:deactivate', async () => {
  try {
    const success = licenseService.deactivateLicense()
    return { success }
  } catch (error: any) {
    logger.error('Deactivate license error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('license:canAddAccount', async () => {
  try {
    const result = licenseService.canAddAccount()
    return { success: true, ...result }
  } catch (error: any) {
    logger.error('Check can add account error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('license:canAddChannel', async () => {
  try {
    const result = licenseService.canAddChannel()
    return { success: true, ...result }
  } catch (error: any) {
    logger.error('Check can add channel error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('license:hasFeature', async (_, feature: string) => {
  try {
    const hasFeature = licenseService.hasFeature(feature as any)
    return { success: true, hasFeature }
  } catch (error: any) {
    logger.error('Check feature error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('license:getMachineId', async () => {
  try {
    const machineId = licenseService.getMachineId()
    return { success: true, machineId }
  } catch (error: any) {
    logger.error('Get machine ID error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('license:login', async (_, email: string, password: string) => {
  try {
    const result = await licenseService.login(email, password)

    // If login successful, restart trade sync with new auth token
    if (result.success) {
      startTradeSyncIfConfigured()
      autoConnectTelegramIfPossible()
    }

    return result
  } catch (error: any) {
    logger.error('Login error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('license:isLoggedIn', async () => {
  try {
    const isLoggedIn = licenseService.isLoggedIn()
    return { success: true, isLoggedIn }
  } catch (error: any) {
    logger.error('Check logged in error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('license:logout', async () => {
  try {
    const success = licenseService.logout()

    // Stop trade sync when user logs out
    if (success && cloudSync) {
      cloudSync.stopTradeSync()
      logger.info('[Cloud Sync] Trade synchronization stopped after logout')
    }

    return { success }
  } catch (error: any) {
    logger.error('Logout error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('license:validateWithAPI', async () => {
  try {
    const result = await licenseService.validateLicenseWithAPI()
    return { success: true, ...result }
  } catch (error: any) {
    logger.error('Validate with API error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('license:forceRevalidate', async () => {
  try {
    logger.info('🔄 Force revalidation requested via IPC')
    const result = await licenseService.forceRevalidate()
    return { success: true, ...result }
  } catch (error: any) {
    logger.error('Force revalidate error:', error)
    return { success: false, error: error.message }
  }
})

// Vision AI Handlers
ipcMain.handle('visionAI:getSettings', async () => {
  try {
    const settings = visionAI.getSettings()
    return { success: true, settings }
  } catch (error: any) {
    logger.error('Get Vision AI settings error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('visionAI:updateSettings', async (_, settings: any) => {
  try {
    visionAI.updateSettings(settings)
    return { success: true }
  } catch (error: any) {
    logger.error('Update Vision AI settings error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('visionAI:getStats', async () => {
  try {
    const stats = visionAI.getStats()
    return { success: true, stats }
  } catch (error: any) {
    logger.error('Get Vision AI stats error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('visionAI:resetStats', async () => {
  try {
    visionAI.resetStats()
    return { success: true }
  } catch (error: any) {
    logger.error('Reset Vision AI stats error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('visionAI:analyzeChart', async (_, request: any) => {
  try {
    // Check if user has Vision AI feature
    const hasFeature = licenseService.hasFeature('visionAI')

    if (!hasFeature) {
      return {
        success: false,
        error: 'Vision AI is only available for Pro and Advance license tiers. Please upgrade your license.',
      }
    }

    const result = await visionAI.analyzeChart(request)
    return result
  } catch (error: any) {
    logger.error('Analyze chart error:', error)
    return {
      success: false,
      error: error.message,
      analyzedAt: new Date().toISOString(),
      processingTime: 0,
      image: request.image ? {
        messageId: request.image.messageId,
        channelId: request.image.channelId,
        fileSize: request.image.fileSize,
      } : {},
      trend: { direction: 'neutral', strength: 'weak', confidence: 0, reasoning: 'Error' },
      supportResistance: [],
      indicators: { detected: [], signals: [] },
      patterns: { patterns: [] },
      priceAction: { priceMovement: 'Unknown', momentum: 'stable', volatility: 'medium', keyObservations: [] },
      recommendation: { action: 'wait', confidence: 0, reasoning: 'Error', riskLevel: 'high' },
      rawAnalysis: '',
    }
  }
})

ipcMain.handle('visionAI:isEnabled', async () => {
  try {
    const enabled = visionAI.isEnabled()
    return { success: true, enabled }
  } catch (error: any) {
    logger.error('Check Vision AI enabled error:', error)
    return { success: false, error: error.message }
  }
})

// Multi-TP Handler IPC handlers
ipcMain.handle('multiTP:getSettings', async () => {
  try {
    const settings = multiTPHandler.getSettings()
    return { success: true, settings }
  } catch (error: any) {
    logger.error('Get Multi-TP settings error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('multiTP:saveSettings', async (_, settings: any) => {
  try {
    const success = multiTPHandler.saveSettings(settings)
    return { success }
  } catch (error: any) {
    logger.error('Save Multi-TP settings error:', error)
    return { success: false, error: error.message }
  }
})

// Trading Account Handlers
ipcMain.handle('account:getAll', async () => {
  try {
    const accounts = accountService.getAccounts()
    return { success: true, accounts }
  } catch (error: any) {
    logger.error('Get accounts error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('account:add', async (_, account: any) => {
  try {
    const id = accountService.addAccount(
      account.platform,
      account.accountNumber,
      account.accountName
    )

    // Restart trade sync if this becomes the primary account
    startTradeSyncIfConfigured()

    return { success: true, id }
  } catch (error: any) {
    logger.error('Add account error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('account:update', async (_, id: number, data: any) => {
  try {
    accountService.updateAccount(id, data)
    return { success: true }
  } catch (error: any) {
    logger.error('Update account error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('account:delete', async (_, id: number) => {
  try {
    accountService.deleteAccount(id)
    return { success: true }
  } catch (error: any) {
    logger.error('Delete account error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('account:setActive', async (_, id: number, isActive: boolean) => {
  try {
    accountService.setActive(id, isActive)

    // Restart trade sync with new primary account
    startTradeSyncIfConfigured()

    return { success: true }
  } catch (error: any) {
    logger.error('Set account active error:', error)
    return { success: false, error: error.message }
  }
})

// Cloud-mode Platform Adapters
ipcMain.handle('platforms:list', async () => {
  try {
    const { listPlatforms } = await import('./adapters')
    return { success: true, platforms: listPlatforms() }
  } catch (error: any) {
    logger.error('platforms:list error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('platforms:testConnection', async (_, platformId: string, creds: any) => {
  try {
    const { createAdapter } = await import('./adapters')
    const adapter = createAdapter(platformId as any)
    const result = await adapter.connect(creds ?? {})
    await adapter.disconnect()
    return { success: true, result }
  } catch (error: any) {
    logger.error('platforms:testConnection error:', error)
    return { success: false, error: error.message }
  }
})

// Update Service Handlers
ipcMain.handle('update:check', async () => {
  try {
    const updateInfo = await updateService?.checkForUpdates()
    return { success: true, updateInfo }
  } catch (error: any) {
    logger.error('Check for updates error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('update:download', async (_, downloadUrl: string) => {
  try {
    updateService?.downloadUpdate(downloadUrl)
    return { success: true }
  } catch (error: any) {
    logger.error('Download update error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('update:install', async () => {
  try {
    const ok = updateService?.installDownloadedUpdate() || false
    return { success: ok, error: ok ? undefined : 'No downloaded update to install' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('update:getStatus', async () => {
  return {
    success: true,
    version: updateService?.getCurrentVersion() || app.getVersion(),
    portable: updateService?.isPortable() ?? false,
    downloaded: updateService?.hasDownloadedUpdate() || null,
  }
})

// ─── Start with Windows ─────────────────────────────────────────────────────────
const SETTING_AUTO_LAUNCH = 'auto_launch'

function autoLaunchPath(): string {
  // The portable launcher extracts to a temp dir; point the login item at the real portable exe
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
}

function setAutoLaunch(enabled: boolean) {
  if (process.platform !== 'win32' || !app.isPackaged) return
  app.setLoginItemSettings({ openAtLogin: enabled, path: autoLaunchPath(), args: [] })
  setSetting(SETTING_AUTO_LAUNCH, enabled ? '1' : '0')
  logger.info(`Start with Windows ${enabled ? 'enabled' : 'disabled'}`)
}

function applyAutoLaunchDefault() {
  if (process.platform !== 'win32' || !app.isPackaged) return
  const stored = getSetting(SETTING_AUTO_LAUNCH)
  if (stored === null) {
    // First run: installed builds default to on, portable builds to off (their path may move)
    setAutoLaunch(!process.env.PORTABLE_EXECUTABLE_DIR)
  } else if (stored === '1') {
    // Re-assert in case the exe path changed (installer upgrade)
    app.setLoginItemSettings({ openAtLogin: true, path: autoLaunchPath(), args: [] })
  }
}

ipcMain.handle('app:getAutoLaunch', async () => {
  try {
    const supported = process.platform === 'win32' && app.isPackaged
    const enabled = supported ? app.getLoginItemSettings({ path: autoLaunchPath() }).openAtLogin : false
    return { success: true, supported, enabled }
  } catch (error: any) {
    return { success: false, supported: false, enabled: false, error: error.message }
  }
})

ipcMain.handle('app:setAutoLaunch', async (_, enabled: boolean) => {
  try {
    setAutoLaunch(!!enabled)
    return { success: true, enabled: !!enabled }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('update:getVersion', async () => {
  try {
    const version = updateService?.getCurrentVersion() || app.getVersion()
    return { success: true, version }
  } catch (error: any) {
    logger.error('Get version error:', error)
    return { success: false, error: error.message }
  }
})
