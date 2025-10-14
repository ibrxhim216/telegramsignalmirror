// Global type declarations for window.electron API
// This makes the Electron IPC API available to React components

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
        isConnected: () => Promise<{ success: boolean; isConnected?: boolean; error?: string }>
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
    }
  }
}

export {}
