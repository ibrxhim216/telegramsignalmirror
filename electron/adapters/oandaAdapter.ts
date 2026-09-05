/**
 * OANDA v20 REST adapter — reference implementation.
 *
 * Auth: personal access token via `Authorization: Bearer <token>`.
 * Symbol format: `EUR_USD`, `GBP_JPY`, `XAU_USD` (underscore).
 * Units: positive = buy, negative = sell; 10 000 units = 0.1 standard lot.
 *
 * Docs: https://developer.oanda.com/rest-live-v20/introduction/
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
import { logger } from '../utils/logger'

const REST_LIVE = 'https://api-fxtrade.oanda.com'
const REST_PRACTICE = 'https://api-fxpractice.oanda.com'

interface OandaTrade {
  id: string
  instrument: string
  price: string
  currentUnits: string
  initialUnits: string
  openTime: string
  unrealizedPL: string
  stopLossOrder?: { price: string } | null
  takeProfitOrder?: { price: string } | null
}

export class OandaAdapter extends BasePlatformAdapter {
  readonly platformId = 'oanda' as const

  private baseUrl = REST_PRACTICE
  private accountId: string | null = null

  async connect(creds: PlatformCredentials): Promise<ConnectResult> {
    if (!creds.accessToken) {
      return { success: false, errorMessage: 'OANDA requires accessToken (personal API token)' }
    }
    this.creds = creds
    this.baseUrl = creds.isDemo === false ? REST_LIVE : REST_PRACTICE

    try {
      const res = await this.request('GET', '/v3/accounts')
      const accounts: string[] = (res.accounts ?? []).map((a: { id: string }) => a.id)
      if (accounts.length === 0) {
        return { success: false, errorMessage: 'No OANDA accounts on this token' }
      }
      this.accountId = creds.accountId && accounts.includes(creds.accountId)
        ? creds.accountId
        : accounts[0]
      this.connected = true
      return { success: true, accountIds: accounts }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, errorMessage: `OANDA connect failed: ${msg}` }
    }
  }

  async placeOrder(signal: NormalizedSignal): Promise<OrderResult> {
    if (!this.connected || !this.accountId) {
      return { success: false, errorCode: 'NOT_CONNECTED', errorMessage: 'OANDA adapter not connected' }
    }

    const instrument = this.toOandaSymbol(signal.symbol)
    const units = this.toUnits(signal.qty, signal.side)
    const firstTP = signal.takeProfits[0]

    const orderBody: Record<string, unknown> = {
      order: {
        instrument,
        units: String(units),
        type: signal.type,
        positionFill: 'DEFAULT',
        timeInForce: signal.type === 'MARKET' ? 'FOK' : 'GTC',
        ...(signal.type !== 'MARKET' && signal.entryPrice != null
          ? { price: signal.entryPrice.toFixed(5) }
          : {}),
        ...(signal.stopLoss != null
          ? { stopLossOnFill: { price: signal.stopLoss.toFixed(5), timeInForce: 'GTC' } }
          : {}),
        ...(firstTP != null
          ? { takeProfitOnFill: { price: firstTP.toFixed(5), timeInForce: 'GTC' } }
          : {}),
        ...(signal.comment ? { clientExtensions: { comment: signal.comment, tag: 'tsm' } } : {}),
      },
    }

    try {
      const res = await this.request('POST', `/v3/accounts/${this.accountId}/orders`, orderBody)
      const fillTxn = res.orderFillTransaction
      if (fillTxn) {
        return {
          success: true,
          platformOrderId: res.lastTransactionID,
          platformPositionId: fillTxn.tradeOpened?.tradeID ?? fillTxn.id,
          filledPrice: parseFloat(fillTxn.price ?? '0'),
        }
      }
      const cancelTxn = res.orderCancelTransaction
      if (cancelTxn) {
        return {
          success: false,
          errorCode: cancelTxn.reason,
          errorMessage: `Order cancelled: ${cancelTxn.reason}`,
        }
      }
      return {
        success: true,
        platformOrderId: res.lastTransactionID,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, errorCode: 'REQUEST_FAILED', errorMessage: msg }
    }
  }

  async modifyOrder(
    platformPositionId: string,
    changes: { stopLoss?: number | null; takeProfit?: number | null }
  ): Promise<ModifyResult> {
    if (!this.connected || !this.accountId) {
      return { success: false, errorCode: 'NOT_CONNECTED', errorMessage: 'OANDA adapter not connected' }
    }

    const body: Record<string, unknown> = {}
    if (changes.stopLoss === null) body.stopLoss = null
    else if (changes.stopLoss != null) {
      body.stopLoss = { price: changes.stopLoss.toFixed(5), timeInForce: 'GTC' }
    }
    if (changes.takeProfit === null) body.takeProfit = null
    else if (changes.takeProfit != null) {
      body.takeProfit = { price: changes.takeProfit.toFixed(5), timeInForce: 'GTC' }
    }

    try {
      await this.request(
        'PUT',
        `/v3/accounts/${this.accountId}/trades/${platformPositionId}/orders`,
        body
      )
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, errorCode: 'REQUEST_FAILED', errorMessage: msg }
    }
  }

  async closePosition(platformPositionId: string, qty?: number): Promise<ModifyResult> {
    if (!this.connected || !this.accountId) {
      return { success: false, errorCode: 'NOT_CONNECTED', errorMessage: 'OANDA adapter not connected' }
    }

    const body = qty != null
      ? { units: String(Math.round(Math.abs(qty) * 100000)) }
      : { units: 'ALL' }

    try {
      await this.request(
        'PUT',
        `/v3/accounts/${this.accountId}/trades/${platformPositionId}/close`,
        body
      )
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, errorCode: 'REQUEST_FAILED', errorMessage: msg }
    }
  }

  async syncPositions(): Promise<NormalizedPosition[]> {
    if (!this.connected || !this.accountId) return []

    try {
      const res = await this.request('GET', `/v3/accounts/${this.accountId}/openTrades`)
      const trades: OandaTrade[] = res.trades ?? []
      return trades.map<NormalizedPosition>((t) => {
        const currentUnits = parseFloat(t.currentUnits)
        return {
          platformPositionId: t.id,
          symbol: this.fromOandaSymbol(t.instrument),
          side: currentUnits >= 0 ? 'BUY' : 'SELL',
          qty: Math.abs(currentUnits) / 100000,
          avgPrice: parseFloat(t.price),
          stopLoss: t.stopLossOrder ? parseFloat(t.stopLossOrder.price) : null,
          takeProfit: t.takeProfitOrder ? parseFloat(t.takeProfitOrder.price) : null,
          openTime: t.openTime,
          unrealizedPnl: parseFloat(t.unrealizedPL),
        }
      })
    } catch (err) {
      logger.error('OANDA syncPositions failed', err)
      return []
    }
  }

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    if (!this.creds?.accessToken) throw new Error('missing access token')

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.creds.accessToken}`,
        'Content-Type': 'application/json',
        'Accept-Datetime-Format': 'RFC3339',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const text = await res.text()
    const json = text ? JSON.parse(text) : {}
    if (!res.ok) {
      const detail = json.errorMessage ?? json.message ?? res.statusText
      throw new Error(`OANDA ${res.status}: ${detail}`)
    }
    return json
  }

  /**
   * Convert lot size to OANDA units. 1 lot = 100 000 units of base currency.
   * side determines sign (BUY positive, SELL negative).
   */
  private toUnits(lots: number, side: 'BUY' | 'SELL'): number {
    const units = Math.round(Math.abs(lots) * 100000)
    return side === 'SELL' ? -units : units
  }

  private toOandaSymbol(symbol: string): string {
    if (symbol.includes('_')) return symbol.toUpperCase()
    const clean = symbol.replace(/[^A-Za-z]/g, '').toUpperCase()
    if (clean.length !== 6) return clean
    return `${clean.slice(0, 3)}_${clean.slice(3)}`
  }

  private fromOandaSymbol(instrument: string): string {
    return instrument.replace('_', '')
  }
}
