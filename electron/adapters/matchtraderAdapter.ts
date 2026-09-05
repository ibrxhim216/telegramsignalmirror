/**
 * Match-Trader adapter — per-broker platformUrl + SYSTEM_UUID. Auth by
 * email/password/brokerId returns a 1 h `co-auth` JWT cookie and a
 * `tradingApiToken` per account (sent as `Auth-trading-api` header on trade
 * routes). Symbols are broker-specific — resolve via Market Watch first.
 *
 * Docs: https://docs.match-trade.com/docs/match-trader-api-documentation/
 * PDF spec: https://docs.match-trade.com/wp-content/uploads/2024/05/MTR-Match-TraderPlatformAPI.pdf
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

export class MatchTraderAdapter extends BasePlatformAdapter {
  readonly platformId = 'matchtrader' as const

  async connect(_creds: PlatformCredentials): Promise<ConnectResult> {
    return { success: false, errorMessage: 'Match-Trader adapter not implemented yet' }
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
