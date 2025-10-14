import { useState, useEffect } from 'react'
import { Mail, Lock, Loader2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const { setLoggedIn } = useAppStore()

  // Check if already logged in on mount
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const result = await window.electron.license.isLoggedIn()
        if (result.success && result.isLoggedIn) {
          console.log('User is already logged in')
          setLoggedIn(true)
        }
      } catch (err: any) {
        console.error('Failed to check login status:', err)
      }
    }
    checkLoginStatus()
  }, [setLoggedIn])

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }

    console.log('Logging in with email:', email)
    setIsLoading(true)
    setError('')

    try {
      const result = await window.electron.license.login(email, password)
      console.log('Login result:', result)

      if (!result.success) {
        console.error('Login failed:', result.error)
        setError(result.error || 'Login failed. Please check your credentials.')
        setIsLoading(false)
      } else {
        console.log('Login successful!')
        setLoggedIn(true)
        // State change will trigger App.tsx to show Telegram auth
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'An unexpected error occurred')
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && email && password) {
      handleLogin()
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-gray-400">Sign in to continue to Telegram Signal Mirror</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="your@email.com"
                className="w-full pl-11 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={!email || !password || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          <div className="text-center pt-4">
            <p className="text-sm text-gray-400">
              Don't have an account?{' '}
              <a
                href="https://telegramsignalmirror.com/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-400 font-medium"
              >
                Sign up
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
