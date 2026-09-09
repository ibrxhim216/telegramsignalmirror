import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { CheckCircle2, Circle, AlertTriangle, ChevronDown, ChevronUp, Download, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  isMonitoring: boolean
}

type RowState = 'ok' | 'warn' | 'todo'

interface Row {
  key: string
  label: string
  state: RowState
  detail: string
  action?: React.ReactNode
}

interface Terminal { id: string; platform: 'MT4' | 'MT5'; expertsPath: string; broker?: string; alreadyInstalled: boolean }

/**
 * Setup checklist + weekly health card shown at the top of the dashboard.
 * Goal: a new user can see which of the setup steps is the broken one, and an existing user
 * can see at a glance that signals are flowing. Collapses itself once everything is green.
 */
export default function SetupChecklist({ isMonitoring }: Props) {
  const { activeChannels, channels } = useAppStore()

  const [telegramOk, setTelegramOk] = useState<boolean | null>(null)
  const [configured, setConfigured] = useState<{ total: number; done: number }>({ total: 0, done: 0 })
  const [accounts, setAccounts] = useState<{ account_number: string; platform: string; is_active: number }[]>([])
  // Routing: which website accounts THIS app's signals go to (none ticked = all of them).
  const [webAccounts, setWebAccounts] = useState<{ accountNumber: string; platform: string; accountName: string | null; isActive: boolean }[]>([])
  const [targets, setTargets] = useState<string[]>([])
  const [targetError, setTargetError] = useState<string | null>(null)
  const loadTargeting = () => {
    window.electron.cloudSync?.getTargeting?.().then((r: any) => {
      if (!r?.success) return
      setWebAccounts(r.webAccounts || [])
      setTargets(r.selected || [])
      setTargetError(r.error || null)
    }).catch(() => {})
  }
  // Website accounts can change at any time (added/removed in the portal): reload every minute and on the refresh icon.
  useEffect(() => {
    loadTargeting()
    const t = setInterval(loadTargeting, 60000)
    return () => clearInterval(t)
  }, [])
  // Empty selection means "all accounts, including ones added later" and shows every box ticked.
  // Unticking one stores an explicit list; ticking everything again returns to "all".
  const allNumbers = webAccounts.map(a => a.accountNumber)
  const isTicked = (n: string) => targets.length === 0 || targets.includes(n)
  const toggleTarget = async (accountNumber: string) => {
    const current = targets.length === 0 ? allNumbers : targets
    let next = current.includes(accountNumber) ? current.filter(a => a !== accountNumber) : [...current, accountNumber]
    if (allNumbers.every(n => next.includes(n))) next = []
    setTargets(next)
    await window.electron.cloudSync.setTargeting(next)
  }
  const [polling, setPolling] = useState<{ accountNumber: string; secondsAgo: number }[]>([])
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [installing, setInstalling] = useState(false)
  const [showWebRequest, setShowWebRequest] = useState(false)
  const [stats, setStats] = useState<{ received: number; newSignals: number; updates: number; skipped: number; executed: number } | null>(null)
  const [collapsed, setCollapsed] = useState<boolean | null>(null) // null = decide automatically
  const [refreshing, setRefreshing] = useState(false)
  const [autoLaunch, setAutoLaunch] = useState<{ supported: boolean; enabled: boolean } | null>(null)

  useEffect(() => {
    window.electron.app?.getAutoLaunch?.().then((r) => {
      if (r?.success) setAutoLaunch({ supported: r.supported, enabled: r.enabled })
    }).catch(() => {})
  }, [])

  const toggleAutoLaunch = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!autoLaunch) return
    const next = !autoLaunch.enabled
    const r = await window.electron.app?.setAutoLaunch?.(next)
    if (r?.success) setAutoLaunch({ ...autoLaunch, enabled: next })
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      const [tg, ea, st, term] = await Promise.all([
        window.electron.telegram.isConnected().catch(() => ({ connected: false } as any)),
        window.electron.ea.status().catch(() => ({ success: false } as any)),
        window.electron.stats.weekly().catch(() => ({ success: false } as any)),
        window.electron.ea.detectTerminals().catch(() => ({ success: false } as any)),
      ])
      setTelegramOk(!!(tg as any)?.isConnected)
      if (ea?.success) {
        setAccounts(ea.accounts || [])
        setPolling(ea.polling || [])
      }
      if (st?.success && st.stats) setStats(st.stats)
      if (term?.success) setTerminals(term.terminals || [])

      // Channel configured = has any signal keyword OR uses Smart Parse (splitEntryMode)
      let done = 0
      for (const id of activeChannels) {
        try {
          const r = await window.electron.channelConfig.getConfig(id)
          const c = r?.config
          const hasKeywords = c && ['buy', 'sell', 'stopLoss', 'takeProfit', 'entryPoint']
            .some(k => Array.isArray(c.signalKeywords?.[k]) && c.signalKeywords[k].length > 0)
          if (hasKeywords || c?.advancedSettings?.splitEntryMode) done++
        } catch { /* ignore */ }
      }
      setConfigured({ total: activeChannels.length, done })
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 10000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannels.join(','), isMonitoring])

  const handleInstall = async () => {
    const targets = terminals.filter(t => !t.alreadyInstalled).map(t => t.id)
    if (targets.length === 0) return
    setInstalling(true)
    try {
      const r = await window.electron.ea.install(targets)
      if (r.success) {
        alert(`EA installed to ${r.installed?.length || 0} terminal(s):\n${(r.installed || []).map(i => i.path).join('\n')}\n\nIn MetaTrader: refresh the Navigator, then attach "TelegramSignalMirror" to a chart.`)
        await refresh()
      } else {
        alert('Install failed: ' + (r.error || 'Unknown error'))
      }
    } finally {
      setInstalling(false)
    }
  }

  // ── Derive rows ──────────────────────────────────────────────────────────────
  const recentPoll = polling.find(p => p.secondsAgo <= 15)
  const rows: Row[] = [
    {
      key: 'telegram',
      label: 'Telegram connected',
      state: telegramOk === null ? 'todo' : telegramOk ? 'ok' : 'todo',
      detail: telegramOk ? 'Signed in and receiving updates' : 'Sign in with your phone number to start',
    },
    {
      key: 'channels',
      label: 'Channels selected and monitoring',
      state: isMonitoring && activeChannels.length > 0 ? 'ok' : activeChannels.length > 0 ? 'warn' : 'todo',
      detail: activeChannels.length === 0
        ? 'Tick at least one channel in the list on the left'
        : isMonitoring
          ? `Monitoring ${activeChannels.length} of ${channels.length} channel(s)`
          : `${activeChannels.length} selected — press Start Monitoring`,
    },
    {
      key: 'config',
      label: 'Channel configured',
      state: configured.total === 0 ? 'todo' : configured.done === configured.total ? 'ok' : 'warn',
      detail: configured.total === 0
        ? 'Select a channel first'
        : configured.done === configured.total
          ? `${configured.done} of ${configured.total} channel(s) have keywords or Smart Parse`
          : `${configured.total - configured.done} channel(s) have no keywords yet — open the channel's settings and use Auto-configure`,
    },
    {
      key: 'account',
      label: 'Trading account registered',
      state: (accounts.some(a => a.is_active) || webAccounts.some(a => a.isActive)) ? 'ok' : 'todo',
      detail: accounts.length > 0
        ? accounts.map(a => `${a.account_number} (${a.platform})`).join(', ')
        : webAccounts.length > 0
          ? `${webAccounts.length} account(s) on your website profile`
          : 'Appears automatically the first time your EA polls, or add it on the website',
      action: (
        <div className="space-y-1">
          {webAccounts.length > 0 ? (
            <>
              <div className="text-[11px] uppercase tracking-wide text-gray-500">This app sends signals to</div>
              {webAccounts.map(a => (
                <label key={a.accountNumber} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer" title="Untick an account to stop this copy of the app sending to it.">
                  <input type="checkbox" checked={isTicked(a.accountNumber)} onChange={() => toggleTarget(a.accountNumber)} />
                  <span>{a.accountNumber} <span className="text-gray-500">({a.platform}{a.accountName ? ` · ${a.accountName}` : ''}{a.isActive ? '' : ' · inactive'})</span></span>
                </label>
              ))}
              <div className="text-[11px] text-gray-500">{targets.length === 0 ? 'All accounts receive this app’s signals, including any you add later. Untick one to leave it out.' : `Only the ${targets.length} ticked account(s) receive this app’s signals.`}</div>
            </>
          ) : (
            <button
              onClick={() => window.electron.web?.open('/dashboard/trading-accounts')}
              className="text-xs text-gray-400 hover:text-gray-200 underline"
            >
              {targetError ? `Could not load website accounts (${targetError}) — open website` : 'Add on website'}
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'ea',
      label: 'EA installed and polling',
      state: recentPoll ? 'ok' : terminals.some(t => t.alreadyInstalled) ? 'warn' : 'todo',
      detail: recentPoll
        ? `EA on account ${recentPoll.accountNumber} polled ${recentPoll.secondsAgo}s ago`
        : terminals.some(t => t.alreadyInstalled)
          ? 'EA file is installed but no poll seen here. If your EA points at the cloud, check its status on the website. Otherwise check WebRequest below.'
          : terminals.length > 0
            ? `Found ${terminals.length} MetaTrader terminal(s) — install the EA with one click`
            : 'No MetaTrader data folder found on this machine (that is fine if MT runs on a VPS)',
      action: (
        <div className="flex items-center gap-2">
          {terminals.some(t => !t.alreadyInstalled) && (
            <button
              onClick={handleInstall}
              disabled={installing}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 text-white rounded"
            >
              <Download size={12} /> {installing ? 'Installing…' : 'Install EA to MT'}
            </button>
          )}
          <button
            onClick={() => setShowWebRequest(v => !v)}
            className="text-xs text-gray-400 hover:text-gray-200 underline"
          >
            WebRequest steps
          </button>
        </div>
      ),
    },
  ]

  const allOk = rows.every(r => r.state === 'ok')
  const isCollapsed = collapsed === null ? allOk : collapsed

  const Icon = ({ state }: { state: RowState }) =>
    state === 'ok' ? <CheckCircle2 className="text-green-400 shrink-0" size={18} />
      : state === 'warn' ? <AlertTriangle className="text-amber-400 shrink-0" size={18} />
        : <Circle className="text-gray-600 shrink-0" size={18} />

  return (
    <div className="mx-6 mt-3 bg-gray-800/60 border border-gray-700 rounded-xl">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">Setup</span>
          <span className={clsx('text-xs px-2 py-0.5 rounded-full',
            allOk ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300')}>
            {rows.filter(r => r.state === 'ok').length}/{rows.length} ready
          </span>
          {stats && (
            <span className="text-xs text-gray-400 hidden md:inline">
              · Last 7 days: <span className="text-gray-200">{stats.newSignals}</span> signals,{' '}
              <span className="text-gray-200">{stats.updates}</span> updates,{' '}
              <span className="text-gray-200">{stats.executed}</span> executed,{' '}
              <span className={stats.skipped > 0 ? 'text-amber-300' : 'text-gray-200'}>{stats.skipped}</span> skipped
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {autoLaunch?.supported && (
            <span
              role="button"
              onClick={toggleAutoLaunch}
              title="Launch the app when Windows starts so a reboot does not stop signal copying"
              className={clsx('flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border',
                autoLaunch.enabled ? 'text-green-300 border-green-500/30 bg-green-500/10' : 'text-gray-400 border-gray-700 hover:text-gray-200')}
            >
              <span className={clsx('w-1.5 h-1.5 rounded-full', autoLaunch.enabled ? 'bg-green-400' : 'bg-gray-600')} />
              Start with Windows: {autoLaunch.enabled ? 'on' : 'off'}
            </span>
          )}
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); refresh(); loadTargeting() }}
            className="text-gray-500 hover:text-gray-300"
            title="Refresh"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </span>
          {isCollapsed ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
        </div>
      </button>

      {/* Rows */}
      {!isCollapsed && (
        <div className="px-4 pb-4 space-y-2">
          {rows.map(r => (
            <div key={r.key} className="flex items-start gap-3 bg-gray-900/40 rounded-lg px-3 py-2">
              <Icon state={r.state} />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white">{r.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{r.detail}</div>
                {r.key === 'ea' && showWebRequest && (
                  <div className="mt-2 text-xs text-gray-300 bg-gray-900 rounded p-3 space-y-1">
                    <div className="font-semibold text-gray-200">Allow the EA to reach the server (one-time, in MetaTrader):</div>
                    <ol className="list-decimal list-inside space-y-0.5 text-gray-400">
                      <li>Tools → Options → Expert Advisors</li>
                      <li>Tick <span className="text-gray-200">Allow WebRequest for listed URL</span></li>
                      <li>Add <span className="text-gray-200 font-mono">https://www.telegramsignalmirror.com</span> and click OK</li>
                      <li>Attach <span className="text-gray-200">TelegramSignalMirror</span> to a chart and enable AutoTrading</li>
                    </ol>
                    <div className="text-gray-500">Without this, the EA stays silent and never receives signals — it is the most common setup issue.</div>
                  </div>
                )}
              </div>
              {r.action && <div className="shrink-0">{r.action}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
