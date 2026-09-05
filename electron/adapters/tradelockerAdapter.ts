/**
 * TradeLocker adapter — REST + Socket.IO. Login by email/password/server;
 * every trade route takes both an accNum HTTP header and the account id in
 * the URL path. Symbols must be resolved to tradableInstrumentId and routeId
 * per account before ordering — never send raw symbol strings.
 *
 * Docs: https://public-api.tradelocker.com/
 * Endpoints:
 *   demo: https://demo.tradelocker.com/backend-api
 *   live: https://live.tradelocker.com/backend-api
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

export class TradeLockerAdapter extends BasePlatformAdapter {
  readonly platformId = 'tradelocker' as const

  async connect(_creds: PlatformCredentials): Promise<ConnectResult> {
    return { success: false, errorMessage: 'TradeLocker adapter not implemented yet' }
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
