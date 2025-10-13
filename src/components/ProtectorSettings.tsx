import { useState, useEffect } from 'react'
import { X, Shield, TrendingUp, TrendingDown, Hash, Clock, AlertTriangle } from 'lucide-react'

interface ProtectorSettingsProps {
  accountNumber: string
  platform: string
  isOpen: boolean
  onClose: () => void
}

interface ProtectorSettings {
  enabled: boolean
  accountNumber: string
  platform: string

  // Profit Target
  dailyProfitTargetEnabled: boolean
  dailyProfitTarget: number
  dailyProfitTargetPercent: number
  useProfitPercent: boolean

  // Loss Limit
  dailyLossLimitEnabled: boolean
  dailyLossLimit: number
  dailyLossLimitPercent: number
  useLossPercent: boolean

  // Trade Count
  maxTradesPerDayEnabled: boolean
  maxTradesPerDay: number

  // FIFO Mode
  fifoModeEnabled: boolean
  fifoCloseOldestFirst: boolean

  // Actions
  closeAllOnProfitTarget: boolean
  closeAllOnLossLimit: boolean
  stopNewTradesOnLimit: boolean
  notifyOnLimitHit: boolean

  // Reset
  resetTime: string
  timezone: string

  // Equity
  equityProtectionEnabled: boolean
  minEquityPercent: number

  // Advanced
  pauseTradingUntilReset: boolean
  allowCloseOnlyMode: boolean

  createdAt: string
  updatedAt: string
}

