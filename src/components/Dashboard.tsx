import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import ChannelList from './ChannelList'
import SignalFeed from './SignalFeed'
import Header from './Header'
import LicenseStatus from './LicenseStatus'
import SetupChecklist from './SetupChecklist'
import { Activity } from 'lucide-react'

export default function Dashboard() {
  const { setChannels, addSignal, activeChannels, setActiveChannels } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [resumed, setResumed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Monitoring state lives in the main process (it survives restarts). Mirror it here.
  useEffect(() => {
    const apply = (state: { isMonitoring: boolean; channelIds: number[]; resumeOnStart: boolean }) => {
      setIsMonitoring(state.isMonitoring)
      if (state.channelIds?.length) setActiveChannels(state.channelIds)
      if (state.isMonitoring) setResumed(true)
    }
    window.electron.telegram.getMonitoringState?.().then((r) => {
      if (r?.success) apply(r as any)
    }).catch(() => {})
    const off = window.electron.telegram.onMonitoringState?.(apply)
    return () => { if (typeof off === 'function') off() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Add a small delay to ensure Telegram client is fully ready
    const timer = setTimeout(() => {
      loadChannels()
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  // Set up signal listener only once with proper cleanup (defensive for backward compatibility)
  useEffect(() => {
    console.log('Setting up signal listener')
    const cleanup = window.electron.telegram.onSignalReceived((signal) => {
      console.log('Signal received in Dashboard:', signal.id)
      addSignal(signal)
    })

    // Cleanup listener when component unmounts (check if cleanup function exists)
    return () => {
      console.log('Cleaning up signal listener')
      if (typeof cleanup === 'function') cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty dependency array - only run once on mount

  const loadChannels = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electron.telegram.getChannels()

      if (result.success && result.channels) {
        console.log('Loaded channels:', result.channels.length)
        setChannels(result.channels)
      } else {
        console.error('Failed to load channels:', result.error)
        setError(result.error || 'Failed to load channels')
      }
    } catch (err: any) {
      console.error('Error loading channels:', err)
      setError(err.message || 'Failed to load channels')
    }

    setIsLoading(false)
  }

  const handleStartMonitoring = async () => {
    if (activeChannels.length === 0) {
      setError('Please select at least one channel')
      return
    }

    setError(null)

    try {
      const result = await window.electron.telegram.startMonitoring(activeChannels)

      if (result.success) {
        setIsMonitoring(true)
        setResumed(false)
      } else {
        setError(result.error || 'Failed to start monitoring')
        console.error('Failed to start monitoring:', result.error)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start monitoring')
      console.error('Error starting monitoring:', err)
    }
  }

  const handleStopMonitoring = async () => {
    await window.electron.telegram.stopMonitoring()
    setIsMonitoring(false)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <Header isMonitoring={isMonitoring} />

      {/* License Status Bar */}
      <div className="px-6 py-3 bg-gray-800/50 border-b border-gray-700">
        <LicenseStatus />
      </div>

      {/* Setup checklist + 7-day health summary (collapses itself once everything is green) */}
      <SetupChecklist isMonitoring={isMonitoring} />

      {resumed && isMonitoring && (
        <div className="mx-6 mt-3 bg-green-500/10 border border-green-500/30 text-green-300 px-4 py-2 rounded-lg text-sm flex items-center justify-between">
          <span>Monitoring resumed automatically for {activeChannels.length} channel{activeChannels.length === 1 ? '' : 's'} from your last session.</span>
          <button onClick={() => setResumed(false)} className="text-green-400 hover:text-green-200">×</button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-3 bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Channels */}
        <div className="w-96 bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Channels</h2>
              <button
                onClick={loadChannels}
                className="text-sm text-blue-400 hover:text-blue-300"
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {!isMonitoring ? (
              <button
                onClick={handleStartMonitoring}
                disabled={activeChannels.length === 0}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Activity size={18} />
                Start Monitoring ({activeChannels.length} selected)
              </button>
            ) : (
              <button
                onClick={handleStopMonitoring}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Activity size={18} className="animate-pulse" />
                Stop Monitoring
              </button>
            )}
          </div>

          <ChannelList isLoading={isLoading} />
        </div>

        {/* Main Content - Signal Feed */}
        <div className="flex-1 bg-gray-900">
          <SignalFeed isMonitoring={isMonitoring} />
        </div>
      </div>
    </div>
  )
}
