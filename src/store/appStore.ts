import { create } from 'zustand'

interface Channel {
  id: number
  title: string
  username: string | null
  type: string
  isActive?: boolean
}

interface Signal {
  id: number
  channelId: number
  text: string
  parsed: any
  timestamp: string
}

interface AppState {
  isTelegramConnected: boolean
  channels: Channel[]
  activeChannels: number[]
  signals: Signal[]
  setTelegramConnected: (connected: boolean) => void
  setChannels: (channels: Channel[]) => void
  setActiveChannels: (channelIds: number[]) => void
  addSignal: (signal: Signal) => void
  clearSignals: () => void
}

export const useAppStore = create<AppState>((set) => ({
  isTelegramConnected: false,
  channels: [],
  activeChannels: [],
  signals: [],

  setTelegramConnected: (connected) => set({ isTelegramConnected: connected }),

  setChannels: (channels) => set({ channels }),

  setActiveChannels: (channelIds) => set({ activeChannels: channelIds }),

  addSignal: (signal) =>
    set((state) => {
      // Prevent duplicates by checking if signal ID already exists
      const isDuplicate = state.signals.some(s => s.id === signal.id)
      if (isDuplicate) {
        console.warn(`Duplicate signal detected (ID: ${signal.id}), skipping`)
        return state // Return unchanged state
      }

      return {
        signals: [signal, ...state.signals].slice(0, 100), // Keep last 100 signals
      }
    }),

  clearSignals: () => set({ signals: [] }),
}))
