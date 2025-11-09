import { Radio, LogOut, UserX, AlertCircle, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'

export default function Header() {
  const { setLoggedIn, setTelegramConnected } = useAppStore()
  const [accountError, setAccountError] = useState<{ accountNumber: string; message: string; action: string } | null>(null)

  useEffect(() => {
    // Listen for account error events from cloud sync
    window.electron.cloudSync.onAccountError((errorData) => {
      setAccountError(errorData)
      // Auto-hide after 10 seconds
      setTimeout(() => setAccountError(null), 10000)
    })
  }, [])

  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect from Telegram?')) {
      await window.electron.telegram.disconnect()
      window.location.reload()
    }
  }

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out? This will disconnect you from both your account and Telegram.')) {
      await window.electron.telegram.disconnect()
      await window.electron.license.logout()
      setLoggedIn(false)
      setTelegramConnected(false)
    }
  }

  return (
    <>
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className="text-blue-500" size={28} />
            <div>
              <h1 className="text-xl font-bold text-white">Telegram Signal Copier</h1>
              <p className="text-xs text-gray-400">Real-time trading signal automation</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-500 font-medium">Connected</span>
            </div>

            <button
              onClick={handleDisconnect}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Disconnect from Telegram"
            >
              <LogOut className="text-gray-400" size={20} />
            </button>

            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Log out from account"
            >
              <UserX className="text-gray-400" size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Account Error Notification */}
      {accountError && (
        <div className="bg-orange-500/10 border-b border-orange-500/50 px-6 py-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-orange-500 mt-0.5 flex-shrink-0" size={20} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-orange-500 font-semibold text-sm">Trading Account Not Found</h3>
                  <p className="text-orange-300 text-sm mt-1">
                    Account <span className="font-mono font-semibold">{accountError.accountNumber}</span> is not registered in the cloud system.
                  </p>
                  <p className="text-orange-300 text-sm mt-1">
                    {accountError.action} <a href="https://telegramsignalmirror.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-200">Visit the website</a> to register your account.
                  </p>
                </div>
                <button
                  onClick={() => setAccountError(null)}
                  className="text-orange-500 hover:text-orange-400 transition-colors ml-4"
                  title="Dismiss"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
