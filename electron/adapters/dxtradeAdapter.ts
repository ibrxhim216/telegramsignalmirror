/**
 * DXtrade adapter — each broker runs its own host (e.g. dxtrade.ftmo.com);
 * user supplies the base URL and `domain` at connect time. Session tokens
 * lapse after ~30 min idle. SL/TP are separate protective orders, not fields
 * on the entry order; a close is an offsetting MARKET with positionEffect
 * CLOSE. `orderCode` (client id) is required for idempotency.
 *
 * Docs: https://demo.dx.trade/developers/#/
 * Per-deployment spec: https://<broker-host>/specs
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

export class DXtradeAdapter extends BasePlatformAdapter {
  readonly platformId = 'dxtrade' as const

  async connect(_creds: PlatformCredentials): Promise<ConnectResult> {
    return { success: false, errorMessage: 'DXtrade adapter not implemented yet' }
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
