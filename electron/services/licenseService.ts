/**
 * License Service
 *
 * Handles license validation, activation, and limits enforcement
 */

import { EventEmitter } from 'events'
import { getDatabase, saveDatabase } from '../database'
import {
  License,
  LicenseTier,
  LicenseValidationResult,
  LicenseCheckResult,
  LicenseActivationRequest,
  LicenseActivationResponse,
  LICENSE_TIERS,
  TRIAL_DURATION_DAYS,
  generateMachineId,
  validateLicenseKeyFormat,
  isLicenseExpired,
  getDaysUntilExpiration,
} from '../types/licenseConfig'
import { logger } from '../utils/logger'

export class LicenseService extends EventEmitter {
  private currentLicense: License | null = null
  private machineId: string
  private validationInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.machineId = generateMachineId()
    // Don't load license in constructor - it will be loaded when database is ready
  }

  /**
   * Initialize license service (call after database is ready)
   */
  init() {
    this.loadLicense()
    this.migrateLicenseLimits() // Update old licenses with new limits
    this.startValidationLoop()
  }

  /**
   * Migrate old licenses to new limits (CRITICAL FIX for unlimited channels)
   */
  private migrateLicenseLimits() {
    if (!this.currentLicense) return

    const currentTier = this.currentLicense.tier
    const newLimits = LICENSE_TIERS[currentTier]

    // Check if limits need updating
    const needsUpdate =
      this.currentLicense.limits.maxChannels !== newLimits.maxChannels ||
      this.currentLicense.limits.maxAccounts !== newLimits.maxAccounts

    if (needsUpdate) {
      logger.info(`Migrating license limits for tier ${currentTier}`)
      logger.info(`Old limits: maxAccounts=${this.currentLicense.limits.maxAccounts}, maxChannels=${this.currentLicense.limits.maxChannels}`)
      logger.info(`New limits: maxAccounts=${newLimits.maxAccounts}, maxChannels=${newLimits.maxChannels}`)

      // Update limits
      this.currentLicense.limits = newLimits
      this.currentLicense.updatedAt = new Date().toISOString()

      // Save updated license
      this.saveLicense(this.currentLicense)

      logger.info('License limits migrated successfully')
    }
  }

  /**
   * Load license from database
   */
  private loadLicense() {
    try {
      const db = getDatabase()
      const rows = db.exec(`
        SELECT value FROM settings WHERE key = 'license'
      `)

      if (rows.length > 0 && rows[0].values.length > 0) {
        const value = rows[0].values[0][0] as string
        this.currentLicense = JSON.parse(value)
        logger.info(`License loaded: ${this.currentLicense?.tier} (${this.currentLicense?.status})`)
      } else {
        logger.info('No license found - running in unlicensed mode')
        this.createTrialLicense()
      }
    } catch (error) {
      logger.error('Failed to load license:', error)
      // Create a default trial license to prevent UI from breaking
      this.createDefaultTrialLicense()
    }
  }

  /**
   * Create default trial license without database access (fallback)
   */
  private createDefaultTrialLicense() {
    const now = new Date()
    const trialEnd = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000)

    this.currentLicense = {
      licenseKey: 'TRIAL-0000-0000-0000-0000',
      tier: 'trial',
      status: 'trial',
      userId: 'trial_user',
      email: '',
      telegramPhone: '',
      isLifetime: false,
      isTrial: true,
      trialStartedAt: now.toISOString(),
      trialEndsAt: trialEnd.toISOString(),
      activatedAt: now.toISOString(),
      expiresAt: trialEnd.toISOString(),
      lastValidated: now.toISOString(),
      limits: LICENSE_TIERS.trial,
      currentAccounts: 0,
      currentChannels: 0,
      machineId: this.machineId,
      allowedMachines: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    logger.info('Created default trial license (database not ready)')
  }

  /**
   * Save license to database
   */
  private saveLicense(license: License): boolean {
    try {
      const db = getDatabase()
      db.run(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES ('license', ?, CURRENT_TIMESTAMP)
      `, [JSON.stringify(license)])

      saveDatabase()
      this.currentLicense = license
      logger.info(`License saved: ${license.tier}`)

      // Emit license updated event
      this.emit('licenseUpdated', license)

      return true
    } catch (error) {
      logger.error('Failed to save license:', error)
      return false
    }
  }

  /**
   * Create trial license (7 days)
   */
  private createTrialLicense() {
    const now = new Date()
    const trialEnd = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000)

    const trialLicense: License = {
      licenseKey: 'TRIAL-0000-0000-0000-0000',
      tier: 'trial',
      status: 'trial',

      userId: 'trial_user',
      email: '',
      telegramPhone: '',

      isLifetime: false,
      isTrial: true,
      trialStartedAt: now.toISOString(),
      trialEndsAt: trialEnd.toISOString(),

      activatedAt: now.toISOString(),
      expiresAt: trialEnd.toISOString(),
      lastValidated: now.toISOString(),

      limits: LICENSE_TIERS.trial,

      currentAccounts: 0,
      currentChannels: 0,

      machineId: this.machineId,
      allowedMachines: 1,

      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    this.saveLicense(trialLicense)
    logger.info(`Created trial license - expires in ${TRIAL_DURATION_DAYS} days`)

    this.emit('trialStarted', trialLicense)
  }

  /**
   * Activate license with key
   */
  async activateLicense(request: LicenseActivationRequest): Promise<LicenseActivationResponse> {
    try {
      // Validate format
      if (!validateLicenseKeyFormat(request.licenseKey)) {
        return {
          success: false,
          error: 'Invalid license key format',
        }
      }

      // TODO: Call backend API to validate license key
      // For now, simulate validation
      const tier = this.extractTierFromKey(request.licenseKey)

      if (!tier) {
        return {
          success: false,
          error: 'Invalid license key',
        }
      }

      // Create license
      const now = new Date()
      const isLifetime = tier === 'advance'
      const expiresAt = isLifetime
        ? null
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

      const license: License = {
        licenseKey: request.licenseKey,
        tier,
        status: 'active',

        userId: `user_${Date.now()}`,
        email: request.email,
        telegramPhone: request.telegramPhone,

        isLifetime,
        isTrial: false,

        activatedAt: now.toISOString(),
        expiresAt: expiresAt?.toISOString() || '',
        lastValidated: now.toISOString(),

        limits: LICENSE_TIERS[tier],

        currentAccounts: 0,
        currentChannels: 0,

        machineId: request.machineId,
        allowedMachines: tier === 'advance' ? 3 : 1,

        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }

      this.saveLicense(license)
      logger.info(`License activated: ${tier}`)

      this.emit('licenseActivated', license)

      return {
        success: true,
        license,
      }
    } catch (error: any) {
      logger.error('License activation failed:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Extract tier from license key prefix
   */
  private extractTierFromKey(key: string): LicenseTier | null {
    const prefix = key.substring(0, 3).toLowerCase()

    if (prefix === 'sta') return 'starter'
    if (prefix === 'pro') return 'pro'
    if (prefix === 'adv') return 'advance'

    return null
  }

  /**
   * Validate current license
   */
  validateLicense(): LicenseValidationResult {
    if (!this.currentLicense) {
      return {
        isValid: false,
        license: null,
        reason: 'No license found',
      }
    }

    // Check if expired
    if (isLicenseExpired(this.currentLicense)) {
      this.currentLicense.status = 'expired'
      this.saveLicense(this.currentLicense)

      return {
        isValid: false,
        license: this.currentLicense,
        reason: 'License expired',
        daysRemaining: 0,
        shouldRenew: true,
      }
    }

    // Check if trial ended
    if (this.currentLicense.isTrial && this.currentLicense.trialEndsAt) {
      const trialEnd = new Date(this.currentLicense.trialEndsAt)
      if (trialEnd < new Date()) {
        this.currentLicense.status = 'expired'
        this.saveLicense(this.currentLicense)

        return {
          isValid: false,
          license: this.currentLicense,
          reason: 'Trial period ended',
          daysRemaining: 0,
          shouldRenew: true,
        }
      }
    }

    // Check machine ID
    if (this.currentLicense.machineId !== this.machineId) {
      return {
        isValid: false,
        license: this.currentLicense,
        reason: 'License bound to different machine',
      }
    }

    // License is valid
    const daysRemaining = getDaysUntilExpiration(this.currentLicense)

    // Update last validated
    this.currentLicense.lastValidated = new Date().toISOString()
    this.saveLicense(this.currentLicense)

    return {
      isValid: true,
      license: this.currentLicense,
      daysRemaining,
      shouldRenew: daysRemaining <= 7 && !this.currentLicense.isLifetime,
    }
  }

  /**
   * Check if action is allowed based on license limits
   */
  canAddAccount(): LicenseCheckResult {
    const validation = this.validateLicense()

    if (!validation.isValid) {
      return {
        canPerformAction: false,
        reason: validation.reason,
      }
    }

    const license = validation.license!
    const maxAccounts = license.limits.maxAccounts

    // Unlimited accounts
    if (maxAccounts === -1) {
      return { canPerformAction: true }
    }

    // Check limit
    if (license.currentAccounts >= maxAccounts) {
      return {
        canPerformAction: false,
        reason: `Account limit reached (${maxAccounts} max)`,
        currentUsage: license.currentAccounts,
        limit: maxAccounts,
        upgradeRequired: this.suggestUpgrade(license.tier),
      }
    }

    return { canPerformAction: true }
  }

  /**
   * Check if can add channel
   */
  canAddChannel(): LicenseCheckResult {
    const validation = this.validateLicense()

    if (!validation.isValid) {
      return {
        canPerformAction: false,
        reason: validation.reason,
      }
    }

    const license = validation.license!
    const maxChannels = license.limits.maxChannels

    // Unlimited channels
    if (maxChannels === -1) {
      return { canPerformAction: true }
    }

    // Check limit
    if (license.currentChannels >= maxChannels) {
      return {
        canPerformAction: false,
        reason: `Channel limit reached (${maxChannels} max)`,
        currentUsage: license.currentChannels,
        limit: maxChannels,
        upgradeRequired: this.suggestUpgrade(license.tier),
      }
    }

    return { canPerformAction: true }
  }

  /**
   * Check if feature is enabled
   */
  hasFeature(feature: keyof License['limits']): boolean {
    const validation = this.validateLicense()

    if (!validation.isValid) return false

    return validation.license!.limits[feature] as boolean
  }

  /**
   * Suggest upgrade tier
   */
  private suggestUpgrade(currentTier: LicenseTier): LicenseTier {
    if (currentTier === 'trial' || currentTier === 'starter') return 'pro'
    if (currentTier === 'pro') return 'advance'
    return 'advance'
  }

  /**
   * Increment account count
   */
  incrementAccountCount() {
    if (!this.currentLicense) return

    this.currentLicense.currentAccounts++
    this.saveLicense(this.currentLicense)
  }

  /**
   * Decrement account count
   */
  decrementAccountCount() {
    if (!this.currentLicense) return

    this.currentLicense.currentAccounts = Math.max(0, this.currentLicense.currentAccounts - 1)
    this.saveLicense(this.currentLicense)
  }

  /**
   * Increment channel count
   */
  incrementChannelCount() {
    if (!this.currentLicense) return

    this.currentLicense.currentChannels++
    this.saveLicense(this.currentLicense)
  }

  /**
   * Decrement channel count
   */
  decrementChannelCount() {
    if (!this.currentLicense) return

    this.currentLicense.currentChannels = Math.max(0, this.currentLicense.currentChannels - 1)
    this.saveLicense(this.currentLicense)
  }

  /**
   * Set channel count to specific value
   */
  setChannelCount(count: number) {
    if (!this.currentLicense) return

    this.currentLicense.currentChannels = Math.max(0, count)
    this.saveLicense(this.currentLicense)
  }

  /**
   * Get current license
   */
  getCurrentLicense(): License | null {
    // If not initialized yet, create a default trial license
    if (!this.currentLicense) {
      this.createDefaultTrialLicense()
    }
    return this.currentLicense
  }

  /**
   * Get machine ID
   */
  getMachineId(): string {
    return this.machineId
  }

  /**
   * Start validation loop (check every hour)
   */
  private startValidationLoop() {
    // Validate immediately
    this.validateLicense()

    // Then every hour
    this.validationInterval = setInterval(() => {
      const result = this.validateLicense()

      if (!result.isValid) {
        logger.warn('License validation failed:', result.reason)
        this.emit('licenseInvalid', result)
      }

      if (result.shouldRenew) {
        logger.warn(`License expiring soon: ${result.daysRemaining} days remaining`)
        this.emit('licenseExpiringSoon', result)
      }
    }, 60 * 60 * 1000) // Every hour
  }

  /**
   * Stop validation loop
   */
  stopValidationLoop() {
    if (this.validationInterval) {
      clearInterval(this.validationInterval)
      this.validationInterval = null
    }
  }

  /**
   * Deactivate license
   */
  deactivateLicense(): boolean {
    if (!this.currentLicense) return false

    this.currentLicense.status = 'suspended'
    this.saveLicense(this.currentLicense)

    logger.info('License deactivated')
    this.emit('licenseDeactivated', this.currentLicense)

    return true
  }
}

// Singleton instance
export const licenseService = new LicenseService()
