/**
 * Account Management Service
 *
 * Manages trading accounts in the database
 * Provides methods to add, update, delete, and retrieve accounts
 */

import { getDatabase, saveDatabase } from '../database'
import { logger } from '../utils/logger'

export interface TradingAccount {
  id: number
  platform: string
  account_number: string
  account_name: string | null
  is_active: number
  config: string | null
  created_at: string
  updated_at: string
}

export class AccountService {
  /**
   * Get all trading accounts from database
   */
  getAccounts(): TradingAccount[] {
    try {
      const db = getDatabase()
      const result = db.exec(`
        SELECT id, platform, account_number, account_name, is_active, config, created_at, updated_at
        FROM trading_accounts
        ORDER BY created_at DESC
      `)

      if (result.length === 0 || result[0].values.length === 0) {
        return []
      }

      return result[0].values.map(row => ({
        id: row[0] as number,
        platform: row[1] as string,
        account_number: row[2] as string,
        account_name: row[3] as string | null,
        is_active: row[4] as number,
        config: row[5] as string | null,
        created_at: row[6] as string,
        updated_at: row[7] as string,
      }))
    } catch (error) {
      logger.error('Error getting accounts:', error)
      return []
    }
  }

  /**
   * Get only active trading accounts
   */
  getActiveAccounts(): TradingAccount[] {
    const accounts = this.getAccounts()
    return accounts.filter(account => account.is_active === 1)
  }

  /**
   * Get the primary (first active) account
   * Used as default when account is not specified
   */
  getPrimaryAccount(): TradingAccount | null {
    const activeAccounts = this.getActiveAccounts()
    return activeAccounts.length > 0 ? activeAccounts[0] : null
  }

  /**
   * Get account by ID
   */
  getAccountById(id: number): TradingAccount | null {
    const accounts = this.getAccounts()
    return accounts.find(account => account.id === id) || null
  }

  /**
   * Get account by account number and platform
   */
  getAccountByNumber(accountNumber: string, platform: string): TradingAccount | null {
    const accounts = this.getAccounts()
    return accounts.find(
      account => account.account_number === accountNumber && account.platform === platform
    ) || null
  }

  /**
   * Add a new trading account
   */
  addAccount(platform: string, accountNumber: string, accountName?: string): number {
    try {
      const db = getDatabase()

      // Check if account already exists
      const existing = this.getAccountByNumber(accountNumber, platform)
      if (existing) {
        throw new Error(`Account ${accountNumber} on ${platform} already exists`)
      }

      db.run(`
        INSERT INTO trading_accounts (platform, account_number, account_name, is_active)
        VALUES (?, ?, ?, 1)
      `, [platform, accountNumber, accountName || null])

      // Get the last inserted ID
      const result = db.exec('SELECT last_insert_rowid()')
      const id = result[0].values[0][0] as number

      saveDatabase()
      logger.info(`Added trading account: ${accountNumber} (${platform})`)

      return id
    } catch (error: any) {
      logger.error('Error adding account:', error)
      throw error
    }
  }

  /**
   * Update trading account details
   */
  updateAccount(id: number, data: Partial<TradingAccount>): void {
    try {
      const db = getDatabase()

      // Build update query dynamically based on provided fields
      const updates: string[] = []
      const values: any[] = []

      if (data.platform !== undefined) {
        updates.push('platform = ?')
        values.push(data.platform)
      }

      if (data.account_number !== undefined) {
        updates.push('account_number = ?')
        values.push(data.account_number)
      }

      if (data.account_name !== undefined) {
        updates.push('account_name = ?')
        values.push(data.account_name)
      }

      if (data.is_active !== undefined) {
        updates.push('is_active = ?')
        values.push(data.is_active)
      }

      if (data.config !== undefined) {
        updates.push('config = ?')
        values.push(data.config)
      }

      if (updates.length === 0) {
        logger.warn('No fields to update for account')
        return
      }

      // Add updated_at
      updates.push('updated_at = CURRENT_TIMESTAMP')
      values.push(id)

      const query = `UPDATE trading_accounts SET ${updates.join(', ')} WHERE id = ?`
      db.run(query, values)

      saveDatabase()
      logger.info(`Updated trading account ID ${id}`)
    } catch (error: any) {
      logger.error('Error updating account:', error)
      throw error
    }
  }

  /**
   * Delete a trading account
   */
  deleteAccount(id: number): void {
    try {
      const db = getDatabase()

      db.run('DELETE FROM trading_accounts WHERE id = ?', [id])

      saveDatabase()
      logger.info(`Deleted trading account ID ${id}`)
    } catch (error: any) {
      logger.error('Error deleting account:', error)
      throw error
    }
  }

  /**
   * Set account active status
   */
  setActive(id: number, isActive: boolean): void {
    try {
      this.updateAccount(id, { is_active: isActive ? 1 : 0 })
      logger.info(`Set account ID ${id} active status to ${isActive}`)
    } catch (error: any) {
      logger.error('Error setting account active status:', error)
      throw error
    }
  }

  /**
   * Get account count
   */
  getAccountCount(): number {
    return this.getAccounts().length
  }

  /**
   * Get active account count
   */
  getActiveAccountCount(): number {
    return this.getActiveAccounts().length
  }
}

// Singleton instance
export const accountService = new AccountService()
