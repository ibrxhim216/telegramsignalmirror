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

    // Event listeners (singleton pattern - only one listener per event)
    onCodeRequired: (callback: () => void) => {
      return createSingletonListener('telegram:codeRequired', callback)
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
    }
  }
}
