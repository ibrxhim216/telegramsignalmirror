import { useState, useEffect } from 'react'
import { X, Save, Upload, Download, RotateCcw } from 'lucide-react'

interface ChannelConfig {
  channelId: number
  channelName: string
  signalKeywords: {
    entryPoint: string[]
    buy: string[]
    sell: string[]
    stopLoss: string[]
    takeProfit: string[]
  }
  updateKeywords: {
    closeTP1: string[]
    closeTP2: string[]
    closeTP3: string[]
    closeTP4: string[]
    closeFull: string[]
    closeHalf: string[]
    closePartial: string[]
    breakEven: string[]
    setTP1: string[]
    setTP2: string[]
    setTP3: string[]
    setTP4: string[]
    setTP5: string[]
    setTP: string[]
    setSL: string[]
    deletePending: string[]
  }
  additionalKeywords: {
    layer: string[]
    closeAll: string[]
    deleteAll: string[]
    ignoreKeyword: string[]
    skipKeyword: string[]
    marketOrder: string[]
    removeSL: string[]
  }
  advancedSettings: {
    delayInMsec: number
    preferEntry: 'first' | 'second' | 'average' | 'all'
    slInPips: boolean
    tpInPips: boolean
    readImage: boolean
    delimiters: string
    allOrder: boolean
    readForwarded: boolean
  }
  riskSettings: {
    riskMode: 'fixed' | 'percent' | 'amount'
    fixedLotSize: number
    riskPercent: number
    riskAmount: number
    maxSpread: number
    slippage: number
  }
  isEnabled: boolean
  useAIParser: boolean
}

interface Props {
  channelId: number
  channelName: string
  isOpen: boolean
  onClose: () => void
}

