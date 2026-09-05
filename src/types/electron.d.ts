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
        sendPassword: (password: string) => Promise<{ success: boolean; error?: string }>
        getSessionInfo: () => Promise<{ success: boolean; hasSavedSession: boolean; phone?: string | null; isConnecting?: boolean; isConnected?: boolean; error?: string }>
        getMonitoringState: () => Promise<{ success: boolean; isMonitoring?: boolean; channelIds?: number[]; resumeOnStart?: boolean; error?: string }>
        onPasswordRequired: (callback: () => void) => () => void
        onMonitoringState: (callback: (state: { isMonitoring: boolean; channelIds: number[]; resumeOnStart: boolean }) => void) => () => void
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
        exportHistory: (channelId: number, opts?: { maxMessages?: number; maxAgeDays?: number; maxBytes?: number }) =>
          Promise<{ success: boolean; canceled?: boolean; path?: string; count?: number; bytes?: number; error?: string }>
        analyzeHistory: (channelId: number, opts?: { maxMessages?: number; maxAgeDays?: number; maxBytes?: number }) =>
          Promise<{ success: boolean; analysis?: any; error?: string }>
      }
      web: {
        open: (path?: string) => Promise<{ success: boolean; error?: string }>
        openDesktopSignIn: () => Promise<{ success: boolean; error?: string }>
      }
      auth: {
        onLoggedIn: (callback: () => void) => () => void
        onLoginFailed: (callback: (error: string) => void) => () => void
      }
      app: {
        getFeatures: () => Promise<{ success: boolean; features?: { advanced: boolean }; error?: string }>
        getAutoLaunch: () => Promise<{ success: boolean; supported: boolean; enabled: boolean; error?: string }>
        setAutoLaunch: (enabled: boolean) => Promise<{ success: boolean; enabled?: boolean; error?: string }>
      }
      ea: {
        detectTerminals: () => Promise<{ success: boolean; terminals?: { id: string; platform: 'MT4' | 'MT5'; expertsPath: string; broker?: string; alreadyInstalled: boolean }[]; error?: string }>
        install: (terminalIds: string[]) => Promise<{ success: boolean; installed?: { id: string; path: string }[]; error?: string }>
        status: () => Promise<{ success: boolean; polling?: { accountNumber: string; lastPollMs: number; secondsAgo: number }[]; accounts?: { account_number: string; platform: string; is_active: number }[]; error?: string }>
      }
      stats: {
        weekly: () => Promise<{ success: boolean; stats?: { received: number; newSignals: number; updates: number; skipped: number; executed: number; byReason: { reason: string; count: number }[] }; error?: string }>
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
        canAddAccount: () => Promise<{ canPerformAction: boolean; reason?: string; currentUsage?: number; limit?: number; upgradeRequired?: string }>
        canAddChannel: () => Promise<{ success: boolean; canPerformAction?: boolean; reason?: string; error?: string }>
        hasFeature: (feature: string) => Promise<{ success: boolean; hasFeature?: boolean; error?: string }>
        getMachineId: () => Promise<{ success: boolean; machineId?: string; error?: string }>
        login: (email: string, password: string) => Promise<{ success: boolean; token?: string; error?: string }>
        isLoggedIn: () => Promise<{ success: boolean; isLoggedIn?: boolean; error?: string }>
        logout: () => Promise<{ success: boolean; error?: string }>
        validateWithAPI: () => Promise<{ success: boolean; isValid?: boolean; license?: any; reason?: string; error?: string }>
        loginWithHandoffToken: (token: string) => Promise<{ success: boolean; error?: string }>
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
      account: {
        getAll: () => Promise<{ success: boolean; accounts?: any[]; error?: string }>
        add: (account: { platform: string; accountNumber: string; accountName?: string }) => Promise<{ success: boolean; id?: number; error?: string }>
        update: (id: number, data: any) => Promise<{ success: boolean; error?: string }>
        delete: (id: number) => Promise<{ success: boolean; error?: string }>
        setActive: (id: number, isActive: boolean) => Promise<{ success: boolean; error?: string }>
      }
      update: {
        check: () => Promise<{ success: boolean; updateInfo?: any; error?: string }>
        download: (downloadUrl: string) => Promise<{ success: boolean; error?: string }>
        getVersion: () => Promise<{ success: boolean; version?: string; error?: string }>
        getStatus: () => Promise<{ success: boolean; version: string; portable: boolean; downloaded: any | null }>
        install: () => Promise<{ success: boolean; error?: string }>
        onUpdateProgress: (callback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => () => void
        onUpdateDownloaded: (callback: (updateInfo: any) => void) => () => void
        onUpdateAvailable: (callback: (updateInfo: any) => void) => () => void
        onUpdateNotAvailable: (callback: (updateInfo: any) => void) => () => void
      }
      cloudSync: {
        onAccountError: (callback: (errorData: { accountNumber: string; message: string; action: string }) => void) => void
      }
    }
  }
}

export {}
