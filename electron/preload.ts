import { contextBridge, ipcRenderer } from 'electron'

// Event listener registry to prevent duplicates (singleton pattern)
const listenerRegistry = new Map<string, Function>()

// Helper function to manage single-instance event listeners
function createSingletonListener(
  eventName: string,
  callback: Function,
  wrapper?: (event: any, ...args: any[]) => void
) {
  // Remove existing listener if present
  const existingListener = listenerRegistry.get(eventName)
  if (existingListener) {
    ipcRenderer.removeListener(eventName, existingListener as any)
  }

  // Create wrapped callback if needed
  const actualCallback = wrapper || callback

  // Store and register new listener
  listenerRegistry.set(eventName, actualCallback)
  ipcRenderer.on(eventName, actualCallback as any)

  // Return cleanup function
  return () => {
    ipcRenderer.removeListener(eventName, actualCallback as any)
    if (listenerRegistry.get(eventName) === actualCallback) {
      listenerRegistry.delete(eventName)
    }
  }
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Telegram API
  telegram: {
    connect: (phoneNumber: string) => ipcRenderer.invoke('telegram:connect', phoneNumber),
    sendCode: (code: string) => ipcRenderer.invoke('telegram:sendCode', code),
    getChannels: () => ipcRenderer.invoke('telegram:getChannels'),
    startMonitoring: (channelIds: number[]) => ipcRenderer.invoke('telegram:startMonitoring', channelIds),
    stopMonitoring: () => ipcRenderer.invoke('telegram:stopMonitoring'),
    disconnect: () => ipcRenderer.invoke('telegram:disconnect'),
    isConnected: () => ipcRenderer.invoke('telegram:isConnected'),
    sendPassword: (password: string) => ipcRenderer.invoke('telegram:sendPassword', password),
    getSessionInfo: () => ipcRenderer.invoke('telegram:getSessionInfo'),
    getMonitoringState: () => ipcRenderer.invoke('telegram:getMonitoringState'),

    // Event listeners (singleton pattern - only one listener per event)
    onCodeRequired: (callback: () => void) => {
      return createSingletonListener('telegram:codeRequired', callback)
    },
    onPasswordRequired: (callback: () => void) => {
      return createSingletonListener('telegram:passwordRequired', callback)
    },
    onMonitoringState: (callback: (state: any) => void) => {
      return createSingletonListener('telegram:monitoringState', callback, (_: any, state: any) => callback(state))
    },
    onConnected: (callback: () => void) => {
      return createSingletonListener('telegram:connected', callback)
    },
    onError: (callback: (error: string) => void) => {
      return createSingletonListener(
        'telegram:error',
        callback,
        (_: any, error: string) => callback(error)
      )
    },
    onSignalReceived: (callback: (signal: any) => void) => {
      return createSingletonListener(
        'signal:received',
        callback,
        (_: any, signal: any) => callback(signal)
      )
    },
  },

  // Channel Configuration
  channelConfig: {
    getConfig: (channelId: number) => ipcRenderer.invoke('channelConfig:get', channelId),
    saveConfig: (config: any) => ipcRenderer.invoke('channelConfig:save', config),
    resetConfig: (channelId: number) => ipcRenderer.invoke('channelConfig:reset', channelId),
    exportConfig: (channelId: number) => ipcRenderer.invoke('channelConfig:export', channelId),
    importConfig: (channelId: number, configJson: string) => ipcRenderer.invoke('channelConfig:import', channelId, configJson),
    clearConfirmationRequirements: (channelId: number) => ipcRenderer.invoke('channelConfig:clearConfirmationRequirements', channelId),
    detectKeywords: (exampleSignal: string) => ipcRenderer.invoke('channelConfig:detectKeywords', exampleSignal),
    // Export recent channel history (text only) to a JSON file the user picks
    exportHistory: (channelId: number, opts?: { maxMessages?: number; maxAgeDays?: number; maxBytes?: number }) =>
      ipcRenderer.invoke('channelConfig:exportHistory', channelId, opts),
    // Pull recent history and ask the LLM to draft a channel configuration from it
    analyzeHistory: (channelId: number, opts?: { maxMessages?: number; maxAgeDays?: number; maxBytes?: number }) =>
      ipcRenderer.invoke('channelConfig:analyzeHistory', channelId, opts),
  },

  // Website helpers: open the portal already signed in, or start browser sign-in for this app
  web: {
    open: (path?: string) => ipcRenderer.invoke('web:open', path),
    openDesktopSignIn: () => ipcRenderer.invoke('web:openDesktopSignIn'),
  },

  // Auth events from the main process (deep-link sign-in)
  auth: {
    onLoggedIn: (callback: () => void) => createSingletonListener('auth:loggedIn', callback),
    onLoginFailed: (callback: (error: string) => void) =>
      createSingletonListener('auth:loginFailed', callback, (_: any, error: string) => callback(error)),
  },

  // Build feature flags — renderer hides advanced-only UI (Split Entry, Auto-configure) when absent
  app: {
    getFeatures: () => ipcRenderer.invoke('app:getFeatures'),
    getAutoLaunch: () => ipcRenderer.invoke('app:getAutoLaunch'),
    setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('app:setAutoLaunch', enabled),
  },

  // EA install / status helpers (setup checklist)
  ea: {
    // Find MT4/MT5 terminal data folders on this machine
    detectTerminals: () => ipcRenderer.invoke('ea:detectTerminals'),
    // Copy the bundled EA into the given terminals' Experts folders
    install: (terminalIds: string[]) => ipcRenderer.invoke('ea:install', terminalIds),
    // Which EAs are polling this app locally, plus registered accounts
    status: () => ipcRenderer.invoke('ea:status'),
  },

  // Weekly health summary for the dashboard
  stats: {
    weekly: () => ipcRenderer.invoke('stats:weekly'),
  },

  // TSC Protector
  protector: {
    getSettings: (accountNumber: string, platform: string) => ipcRenderer.invoke('protector:getSettings', accountNumber, platform),
    saveSettings: (settings: any) => ipcRenderer.invoke('protector:saveSettings', settings),
    getStatus: (accountNumber: string, platform: string) => ipcRenderer.invoke('protector:getStatus', accountNumber, platform),
    canOpenTrade: (accountNumber: string, platform: string) => ipcRenderer.invoke('protector:canOpenTrade', accountNumber, platform),

    // Event listeners
    onLimitHit: (callback: (event: any) => void) => {
      ipcRenderer.on('protector:limitHit', (_, event) => callback(event))
    },
    onNotification: (callback: (notification: any) => void) => {
      ipcRenderer.on('protector:notification', (_, notification) => callback(notification))
    },
    onStatsReset: (callback: (data: any) => void) => {
      ipcRenderer.on('protector:statsReset', (_, data) => callback(data))
    },
  },

  // License
  license: {
    get: () => ipcRenderer.invoke('license:get'),
    validate: () => ipcRenderer.invoke('license:validate'),
    activate: (request: any) => ipcRenderer.invoke('license:activate', request),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
    canAddAccount: () => ipcRenderer.invoke('license:canAddAccount'),
    canAddChannel: () => ipcRenderer.invoke('license:canAddChannel'),
    hasFeature: (feature: string) => ipcRenderer.invoke('license:hasFeature', feature),
    getMachineId: () => ipcRenderer.invoke('license:getMachineId'),
    login: (email: string, password: string) => ipcRenderer.invoke('license:login', email, password),
    isLoggedIn: () => ipcRenderer.invoke('license:isLoggedIn'),
    logout: () => ipcRenderer.invoke('license:logout'),
    validateWithAPI: () => ipcRenderer.invoke('license:validateWithAPI'),
    forceRevalidate: () => ipcRenderer.invoke('license:forceRevalidate'),
    loginWithHandoffToken: (token: string) => ipcRenderer.invoke('license:loginWithHandoffToken', token),

    // Event listeners (singleton pattern)
    onUpdated: (callback: (license: any) => void) => {
      return createSingletonListener('license:updated', callback, (_: any, license: any) => callback(license))
    },
    onActivated: (callback: (license: any) => void) => {
      return createSingletonListener('license:activated', callback, (_: any, license: any) => callback(license))
    },
    onTrialStarted: (callback: (license: any) => void) => {
      return createSingletonListener('license:trialStarted', callback, (_: any, license: any) => callback(license))
    },
    onInvalid: (callback: (result: any) => void) => {
      return createSingletonListener('license:invalid', callback, (_: any, result: any) => callback(result))
    },
    onExpiringSoon: (callback: (result: any) => void) => {
      return createSingletonListener('license:expiringSoon', callback, (_: any, result: any) => callback(result))
    },
    onDeactivated: (callback: (license: any) => void) => {
      return createSingletonListener('license:deactivated', callback, (_: any, license: any) => callback(license))
    },
  },

  // Vision AI
  visionAI: {
    getSettings: () => ipcRenderer.invoke('visionAI:getSettings'),
    updateSettings: (settings: any) => ipcRenderer.invoke('visionAI:updateSettings', settings),
    getStats: () => ipcRenderer.invoke('visionAI:getStats'),
    resetStats: () => ipcRenderer.invoke('visionAI:resetStats'),
    analyzeChart: (request: any) => ipcRenderer.invoke('visionAI:analyzeChart', request),
    isEnabled: () => ipcRenderer.invoke('visionAI:isEnabled'),

    // Event listeners
    onAnalysisComplete: (callback: (result: any) => void) => {
      ipcRenderer.on('visionAI:analysisComplete', (_, result) => callback(result))
    },
    onAnalysisError: (callback: (data: any) => void) => {
      ipcRenderer.on('visionAI:analysisError', (_, data) => callback(data))
    },
    onSettingsUpdated: (callback: (settings: any) => void) => {
      ipcRenderer.on('visionAI:settingsUpdated', (_, settings) => callback(settings))
    },
    onStatsReset: (callback: () => void) => {
      ipcRenderer.on('visionAI:statsReset', callback)
    },
  },

  // Multi-TP Handler
  multiTP: {
    getSettings: () => ipcRenderer.invoke('multiTP:getSettings'),
    saveSettings: (settings: any) => ipcRenderer.invoke('multiTP:saveSettings', settings),
  },

  // Trading Accounts
  account: {
    getAll: () => ipcRenderer.invoke('account:getAll'),
    add: (account: any) => ipcRenderer.invoke('account:add', account),
    update: (id: number, data: any) => ipcRenderer.invoke('account:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('account:delete', id),
    setActive: (id: number, isActive: boolean) => ipcRenderer.invoke('account:setActive', id, isActive),
  },

  // Cloud-mode Platforms
  platforms: {
    list: () => ipcRenderer.invoke('platforms:list'),
    testConnection: (platformId: string, creds: any) =>
      ipcRenderer.invoke('platforms:testConnection', platformId, creds),
  },

  // Cloud Sync
  cloudSync: {
    onAccountError: (callback: (errorData: any) => void) => {
      return createSingletonListener('cloudSync:accountError', callback, (_: any, errorData: any) => callback(errorData))
    },
  },

  // Update Service
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: (downloadUrl: string) => ipcRenderer.invoke('update:download', downloadUrl),
    getVersion: () => ipcRenderer.invoke('update:getVersion'),
    getStatus: () => ipcRenderer.invoke('update:getStatus'),
    install: () => ipcRenderer.invoke('update:install'),

    // Event listeners
    onUpdateProgress: (callback: (progress: any) => void) => {
      return createSingletonListener('update-progress', callback, (_: any, p: any) => callback(p))
    },
    onUpdateDownloaded: (callback: (updateInfo: any) => void) => {
      return createSingletonListener('update-downloaded', callback, (_: any, info: any) => callback(info))
    },
    onUpdateAvailable: (callback: (updateInfo: any) => void) => {
      return createSingletonListener('update-available', callback, (_: any, updateInfo: any) => callback(updateInfo))
    },
    onUpdateNotAvailable: (callback: (updateInfo: any) => void) => {
      return createSingletonListener('update-not-available', callback, (_: any, updateInfo: any) => callback(updateInfo))
    },
  },

  // Helper for opening download URLs in browser
  downloadUpdate: (url: string) => ipcRenderer.invoke('update:download', url),
  on: (channel: string, callback: Function) => {
    const validChannels = ['update-available', 'update-not-available']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, data) => callback(data))
    }
  },
  off: (channel: string, callback: Function) => {
    ipcRenderer.removeListener(channel, callback as any)
  },
})

