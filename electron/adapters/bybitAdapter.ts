/**
 * Bybit v5 adapter — REST + WebSocket private streams. HMAC-SHA256 signing
 * with X-BAPI-* headers. `category` (linear/spot/inverse/option) is required
 * on every trading call. SL/TP on live positions go through
 * /v5/position/trading-stop; on pending orders they attach to /v5/order/amend.
 * Position close = opposite-side market with reduceOnly:true.
 *
 * Docs: https://bybit-exchange.github.io/docs/v5/intro
 */

import { BasePlatformAdapter } from './baseAdapter'
import {
  PlatformCredentials,
  NormalizedSignal,
  NormalizedPosition,
  OrderResult,
  ModifyResult,
  ConnectResult,
} from './types'

export class BybitAdapter extends BasePlatformAdapter {
  readonly platformId = 'bybit' as const

  async connect(_creds: PlatformCredentials): Promise<ConnectResult> {
    return { success: false, errorMessage: 'Bybit adapter not implemented yet' }
  }

  async placeOrder(_signal: NormalizedSignal): Promise<OrderResult> {
    return this.notImplemented('placeOrder')
  }

  async modifyOrder(
    _platformPositionId: string,
    _changes: { stopLoss?: number | null; takeProfit?: number | null }
  ): Promise<ModifyResult> {
    return this.notImplemented('modifyOrder')
  }

  async closePosition(_platformPositionId: string, _qty?: number): Promise<ModifyResult> {
    return this.notImplemented('closePosition')
  }

  async syncPositions(): Promise<NormalizedPosition[]> {
    return []
  }
}
