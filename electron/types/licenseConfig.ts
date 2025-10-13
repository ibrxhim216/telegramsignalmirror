/**
 * License Configuration Types
 *
 * Three-tier licensing system:
 * - Starter: $14.99/month (1 account, 1 channel)
 * - Pro: $24.99/month (3 accounts, unlimited channels)
 * - Advance: $279 lifetime (unlimited accounts, unlimited channels)
 */

export type LicenseTier = 'starter' | 'pro' | 'advance' | 'trial' | 'none'

export interface LicenseLimits {
  maxAccounts: number          // Maximum trading accounts
  maxChannels: number          // Maximum Telegram channels
  multiTP: boolean             // Multiple TP levels enabled
  tscProtector: boolean        // TSC Protector enabled
  tradeModifications: boolean  // Trade modification commands
  aiParser: boolean            // AI-powered signal parsing
  visionAI: boolean            // Image-based signal parsing
  multiPlatform: boolean       // cTrader, DXTrade, TradeLocker support
}

export interface License {
  licenseKey: string           // Unique license key
  tier: LicenseTier           // License tier
  status: 'active' | 'expired' | 'suspended' | 'trial'

  // User information
  userId: string              // Unique user ID
  email: string               // User email
  telegramPhone: string       // Telegram phone number (linked)

  // Subscription details
  isLifetime: boolean         // Lifetime license (Advance)
  subscriptionId?: string     // Stripe subscription ID
  customerId?: string         // Stripe customer ID

  // Dates
  activatedAt: string         // When license was activated
  expiresAt: string           // When license expires (null for lifetime)
  lastValidated: string       // Last validation timestamp

  // Trial
  isTrial: boolean            // Is this a trial license?
  trialStartedAt?: string     // Trial start date
  trialEndsAt?: string        // Trial end date

  // Limits
  limits: LicenseLimits       // Feature limits for this tier

  // Usage tracking
  currentAccounts: number     // Currently connected accounts
  currentChannels: number     // Currently monitored channels

  // Machine binding
  machineId: string           // Bound to specific machine
  allowedMachines: number     // How many machines allowed

  // Metadata
  createdAt: string
  updatedAt: string
}

export const LICENSE_TIERS: Record<LicenseTier, LicenseLimits> = {
  none: {
    maxAccounts: 0,
    maxChannels: 0,
    multiTP: false,
    tscProtector: false,
    tradeModifications: false,
    aiParser: false,
    visionAI: false,
    multiPlatform: false,
  },

  trial: {
    maxAccounts: 1,
    maxChannels: -1,        // -1 means unlimited (per spec: all plans have unlimited channels)
    multiTP: true,
    tscProtector: true,
    tradeModifications: true,
    aiParser: true,
    visionAI: false,
    multiPlatform: false,
  },

  starter: {
    maxAccounts: 1,
    maxChannels: -1,        // -1 means unlimited (per spec: all plans have unlimited channels)
    multiTP: true,
    tscProtector: true,
    tradeModifications: true,
    aiParser: true,
    visionAI: false,
    multiPlatform: false,
  },

  pro: {
    maxAccounts: 3,
    maxChannels: -1,        // -1 means unlimited
    multiTP: true,
    tscProtector: true,
    tradeModifications: true,
    aiParser: true,
    visionAI: true,
    multiPlatform: false,
  },

  advance: {
    maxAccounts: -1,        // -1 means unlimited
    maxChannels: -1,        // -1 means unlimited
    multiTP: true,
    tscProtector: true,
    tradeModifications: true,
    aiParser: true,
    visionAI: true,
    multiPlatform: true,
  },
}

export const PRICING = {
  starter: {
    monthly: 14.99,
    currency: 'USD',
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter',
  },
  pro: {
    monthly: 24.99,
    currency: 'USD',
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
  },
  advance: {
    lifetime: 279,
    currency: 'USD',
    stripePriceId: process.env.STRIPE_ADVANCE_PRICE_ID || 'price_advance',
  },
}

export const TRIAL_DURATION_DAYS = 7

export interface LicenseValidationResult {
  isValid: boolean
  license: License | null
  reason?: string
  daysRemaining?: number
  shouldRenew?: boolean
}

export interface LicenseCheckResult {
  canPerformAction: boolean
  reason?: string
  currentUsage?: number
  limit?: number
  upgradeRequired?: LicenseTier
}

/**
 * License activation request
 */
export interface LicenseActivationRequest {
  licenseKey: string
  email: string
  telegramPhone: string
  machineId: string
}

/**
 * License activation response
 */
export interface LicenseActivationResponse {
  success: boolean
  license?: License
  error?: string
}

/**
 * Generate machine ID from system information
 */
export function generateMachineId(): string {
  const os = require('os')
  const crypto = require('crypto')

  // Create unique machine fingerprint
  const data = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || '',
  ].join('|')

  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32)
}

/**
 * Generate license key (server-side only)
 */
export function generateLicenseKey(tier: LicenseTier, userId: string): string {
  const crypto = require('crypto')

  const prefix = tier.toUpperCase().substring(0, 3)
  const random = crypto.randomBytes(8).toString('hex').toUpperCase()
  const checksum = crypto.createHash('md5').update(userId + random).digest('hex').substring(0, 4).toUpperCase()

  // Format: PRO-XXXX-XXXX-XXXX-XXXX
  const key = `${prefix}-${random.substring(0, 4)}-${random.substring(4, 8)}-${random.substring(8, 12)}-${checksum}`

  return key
}

/**
 * Validate license key format
 */
export function validateLicenseKeyFormat(key: string): boolean {
  // Format: XXX-XXXX-XXXX-XXXX-XXXX
  const regex = /^[A-Z]{3}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/
  return regex.test(key)
}

/**
 * Check if license is expired
 */
export function isLicenseExpired(license: License): boolean {
  if (license.isLifetime) return false
  if (!license.expiresAt) return false

  return new Date(license.expiresAt) < new Date()
}

/**
 * Get days until expiration
 */
export function getDaysUntilExpiration(license: License): number {
  if (license.isLifetime) return Infinity
  if (!license.expiresAt) return 0

  const now = new Date()
  const expires = new Date(license.expiresAt)
  const diff = expires.getTime() - now.getTime()

  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
