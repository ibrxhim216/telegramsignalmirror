import { useState, useEffect } from 'react'
import { Mail, Lock, Loader2, Globe } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import logo from '../assets/logo.png'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [browserPending, setBrowserPending] = useState(false)
  const [error, setError] = useState('')
  const { setLoggedIn } = useAppStore()

  // Check if already logged in on mount
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const result = await window.electron.license.isLoggedIn()
        if (result.success && result.isLoggedIn) {
          setLoggedIn(true)
        }
      } catch (err: any) {
        console.error('Failed to check login status:', err)
      }
    }
    checkLoginStatus()
  }, [setLoggedIn])

  // Browser sign-in completes through a tsm://login deep link handled by the main process
  useEffect(() => {
    const offOk = window.electron.auth?.onLoggedIn(() => {
      setBrowserPending(false)
      setLoggedIn(true)
    })
    const offFail = window.electron.auth?.onLoginFailed((message) => {
      setBrowserPending(false)
      setError(message || 'Sign-in from the browser failed. Try again or use your password below.')
    })
    return () => {
      if (typeof offOk === 'function') offOk()
      if (typeof offFail === 'function') offFail()
    }
  }, [setLoggedIn])

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const result = await window.electron.license.login(email, password)
      if (!result.success) {
        setError(result.error || 'Login failed. Please check your credentials.')
        setIsLoading(false)
      } else {
        setLoggedIn(true)
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
      setIsLoading(false)
    }
  }

  const handleBrowserSignIn = async () => {
    setError('')
    setBrowserPending(true)
    const r = await window.electron.web?.openDesktopSignIn()
    if (!r?.success) {
      setBrowserPending(false)
      setError(r?.error || 'Could not open your browser.')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && email && password) {
      handleLogin()
    }
  }

  const inputClass =
    'w-full pl-11 pr-4 py-3 bg-gray-900/70 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/60 focus:border-sky-500/60 disabled:opacity-60'

  return (
    <div className="h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-md px-6">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={logo} alt="" className="w-10 h-10 object-contain" />
          <span className="text-lg font-semibold text-white">Telegram Signal Mirror</span>
        </div>

        <div className="bg-gray-800/70 p-8 rounded-2xl border border-gray-700">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white">Sign in</h1>
            <p className="text-gray-400 text-sm mt-1">Use the account you created on the website.</p>
          </div>

          <button
            onClick={handleBrowserSignIn}
            disabled={browserPending || isLoading}
            className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 disabled:bg-gray-700 disabled:text-gray-400 text-gray-950 py-3 rounded-lg font-medium transition-colors"
          >
            {browserPending ? <Loader2 className="animate-spin" size={18} /> : <Globe size={18} />}
            {browserPending ? 'Waiting for your browser…' : 'Sign in with your browser'}
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Opens telegramsignalmirror.com. If you are already logged in there, this app signs in by itself.
          </p>
          {browserPending && (
            <button
              onClick={() => setBrowserPending(false)}
              className="mt-2 w-full text-xs text-gray-400 hover:text-gray-200"
            >
              Cancel and use a password instead
            </button>
          )}

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-gray-700" />
            <span className="text-xs text-gray-500">or with password</span>
            <div className="h-px flex-1 bg-gray-700" />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="you@example.com"
                  autoComplete="off"
                  spellCheck="false"
                  className={inputClass}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="••••••••"
                  autoComplete="off"
                  spellCheck="false"
                  className={inputClass}
                  disabled={isLoading}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={!email || !password || isLoading}
              className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  Signing in…
                </>
              ) : (
                'Sign in with password'
              )}
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 text-center mt-6">
          No account yet?{' '}
          <button
            onClick={() => window.electron.web?.open('/signup')}
            className="text-sky-400 hover:text-sky-300 font-medium"
          >
            Start a free trial
          </button>
        </p>
      </div>
    </div>
  )
}
