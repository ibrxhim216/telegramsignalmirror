import { getDatabase, saveDatabase } from '../database'
import { logger } from '../utils/logger'

export interface ActiveTrade {
  id: number
  signalId: number
  channelId: number
  platform: string
  accountNumber: string
  ticket: number           // MT4/MT5 ticket number
  symbol: string
  direction: string
  entryPrice: number
  lotSize: number
  stopLoss: number | null
  takeProfits: number[]    // Array of TP levels
  tpLevel: number          // Which TP this trade represents (1-5)
  status: 'pending' | 'open' | 'closed'
  openedAt: string
  closedAt: string | null
  profit: number | null
}

export interface TradeModification {
  type: 'close' | 'modify_sl' | 'modify_tp' | 'delete'
  tradeIds: number[]
  percentage?: number      // For partial close
  newSL?: number
  newTP?: number[]
  reason: string
}

export class TradeManager {
  /**
   * Save a new trade to the database
   */
  saveTrade(trade: Omit<ActiveTrade, 'id'>): number {
    try {
      const db = getDatabase()

      db.run(`
        INSERT INTO trades (
          signal_id, channel_id, platform, account_number, ticket,
          symbol, direction, entry_price, lot_size, stop_loss,
          take_profit, status, opened_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        trade.signalId,
        trade.channelId,
        trade.platform,
        trade.accountNumber,
        trade.ticket,
        trade.symbol,
        trade.direction,
        trade.entryPrice,
        trade.lotSize,
        trade.stopLoss,
        JSON.stringify(trade.takeProfits),
        trade.status,
        trade.openedAt
      ])

      const result = db.exec('SELECT last_insert_rowid()')
      const tradeId = result[0].values[0][0] as number

      saveDatabase()
      logger.info(`Trade saved: ID=${tradeId}, Symbol=${trade.symbol}, Ticket=${trade.ticket}`)

      return tradeId
    } catch (error: any) {
      logger.error('Error saving trade:', error)
      throw error
    }
  }

  /**
   * Get active trades for a specific signal
   */
  getTradesBySignal(signalId: number): ActiveTrade[] {
    try {
      const db = getDatabase()
      const stmt = db.prepare(`
        SELECT * FROM trades
        WHERE signal_id = ? AND (status = 'pending' OR status = 'open')
        ORDER BY id ASC
      `)
      stmt.bind([signalId])

      const trades: ActiveTrade[] = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        trades.push(this.rowToTrade(row))
      }

      stmt.free()
      return trades
    } catch (error: any) {
      logger.error('Error getting trades by signal:', error)
      return []
    }
  }

  /**
   * Get active trades for a symbol on a specific account
   */
  getTradesBySymbol(symbol: string, accountNumber: string, platform: string = 'MT4'): ActiveTrade[] {
    try {
      const db = getDatabase()
      const stmt = db.prepare(`
        SELECT * FROM trades
        WHERE symbol = ? AND account_number = ? AND platform = ?
        AND (status = 'pending' OR status = 'open')
        ORDER BY opened_at ASC
      `)
      stmt.bind([symbol, accountNumber, platform])

      const trades: ActiveTrade[] = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        trades.push(this.rowToTrade(row))
      }

      stmt.free()
      return trades
    } catch (error: any) {
      logger.error('Error getting trades by symbol:', error)
      return []
    }
  }

  /**
   * Get active trades for a channel
   */
  getTradesByChannel(channelId: number, accountNumber: string): ActiveTrade[] {
    try {
      const db = getDatabase()
      const stmt = db.prepare(`
        SELECT * FROM trades
        WHERE channel_id = ? AND account_number = ?
        AND (status = 'pending' OR status = 'open')
        ORDER BY opened_at ASC
      `)
      stmt.bind([channelId, accountNumber])

      const trades: ActiveTrade[] = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        trades.push(this.rowToTrade(row))
      }

      stmt.free()
      return trades
    } catch (error: any) {
      logger.error('Error getting trades by channel:', error)
      return []
    }
  }

  /**
   * Get all active trades for an account
   */
  getAllActiveTrades(accountNumber: string, platform: string = 'MT4'): ActiveTrade[] {
    try {
      const db = getDatabase()
      const stmt = db.prepare(`
        SELECT * FROM trades
        WHERE account_number = ? AND platform = ?
        AND (status = 'pending' OR status = 'open')
        ORDER BY opened_at ASC
      `)
      stmt.bind([accountNumber, platform])

      const trades: ActiveTrade[] = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        trades.push(this.rowToTrade(row))
      }

      stmt.free()
      return trades
    } catch (error: any) {
      logger.error('Error getting all active trades:', error)
      return []
    }
  }

  /**
   * Update trade status
   */
  updateTradeStatus(tradeId: number, status: 'pending' | 'open' | 'closed', profit?: number): boolean {
    try {
      const db = getDatabase()

      if (status === 'closed') {
        db.run(`
          UPDATE trades
          SET status = ?, closed_at = ?, profit = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [status, new Date().toISOString(), profit || 0, tradeId])
      } else {
        db.run(`
          UPDATE trades
          SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [status, tradeId])
      }

      saveDatabase()
      logger.debug(`Trade ${tradeId} status updated to ${status}`)
      return true
    } catch (error: any) {
      logger.error('Error updating trade status:', error)
      return false
    }
  }

  /**
   * Update trade SL
   */
  updateTradeSL(tradeId: number, newSL: number): boolean {
    try {
      const db = getDatabase()
      db.run(`
        UPDATE trades
        SET stop_loss = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newSL, tradeId])

      saveDatabase()
      logger.info(`Trade ${tradeId} SL updated to ${newSL}`)
      return true
    } catch (error: any) {
      logger.error('Error updating trade SL:', error)
      return false
    }
  }

  /**
   * Update trade TP
   */
  updateTradeTP(tradeId: number, newTP: number[]): boolean {
    try {
      const db = getDatabase()
      db.run(`
        UPDATE trades
        SET take_profit = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [JSON.stringify(newTP), tradeId])

      saveDatabase()
      logger.info(`Trade ${tradeId} TP updated to ${newTP}`)
      return true
    } catch (error: any) {
      logger.error('Error updating trade TP:', error)
      return false
    }
  }

  /**
   * Get trade by ticket number
   */
  getTradeByTicket(ticket: number, accountNumber: string): ActiveTrade | null {
    try {
      const db = getDatabase()
      const stmt = db.prepare(`
        SELECT * FROM trades
        WHERE ticket = ? AND account_number = ?
        LIMIT 1
      `)
      stmt.bind([ticket, accountNumber])

      if (stmt.step()) {
        const row = stmt.getAsObject()
        stmt.free()
        return this.rowToTrade(row)
      }

      stmt.free()
      return null
    } catch (error: any) {
      logger.error('Error getting trade by ticket:', error)
      return null
    }
  }

  /**
   * Convert database row to ActiveTrade object
   */
  private rowToTrade(row: any): ActiveTrade {
    return {
      id: row.id as number,
      signalId: row.signal_id as number,
      channelId: row.channel_id || 0,
      platform: row.platform as string,
      accountNumber: row.account_number as string,
      ticket: row.ticket as number,
      symbol: row.symbol as string,
      direction: row.direction as string,
      entryPrice: row.entry_price as number,
      lotSize: row.lot_size as number,
      stopLoss: row.stop_loss as number | null,
      takeProfits: row.take_profit ? JSON.parse(row.take_profit as string) : [],
      tpLevel: row.tp_level || 0,
      status: row.status as 'pending' | 'open' | 'closed',
      openedAt: row.opened_at as string,
      closedAt: row.closed_at as string | null,
      profit: row.profit as number | null
    }
  }

  /**
   * Delete trade from database
   */
  deleteTrade(tradeId: number): boolean {
    try {
      const db = getDatabase()
      db.run('DELETE FROM trades WHERE id = ?', [tradeId])
      saveDatabase()
      logger.info(`Trade ${tradeId} deleted`)
      return true
    } catch (error: any) {
      logger.error('Error deleting trade:', error)
      return false
    }
  }
}

// Singleton instance
export const tradeManager = new TradeManager()
