import { Radio, LogOut, Settings } from 'lucide-react'

export default function Header() {
  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect from Telegram?')) {
      await window.electron.telegram.disconnect()
      window.location.reload()
    }
  }

  return (
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
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="text-gray-400" size={20} />
          </button>

          <button
            onClick={handleDisconnect}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Disconnect"
          >
            <LogOut className="text-gray-400" size={20} />
          </button>
        </div>
      </div>
    </header>
  )
}
