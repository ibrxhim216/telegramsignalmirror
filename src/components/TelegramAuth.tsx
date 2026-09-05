import { useState, useEffect } from 'react'
import { Phone, Lock, KeyRound, Loader2 } from 'lucide-react'
import logo from '../assets/logo.png'

type Step = 'checking' | 'reconnecting' | 'phone' | 'code' | 'password'

/**
 * Telegram sign-in. On a normal restart the saved session is restored by the main process, so
 * this screen only shows a short "Reconnecting" state. The phone / code / 2FA-password steps are
 * for first-time setup or after the session was revoked.
 */
export default function TelegramAuth() {
  const [step, setStep] = useState<Step>('checking')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Decide what to show: reconnecting (saved session) or the phone form
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const savedPhone = localStorage.getItem('telegram_phone_number')
      if (savedPhone) setPhoneNumber(savedPhone)
      try {
        const info = await window.electron.telegram.getSessionInfo?.()
        if (cancelled) return
        if (info?.success && info.hasSavedSession) {
          if (info.phone) setPhoneNumber(info.phone)
          setStep(info.isConnecting || info.isConnected ? 'reconnecting' : 'reconnecting')
          // If the main process did not start a reconnect (older build), kick it off
          if (!info.isConnecting && !info.isConnected && info.phone) {
            window.electron.telegram.connect(info.phone).catch(() => {})
          }
          // Safety valve: if nothing happens for a while, let the user take over
          setTimeout(() => {
            if (!cancelled) setStep((s) => (s === 'reconnecting' ? 'phone' : s))
          }, 25000)
        } else {
          setStep('phone')
        }
      } catch {
        if (!cancelled) setStep('phone')
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const offCode = window.electron.telegram.onCodeRequired(() => {
      setStep('code')
      setIsLoading(false)
    })
    const offPassword = window.electron.telegram.onPasswordRequired?.(() => {
      setStep('password')
      setIsLoading(false)
    })
    const offError = window.electron.telegram.onError((message) => {
      setError(message)
      setIsLoading(false)
      setStep((s) => (s === 'reconnecting' ? 'phone' : s))
    })
    return () => {
      if (typeof offCode === 'function') offCode()
      if (typeof offPassword === 'function') offPassword()
      if (typeof offError === 'function') offError()
    }
  }, [])

  const handleConnect = async () => {
    localStorage.setItem('telegram_phone_number', phoneNumber)
    setIsLoading(true)
    setError('')
    try {
      const result = await window.electron.telegram.connect(phoneNumber)
      if (!result.success) {
        setError(result.error || 'Connection failed')
        setIsLoading(false)
      }
      // On success we stay in the loading state until codeRequired / passwordRequired / connected fires
    } catch (err: any) {
      setError(err.message || 'Connection failed')
      setIsLoading(false)
    }
  }

  const handleSubmitCode = async () => {
    setIsLoading(true)
    setError('')
    try {
      const result = await window.electron.telegram.sendCode(code)
      if (!result.success) {
        setError(result.error || 'Invalid code')
        setIsLoading(false)
      }
    } catch (err: any) {
      setError(err.message || 'Invalid code')
      setIsLoading(false)
    }
  }

  const handleSubmitPassword = async () => {
    setIsLoading(true)
    setError('')
    try {
      const result = await window.electron.telegram.sendPassword(password)
      if (!result.success) {
        setError(result.error || 'Wrong password')
        setIsLoading(false)
      }
    } catch (err: any) {
      setError(err.message || 'Wrong password')
      setIsLoading(false)
    }
  }

  const inputClass =
    'w-full pl-11 pr-4 py-3 bg-gray-900/70 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/60 focus:border-sky-500/60 disabled:opacity-60'
  const buttonClass =
    'w-full bg-sky-500 hover:bg-sky-400 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-gray-950 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2'

  return (
    <div className="h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-md px-6">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={logo} alt="" className="w-10 h-10 object-contain" />
          <span className="text-lg font-semibold text-white">Telegram Signal Mirror</span>
        </div>

        <div className="bg-gray-800/70 p-8 rounded-2xl border border-gray-700">
          {(step === 'checking' || step === 'reconnecting') && (
            <div className="text-center py-6">
              <Loader2 className="mx-auto animate-spin text-sky-400 mb-4" size={32} />
              <h1 className="text-xl font-semibold text-white">
                {step === 'checking' ? 'Checking Telegram session…' : 'Reconnecting to Telegram'}
              </h1>
              <p className="text-gray-400 text-sm mt-2">
                {step === 'reconnecting'
                  ? 'Restoring your saved session. This usually takes a few seconds.'
                  : 'One moment.'}
              </p>
              {step === 'reconnecting' && (
                <button
                  onClick={() => setStep('phone')}
                  className="mt-6 text-xs text-gray-400 hover:text-gray-200"
                >
                  Use a different phone number
                </button>
              )}
            </div>
          )}

          {step === 'phone' && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-white">Connect Telegram</h1>
                <p className="text-gray-400 text-sm mt-1">
                  Sign in with the Telegram account that is a member of your signal channels. Telegram sends a
                  code to your Telegram app; we never see your password.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Phone number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && phoneNumber && !isLoading && handleConnect()}
                      placeholder="+44 7700 900123"
                      className={inputClass}
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Include the country code, for example +1 or +44.</p>
                </div>
                {error && <ErrorBox message={error} />}
                <button onClick={handleConnect} disabled={!phoneNumber || isLoading} className={buttonClass}>
                  {isLoading && <Loader2 className="animate-spin" size={18} />}
                  {isLoading ? 'Connecting…' : 'Send code'}
                </button>
              </div>
            </>
          )}

          {step === 'code' && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-white">Enter the code</h1>
                <p className="text-gray-400 text-sm mt-1">
                  Telegram sent a login code to your Telegram app (not by SMS). Check your Telegram messages.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Verification code</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={code}
                      onChange={(e) => setCode(e.target.value.trim())}
                      onKeyDown={(e) => e.key === 'Enter' && code && !isLoading && handleSubmitCode()}
                      placeholder="12345"
                      className={inputClass}
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                </div>
                {error && <ErrorBox message={error} />}
                <button onClick={handleSubmitCode} disabled={!code || isLoading} className={buttonClass}>
                  {isLoading && <Loader2 className="animate-spin" size={18} />}
                  {isLoading ? 'Verifying…' : 'Verify code'}
                </button>
              </div>
            </>
          )}

          {step === 'password' && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-white">Two-step verification</h1>
                <p className="text-gray-400 text-sm mt-1">
                  Your Telegram account has a cloud password. Enter it to finish signing in. It is sent straight to
                  Telegram and is not stored by this app.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Telegram password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && password && !isLoading && handleSubmitPassword()}
                      placeholder="••••••••"
                      className={inputClass}
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                </div>
                {error && <ErrorBox message={error} />}
                <button onClick={handleSubmitPassword} disabled={!password || isLoading} className={buttonClass}>
                  {isLoading && <Loader2 className="animate-spin" size={18} />}
                  {isLoading ? 'Signing in…' : 'Continue'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg text-sm">{message}</div>
  )
}
