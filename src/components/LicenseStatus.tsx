import { useState, useEffect } from 'react'
import { Shield, Crown, Star, AlertTriangle, Clock, ExternalLink } from 'lucide-react'
import LicenseActivation from './LicenseActivation'

interface License {
  tier: 'starter' | 'pro' | 'advance' | 'trial' | 'none'
  status: 'active' | 'expired' | 'suspended' | 'trial'
  isLifetime: boolean
  isTrial: boolean
  expiresAt?: string
  trialEndsAt?: string
  currentAccounts: number
  currentChannels: number
  limits: {
    maxAccounts: number
    maxChannels: number
  }
}

export default function LicenseStatus() {
  const [license, setLicense] = useState<License | null>(null)
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)
  const [showActivation, setShowActivation] = useState(false)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)

  useEffect(() => {
    loadLicense()

    // Listen for license events with cleanup
    const cleanupUpdated = window.electron.license.onUpdated((updatedLicense) => {
      setLicense(updatedLicense)
      calculateDaysRemaining(updatedLicense)
    })

    const cleanupActivated = window.electron.license.onActivated((activatedLicense) => {
      setLicense(activatedLicense)
      calculateDaysRemaining(activatedLicense)
    })

    const cleanupTrialStarted = window.electron.license.onTrialStarted((trialLicense) => {
      setLicense(trialLicense)
      calculateDaysRemaining(trialLicense)
    })

    const cleanupExpiringSoon = window.electron.license.onExpiringSoon((result) => {
      if (result.daysRemaining !== undefined) {
        setDaysRemaining(result.daysRemaining)
      }
    })

    const cleanupInvalid = window.electron.license.onInvalid(() => {
      loadLicense()
    })

    // Cleanup all listeners when component unmounts (check if cleanup functions exist)
    return () => {
      if (typeof cleanupUpdated === 'function') cleanupUpdated()
      if (typeof cleanupActivated === 'function') cleanupActivated()
      if (typeof cleanupTrialStarted === 'function') cleanupTrialStarted()
      if (typeof cleanupExpiringSoon === 'function') cleanupExpiringSoon()
      if (typeof cleanupInvalid === 'function') cleanupInvalid()
    }
  }, [])

  const loadLicense = async () => {
    try {
      console.log('Loading license...')
      const result = await window.electron.license.get()
      console.log('License result:', result)
      if (result.success && result.license) {
        setLicense(result.license)
        calculateDaysRemaining(result.license)
      }
    } catch (error) {
      console.error('Failed to load license:', error)
      // Set a default trial license to prevent UI blocking
      setLicense({
        tier: 'trial',
        status: 'trial',
        isLifetime: false,
        isTrial: true,
        currentAccounts: 0,
        currentChannels: 0,
        limits: {
          maxAccounts: 1,
          maxChannels: -1,
        },
      })
    }
  }

  const calculateDaysRemaining = (lic: License) => {
    if (lic.isLifetime) {
      setDaysRemaining(null)
      return
    }

    const expiryDate = lic.isTrial && lic.trialEndsAt ? lic.trialEndsAt : lic.expiresAt
    if (!expiryDate) {
      setDaysRemaining(null)
      return
    }

    const now = new Date()
    const expires = new Date(expiryDate)
    const diff = expires.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

    setDaysRemaining(days)
  }

  const getTierDisplay = (tier: string) => {
    switch (tier) {
      case 'starter':
        return { name: 'Starter', icon: Shield, color: 'text-blue-400' }
      case 'pro':
        return { name: 'Pro', icon: Star, color: 'text-purple-400' }
      case 'advance':
        return { name: 'Advance', icon: Crown, color: 'text-yellow-400' }
      case 'trial':
        return { name: 'Trial', icon: Clock, color: 'text-gray-400' }
      default:
        return { name: 'No License', icon: AlertTriangle, color: 'text-red-400' }
    }
  }

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'starter':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'pro':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
      case 'advance':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      case 'trial':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
      default:
        return 'bg-red-500/20 text-red-400 border-red-500/50'
    }
  }

  const shouldShowUpgradePrompt = () => {
    if (!license) return false
    if (license.tier === 'advance') return false // Already on highest tier

    // Show if close to channel limit (accounts are managed on web portal)
    const channelUsage = license.limits.maxChannels > 0
      ? (license.currentChannels / license.limits.maxChannels) * 100
      : 0

    return channelUsage >= 80
  }

  const handleUpgrade = () => {
    window.open('https://www.telegramsignalmirror.com/dashboard/billing', '_blank')
  }

  if (!license) {
    return null
  }

  const tierDisplay = getTierDisplay(license.tier)
  const TierIcon = tierDisplay.icon

  return (
    <>
      <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
        {/* Tier Badge */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded border ${getTierBadgeColor(license.tier)}`}>
          <TierIcon size={16} />
          <span className="text-sm font-medium">{tierDisplay.name}</span>
        </div>

        {/* Status Info */}
        <div className="flex items-center gap-4 text-sm">
          {/* Expiration */}
          {license.isLifetime ? (
            <span className="text-green-400 font-medium">Lifetime</span>
          ) : daysRemaining !== null && (
            <div className="flex items-center gap-1">
              <Clock size={14} className={daysRemaining <= 7 ? 'text-red-400' : 'text-gray-400'} />
              <span className={daysRemaining <= 7 ? 'text-red-400' : 'text-gray-400'}>
                {daysRemaining} days left
              </span>
            </div>
          )}

          {/* Usage - Only show channels (accounts are managed on web portal) */}
          <div className="flex items-center gap-3 text-gray-400">
            <span>
              {license.currentChannels} / {license.limits.maxChannels === -1 ? '∞' : license.limits.maxChannels} channels
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {license.isTrial && (
            <button
              onClick={() => setShowActivation(true)}
              className="px-3 py-1 bg-yellow-500 text-black text-sm font-medium rounded hover:bg-yellow-600 transition-colors"
            >
              Activate License
            </button>
          )}

          {license.tier !== 'advance' && !license.isTrial && (
            <button
              onClick={handleUpgrade}
              className="px-3 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/50 text-sm font-medium rounded hover:bg-purple-500/30 transition-colors flex items-center gap-1"
            >
              Upgrade
              <ExternalLink size={12} />
            </button>
          )}

          {daysRemaining !== null && daysRemaining <= 7 && !license.isLifetime && (
            <button
              onClick={handleUpgrade}
              className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/50 text-sm font-medium rounded hover:bg-red-500/30 transition-colors"
            >
              Renew Now
            </button>
          )}
        </div>
      </div>

      {/* Upgrade Prompt */}
      {shouldShowUpgradePrompt() && !showUpgradePrompt && (
        <div className="mt-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 flex items-start gap-3">
          <AlertTriangle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-yellow-400 mb-1">
              Approaching Limit
            </h4>
            <p className="text-xs text-yellow-300/80">
              You're close to your {license.tier} plan channel limit. Upgrade to monitor more signal providers.
            </p>
          </div>
          <button
            onClick={handleUpgrade}
            className="px-3 py-1 bg-yellow-500 text-black text-sm font-medium rounded hover:bg-yellow-600 transition-colors flex-shrink-0"
          >
            Upgrade Now
          </button>
          <button
            onClick={() => setShowUpgradePrompt(true)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* License Activation Dialog */}
      <LicenseActivation
        isOpen={showActivation}
        onClose={() => setShowActivation(false)}
        onActivated={loadLicense}
      />
    </>
  )
}
