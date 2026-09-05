import { useEffect } from 'react'
import Dashboard from './components/Dashboard'
import TelegramAuth from './components/TelegramAuth'
import Login from './components/Login'
import UpdateNotification from './components/UpdateNotification'
import { useAppStore } from './store/appStore'

function App() {
  const { isLoggedIn, isTelegramConnected, setLoggedIn, setTelegramConnected } = useAppStore()

  useEffect(() => {
    const checkAuth = async () => {
      const loginResult = await window.electron.license.isLoggedIn()
      if (loginResult.success && loginResult.isLoggedIn) {
        setLoggedIn(true)
        const telegramResult = await window.electron.telegram.isConnected()
        if (telegramResult.success && telegramResult.isConnected) {
          setTelegramConnected(true)
        }
      }
    }
    checkAuth()

    const cleanupConnected = window.electron.telegram.onConnected(() => {
      setTelegramConnected(true)
    })
    const cleanupError = window.electron.telegram.onError((error) => {
      console.error('Telegram error:', error)
    })
    // Sign-in completed from the website (tsm://login deep link)
    const cleanupLoggedIn = window.electron.auth?.onLoggedIn(() => {
      setLoggedIn(true)
    })

    return () => {
      if (typeof cleanupConnected === 'function') cleanupConnected()
      if (typeof cleanupError === 'function') cleanupError()
      if (typeof cleanupLoggedIn === 'function') cleanupLoggedIn()
    }
  }, [setLoggedIn, setTelegramConnected])

  if (!isLoggedIn) {
    return (
      <div className="h-screen bg-gray-900 text-white">
        <Login />
      </div>
    )
  }

  if (!isTelegramConnected) {
    return (
      <div className="h-screen bg-gray-900 text-white">
        <TelegramAuth />
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-900 text-white">
      <UpdateNotification />
      <Dashboard />
    </div>
  )
}

export default App
