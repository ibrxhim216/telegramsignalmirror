import 'dotenv/config'
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
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
import { licenseService } from './services/licenseService'
import { visionAI } from './services/visionAI'
import { accountService } from './services/accountService'
import { logger } from './utils/logger'

let mainWindow: BrowserWindow | null = null
let telegramService: TelegramService | null = null
let wsServer: WebSocketServer | null = null
let apiServer: ApiServer | null = null
let signalParser: SignalParser | null = null
let cloudSync: CloudSyncService | null = null

const isDev = process.env.NODE_ENV === 'development'

/**
 * Helper function to start or restart trade sync
 */
function startTradeSyncIfConfigured() {
  if (!cloudSync) return

  const authToken = licenseService.getAuthToken()
  const primaryAccount = accountService.getPrimaryAccount()

  if (authToken && primaryAccount) {
    // Stop existing sync if running
    cloudSync.stopTradeSync()

    // Set configuration
    cloudSync.setAuthToken(authToken)
    cloudSync.setAccountNumber(primaryAccount.account_number)

    // Start sync
    cloudSync.startTradeSync(30000)
    logger.info('[Cloud Sync] Trade synchronization (re)started')
  } else {
    // Stop sync if not fully configured
    cloudSync.stopTradeSync()
    logger.info('[Cloud Sync] Trade synchronization stopped - missing auth token or account')
  }
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
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    // Vite dev server running on port 5555
    mainWindow.loadURL('http://localhost:5555')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'))
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

  // Cloud Sync event listeners
  cloudSync.on('accountError', (errorData: any) => {
    logger.warn(`⚠️ Cloud Sync: Account not found - ${errorData.accountNumber}`)
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
  })

  telegramService.on('signalReceived', async (signal) => {
    mainWindow?.webContents.send('signal:received', signal)

    // Check if it's an update command
    if (signal.isUpdate && signal.parsed) {
      logger.info(`Processing update command: ${signal.parsed.update?.type}`)

      // Get primary trading account
      const primaryAccount = accountService.getPrimaryAccount()
      if (!primaryAccount) {
        logger.warn('No active trading account configured, skipping update command')
        return
      }

      // Process the update with modification handler
      tradeModificationHandler.processUpdate(
        signal.parsed,
        signal.channelId,
        primaryAccount.account_number,
        primaryAccount.platform as 'MT4' | 'MT5'
      )
    } else {
      // It's a new signal - check protector first
      const primaryAccount = accountService.getPrimaryAccount()
      if (!primaryAccount) {
        logger.warn('No active trading account configured, skipping signal')
        mainWindow?.webContents.send('signal:blocked', {
          signal,
          reason: 'No active trading account configured',
        })
        return
      }

      const protectorCheck = tscProtector.canOpenTrade(primaryAccount.account_number, primaryAccount.platform as 'MT4' | 'MT5')

      if (!protectorCheck.allowed) {
        logger.warn(`🚫 TSC PROTECTOR blocked signal: ${protectorCheck.reason}`)
        mainWindow?.webContents.send('signal:blocked', {
          signal,
          reason: protectorCheck.reason,
        })
        return
      }

      // Send to WebSocket
      wsServer?.broadcast(signal)

      // Process with multi-TP handler if signal has multiple TPs
      if (signal.parsed) {
        const multiTPSettings = multiTPHandler.getSettings()

        if (
          multiTPSettings.enabled &&
          signal.parsed.takeProfits &&
          signal.parsed.takeProfits.length > 1
        ) {
          // Split into multiple orders
          const fixedLotSize = 0.01 // TODO: Get from settings or calculate by risk
          const splitOrders = multiTPHandler.splitSignal(signal.parsed, fixedLotSize)

          if (splitOrders.length > 0) {
            logger.info(`📊 Multi-TP: Split signal into ${splitOrders.length} orders`)

            // Add each split order to API queue
            for (const splitOrder of splitOrders) {
              await apiServer?.addSignal({
                ...signal.parsed,
                takeProfit: splitOrder.takeProfit,
                takeProfits: [splitOrder.takeProfit],
                comment: splitOrder.comment,
                groupId: splitOrder.groupId,
              } as any, signal.config, signal.id, signal.channelId, signal.channelName)
            }
          } else {
            // Fallback to single order
            await apiServer?.addSignal(signal.parsed, signal.config, signal.id, signal.channelId, signal.channelName)
          }
        } else {
          // Single TP or multi-TP disabled - send as-is
          await apiServer?.addSignal(signal.parsed, signal.config, signal.id, signal.channelId, signal.channelName)
        }
      }
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

    // Push modification to cloud for MT5 EA to poll
    if (cloudSync) {
      await cloudSync.pushModification(modification)
    }

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
  signalModificationService.on('modificationCommand', (command) => {
    logger.info(`📤 Signal modification command: ${command.type} for ${command.trades.length} trade(s)`)

    // Add to API server queue for EA to poll
    apiServer?.addModificationCommand(command)

    // Broadcast to UI
    wsServer?.broadcast({
      type: 'signalModification',
      command
    })
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

  createWindow()

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
})

// IPC Handlers
ipcMain.handle('telegram:connect', async (_, phoneNumber: string) => {
  try {
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

    logger.info('Stopped monitoring all channels')
    return { success: true }
  } catch (error: any) {
    logger.error('Stop monitoring error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('telegram:disconnect', async () => {
  try {
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