export default function ChannelConfigDialog({ channelId, channelName, isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'signal' | 'update' | 'additional'>('signal')
  const [config, setConfig] = useState<ChannelConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && channelId) {
      loadConfig()
    }
  }, [isOpen, channelId])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const result = await window.electron.channelConfig.getConfig(channelId)
      if (result.success) {
        setConfig(result.config)
      }
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    if (!config) return

    try {
      const result = await window.electron.channelConfig.saveConfig(config)
      if (result.success) {
        alert('Configuration saved successfully!')
        onClose()
      } else {
        alert('Failed to save configuration')
      }
    } catch (error) {
      console.error('Error saving config:', error)
      alert('Error saving configuration')
    }
  }

  const exportConfig = async () => {
    if (!config) return

    try {
      const result = await window.electron.channelConfig.exportConfig(channelId)
      if (result.success && result.json) {
        const blob = new Blob([result.json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `channel-${channelId}-config.json`
        a.click()
      }
    } catch (error) {
      console.error('Error exporting config:', error)
    }
  }

  const importConfig = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e: any) => {
      const file = e.target.files[0]
      if (!file) return

      try {
        const text = await file.text()
        const result = await window.electron.channelConfig.importConfig(channelId, text)
        if (result.success) {
          alert('Configuration imported successfully!')
          loadConfig()
        } else {
          alert('Failed to import configuration')
        }
      } catch (error) {
        console.error('Error importing config:', error)
        alert('Error importing configuration')
      }
    }
    input.click()
  }

  const resetConfig = async () => {
    if (!confirm('Reset configuration to defaults? This cannot be undone.')) return

    try {
      const result = await window.electron.channelConfig.resetConfig(channelId)
      if (result.success) {
        alert('Configuration reset successfully!')
        loadConfig()
      }
    } catch (error) {
      console.error('Error resetting config:', error)
    }
  }

  const updateKeywordArray = (
    section: 'signal' | 'update' | 'additional',
    field: string,
    value: string
  ) => {
    if (!config) return

    const keywords = value.split(',').map(k => k.trim()).filter(k => k.length > 0)

    setConfig({
      ...config,
      [`${section}Keywords`]: {
        ...config[`${section}Keywords` as keyof ChannelConfig] as any,
        [field]: keywords
      }
    })
  }

  const updateAdvancedSetting = (field: string, value: any) => {
    if (!config) return

    setConfig({
      ...config,
      advancedSettings: {
        ...config.advancedSettings,
        [field]: value
      }
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            Config Keyword for {channelName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading configuration...</div>
        ) : !config ? (
          <div className="p-8 text-center text-red-400">Failed to load configuration</div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setActiveTab('signal')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'signal'
                    ? 'text-white border-b-2 border-purple-500 bg-gray-700/50'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/30'
                }`}
              >
                Signal Keyword
              </button>
              <button
                onClick={() => setActiveTab('update')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'update'
                    ? 'text-white border-b-2 border-purple-500 bg-gray-700/50'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/30'
                }`}
              >
                Update Keyword
              </button>
              <button
                onClick={() => setActiveTab('additional')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'additional'
                    ? 'text-white border-b-2 border-purple-500 bg-gray-700/50'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/30'
                }`}
              >
                Additional Keyword
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {/* Signal Keywords Tab */}
              {activeTab === 'signal' && (
                <div className="space-y-4">
                  <KeywordInput
                    label="Entry Point"
                    placeholder="Type word used for ENTRY Price if any"
                    value={config.signalKeywords.entryPoint.join(', ')}
                    onChange={(v) => updateKeywordArray('signal', 'entryPoint', v)}
                  />
                  <KeywordInput
                    label="BUY"
                    placeholder="Type word used for BUY in signal"
                    value={config.signalKeywords.buy.join(', ')}
                    onChange={(v) => updateKeywordArray('signal', 'buy', v)}
                  />
                  <KeywordInput
                    label="SELL"
                    placeholder="Type word used for SELL in signal"
                    value={config.signalKeywords.sell.join(', ')}
                    onChange={(v) => updateKeywordArray('signal', 'sell', v)}
                  />
                  <KeywordInput
                    label="SL"
                    placeholder="Type word used for SL in signal"
                    value={config.signalKeywords.stopLoss.join(', ')}
                    onChange={(v) => updateKeywordArray('signal', 'stopLoss', v)}
                  />
                  <KeywordInput
                    label="TP"
                    placeholder="Type words used for TP in signal (TP1,TP2..)"
                    value={config.signalKeywords.takeProfit.join(', ')}
                    onChange={(v) => updateKeywordArray('signal', 'takeProfit', v)}
                  />
                </div>
              )}

              {/* Update Keywords Tab */}
              {activeTab === 'update' && (
                <div className="space-y-4">
                  <KeywordInput
                    label="Close TP1"
                    placeholder="Word for closing only TP1 in reply"
                    value={config.updateKeywords.closeTP1.join(', ')}
                    onChange={(v) => updateKeywordArray('update', 'closeTP1', v)}
                  />
                  <KeywordInput
                    label="Close TP2"
                    placeholder="Word for closing only TP2 in reply"
                    value={config.updateKeywords.closeTP2.join(', ')}
                    onChange={(v) => updateKeywordArray('update', 'closeTP2', v)}
                  />
                  <KeywordInput
                    label="Close TP3"
                    placeholder="Word for closing only TP3 in reply"
                    value={config.updateKeywords.closeTP3.join(', ')}
                    onChange={(v) => updateKeywordArray('update', 'closeTP3', v)}
                  />
                  <KeywordInput
                    label="Close TP4"
                    placeholder="Word for closing only TP4 in reply"
                    value={config.updateKeywords.closeTP4.join(', ')}
                    onChange={(v) => updateKeywordArray('update', 'closeTP4', v)}
                  />
                  <KeywordInput
                    label="Close Full"
                    placeholder="Word for closing the full trade in reply"
                    value={config.updateKeywords.closeFull.join(', ')}
                    onChange={(v) => updateKeywordArray('update', 'closeFull', v)}
                  />
                  <KeywordInput
                    label="Close Half"
                    placeholder="Word for closing half of the trade in reply"
                    value={config.updateKeywords.closeHalf.join(', ')}
                    onChange={(v) => updateKeywordArray('update', 'closeHalf', v)}
                  />
                  <KeywordInput
                    label="Close Partial"
                    placeholder="Word for closing part of the trade in reply"
                    value={config.updateKeywords.closePartial.join(', ')}
                    onChange={(v) => updateKeywordArray('update', 'closePartial', v)}
                  />
                  <KeywordInput
                    label="Break Even"
                    placeholder="Word for moving SL to entry in reply"
                    value={config.updateKeywords.breakEven.join(', ')}
                    onChange={(v) => updateKeywordArray('update', 'breakEven', v)}
                  />
                  <KeywordInput
                    label="Set TP1"
                    placeholder="Word for changing only TP1 in reply"
                    value={config.updateKeywords.setTP1.join(', ')}
                    onChange={(v) => updateKeywordArray('update', 'setTP1', v)}
                  />
                  <KeywordInput
                    label="Set TP"
                    placeholder="Word for changing all TPs in reply"
                    value={config.updateKeywords.setTP.join(', ')}
                    onChange={(v) => updateKeywordArray('update', 'setTP', v)}
                  />
                  <KeywordInput
                    label="Set SL"
                    placeholder="Word for changing SL in reply"
                    value={config.updateKeywords.setSL.join(', ')}
                    onChange={(v) => updateKeywordArray('update', 'setSL', v)}
                  />
                  <KeywordInput
                    label="Delete"
                    placeholder="Word for deleting a pending order in reply"
                    value={config.updateKeywords.deletePending.join(', ')}
                    onChange={(v) => updateKeywordArray('update', 'deletePending', v)}
                  />
                </div>
              )}

              {/* Additional Keywords Tab */}
              {activeTab === 'additional' && (
                <div className="space-y-4">
                  <KeywordInput
                    label="Layer"
                    placeholder="Word for re-entry in reply"
                    value={config.additionalKeywords.layer.join(', ')}
                    onChange={(v) => updateKeywordArray('additional', 'layer', v)}
                  />
                  <KeywordInput
                    label="Close All"
                    placeholder="Word for closing all active trades"
                    value={config.additionalKeywords.closeAll.join(', ')}
                    onChange={(v) => updateKeywordArray('additional', 'closeAll', v)}
                  />
                  <KeywordInput
                    label="Delete All"
                    placeholder="Word for removing all pending trades"
                    value={config.additionalKeywords.deleteAll.join(', ')}
                    onChange={(v) => updateKeywordArray('additional', 'deleteAll', v)}
                  />
                  <KeywordInput
                    label="Market Order"
                    placeholder="Word for market order even if it's pending order"
                    value={config.additionalKeywords.marketOrder.join(', ')}
                    onChange={(v) => updateKeywordArray('additional', 'marketOrder', v)}
                  />
                  <KeywordInput
                    label="Remove SL"
                    placeholder="Word for removing SL in reply"
                    value={config.additionalKeywords.removeSL.join(', ')}
                    onChange={(v) => updateKeywordArray('additional', 'removeSL', v)}
                  />

                  <div className="pt-4 border-t border-gray-700">
                    <h3 className="text-sm font-semibold text-white mb-4">Advanced Settings</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Delay in Msec</label>
                        <input
                          type="number"
                          value={config.advancedSettings.delayInMsec}
                          onChange={(e) => updateAdvancedSetting('delayInMsec', parseInt(e.target.value))}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Prefer Entry</label>
                        <select
                          value={config.advancedSettings.preferEntry}
                          onChange={(e) => updateAdvancedSetting('preferEntry', e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                        >
                          <option value="first">First Price</option>
                          <option value="second">Second Price</option>
                          <option value="average">Average</option>
                          <option value="all">All Prices</option>
                        </select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={config.advancedSettings.slInPips}
                          onChange={(e) => updateAdvancedSetting('slInPips', e.target.checked)}
                          className="rounded"
                        />
                        <label className="text-sm text-gray-300">SL In Pips</label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={config.advancedSettings.tpInPips}
                          onChange={(e) => updateAdvancedSetting('tpInPips', e.target.checked)}
                          className="rounded"
                        />
                        <label className="text-sm text-gray-300">TP In Pips</label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={config.advancedSettings.readImage}
                          onChange={(e) => updateAdvancedSetting('readImage', e.target.checked)}
                          className="rounded"
                        />
                        <label className="text-sm text-gray-300">Read Image (OCR)</label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={config.advancedSettings.readForwarded}
                          onChange={(e) => updateAdvancedSetting('readForwarded', e.target.checked)}
                          className="rounded"
                        />
                        <label className="text-sm text-gray-300">Read Forwarded</label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-800/50">
              <div className="flex gap-2">
                <button
                  onClick={exportConfig}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  <Download size={16} />
                  Export
                </button>
                <button
                  onClick={importConfig}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  <Upload size={16} />
                  Import
                </button>
                <button
                  onClick={resetConfig}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  <RotateCcw size={16} />
                  Reset
                </button>
              </div>
              <button
                onClick={saveConfig}
                className="flex items-center gap-2 px-6 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors font-medium"
              >
                <Save size={16} />
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function KeywordInput({ label, placeholder, value, onChange }: {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue)
    }
  }

  return (
    <div className="grid grid-cols-4 gap-4 items-center">
      <label className="text-sm text-gray-300 text-right">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
        autoComplete="off"
        spellCheck="false"
        className="col-span-3 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
      />
    </div>
  )
}
