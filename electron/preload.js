"use strict";

// electron/preload.ts
var import_electron = require("electron");
var listenerRegistry = /* @__PURE__ */ new Map();
function createSingletonListener(eventName, callback, wrapper) {
  const existingListener = listenerRegistry.get(eventName);
  if (existingListener) {
    import_electron.ipcRenderer.removeListener(eventName, existingListener);
  }
  const actualCallback = wrapper || callback;
  listenerRegistry.set(eventName, actualCallback);
  import_electron.ipcRenderer.on(eventName, actualCallback);
  return () => {
    import_electron.ipcRenderer.removeListener(eventName, actualCallback);
    if (listenerRegistry.get(eventName) === actualCallback) {
      listenerRegistry.delete(eventName);
    }
  };
}
import_electron.contextBridge.exposeInMainWorld("electron", {
  // Telegram API
  telegram: {
    connect: (phoneNumber) => import_electron.ipcRenderer.invoke("telegram:connect", phoneNumber),
    sendCode: (code) => import_electron.ipcRenderer.invoke("telegram:sendCode", code),
    getChannels: () => import_electron.ipcRenderer.invoke("telegram:getChannels"),
    startMonitoring: (channelIds) => import_electron.ipcRenderer.invoke("telegram:startMonitoring", channelIds),
    stopMonitoring: () => import_electron.ipcRenderer.invoke("telegram:stopMonitoring"),
    disconnect: () => import_electron.ipcRenderer.invoke("telegram:disconnect"),
    isConnected: () => import_electron.ipcRenderer.invoke("telegram:isConnected"),
    // Event listeners (singleton pattern - only one listener per event)
    onCodeRequired: (callback) => {
      return createSingletonListener("telegram:codeRequired", callback);
    },
    onConnected: (callback) => {
      return createSingletonListener("telegram:connected", callback);
    },
    onError: (callback) => {
      return createSingletonListener(
        "telegram:error",
        callback,
        (_, error) => callback(error)
      );
    },
    onSignalReceived: (callback) => {
      return createSingletonListener(
        "signal:received",
        callback,
        (_, signal) => callback(signal)
      );
    }
  },
  // Channel Configuration
  channelConfig: {
    getConfig: (channelId) => import_electron.ipcRenderer.invoke("channelConfig:get", channelId),
    saveConfig: (config) => import_electron.ipcRenderer.invoke("channelConfig:save", config),
    resetConfig: (channelId) => import_electron.ipcRenderer.invoke("channelConfig:reset", channelId),
    exportConfig: (channelId) => import_electron.ipcRenderer.invoke("channelConfig:export", channelId),
    importConfig: (channelId, configJson) => import_electron.ipcRenderer.invoke("channelConfig:import", channelId, configJson),
    clearConfirmationRequirements: (channelId) => import_electron.ipcRenderer.invoke("channelConfig:clearConfirmationRequirements", channelId),
    detectKeywords: (exampleSignal) => import_electron.ipcRenderer.invoke("channelConfig:detectKeywords", exampleSignal)
  },
  // TSC Protector
  protector: {
    getSettings: (accountNumber, platform) => import_electron.ipcRenderer.invoke("protector:getSettings", accountNumber, platform),
    saveSettings: (settings) => import_electron.ipcRenderer.invoke("protector:saveSettings", settings),
    getStatus: (accountNumber, platform) => import_electron.ipcRenderer.invoke("protector:getStatus", accountNumber, platform),
    canOpenTrade: (accountNumber, platform) => import_electron.ipcRenderer.invoke("protector:canOpenTrade", accountNumber, platform),
    // Event listeners
    onLimitHit: (callback) => {
      import_electron.ipcRenderer.on("protector:limitHit", (_, event) => callback(event));
    },
    onNotification: (callback) => {
      import_electron.ipcRenderer.on("protector:notification", (_, notification) => callback(notification));
    },
    onStatsReset: (callback) => {
      import_electron.ipcRenderer.on("protector:statsReset", (_, data) => callback(data));
    }
  },
  // License
  license: {
    get: () => import_electron.ipcRenderer.invoke("license:get"),
    validate: () => import_electron.ipcRenderer.invoke("license:validate"),
    activate: (request) => import_electron.ipcRenderer.invoke("license:activate", request),
    deactivate: () => import_electron.ipcRenderer.invoke("license:deactivate"),
    canAddAccount: () => import_electron.ipcRenderer.invoke("license:canAddAccount"),
    canAddChannel: () => import_electron.ipcRenderer.invoke("license:canAddChannel"),
    hasFeature: (feature) => import_electron.ipcRenderer.invoke("license:hasFeature", feature),
    getMachineId: () => import_electron.ipcRenderer.invoke("license:getMachineId"),
    login: (email, password) => import_electron.ipcRenderer.invoke("license:login", email, password),
    isLoggedIn: () => import_electron.ipcRenderer.invoke("license:isLoggedIn"),
    logout: () => import_electron.ipcRenderer.invoke("license:logout"),
    validateWithAPI: () => import_electron.ipcRenderer.invoke("license:validateWithAPI"),
    // Event listeners (singleton pattern)
    onUpdated: (callback) => {
      return createSingletonListener("license:updated", callback, (_, license) => callback(license));
    },
    onActivated: (callback) => {
      return createSingletonListener("license:activated", callback, (_, license) => callback(license));
    },
    onTrialStarted: (callback) => {
      return createSingletonListener("license:trialStarted", callback, (_, license) => callback(license));
    },
    onInvalid: (callback) => {
      return createSingletonListener("license:invalid", callback, (_, result) => callback(result));
    },
    onExpiringSoon: (callback) => {
      return createSingletonListener("license:expiringSoon", callback, (_, result) => callback(result));
    },
    onDeactivated: (callback) => {
      return createSingletonListener("license:deactivated", callback, (_, license) => callback(license));
    }
  },
  // Vision AI
  visionAI: {
    getSettings: () => import_electron.ipcRenderer.invoke("visionAI:getSettings"),
    updateSettings: (settings) => import_electron.ipcRenderer.invoke("visionAI:updateSettings", settings),
    getStats: () => import_electron.ipcRenderer.invoke("visionAI:getStats"),
    resetStats: () => import_electron.ipcRenderer.invoke("visionAI:resetStats"),
    analyzeChart: (request) => import_electron.ipcRenderer.invoke("visionAI:analyzeChart", request),
    isEnabled: () => import_electron.ipcRenderer.invoke("visionAI:isEnabled"),
    // Event listeners
    onAnalysisComplete: (callback) => {
      import_electron.ipcRenderer.on("visionAI:analysisComplete", (_, result) => callback(result));
    },
    onAnalysisError: (callback) => {
      import_electron.ipcRenderer.on("visionAI:analysisError", (_, data) => callback(data));
    },
    onSettingsUpdated: (callback) => {
      import_electron.ipcRenderer.on("visionAI:settingsUpdated", (_, settings) => callback(settings));
    },
    onStatsReset: (callback) => {
      import_electron.ipcRenderer.on("visionAI:statsReset", callback);
    }
  },
  // Multi-TP Handler
  multiTP: {
    getSettings: () => import_electron.ipcRenderer.invoke("multiTP:getSettings"),
    saveSettings: (settings) => import_electron.ipcRenderer.invoke("multiTP:saveSettings", settings)
  },
  // Trading Accounts
  account: {
    getAll: () => import_electron.ipcRenderer.invoke("account:getAll"),
    add: (account) => import_electron.ipcRenderer.invoke("account:add", account),
    update: (id, data) => import_electron.ipcRenderer.invoke("account:update", id, data),
    delete: (id) => import_electron.ipcRenderer.invoke("account:delete", id),
    setActive: (id, isActive) => import_electron.ipcRenderer.invoke("account:setActive", id, isActive)
  },
  // Cloud Sync
  cloudSync: {
    onAccountError: (callback) => {
      return createSingletonListener("cloudSync:accountError", callback, (_, errorData) => callback(errorData));
    }
  }
});
