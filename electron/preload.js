const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Telegram API
  telegram: {
    connect: (phoneNumber) => ipcRenderer.invoke('telegram:connect', phoneNumber),
    sendCode: (code) => ipcRenderer.invoke('telegram:sendCode', code),
    getChannels: () => ipcRenderer.invoke('telegram:getChannels'),
    startMonitoring: (channelIds) => ipcRenderer.invoke('telegram:startMonitoring', channelIds),
    stopMonitoring: () => ipcRenderer.invoke('telegram:stopMonitoring'),
    disconnect: () => ipcRenderer.invoke('telegram:disconnect'),
    isConnected: () => ipcRenderer.invoke('telegram:isConnected'),

    // Event listeners
    onCodeRequired: (callback) => {
      ipcRenderer.on('telegram:codeRequired', callback)
    },
    onConnected: (callback) => {
      ipcRenderer.on('telegram:connected', callback)
    },
    onError: (callback) => {
      ipcRenderer.on('telegram:error', (_, error) => callback(error))
    },
    onSignalReceived: (callback) => {
      ipcRenderer.on('signal:received', (_, signal) => callback(signal))
    },
  },

  // Channel Configuration
  channelConfig: {
    getConfig: (channelId) => ipcRenderer.invoke('channelConfig:get', channelId),
    saveConfig: (config) => ipcRenderer.invoke('channelConfig:save', config),
    resetConfig: (channelId) => ipcRenderer.invoke('channelConfig:reset', channelId),
    exportConfig: (channelId) => ipcRenderer.invoke('channelConfig:export', channelId),
    importConfig: (channelId, configJson) => ipcRenderer.invoke('channelConfig:import', channelId, configJson),
  },

  // TSC Protector
  protector: {
    getSettings: (accountNumber, platform) => ipcRenderer.invoke('protector:getSettings', accountNumber, platform),
    saveSettings: (settings) => ipcRenderer.invoke('protector:saveSettings', settings),
    getStatus: (accountNumber, platform) => ipcRenderer.invoke('protector:getStatus', accountNumber, platform),
    canOpenTrade: (accountNumber, platform) => ipcRenderer.invoke('protector:canOpenTrade', accountNumber, platform),

    // Event listeners
    onLimitHit: (callback) => {
      ipcRenderer.on('protector:limitHit', (_, event) => callback(event))
    },
    onNotification: (callback) => {
      ipcRenderer.on('protector:notification', (_, notification) => callback(notification))
    },
    onStatsReset: (callback) => {
      ipcRenderer.on('protector:statsReset', (_, data) => callback(data))
    },
  },

  // License
  license: {
    get: () => ipcRenderer.invoke('license:get'),
    validate: () => ipcRenderer.invoke('license:validate'),
    activate: (request) => ipcRenderer.invoke('license:activate', request),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
    canAddAccount: () => ipcRenderer.invoke('license:canAddAccount'),
    canAddChannel: () => ipcRenderer.invoke('license:canAddChannel'),
    hasFeature: (feature) => ipcRenderer.invoke('license:hasFeature', feature),
    getMachineId: () => ipcRenderer.invoke('license:getMachineId'),

    // Event listeners
    onUpdated: (callback) => {
      ipcRenderer.on('license:updated', (_, license) => callback(license))
    },
    onActivated: (callback) => {
      ipcRenderer.on('license:activated', (_, license) => callback(license))
    },
    onTrialStarted: (callback) => {
      ipcRenderer.on('license:trialStarted', (_, license) => callback(license))
    },
    onInvalid: (callback) => {
      ipcRenderer.on('license:invalid', (_, result) => callback(result))
    },
    onExpiringSoon: (callback) => {
      ipcRenderer.on('license:expiringSoon', (_, result) => callback(result))
    },
    onDeactivated: (callback) => {
      ipcRenderer.on('license:deactivated', (_, license) => callback(license))
    },
  },

  // Vision AI
  visionAI: {
    getSettings: () => ipcRenderer.invoke('visionAI:getSettings'),
    updateSettings: (settings) => ipcRenderer.invoke('visionAI:updateSettings', settings),
    getStats: () => ipcRenderer.invoke('visionAI:getStats'),
    resetStats: () => ipcRenderer.invoke('visionAI:resetStats'),
    analyzeChart: (request) => ipcRenderer.invoke('visionAI:analyzeChart', request),
    isEnabled: () => ipcRenderer.invoke('visionAI:isEnabled'),

    // Event listeners
    onAnalysisComplete: (callback) => {
      ipcRenderer.on('visionAI:analysisComplete', (_, result) => callback(result))
    },
    onAnalysisError: (callback) => {
      ipcRenderer.on('visionAI:analysisError', (_, data) => callback(data))
    },
    onSettingsUpdated: (callback) => {
      ipcRenderer.on('visionAI:settingsUpdated', (_, settings) => callback(settings))
    },
    onStatsReset: (callback) => {
      ipcRenderer.on('visionAI:statsReset', callback)
    },
  },
})
