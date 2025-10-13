import React, { useState, useEffect } from 'react'
import { X, Key, Shield, CheckCircle, AlertTriangle, Loader } from 'lucide-react'

interface LicenseActivationProps {
  isOpen: boolean
  onClose: () => void
  onActivated?: () => void
}

export default function LicenseActivation({ isOpen, onClose, onActivated }: LicenseActivationProps) {
  const [licenseKey, setLicenseKey] = useState('')
  const [email, setEmail] = useState('')
  const [telegramPhone, setTelegramPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [machineId, setMachineId] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadMachineId()
    }
  }, [isOpen])

  const loadMachineId = async () => {
    try {
      const result = await window.electron.license.getMachineId()
      if (result.success && result.machineId) {
        setMachineId(result.machineId)
      }
    } catch (error) {
      console.error('Failed to load machine ID:', error)
    }
  }

  const handleActivate = async () => {
    setError('')
    setSuccess(false)

    // Validation
    if (!licenseKey.trim()) {
      setError('Please enter your license key')
      return
    }

    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    if (!telegramPhone.trim()) {
      setError('Please enter your Telegram phone number')
      return
    }

    try {
      setLoading(true)

      const result = await window.electron.license.activate({
        licenseKey: licenseKey.trim().toUpperCase(),
        email: email.trim(),
        telegramPhone: telegramPhone.trim(),
        machineId,
      })

      if (result.success) {
        setSuccess(true)
        setTimeout(() => {
          onActivated?.()
          onClose()
        }, 2000)
      } else {
        setError(result.error || 'Activation failed')
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatLicenseKey = (value: string) => {
    // Remove non-alphanumeric characters
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '')

    // Format as XXX-XXXX-XXXX-XXXX-XXXX
    const parts = []
    parts.push(cleaned.substring(0, 3))
    parts.push(cleaned.substring(3, 7))
    parts.push(cleaned.substring(7, 11))
    parts.push(cleaned.substring(11, 15))
    parts.push(cleaned.substring(15, 19))

    return parts.filter(p => p.length > 0).join('-')
  }

  const handleLicenseKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatLicenseKey(e.target.value)
    setLicenseKey(formatted)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Key className="text-yellow-500" size={24} />
            <h2 className="text-xl font-bold text-white">Activate License</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle className="text-green-500" size={64} />
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">License Activated!</h3>
                <p className="text-gray-400">Your license has been successfully activated.</p>
              </div>
            </div>
          ) : (
            <>
              {/* License Key */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  License Key
                </label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={handleLicenseKeyChange}
                  placeholder="XXX-XXXX-XXXX-XXXX-XXXX"
                  maxLength={23}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-4 py-2 text-white font-mono text-lg tracking-wider focus:outline-none focus:border-yellow-500"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your license key from the purchase confirmation email
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-gray-900 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-yellow-500"
                  disabled={loading}
                />
              </div>

              {/* Telegram Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Telegram Phone Number
                </label>
                <input
                  type="tel"
                  value={telegramPhone}
                  onChange={(e) => setTelegramPhone(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full bg-gray-900 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-yellow-500"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must match the phone number you'll use with Telegram
                </p>
              </div>

              {/* Machine ID */}
              {machineId && (
                <div className="bg-gray-900/50 rounded p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="text-gray-400" size={16} />
                    <span className="text-xs font-medium text-gray-400">Machine ID</span>
                  </div>
                  <code className="text-xs text-gray-500 font-mono break-all">
                    {machineId}
                  </code>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/50 rounded p-3">
                  <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Info */}
              <div className="bg-blue-500/10 border border-blue-500/50 rounded p-3">
                <p className="text-xs text-blue-300">
                  💡 Don't have a license yet?{' '}
                  <a
                    href="https://telegramsignalcopier.com/pricing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-200"
                  >
                    Purchase one here
                  </a>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex justify-end gap-3 p-6 border-t border-gray-700 bg-gray-900/30">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleActivate}
              disabled={loading}
              className="px-6 py-2 bg-yellow-500 text-black font-medium rounded hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={16} />
                  Activating...
                </>
              ) : (
                <>
                  <Key size={16} />
                  Activate License
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
