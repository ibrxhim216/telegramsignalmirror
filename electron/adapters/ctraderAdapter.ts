/**
 * cTrader adapter — Spotware Open API over Protobuf/WebSocket (wss://…:5035).
 * OAuth 2.0 with `trading` scope; server-push execution events via
 * ProtoOAExecutionEvent. Requires a registered Spotware app (client_id/secret)
 * and a 10 s heartbeat.
 *
 * Docs: https://help.ctrader.com/open-api/
 * Suggested npm: @claasahl/spotware-connect-api or spotware sample stack.
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

export class CTraderAdapter extends BasePlatformAdapter {
  readonly platformId = 'ctrader' as const

  async connect(_creds: PlatformCredentials): Promise<ConnectResult> {
    return { success: false, errorMessage: 'cTrader adapter not implemented yet' }
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
