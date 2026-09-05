import { PlatformAdapter, PlatformId } from './types'
import { TradeLockerAdapter } from './tradelockerAdapter'
import { CTraderAdapter } from './ctraderAdapter'
import { MatchTraderAdapter } from './matchtraderAdapter'
import { DXtradeAdapter } from './dxtradeAdapter'
import { OandaAdapter } from './oandaAdapter'
import { BybitAdapter } from './bybitAdapter'
import { IGAdapter } from './igAdapter'

export * from './types'

type AdapterFactory = () => PlatformAdapter

const REGISTRY: Record<PlatformId, AdapterFactory> = {
  tradelocker: () => new TradeLockerAdapter(),
  ctrader: () => new CTraderAdapter(),
  matchtrader: () => new MatchTraderAdapter(),
  dxtrade: () => new DXtradeAdapter(),
  oanda: () => new OandaAdapter(),
  bybit: () => new BybitAdapter(),
  ig: () => new IGAdapter(),
}

export interface PlatformMeta {
  id: PlatformId
  label: string
  category: 'forex-cfd' | 'crypto' | 'multi'
  status: 'ready' | 'stub'
  authFields: Array<'apiKey' | 'apiSecret' | 'accessToken' | 'email' | 'password' | 'server' | 'brokerId' | 'domain' | 'platformUrl'>
  notes?: string
}

export const PLATFORM_META: Record<PlatformId, PlatformMeta> = {
  tradelocker: {
    id: 'tradelocker',
    label: 'TradeLocker',
    category: 'forex-cfd',
    status: 'stub',
    authFields: ['email', 'password', 'server'],
    notes: 'Prop-firm favorite; login by email/password/server.',
  },
  ctrader: {
    id: 'ctrader',
    label: 'cTrader',
    category: 'forex-cfd',
    status: 'stub',
    authFields: ['accessToken'],
    notes: 'OAuth flow via Spotware; app registration required.',
  },
  matchtrader: {
    id: 'matchtrader',
    label: 'Match-Trader',
    category: 'forex-cfd',
    status: 'stub',
    authFields: ['email', 'password', 'brokerId', 'platformUrl'],
    notes: 'Per-broker platformUrl; JWT cookie expires hourly.',
  },
  dxtrade: {
    id: 'dxtrade',
    label: 'DXtrade',
    category: 'forex-cfd',
    status: 'stub',
    authFields: ['email', 'password', 'domain', 'platformUrl'],
    notes: 'Each broker on own host; SL/TP are separate protective orders.',
  },
  oanda: {
    id: 'oanda',
    label: 'OANDA',
    category: 'forex-cfd',
    status: 'ready',
    authFields: ['accessToken'],
    notes: 'Personal API token; practice env by default.',
  },
  bybit: {
    id: 'bybit',
    label: 'Bybit',
    category: 'crypto',
    status: 'stub',
    authFields: ['apiKey', 'apiSecret'],
    notes: 'v5 unified account; HMAC-SHA256 signed requests.',
  },
  ig: {
    id: 'ig',
    label: 'IG Markets',
    category: 'forex-cfd',
    status: 'stub',
    authFields: ['apiKey', 'email', 'password'],
    notes: 'US retail not supported; strict per-account rate limits.',
  },
}

export function createAdapter(platform: PlatformId): PlatformAdapter {
  const factory = REGISTRY[platform]
  if (!factory) throw new Error(`Unknown platform: ${platform}`)
  return factory()
}

export function listPlatforms(): PlatformMeta[] {
  return Object.values(PLATFORM_META)
}
