import { LogOut, Unplug, AlertCircle, X, ExternalLink } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import logo from '../assets/logo.png'

interface Props {
  isMonitoring: boolean
}

export default function Header({ isMonitoring }: Props) {
  const { setLoggedIn, setTelegramConnected, isTelegramConnected, activeChannels } = useAppStore()
  const [accountError, setAccountError] = useState<{ accountNumber: string; message: string; action: string } | null>(null)

  useEffect(() => {
    const off = window.electron.cloudSync.onAccountError((errorData) => {
      setAccountError(errorData)
    })
    return () => {
      if (typeof off === 'function') (off as any)()
    }
  }, [])

  const handleDisconnect = async () => {
    if (confirm('Disconnect from Telegram? Signals stop until you sign in to Telegram again.')) {
      await window.electron.telegram.disconnect()
      window.location.reload()
    }
  }

  const handleLogout = async () => {
    if (confirm('Log out of your Telegram Signal Mirror account? This also disconnects Telegram.')) {
      await window.electron.telegram.disconnect()
      await window.electron.license.logout()
      setLoggedIn(false)
      setTelegramConnected(false)
    }
  }

  const status = !isTelegramConnected
    ? { dot: 'bg-red-400', text: 'Telegram disconnected', cls: 'text-red-300 border-red-500/30 bg-red-500/10' }
    : isMonitoring
      ? { dot: 'bg-green-400 animate-pulse', text: `Copying ${activeChannels.length} channel${activeChannels.length === 1 ? '' : 's'}`, cls: 'text-green-300 border-green-500/30 bg-green-500/10' }
      : { dot: 'bg-amber-400', text: 'Connected, not monitoring', cls: 'text-amber-300 border-amber-500/30 bg-amber-500/10' }

  return (
    <>
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="text-base font-semibold text-white leading-tight">Telegram Signal Mirror</h1>
              <p className="text-xs text-gray-400">Signals from your channels, executed on your MT4/MT5</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm font-medium ${status.cls}`}>
              <span className={`w-2 h-2 rounded-full ${status.dot}`} />
              {status.text}
            </div>

            <button
              onClick={() => window.electron.web?.open('/dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Open your account on the website (already signed in)"
            >
              <ExternalLink size={15} />
              Web dashboard
            </button>

            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Disconnect Telegram"
            >
              <Unplug size={15} />
              Telegram
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Log out of your account"
            >
              <LogOut size={15} />
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Cloud account problem (account taken by another user, plan limit, ...) */}
      {accountError && (
        <div className="bg-amber-500/10 border-b border-amber-500/40 px-6 py-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-400 mt-0.5 shrink-0" size={18} />
            <div className="flex-1 text-sm">
              <div className="text-amber-200 font-semibold">
                Trading account {accountError.accountNumber} could not be registered on the website
              </div>
              <div className="text-amber-200/80 mt-0.5">{accountError.action}</div>
              <button
                onClick={() => window.electron.web?.open('/dashboard/trading-accounts')}
                className="mt-1.5 text-amber-100 underline hover:text-white"
              >
                Manage trading accounts on the website
              </button>
            </div>
            <button
              onClick={() => setAccountError(null)}
              className="text-amber-400 hover:text-amber-200 transition-colors"
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
