import { useState, useEffect } from 'react'
import { X, Download, ExternalLink } from 'lucide-react'

interface UpdateInfo {
  latestVersion: string
  releaseDate: string
  downloadUrl: string
  releaseNotes: string
  updateAvailable: boolean
}

export default function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [showDialog, setShowDialog] = useState(false)

  useEffect(() => {
    // Listen for update notifications from main process
    const handleUpdateAvailable = (_event: any, info: UpdateInfo) => {
      setUpdateInfo(info)
      setShowBanner(true)
    }

    // @ts-ignore - window.electron is added by preload
    window.electron?.on('update-available', handleUpdateAvailable)

    return () => {
      // @ts-ignore
      window.electron?.off('update-available', handleUpdateAvailable)
    }
  }, [])

  const handleDownload = () => {
    if (updateInfo) {
      // @ts-ignore
      window.electron?.downloadUpdate(updateInfo.downloadUrl)
      setShowBanner(false)
      setShowDialog(false)
    }
  }

  const handleShowDetails = () => {
    setShowDialog(true)
  }

  const handleDismiss = () => {
    setShowBanner(false)
  }

  if (!updateInfo || !updateInfo.updateAvailable) {
    return null
  }

  return (
    <>
      {/* Update Banner */}
      {showBanner && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <Download className="animate-bounce" size={20} />
            <div>
              <p className="font-semibold">
                Update Available: v{updateInfo.latestVersion}
              </p>
              <p className="text-sm text-blue-100">
                Click to see what's new and download
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShowDetails}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              View Details
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 hover:bg-blue-600 rounded-lg transition-colors"
              title="Dismiss"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Update Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download size={24} />
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Update Available
                  </h2>
                  <p className="text-sm text-blue-100">
                    Version {updateInfo.latestVersion} - Released {new Date(updateInfo.releaseDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDialog(false)}
                className="p-2 hover:bg-blue-600 rounded-lg transition-colors text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Release Notes */}
            <div className="p-6 overflow-y-auto max-h-96">
              <div className="prose prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans">
                  {updateInfo.releaseNotes}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-900 border-t border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                <p className="font-medium mb-1">How to update:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Download the new version</li>
                  <li>Close this app</li>
                  <li>Extract and replace the old .exe file</li>
                  <li>Restart the app</li>
                </ol>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDialog(false)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Later
                </button>
                <button
                  onClick={handleDownload}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2 font-medium"
                >
                  <Download size={18} />
                  Download Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
