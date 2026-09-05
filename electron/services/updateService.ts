import { EventEmitter } from 'events'
import { app, shell } from 'electron'
import https from 'https'
import http from 'http'
import { autoUpdater } from 'electron-updater'
import { logger } from '../utils/logger'

export interface UpdateInfo {
  latestVersion: string
  releaseDate: string
  downloadUrl: string
  releaseNotes: string
  updateAvailable: boolean
  /** true when the app can install the update itself (installer build); false for the portable exe */
  canAutoInstall: boolean
}

export interface DownloadProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

/**
 * Two update paths:
 *  - Installed build (NSIS): electron-updater downloads the new installer in the background and
 *    installs it on restart. Emits 'update-available', 'update-progress', 'update-downloaded'.
 *  - Portable exe: cannot replace itself, so we only tell the user and open the download page.
 */
export class UpdateService extends EventEmitter {
  private apiUrl: string
  private currentVersion: string
  private checkInterval: NodeJS.Timeout | null = null
  private downloaded: UpdateInfo | null = null

  constructor() {
    super()
    this.apiUrl = process.env.API_SERVER_URL || process.env.VITE_API_URL || 'https://www.telegramsignalmirror.com'
    this.currentVersion = app.getVersion()
    logger.info(`Update Service initialized. Current version: ${this.currentVersion} (${this.isPortable() ? 'portable' : 'installed'})`)

    if (this.usesAutoUpdater()) {
      this.configureAutoUpdater()
    }
  }

  /** electron-builder's portable launcher sets this; the installed build does not. */
  isPortable(): boolean {
    return !!process.env.PORTABLE_EXECUTABLE_DIR
  }

  private usesAutoUpdater(): boolean {
    return app.isPackaged && !this.isPortable()
  }

  private configureAutoUpdater() {
    autoUpdater.logger = {
      info: (m: any) => logger.info(`[AutoUpdater] ${m}`),
      warn: (m: any) => logger.warn(`[AutoUpdater] ${m}`),
      error: (m: any) => logger.error(`[AutoUpdater] ${m}`),
      debug: (m: any) => logger.debug(`[AutoUpdater] ${m}`),
    } as any
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowDowngrade = false

    autoUpdater.on('update-available', (info) => {
      const update: UpdateInfo = {
        latestVersion: info.version,
        releaseDate: info.releaseDate || '',
        downloadUrl: `${this.apiUrl}/dashboard/downloads`,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
        updateAvailable: true,
        canAutoInstall: true,
      }
      logger.info(`Update available (auto-install): v${info.version}`)
      this.emit('update-available', update)
    })
    autoUpdater.on('update-not-available', (info) => {
      this.emit('update-not-available', {
        latestVersion: info.version,
        releaseDate: info.releaseDate || '',
        downloadUrl: '',
        releaseNotes: '',
        updateAvailable: false,
        canAutoInstall: true,
      } as UpdateInfo)
    })
    autoUpdater.on('download-progress', (p) => {
      this.emit('update-progress', {
        percent: p.percent,
        transferred: p.transferred,
        total: p.total,
        bytesPerSecond: p.bytesPerSecond,
      } as DownloadProgress)
    })
    autoUpdater.on('update-downloaded', (info) => {
      this.downloaded = {
        latestVersion: info.version,
        releaseDate: info.releaseDate || '',
        downloadUrl: '',
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
        updateAvailable: true,
        canAutoInstall: true,
      }
      logger.info(`Update downloaded: v${info.version} - will install on restart`)
      this.emit('update-downloaded', this.downloaded)
    })
    autoUpdater.on('error', (err) => {
      logger.error(`[AutoUpdater] ${err?.message || err}`)
      this.emit('error', err?.message || String(err))
    })
  }

  /**
   * Check for updates. Installed builds use electron-updater; the portable exe asks the website.
   */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    if (this.usesAutoUpdater()) {
      try {
        const result = await autoUpdater.checkForUpdates()
        if (!result) return null
        const version = result.updateInfo.version
        return {
          latestVersion: version,
          releaseDate: result.updateInfo.releaseDate || '',
          downloadUrl: '',
          releaseNotes: typeof result.updateInfo.releaseNotes === 'string' ? result.updateInfo.releaseNotes : '',
          updateAvailable: this.isNewer(version, this.currentVersion),
          canAutoInstall: true,
        }
      } catch (error: any) {
        logger.error('Auto-update check failed:', error)
        this.emit('error', error.message)
        return null
      }
    }

    // Portable / dev: compare against the website's version endpoint
    try {
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
        // Only flag genuinely newer versions (the old check fired for ANY difference)
        updateAvailable: this.isNewer(response.latestVersion, this.currentVersion),
        canAutoInstall: false,
      }
      if (updateInfo.updateAvailable) {
        logger.info(`Update available: ${updateInfo.latestVersion} (current: ${this.currentVersion})`)
        this.emit('update-available', updateInfo)
      } else {
        this.emit('update-not-available', updateInfo)
      }
      return updateInfo
    } catch (error: any) {
      logger.error('Error checking for updates:', error)
      this.emit('error', error.message)
      return null
    }
  }

  /** Semver-ish comparison: is `a` newer than `b`? */
  private isNewer(a: string, b: string): boolean {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0)
    const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i] || 0
      const y = pb[i] || 0
      if (x !== y) return x > y
    }
    return false
  }

  /** Start automatic update checks (10s after launch, then every 6 hours). */
  startAutoUpdateCheck() {
    if (this.checkInterval) return
    setTimeout(() => this.checkForUpdates(), 10000)
    this.checkInterval = setInterval(() => this.checkForUpdates(), 6 * 60 * 60 * 1000)
    logger.info('Auto-update checks enabled (every 6 hours)')
  }

  stopAutoUpdateCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  /** Portable builds: open the download page in the browser. */
  downloadUpdate(downloadUrl: string) {
    try {
      shell.openExternal(downloadUrl || `${this.apiUrl}/dashboard/downloads`)
    } catch (error: any) {
      logger.error('Error opening download URL:', error)
    }
  }

  /** Installed builds: quit and run the downloaded installer. */
  installDownloadedUpdate(): boolean {
    if (!this.downloaded) {
      logger.warn('installDownloadedUpdate called but nothing has been downloaded')
      return false
    }
    logger.info(`Installing update v${this.downloaded.latestVersion} and restarting`)
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
    return true
  }

  hasDownloadedUpdate(): UpdateInfo | null {
    return this.downloaded
  }

  private makeHttpRequest(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http
      const request = protocol.get(url, (response) => {
        let data = ''
        response.on('data', (chunk) => { data += chunk })
        response.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            reject(new Error('Failed to parse response'))
          }
        })
      })
      request.on('error', reject)
      request.setTimeout(10000, () => {
        request.destroy()
        reject(new Error('Request timeout'))
      })
    })
  }

  getCurrentVersion(): string {
    return this.currentVersion
  }
}
