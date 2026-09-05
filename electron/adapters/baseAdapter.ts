import {
  PlatformAdapter,
  PlatformCredentials,
  NormalizedSignal,
  NormalizedPosition,
  OrderResult,
  ModifyResult,
  ConnectResult,
  PlatformId,
} from './types'

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly platformId: PlatformId

  protected creds: PlatformCredentials | null = null
  protected connected = false

  abstract connect(creds: PlatformCredentials): Promise<ConnectResult>

  async disconnect(): Promise<void> {
    this.creds = null
    this.connected = false
  }

  abstract placeOrder(signal: NormalizedSignal): Promise<OrderResult>
  abstract modifyOrder(
    platformPositionId: string,
    changes: { stopLoss?: number | null; takeProfit?: number | null }
  ): Promise<ModifyResult>
  abstract closePosition(platformPositionId: string, qty?: number): Promise<ModifyResult>
  abstract syncPositions(): Promise<NormalizedPosition[]>

  protected notImplemented(op: string): OrderResult & ModifyResult {
    return {
      success: false,
      errorCode: 'NOT_IMPLEMENTED',
      errorMessage: `${this.platformId}.${op}() is not implemented yet`,
    }
  }
}
