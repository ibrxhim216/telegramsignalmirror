import { useEffect } from 'react'
import Dashboard from './components/Dashboard'
import TelegramAuth from './components/TelegramAuth'
import Login from './components/Login'
import { useAppStore } from './store/appStore'

function App() {
  const { isLoggedIn, isTelegramConnected, setLoggedIn, setTelegramConnected } = useAppStore()

  useEffect(() => {
    console.log('App mounted, checking authentication...')

    // Check login status first
    const checkAuth = async () => {
      const loginResult = await window.electron.license.isLoggedIn()
      console.log('Login check result:', loginResult)
      if (loginResult.success && loginResult.isLoggedIn) {
        console.log('User is logged in')
        setLoggedIn(true)

        // Then check Telegram connection
        const telegramResult = await window.electron.telegram.isConnected()
        console.log('Telegram connection check result:', telegramResult)
        if (telegramResult.success && telegramResult.isConnected) {
          console.log('Already connected to Telegram')
          setTelegramConnected(true)
        }
      } else {
        console.log('User is not logged in')
      }
    }
    checkAuth()

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
  }, [setLoggedIn, setTelegramConnected])

  console.log('Rendering App, isLoggedIn:', isLoggedIn, 'isTelegramConnected:', isTelegramConnected)

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return (
      <div className="h-screen bg-gray-900 text-white">
        <Login />
      </div>
    )
  }

  // Show Telegram auth if logged in but not connected
  if (!isTelegramConnected) {
    return (
      <div className="h-screen bg-gray-900 text-white">
        <TelegramAuth />
      </div>
    )
  }

  // Show dashboard if fully authenticated
  return (
    <div className="h-screen bg-gray-900 text-white">
      <Dashboard />
    </div>
  )
}

export default App
