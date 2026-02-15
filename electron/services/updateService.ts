import { EventEmitter } from 'events'
import { logger } from '../utils/logger'
import { app } from 'electron'
import https from 'https'
import http from 'http'

export interface UpdateInfo {
  latestVersion: string
  releaseDate: string
  downloadUrl: string
  releaseNotes: string
  updateAvailable: boolean
}

export class UpdateService extends EventEmitter {
  private apiUrl: string
  private currentVersion: string
  private checkInterval: NodeJS.Timeout | null = null
  private hasNotifiedUpdate: boolean = false

  constructor() {
    super()
    this.apiUrl = process.env.API_SERVER_URL || 'https://telegramsignalmirror.com'
    this.currentVersion = app.getVersion()
    logger.info(`Update Service initialized. Current version: ${this.currentVersion}`)
  }

  /**
   * Check for updates manually
   */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      logger.info('Checking for updates...')

      const url = `${this.apiUrl}/api/app/version?version=${this.currentVersion}`
      const response = await this.makeHttpRequest(url)

      if (!response.success) {
        logger.error('Failed to check for updates:', response.error)
        return null
      }

      const updateInfo: UpdateInfo = {
        latestVersion: response.latestVersion,
        releaseDate: response.releaseDate,
        downloadUrl: response.downloadUrl,
        releaseNotes: response.releaseNotes,
        updateAvailable: response.updateAvailable
      }

      if (updateInfo.updateAvailable) {
        logger.info(`Update available: ${updateInfo.latestVersion} (current: ${this.currentVersion})`)
        this.emit('update-available', updateInfo)
      } else {
        logger.info('App is up to date')
        this.emit('update-not-available', updateInfo)
      }

      return updateInfo
    } catch (error: any) {
      logger.error('Error checking for updates:', error)
      this.emit('error', error.message)
      return null
    }
  }

  /**
   * Start automatic update checks (every 6 hours)
   */
  startAutoUpdateCheck() {
    if (this.checkInterval) {
      return // Already running
    }

    // Check on startup
    setTimeout(() => {
      this.checkForUpdates()
    }, 10000) // Check 10 seconds after startup

    // Check every 6 hours
    this.checkInterval = setInterval(() => {
      this.checkForUpdates()
    }, 6 * 60 * 60 * 1000)

    logger.info('Auto-update checks enabled (every 6 hours)')
  }

  /**
   * Stop automatic update checks
   */
  stopAutoUpdateCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      logger.info('Auto-update checks disabled')
    }
  }

  /**
   * Download update (opens download URL in browser)
   */
  downloadUpdate(downloadUrl: string) {
    try {
      const { shell } = require('electron')
      shell.openExternal(downloadUrl)
      logger.info('Opened download URL in browser')
    } catch (error: any) {
      logger.error('Error opening download URL:', error)
    }
  }

  /**
   * Make HTTP/HTTPS request
   */
  private makeHttpRequest(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http

      const request = protocol.get(url, (response) => {
        let data = ''

        response.on('data', (chunk) => {
          data += chunk
        })

        response.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            resolve(parsed)
          } catch (error) {
            reject(new Error('Failed to parse response'))
          }
        })
      })

      request.on('error', (error) => {
        reject(error)
      })

      request.setTimeout(10000, () => {
        request.destroy()
        reject(new Error('Request timeout'))
      })
    })
  }

  /**
   * Get current app version
   */
  getCurrentVersion(): string {
    return this.currentVersion
  }
}
