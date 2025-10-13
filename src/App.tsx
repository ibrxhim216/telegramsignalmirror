import { useEffect } from 'react'
import Dashboard from './components/Dashboard'
import TelegramAuth from './components/TelegramAuth'
import { useAppStore } from './store/appStore'

function App() {
  const { isTelegramConnected, setTelegramConnected } = useAppStore()

  useEffect(() => {
    console.log('App mounted, checking Telegram connection...')

    // Check if already connected (handles auto-connect on startup)
    const checkConnection = async () => {
      const result = await window.electron.telegram.isConnected()
      console.log('Connection check result:', result)
      if (result.success && result.isConnected) {
        console.log('Already connected to Telegram')
        setTelegramConnected(true)
      }
    }
    checkConnection()

    // Listen for Telegram events with cleanup (defensive for backward compatibility)
    const cleanupConnected = window.electron.telegram.onConnected(() => {
      console.log('✅ Telegram connected event received!')
      setTelegramConnected(true)
    })

    const cleanupError = window.electron.telegram.onError((error) => {
      console.error('❌ Telegram error:', error)
    })

    // Cleanup listeners when component unmounts (check if cleanup functions exist)
    return () => {
      if (typeof cleanupConnected === 'function') cleanupConnected()
      if (typeof cleanupError === 'function') cleanupError()
    }
  }, [setTelegramConnected])

  console.log('Rendering App, isTelegramConnected:', isTelegramConnected)

  return (
    <div className="h-screen bg-gray-900 text-white">
      {!isTelegramConnected ? <TelegramAuth /> : <Dashboard />}
    </div>
  )
}

export default App
