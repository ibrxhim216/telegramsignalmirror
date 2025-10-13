import { useState, useEffect } from 'react'
import { Phone, Lock } from 'lucide-react'

export default function TelegramAuth() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')
  const [isCodeRequired, setIsCodeRequired] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Load saved phone number on mount
  useEffect(() => {
    const savedPhone = localStorage.getItem('telegram_phone_number')
    if (savedPhone) {
      setPhoneNumber(savedPhone)
    }
  }, [])

  // Listen for code required event with cleanup (defensive for backward compatibility)
  useEffect(() => {
    const cleanup = window.electron.telegram.onCodeRequired(() => {
      console.log('🔐 Code required event received')
      setIsCodeRequired(true)
      setIsLoading(false)
    })

    // Cleanup listener when component unmounts (check if cleanup function exists)
    return () => {
      if (typeof cleanup === 'function') cleanup()
    }
  }, [])

  const handleConnect = async () => {
    console.log('📞 Connecting to Telegram with phone:', phoneNumber)

    // Save phone number to localStorage for future use
    localStorage.setItem('telegram_phone_number', phoneNumber)

    setIsLoading(true)
    setError('')

    try {
      const result = await window.electron.telegram.connect(phoneNumber)
      console.log('Connection result:', result)

      if (!result.success) {
        console.error('Connection failed:', result.error)
        setError(result.error || 'Connection failed')
        setIsLoading(false)
      }
      // If success, keep loading state - UI will change when codeRequired event fires
    } catch (err: any) {
      console.error('Connection error:', err)
      setError(err.message || 'Connection failed')
      setIsLoading(false)
    }
  }

  const handleSubmitCode = async () => {
    console.log('🔑 Submitting verification code:', code)
    setIsLoading(true)
    setError('')

    try {
      const result = await window.electron.telegram.sendCode(code)
      console.log('Code submission result:', result)

      if (!result.success) {
        console.error('Code verification failed:', result.error)
        setError(result.error || 'Invalid code')
        setIsLoading(false)
      } else {
        console.log('✅ Code verified, waiting for connection event...')
      }
    } catch (err: any) {
      console.error('Code verification error:', err)
      setError(err.message || 'Invalid code')
      setIsLoading(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Telegram Signal Copier</h1>
          <p className="text-gray-400">Connect your Telegram account to get started</p>
        </div>

        {!isCodeRequired ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full pl-11 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Include country code (e.g., +1 for US)
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={!phoneNumber || isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Connecting...' : 'Connect to Telegram'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Verification Code
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="12345"
                  className="w-full pl-11 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Enter the code sent to your Telegram app
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmitCode}
              disabled={!code || isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Verifying...' : 'Verify Code'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
