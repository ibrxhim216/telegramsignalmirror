import { useState, useEffect } from 'react'
import { X, Download, RefreshCw } from 'lucide-react'

interface UpdateInfo {
  latestVersion: string
  releaseDate: string
  downloadUrl: string
  releaseNotes: string
  updateAvailable: boolean
  canAutoInstall?: boolean
}

interface Progress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

/**
 * Installed copies: "Downloading…" progress, then "Restart to update".
 * Portable copies: "Update available" with a Download button that opens the website.
 */
export default function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [downloaded, setDownloaded] = useState<UpdateInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // An update may have finished downloading before this component mounted
    window.electron?.update?.getStatus?.().then((s) => {
      if (s?.success && s.downloaded) setDownloaded(s.downloaded)
    }).catch(() => {})

    const offAvailable = window.electron?.update?.onUpdateAvailable((info: UpdateInfo) => {
      setUpdateInfo(info)
      setDismissed(false)
    })
    const offProgress = window.electron?.update?.onUpdateProgress?.((p) => setProgress(p))
    const offDownloaded = window.electron?.update?.onUpdateDownloaded?.((info: UpdateInfo) => {
      setDownloaded(info)
      setProgress(null)
      setDismissed(false)
    })
    return () => {
      offAvailable?.()
      offProgress?.()
      offDownloaded?.()
    }
  }, [])

  const handleInstall = async () => {
    setInstalling(true)
    const r = await window.electron?.update?.install?.()
    if (!r?.success) setInstalling(false)
  }

  const handleDownload = () => {
    if (updateInfo) {
      window.electron?.update?.download(updateInfo.downloadUrl)
      setShowDialog(false)
    }
  }

  if (dismissed) return null

  // 1) Ready to install (installed build)
  if (downloaded) {
    return (
      <div className="bg-emerald-600/90 text-white px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <RefreshCw size={18} />
          <span>
            <span className="font-semibold">Version {downloaded.latestVersion} is ready.</span> Restart to update. Signal
            copying pauses for about ten seconds while the app restarts.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstall}
            disabled={installing}
            className="px-3 py-1.5 bg-white text-emerald-700 rounded-md text-sm font-medium hover:bg-emerald-50 disabled:opacity-60"
          >
            {installing ? 'Restarting…' : 'Restart now'}
          </button>
          <button onClick={() => setDismissed(true)} className="p-1.5 hover:bg-emerald-700 rounded-md" title="Later (installs on next quit)">
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  // 2) Downloading (installed build)
  if (progress && updateInfo?.canAutoInstall) {
    return (
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-2 text-sm text-gray-300 flex items-center gap-3">
        <Download size={16} className="text-sky-400" />
        <span>Downloading version {updateInfo.latestVersion}… {Math.round(progress.percent)}%</span>
        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden max-w-xs">
          <div className="h-full bg-sky-500" style={{ width: `${Math.min(100, progress.percent)}%` }} />
        </div>
      </div>
    )
  }

  if (!updateInfo || !updateInfo.updateAvailable) return null

  // 3) Installed build, update found but download not yet started: quiet line
  if (updateInfo.canAutoInstall) {
    return (
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-2 text-sm text-gray-300 flex items-center gap-3">
        <Download size={16} className="text-sky-400" />
        Version {updateInfo.latestVersion} is available and will download in the background.
      </div>
    )
  }

  // 4) Portable build: manual download
  return (
    <>
      <div className="bg-sky-600 text-white px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <Download size={18} />
          <span>
            <span className="font-semibold">Version {updateInfo.latestVersion} is available.</span> You are running the
            portable version, so download it from the website and replace this file.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDialog(true)}
            className="px-3 py-1.5 bg-white text-sky-700 rounded-md text-sm font-medium hover:bg-sky-50"
          >
            What's new
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 bg-sky-800 text-white rounded-md text-sm font-medium hover:bg-sky-900"
          >
            Download
          </button>
          <button onClick={() => setDismissed(true)} className="p-1.5 hover:bg-sky-700 rounded-md" title="Dismiss">
            <X size={16} />
          </button>
        </div>
      </div>

      {showDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-xl w-full max-h-[80vh] overflow-hidden border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Version {updateInfo.latestVersion}</h2>
                {updateInfo.releaseDate && (
                  <p className="text-xs text-gray-400">Released {new Date(updateInfo.releaseDate).toLocaleDateString()}</p>
                )}
              </div>
              <button onClick={() => setShowDialog(false)} className="p-2 hover:bg-gray-700 rounded-lg text-gray-300">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-80">
              <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans">{updateInfo.releaseNotes}</pre>
            </div>
            <div className="px-6 py-4 bg-gray-900 border-t border-gray-700 flex items-center justify-between gap-4">
              <p className="text-xs text-gray-400">
                Tip: install the setup version from the website once and future updates install themselves.
              </p>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setShowDialog(false)} className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600">
                  Later
                </button>
                <button onClick={handleDownload} className="px-4 py-2 bg-sky-500 text-gray-950 rounded-lg text-sm font-medium hover:bg-sky-400 flex items-center gap-2">
                  <Download size={16} />
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
