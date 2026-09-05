/**
 * Cloud-mode platform adapter contract.
 *
 * Every broker/exchange integration implements PlatformAdapter so the
 * signal dispatcher can route a parsed signal to any supported venue with
 * the same call shape. MT4/MT5 keep their existing EA-polling path; these
 * adapters cover the "server-side execution" cloud mode where the app talks
 * to the broker's REST/WebSocket API directly.
 */

export type PlatformId =
  | 'tradelocker'
  | 'ctrader'
  | 'matchtrader'
  | 'dxtrade'
  | 'oanda'
  | 'bybit'
  | 'ig'

export type OrderSide = 'BUY' | 'SELL'

export type OrderType = 'MARKET' | 'LIMIT' | 'STOP'

export interface NormalizedSignal {
  signalId: number
  symbol: string
  side: OrderSide
  type: OrderType
  qty: number
  entryPrice?: number
  stopLoss?: number
  takeProfits: number[]
  comment?: string
}

export interface NormalizedPosition {
  platformPositionId: string
  symbol: string
  side: OrderSide
  qty: number
  avgPrice: number
  stopLoss: number | null
  takeProfit: number | null
  openTime: string
  unrealizedPnl?: number
}

export interface OrderResult {
  success: boolean
  platformOrderId?: string
  platformPositionId?: string
  filledPrice?: number
  errorCode?: string
  errorMessage?: string
}

export interface ModifyResult {
  success: boolean
  errorCode?: string
  errorMessage?: string
}

export interface ConnectResult {
  success: boolean
  accountIds?: string[]
  errorMessage?: string
}

/**
 * Per-account credentials + endpoint hints. Adapters read only what they need
 * (e.g. HMAC uses apiKey+apiSecret; OAuth uses accessToken+refreshToken).
 */
export interface PlatformCredentials {
  apiKey?: string
  apiSecret?: string
  accessToken?: string
  refreshToken?: string
  email?: string
  password?: string
  server?: string      // TradeLocker server name / broker id
  brokerId?: string    // Match-Trader partner/broker id
  domain?: string      // DXtrade auth domain
  platformUrl?: string // DXtrade per-broker host, Match-Trader platformUrl
  systemUuid?: string  // Match-Trader system uuid
  accountId?: string
  isDemo?: boolean
}

export interface PlatformAdapter {
  readonly platformId: PlatformId

  connect(creds: PlatformCredentials): Promise<ConnectResult>
  disconnect(): Promise<void>

  placeOrder(signal: NormalizedSignal): Promise<OrderResult>
  modifyOrder(
    platformPositionId: string,
    changes: { stopLoss?: number | null; takeProfit?: number | null }
  ): Promise<ModifyResult>
  closePosition(platformPositionId: string, qty?: number): Promise<ModifyResult>
  syncPositions(): Promise<NormalizedPosition[]>
}