// TypeScript declaration for window object
declare global {
  interface Window {
    electron: {
      telegram: {
        connect: (phoneNumber: string) => Promise<{ success: boolean; error?: string }>
        sendCode: (code: string) => Promise<{ success: boolean; error?: string }>
        getChannels: () => Promise<{ success: boolean; channels?: any[]; error?: string }>
        startMonitoring: (channelIds: number[]) => Promise<{ success: boolean; error?: string }>
        stopMonitoring: () => Promise<{ success: boolean; error?: string }>
        disconnect: () => Promise<{ success: boolean; error?: string }>
        onCodeRequired: (callback: () => void) => () => void
        onConnected: (callback: () => void) => () => void
        onError: (callback: (error: string) => void) => () => void
        onSignalReceived: (callback: (signal: any) => void) => () => void
      }
      channelConfig: {
        getConfig: (channelId: number) => Promise<{ success: boolean; config?: any; error?: string }>
        saveConfig: (config: any) => Promise<{ success: boolean; error?: string }>
        resetConfig: (channelId: number) => Promise<{ success: boolean; error?: string }>
        exportConfig: (channelId: number) => Promise<{ success: boolean; json?: string; error?: string }>
        importConfig: (channelId: number, configJson: string) => Promise<{ success: boolean; error?: string }>
        clearConfirmationRequirements: (channelId: number) => Promise<{ success: boolean; error?: string }>
        detectKeywords: (exampleSignal: string) => Promise<{ success: boolean; detected?: any; error?: string }>
      }
      protector: {
        getSettings: (accountNumber: string, platform: string) => Promise<{ success: boolean; settings?: any; error?: string }>
        saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>
        getStatus: (accountNumber: string, platform: string) => Promise<{ success: boolean; status?: any; error?: string }>
        canOpenTrade: (accountNumber: string, platform: string) => Promise<{ success: boolean; allowed?: boolean; reason?: string; error?: string }>
        onLimitHit: (callback: (event: any) => void) => void
        onNotification: (callback: (notification: any) => void) => void
        onStatsReset: (callback: (data: any) => void) => void
      }
      license: {
        get: () => Promise<{ success: boolean; license?: any; error?: string }>
        validate: () => Promise<{ success: boolean; isValid?: boolean; license?: any; reason?: string; error?: string }>
        activate: (request: any) => Promise<{ success: boolean; license?: any; error?: string }>
        deactivate: () => Promise<{ success: boolean; error?: string }>
        canAddAccount: () => Promise<{ success: boolean; canPerformAction?: boolean; reason?: string; error?: string }>
        canAddChannel: () => Promise<{ success: boolean; canPerformAction?: boolean; reason?: string; error?: string }>
        hasFeature: (feature: string) => Promise<{ success: boolean; hasFeature?: boolean; error?: string }>
        getMachineId: () => Promise<{ success: boolean; machineId?: string; error?: string }>
        login: (email: string, password: string) => Promise<{ success: boolean; token?: string; error?: string }>
        isLoggedIn: () => Promise<{ success: boolean; isLoggedIn?: boolean; error?: string }>
        logout: () => Promise<{ success: boolean; error?: string }>
        validateWithAPI: () => Promise<{ success: boolean; isValid?: boolean; license?: any; reason?: string; error?: string }>
        forceRevalidate: () => Promise<{ success: boolean; isValid?: boolean; license?: any; reason?: string; error?: string }>
        onUpdated: (callback: (license: any) => void) => () => void
        onActivated: (callback: (license: any) => void) => () => void
        onTrialStarted: (callback: (license: any) => void) => () => void
        onInvalid: (callback: (result: any) => void) => () => void
        onExpiringSoon: (callback: (result: any) => void) => () => void
        onDeactivated: (callback: (license: any) => void) => () => void
      }
      visionAI: {
        getSettings: () => Promise<{ success: boolean; settings?: any; error?: string }>
        updateSettings: (settings: any) => Promise<{ success: boolean; error?: string }>
        getStats: () => Promise<{ success: boolean; stats?: any; error?: string }>
        resetStats: () => Promise<{ success: boolean; error?: string }>
        analyzeChart: (request: any) => Promise<any>
        isEnabled: () => Promise<{ success: boolean; enabled?: boolean; error?: string }>
        onAnalysisComplete: (callback: (result: any) => void) => void
        onAnalysisError: (callback: (data: any) => void) => void
        onSettingsUpdated: (callback: (settings: any) => void) => void
        onStatsReset: (callback: () => void) => void
      }
      multiTP: {
        getSettings: () => Promise<{ success: boolean; settings?: any; error?: string }>
        saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>
      }
      account: {
        getAll: () => Promise<{ success: boolean; accounts?: any[]; error?: string }>
        add: (account: any) => Promise<{ success: boolean; id?: number; error?: string }>
        update: (id: number, data: any) => Promise<{ success: boolean; error?: string }>
        delete: (id: number) => Promise<{ success: boolean; error?: string }>
        setActive: (id: number, isActive: boolean) => Promise<{ success: boolean; error?: string }>
      }
      platforms: {
        list: () => Promise<{ success: boolean; platforms?: any[]; error?: string }>
        testConnection: (platformId: string, creds: any) => Promise<{ success: boolean; result?: any; error?: string }>
      }
      cloudSync: {
        onAccountError: (callback: (errorData: any) => void) => () => void
      }
      update: {
        check: () => Promise<{ success: boolean; updateInfo?: any; error?: string }>
        download: (downloadUrl: string) => Promise<{ success: boolean; error?: string }>
        getVersion: () => Promise<{ success: boolean; version?: string; error?: string }>
        onUpdateAvailable: (callback: (updateInfo: any) => void) => () => void
        onUpdateNotAvailable: (callback: (updateInfo: any) => void) => () => void
      }
      downloadUpdate: (url: string) => Promise<any>
      on: (channel: string, callback: Function) => void
      off: (channel: string, callback: Function) => void
    }
  }
}
