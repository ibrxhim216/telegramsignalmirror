import { getDatabase, saveDatabase } from '../database'
import { ChannelConfig, DEFAULT_CHANNEL_CONFIG } from '../types/channelConfig'
import { logger } from '../utils/logger'

export class ChannelConfigService {
  /**
   * Get configuration for a specific channel
   */
  getConfig(channelId: number): ChannelConfig | null {
    try {
      const db = getDatabase()
      const stmt = db.prepare('SELECT config, title FROM channels WHERE id = ?')
      stmt.bind([channelId])

      if (stmt.step()) {
        const row = stmt.getAsObject()
        const configJson = row.config as string
        const channelName = row.title as string

        if (configJson) {
          const loadedConfig = JSON.parse(configJson) as Partial<ChannelConfig>

          // Merge with defaults to ensure all fields exist (for backwards compatibility)
          const config: ChannelConfig = {
            ...DEFAULT_CHANNEL_CONFIG,
            ...loadedConfig,
            channelId,
            channelName: loadedConfig.channelName || channelName,
            // Deep merge nested objects
            signalKeywords: { ...DEFAULT_CHANNEL_CONFIG.signalKeywords, ...(loadedConfig.signalKeywords || {}) },
            updateKeywords: { ...DEFAULT_CHANNEL_CONFIG.updateKeywords, ...(loadedConfig.updateKeywords || {}) },
            additionalKeywords: { ...DEFAULT_CHANNEL_CONFIG.additionalKeywords, ...(loadedConfig.additionalKeywords || {}) },
            advancedSettings: { ...DEFAULT_CHANNEL_CONFIG.advancedSettings, ...(loadedConfig.advancedSettings || {}) },
            riskSettings: { ...DEFAULT_CHANNEL_CONFIG.riskSettings, ...(loadedConfig.riskSettings || {}) },
            tradeFilters: { ...DEFAULT_CHANNEL_CONFIG.tradeFilters, ...(loadedConfig.tradeFilters || {}) },
            sltpOverride: { ...DEFAULT_CHANNEL_CONFIG.sltpOverride, ...(loadedConfig.sltpOverride || {}) },
            modification: { ...DEFAULT_CHANNEL_CONFIG.modification, ...(loadedConfig.modification || {}) },
            breakeven: { ...DEFAULT_CHANNEL_CONFIG.breakeven, ...(loadedConfig.breakeven || {}) },
            trailingStop: { ...DEFAULT_CHANNEL_CONFIG.trailingStop, ...(loadedConfig.trailingStop || {}) },
            partialClose: { ...DEFAULT_CHANNEL_CONFIG.partialClose, ...(loadedConfig.partialClose || {}) },
            symbolMapping: { ...DEFAULT_CHANNEL_CONFIG.symbolMapping, ...(loadedConfig.symbolMapping || {}) },
            timeFilter: { ...DEFAULT_CHANNEL_CONFIG.timeFilter, ...(loadedConfig.timeFilter || {}) },
            signalModifications: { ...DEFAULT_CHANNEL_CONFIG.signalModifications, ...(loadedConfig.signalModifications || {}) },
            other: { ...DEFAULT_CHANNEL_CONFIG.other, ...(loadedConfig.other || {}) },
          }

          return config
        } else {
          // Return default config if none exists
          return this.createDefaultConfig(channelId, channelName)
        }
      }

      stmt.free()
      return null
    } catch (error: any) {
      logger.error('Error getting channel config:', error)
      return null
    }
  }