export default function ProtectorSettings({ accountNumber, platform, isOpen, onClose }: ProtectorSettingsProps) {
  const [settings, setSettings] = useState<ProtectorSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'limits' | 'actions' | 'advanced'>('limits')

  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen, accountNumber, platform])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const result = await window.electron.protector.getSettings(accountNumber, platform)
      if (result.success && result.settings) {
        setSettings(result.settings)
      }
    } catch (error) {
      console.error('Failed to load protector settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings) return

    try {
      setSaving(true)
      const result = await window.electron.protector.saveSettings({
        ...settings,
        updatedAt: new Date().toISOString(),
      })

      if (result.success) {
        alert('Settings saved successfully!')
        onClose()
      } else {
        alert(`Failed to save settings: ${result.error}`)
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key: keyof ProtectorSettings, value: any) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Shield className="text-yellow-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-white">TSC Protector</h2>
              <p className="text-sm text-gray-400">
                Account: {accountNumber} ({platform})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-gray-400">Loading settings...</div>
          </div>
        ) : !settings ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-red-400">Failed to load settings</div>
          </div>
        ) : (
          <>
            {/* Master Enable Switch */}
            <div className="p-6 bg-gray-900/50 border-b border-gray-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => updateSetting('enabled', e.target.checked)}
                  className="w-5 h-5 rounded border-gray-600 text-green-500 focus:ring-green-500"
                />
                <div>
                  <div className="text-white font-medium">Enable TSC Protector</div>
                  <div className="text-sm text-gray-400">
                    Protect your account with daily profit/loss limits
                  </div>
                </div>
              </label>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700 bg-gray-900/30">
              <button
                onClick={() => setActiveTab('limits')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'limits'
                    ? 'text-white border-b-2 border-yellow-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Limits
              </button>
              <button
                onClick={() => setActiveTab('actions')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'actions'
                    ? 'text-white border-b-2 border-yellow-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Actions
              </button>
              <button
                onClick={() => setActiveTab('advanced')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'advanced'
                    ? 'text-white border-b-2 border-yellow-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Advanced
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeTab === 'limits' && (
                <>
                  {/* Daily Profit Target */}
                  <div className="bg-gray-900/30 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2 text-green-400 font-medium">
                      <TrendingUp size={20} />
                      Daily Profit Target
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.dailyProfitTargetEnabled}
                        onChange={(e) => updateSetting('dailyProfitTargetEnabled', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-white">Enable daily profit target</span>
                    </label>

                    {settings.dailyProfitTargetEnabled && (
                      <>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.useProfitPercent}
                            onChange={(e) => updateSetting('useProfitPercent', e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-300">Use percentage instead of fixed amount</span>
                        </label>

                        {settings.useProfitPercent ? (
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Profit Target (%)</label>
                            <input
                              type="number"
                              value={settings.dailyProfitTargetPercent}
                              onChange={(e) => updateSetting('dailyProfitTargetPercent', parseFloat(e.target.value))}
                              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                              step="0.1"
                              min="0"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Profit Target ($)</label>
                            <input
                              type="number"
                              value={settings.dailyProfitTarget}
                              onChange={(e) => updateSetting('dailyProfitTarget', parseFloat(e.target.value))}
                              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                              step="10"
                              min="0"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Daily Loss Limit */}
                  <div className="bg-gray-900/30 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2 text-red-400 font-medium">
                      <TrendingDown size={20} />
                      Daily Loss Limit
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.dailyLossLimitEnabled}
                        onChange={(e) => updateSetting('dailyLossLimitEnabled', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-white">Enable daily loss limit</span>
                    </label>

                    {settings.dailyLossLimitEnabled && (
                      <>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.useLossPercent}
                            onChange={(e) => updateSetting('useLossPercent', e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-300">Use percentage instead of fixed amount</span>
                        </label>

                        {settings.useLossPercent ? (
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Loss Limit (%)</label>
                            <input
                              type="number"
                              value={settings.dailyLossLimitPercent}
                              onChange={(e) => updateSetting('dailyLossLimitPercent', parseFloat(e.target.value))}
                              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                              step="0.1"
                              min="0"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Loss Limit ($)</label>
                            <input
                              type="number"
                              value={settings.dailyLossLimit}
                              onChange={(e) => updateSetting('dailyLossLimit', parseFloat(e.target.value))}
                              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                              step="10"
                              min="0"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Max Trades Per Day */}
                  <div className="bg-gray-900/30 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2 text-blue-400 font-medium">
                      <Hash size={20} />
                      Trade Count Limit
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.maxTradesPerDayEnabled}
                        onChange={(e) => updateSetting('maxTradesPerDayEnabled', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-white">Enable max trades per day</span>
                    </label>

                    {settings.maxTradesPerDayEnabled && (
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Max Trades Per Day</label>
                        <input
                          type="number"
                          value={settings.maxTradesPerDay}
                          onChange={(e) => updateSetting('maxTradesPerDay', parseInt(e.target.value))}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                          min="1"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'actions' && (
                <>
                  {/* Actions on Limit Hit */}
                  <div className="bg-gray-900/30 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2 text-yellow-400 font-medium mb-2">
                      <AlertTriangle size={20} />
                      Actions When Limit Is Hit
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.closeAllOnProfitTarget}
                        onChange={(e) => updateSetting('closeAllOnProfitTarget', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-white">Close all positions when profit target hit</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.closeAllOnLossLimit}
                        onChange={(e) => updateSetting('closeAllOnLossLimit', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-white">Close all positions when loss limit hit</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.stopNewTradesOnLimit}
                        onChange={(e) => updateSetting('stopNewTradesOnLimit', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-white">Stop opening new trades when limit hit</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.notifyOnLimitHit}
                        onChange={(e) => updateSetting('notifyOnLimitHit', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-white">Send notification when limit hit</span>
                    </label>
                  </div>

                  {/* Reset Settings */}
                  <div className="bg-gray-900/30 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2 text-purple-400 font-medium">
                      <Clock size={20} />
                      Daily Reset Settings
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Reset Time (UTC)</label>
                      <input
                        type="time"
                        value={settings.resetTime}
                        onChange={(e) => updateSetting('resetTime', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                      />
                      <p className="text-xs text-gray-500 mt-1">All stats reset at this time daily</p>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'advanced' && (
                <>
                  {/* FIFO Mode */}
                  <div className="bg-gray-900/30 rounded-lg p-4 space-y-4">
                    <div className="text-white font-medium">FIFO Mode (Prop Firm Compliance)</div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.fifoModeEnabled}
                        onChange={(e) => updateSetting('fifoModeEnabled', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-white">Enable FIFO mode</span>
                    </label>

                    {settings.fifoModeEnabled && (
                      <label className="flex items-center gap-2 cursor-pointer ml-6">
                        <input
                          type="checkbox"
                          checked={settings.fifoCloseOldestFirst}
                          onChange={(e) => updateSetting('fifoCloseOldestFirst', e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-gray-300">Close oldest trades first</span>
                      </label>
                    )}
                  </div>

                  {/* Equity Protection */}
                  <div className="bg-gray-900/30 rounded-lg p-4 space-y-4">
                    <div className="text-white font-medium">Equity Protection</div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.equityProtectionEnabled}
                        onChange={(e) => updateSetting('equityProtectionEnabled', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-white">Enable equity protection</span>
                    </label>

                    {settings.equityProtectionEnabled && (
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Minimum Equity (% of balance)
                        </label>
                        <input
                          type="number"
                          value={settings.minEquityPercent}
                          onChange={(e) => updateSetting('minEquityPercent', parseFloat(e.target.value))}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                          step="1"
                          min="0"
                          max="100"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Stop trading if equity drops below this percentage
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Advanced Options */}
                  <div className="bg-gray-900/30 rounded-lg p-4 space-y-4">
                    <div className="text-white font-medium">Advanced Options</div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.pauseTradingUntilReset}
                        onChange={(e) => updateSetting('pauseTradingUntilReset', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <div>
                        <div className="text-white">Pause trading until reset</div>
                        <div className="text-xs text-gray-400">
                          When limit hit, block all new trades until daily reset
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.allowCloseOnlyMode}
                        onChange={(e) => updateSetting('allowCloseOnlyMode', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <div>
                        <div className="text-white">Allow close-only mode</div>
                        <div className="text-xs text-gray-400">
                          Allow closing existing trades even when limits hit
                        </div>
                      </div>
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-700 bg-gray-900/30">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-yellow-500 text-black font-medium rounded hover:bg-yellow-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
