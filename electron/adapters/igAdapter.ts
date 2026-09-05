/**
 * IG Markets adapter — REST + Lightstreamer. API key + username/password
 * yields CST and X-SECURITY-TOKEN headers (v2 session) that extend up to a
 * 72 h hard cap. Instruments identified by "epic" (e.g. CS.D.EURUSD.MINI.IP).
 * US retail clients not supported by IG. Trading rate limit ~100/min per acct.
 *
 * Docs: https://labs.ig.com/rest-trading-api-reference.html
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

export class IGAdapter extends BasePlatformAdapter {
  readonly platformId = 'ig' as const

  async connect(_creds: PlatformCredentials): Promise<ConnectResult> {
    return { success: false, errorMessage: 'IG Markets adapter not implemented yet' }
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
