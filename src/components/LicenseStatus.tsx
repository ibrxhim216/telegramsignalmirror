import { useState, useEffect } from 'react'
import { Shield, Crown, Star, AlertTriangle, Clock, ExternalLink } from 'lucide-react'

interface License {
  tier: 'starter' | 'pro' | 'advance' | 'trial' | 'none'
  status: 'active' | 'expired' | 'suspended' | 'trial'
  isLifetime: boolean
  isTrial: boolean
  expiresAt?: string
  trialEndsAt?: string
  email?: string
  currentAccounts: number
  currentChannels: number
  limits: {
    maxAccounts: number
    maxChannels: number
  }
}

/** Plan names as they appear on the website, so the app and the portal agree. */
const TIER_DISPLAY: Record<string, { name: string; icon: typeof Shield; cls: string }> = {
  starter: { name: 'Basic', icon: Shield, cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  pro: { name: 'Pro', icon: Star, cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  advance: { name: 'Lifetime', icon: Crown, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  trial: { name: 'Trial', icon: Clock, cls: 'bg-gray-500/15 text-gray-300 border-gray-500/30' },
  none: { name: 'No plan', icon: AlertTriangle, cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
}

export default function LicenseStatus() {
  const [license, setLicense] = useState<License | null>(null)
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)

  useEffect(() => {
    loadLicense()

    const apply = (lic: License) => {
      setLicense(lic)
      calculateDaysRemaining(lic)
    }
    const cleanups = [
      window.electron.license.onUpdated(apply),
      window.electron.license.onActivated(apply),
      window.electron.license.onTrialStarted(apply),
      window.electron.license.onExpiringSoon((result) => {
        if (result.daysRemaining !== undefined) setDaysRemaining(result.daysRemaining)
      }),
      window.electron.license.onInvalid(() => loadLicense()),
    ]
    return () => {
      cleanups.forEach((c) => typeof c === 'function' && c())
    }
  }, [])

  const loadLicense = async () => {
    try {
      const result = await window.electron.license.get()
      if (result.success && result.license) {
        setLicense(result.license)
        calculateDaysRemaining(result.license)
      }
    } catch (error) {
      console.error('Failed to load license:', error)
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
    const diff = new Date(expiryDate).getTime() - Date.now()
    setDaysRemaining(Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const openBilling = () => window.electron.web?.open('/dashboard/billing')

  if (!license) return null

  const display = TIER_DISPLAY[license.tier] || TIER_DISPLAY.none
  const TierIcon = display.icon
  const expiringSoon = daysRemaining !== null && daysRemaining <= 7 && !license.isLifetime
  const expired = license.status === 'expired' || (daysRemaining !== null && daysRemaining <= 0 && !license.isLifetime)

  return (
    <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
      <div className={`flex items-center gap-2 px-2.5 py-1 rounded border text-sm font-medium ${display.cls}`}>
        <TierIcon size={14} />
        {display.name}
        {license.isTrial && license.tier !== 'trial' ? ' · trial' : ''}
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-400">
        {license.isLifetime ? (
          <span className="text-green-400 font-medium">Lifetime access</span>
        ) : expired ? (
          <span className="text-red-400 font-medium">Expired</span>
        ) : daysRemaining !== null ? (
          <span className={`flex items-center gap-1 ${expiringSoon ? 'text-amber-300' : ''}`}>
            <Clock size={13} />
            {license.isTrial ? 'Trial ends' : 'Renews'} in {daysRemaining} day{daysRemaining === 1 ? '' : 's'}
          </span>
        ) : null}

        <span>
          {license.currentAccounts}/{license.limits.maxAccounts === -1 ? '∞' : license.limits.maxAccounts} trading account
          {license.limits.maxAccounts === 1 ? '' : 's'}
        </span>
        {license.email && <span className="hidden xl:inline text-gray-500">{license.email}</span>}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {(expired || expiringSoon) && !license.isLifetime && (
          <button
            onClick={openBilling}
            className="px-3 py-1 bg-amber-500 text-gray-950 text-sm font-medium rounded hover:bg-amber-400 transition-colors flex items-center gap-1"
          >
            {expired ? 'Renew now' : 'Renew'}
            <ExternalLink size={12} />
          </button>
        )}
        {!license.isLifetime && (
          <button
            onClick={openBilling}
            className="px-3 py-1 text-sm text-gray-300 border border-gray-600 rounded hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-1"
            title="Opens billing on the website, already signed in"
          >
            {license.tier === 'starter' || license.tier === 'trial' ? 'Upgrade' : 'Manage plan'}
            <ExternalLink size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
