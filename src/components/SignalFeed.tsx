import { useAppStore } from '../store/appStore'
import { TrendingUp, TrendingDown, Target, ShieldAlert, Clock } from 'lucide-react'
import clsx from 'clsx'

interface SignalFeedProps {
  isMonitoring: boolean
}

export default function SignalFeed({ isMonitoring }: SignalFeedProps) {
  const { signals, clearSignals } = useAppStore()

  if (!isMonitoring) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Clock className="mx-auto text-gray-600 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            Not Monitoring
          </h3>
          <p className="text-gray-500">
            Select channels and click "Start Monitoring" to begin receiving signals
          </p>
        </div>
      </div>
    )
  }

  if (signals.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <Clock className="mx-auto text-gray-600 mb-4 animate-pulse" size={64} />
          </div>
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            Waiting for Signals...
          </h3>
          <p className="text-gray-500">
            Monitoring selected channels for trading signals
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Signal Feed</h2>
        {signals.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Clear all signals from feed?')) {
                clearSignals()
              }
            }}
            className="text-sm text-gray-400 hover:text-red-400 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="space-y-4">
        {signals.map((signal) => {
          const parsed = signal.parsed
          const isBuy = parsed?.direction?.includes('BUY')

          return (
            <div
              key={signal.id}
              className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
            >
              {/* Signal Header */}
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'p-2 rounded-lg',
                    isBuy ? 'bg-green-500/10' : 'bg-red-500/10'
                  )}>
                    {isBuy ? (
                      <TrendingUp className="text-green-400" size={24} />
                    ) : (
                      <TrendingDown className="text-red-400" size={24} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">
                        {parsed?.symbol || 'Unknown'}
                      </h3>
                      <span className={clsx(
                        'px-2 py-1 rounded text-xs font-medium',
                        isBuy ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      )}>
                        {parsed?.direction || 'Unknown'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(signal.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                {parsed?.confidence && (
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Confidence</div>
                    <div className="text-lg font-bold text-white">
                      {(parsed.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                )}
              </div>

              {/* Signal Details */}
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {parsed?.entryPrice && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Entry Price</div>
                    <div className="font-semibold text-white">
                      {Array.isArray(parsed.entryPrice)
                        ? parsed.entryPrice.join(', ')
                        : parsed.entryPrice}
                    </div>
                  </div>
                )}

                {parsed?.stopLoss && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <ShieldAlert size={12} />
                      Stop Loss
                    </div>
                    <div className="font-semibold text-red-400">
                      {parsed.stopLoss}
                    </div>
                  </div>
                )}

                {parsed?.takeProfits && parsed.takeProfits.length > 0 && (
                  <div className="col-span-2">
                    <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <Target size={12} />
                      Take Profit
                    </div>
                    <div className="font-semibold text-green-400">
                      {parsed.takeProfits.map((tp: number, i: number) => (
                        <span key={i} className="mr-2">
                          TP{i + 1}: {tp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Raw Message */}
              <div className="p-4 bg-gray-900/50 border-t border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Original Message</div>
                <div className="text-sm text-gray-300 whitespace-pre-wrap">
                  {signal.text}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