  /**
   * Save configuration for a channel
   */
  saveConfig(config: ChannelConfig): boolean {
    try {
      const db = getDatabase()
      const configJson = JSON.stringify(config)

      const stmt = db.prepare('UPDATE channels SET config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      stmt.bind([configJson, config.channelId])
      stmt.step()
      stmt.free()

      saveDatabase()
      logger.info(`Channel config saved for channel ${config.channelId}`)
      return true
    } catch (error: any) {
      logger.error('Error saving channel config:', error)
      return false
    }
  }

  /**
   * Get all channel configurations
   */
  getAllConfigs(): ChannelConfig[] {
    try {
      const db = getDatabase()
      const stmt = db.prepare('SELECT id, title, config FROM channels')
      const configs: ChannelConfig[] = []

      while (stmt.step()) {
        const row = stmt.getAsObject()
        const channelId = row.id as number
        const channelName = row.title as string
        const configJson = row.config as string

        if (configJson) {
          const loadedConfig = JSON.parse(configJson) as Partial<ChannelConfig>

          // Merge with defaults to ensure all fields exist
          const config: ChannelConfig = {
            ...DEFAULT_CHANNEL_CONFIG,
            ...loadedConfig,
            channelId,
            channelName: loadedConfig.channelName || channelName,
            // Deep merge nested objects
            signalKeywords: { ...DEFAULT_CHANNEL_CONFIG.signalKeywords, ...(loadedConfig.signalKeywords || {}) },
            updateKeywords: { ...DEFAULT_CHANNEL_CONFIG.updateKeywords, ...(loadedConfig.updateKeywords || {}) },
            additionalKeywords: { ...DEFAULT_CHANNEL_CONFIG.additionalKeywords, ...(loadedConfig.additionalKeywords || {}) },
            advancedSettings: { ...DEFAULT_CHANNEL_CONFIG.advancedSettings, ...(loadedConfig.advancedSettings || {}) },
            riskSettings: { ...DEFAULT_CHANNEL_CONFIG.riskSettings, ...(loadedConfig.riskSettings || {}) },
            tradeFilters: { ...DEFAULT_CHANNEL_CONFIG.tradeFilters, ...(loadedConfig.tradeFilters || {}) },
            sltpOverride: { ...DEFAULT_CHANNEL_CONFIG.sltpOverride, ...(loadedConfig.sltpOverride || {}) },
            modification: { ...DEFAULT_CHANNEL_CONFIG.modification, ...(loadedConfig.modification || {}) },
            breakeven: { ...DEFAULT_CHANNEL_CONFIG.breakeven, ...(loadedConfig.breakeven || {}) },
            trailingStop: { ...DEFAULT_CHANNEL_CONFIG.trailingStop, ...(loadedConfig.trailingStop || {}) },
            partialClose: { ...DEFAULT_CHANNEL_CONFIG.partialClose, ...(loadedConfig.partialClose || {}) },
            symbolMapping: { ...DEFAULT_CHANNEL_CONFIG.symbolMapping, ...(loadedConfig.symbolMapping || {}) },
            timeFilter: { ...DEFAULT_CHANNEL_CONFIG.timeFilter, ...(loadedConfig.timeFilter || {}) },
            signalModifications: { ...DEFAULT_CHANNEL_CONFIG.signalModifications, ...(loadedConfig.signalModifications || {}) },
            other: { ...DEFAULT_CHANNEL_CONFIG.other, ...(loadedConfig.other || {}) },
          }

          configs.push(config)
        } else {
          // Create default config
          const defaultConfig = this.createDefaultConfig(channelId, channelName)
          configs.push(defaultConfig)
        }
      }

      stmt.free()
      return configs
    } catch (error: any) {
      logger.error('Error getting all channel configs:', error)
      return []
    }
  }

  /**
   * Create default configuration for a channel
   */
  createDefaultConfig(channelId: number, channelName: string): ChannelConfig {
    const config: ChannelConfig = {
      channelId,
      channelName,
      ...DEFAULT_CHANNEL_CONFIG,
      updatedAt: new Date().toISOString()
    }

    // Save it to database
    this.saveConfig(config)

    return config
  }

  /**
   * Reset channel configuration to defaults
   */
  resetConfig(channelId: number): boolean {
    try {
      const db = getDatabase()
      const stmt = db.prepare('SELECT title FROM channels WHERE id = ?')
      stmt.bind([channelId])

      if (stmt.step()) {
        const row = stmt.getAsObject()
        const channelName = row.title as string
        stmt.free()

        const defaultConfig = this.createDefaultConfig(channelId, channelName)
        return this.saveConfig(defaultConfig)
      }

      stmt.free()
      return false
    } catch (error: any) {
      logger.error('Error resetting channel config:', error)
      return false
    }
  }

  /**
   * Export channel configuration to JSON
   */
  exportConfig(channelId: number): string | null {
    const config = this.getConfig(channelId)
    if (config) {
      return JSON.stringify(config, null, 2)
    }
    return null
  }

  /**
   * Import channel configuration from JSON
   */
  importConfig(channelId: number, configJson: string): boolean {
    try {
      const config = JSON.parse(configJson) as ChannelConfig
      config.channelId = channelId // Ensure correct channel ID
      config.updatedAt = new Date().toISOString()
      return this.saveConfig(config)
    } catch (error: any) {
      logger.error('Error importing channel config:', error)
      return false
    }
  }

  /**
   * Update specific keywords for a channel
   */
  updateKeywords(
    channelId: number,
    keywordType: 'signal' | 'update' | 'additional',
    keywords: any
  ): boolean {
    const config = this.getConfig(channelId)
    if (!config) return false

    switch (keywordType) {
      case 'signal':
        config.signalKeywords = keywords
        break
      case 'update':
        config.updateKeywords = keywords
        break
      case 'additional':
        config.additionalKeywords = keywords
        break
    }

    config.updatedAt = new Date().toISOString()
    return this.saveConfig(config)
  }

  /**
   * Update advanced settings for a channel
   */
  updateAdvancedSettings(channelId: number, settings: any): boolean {
    const config = this.getConfig(channelId)
    if (!config) return false

    config.advancedSettings = { ...config.advancedSettings, ...settings }
    config.updatedAt = new Date().toISOString()
    return this.saveConfig(config)
  }

  /**
   * Update risk settings for a channel
   */
  updateRiskSettings(channelId: number, settings: any): boolean {
    const config = this.getConfig(channelId)
    if (!config) return false

    config.riskSettings = { ...config.riskSettings, ...settings }
    config.updatedAt = new Date().toISOString()
    return this.saveConfig(config)
  }

  /**
   * Clear requireConfirmationFor array (allow all modifications to auto-apply)
   */
  clearConfirmationRequirements(channelId: number): boolean {
    const config = this.getConfig(channelId)
    if (!config) return false

    config.signalModifications.requireConfirmationFor = []
    config.updatedAt = new Date().toISOString()
    return this.saveConfig(config)
  }
}

// Singleton instance
export const channelConfigService = new ChannelConfigService()
