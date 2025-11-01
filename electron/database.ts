import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { logger } from './utils/logger'

let db: SqlJsDatabase | null = null
let dbPath: string = ''

/**
 * Run database migrations for existing databases
 */
function runMigrations() {
  if (!db) return

  try {
    // Check if trades table has the new columns
    const tableInfo = db.exec("PRAGMA table_info(trades)")

    if (tableInfo.length > 0) {
      const columns = tableInfo[0].values.map((row: any) => row[1]) // Column names are in index 1

      // Add channel_id if missing
      if (!columns.includes('channel_id')) {
        logger.info('Migration: Adding channel_id column to trades table')
        db.run('ALTER TABLE trades ADD COLUMN channel_id INTEGER')
      }

      // Add ticket if missing
      if (!columns.includes('ticket')) {
        logger.info('Migration: Adding ticket column to trades table')
        db.run('ALTER TABLE trades ADD COLUMN ticket INTEGER')
      }

      logger.info('Database migrations completed')
    }
  } catch (error) {
    logger.error('Migration error:', error)
    // Don't throw - continue with database initialization
  }
}

export async function initDatabase() {
  try {
    dbPath = path.join(app.getPath('userData'), 'telegram-signal-copier.db')

    const SQL = await initSqlJs()

    // Load existing database or create new
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath)
      db = new SQL.Database(buffer)
    } else {
      db = new SQL.Database()
    }

    logger.info(`Database initialized at: ${dbPath}`)

    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number TEXT UNIQUE NOT NULL,
        telegram_session TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        username TEXT,
        type TEXT,
        is_active INTEGER DEFAULT 0,
        config TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER NOT NULL,
        message_id INTEGER NOT NULL,
        message_text TEXT NOT NULL,
        parsed_data TEXT,
        received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_id) REFERENCES channels(id)
      );

      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        signal_id INTEGER NOT NULL,
        channel_id INTEGER,
        platform TEXT NOT NULL,
        account_number TEXT NOT NULL,
        ticket INTEGER,
        symbol TEXT NOT NULL,
        direction TEXT NOT NULL,
        entry_price REAL,
        stop_loss REAL,
        take_profit TEXT,
        lot_size REAL,
        tp_level INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        opened_at DATETIME,
        closed_at DATETIME,
        profit REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (signal_id) REFERENCES signals(id),
        FOREIGN KEY (channel_id) REFERENCES channels(id)
      );

      CREATE TABLE IF NOT EXISTS trading_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        account_number TEXT NOT NULL,
        account_name TEXT,
        is_active INTEGER DEFAULT 1,
        config TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(platform, account_number)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS signal_modifications (
        id TEXT PRIMARY KEY,
        signal_id TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        reply_to_message_id INTEGER NOT NULL,
        channel_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        value REAL,
        price REAL,
        pips REAL,
        percentage REAL,
        raw_text TEXT NOT NULL,
        parsed_at DATETIME NOT NULL,
        applied_at DATETIME,
        status TEXT DEFAULT 'pending',
        affected_tickets TEXT,
        error_message TEXT,
        FOREIGN KEY (channel_id) REFERENCES channels(id)
      );

      CREATE TABLE IF NOT EXISTS active_trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        direction TEXT NOT NULL,
        entry_price REAL,
        stop_loss REAL,
        take_profit TEXT,
        lot_size REAL,
        account_number TEXT NOT NULL,
        platform TEXT NOT NULL,
        channel_id INTEGER,
        opened_at DATETIME,
        status TEXT DEFAULT 'open',
        cloud_signal_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ticket_number, account_number)
      );

      CREATE INDEX IF NOT EXISTS idx_signals_channel_id ON signals(channel_id);
      CREATE INDEX IF NOT EXISTS idx_trades_signal_id ON trades(signal_id);
      CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
      CREATE INDEX IF NOT EXISTS idx_modifications_signal_id ON signal_modifications(signal_id);
      CREATE INDEX IF NOT EXISTS idx_modifications_status ON signal_modifications(status);
      CREATE INDEX IF NOT EXISTS idx_active_trades_ticket ON active_trades(ticket_number, account_number);
      CREATE INDEX IF NOT EXISTS idx_active_trades_status ON active_trades(status);
    `)

    // Run migrations for existing databases
    runMigrations()

    // Save to file
    saveDatabase()

    logger.info('Database tables created successfully')
  } catch (error) {
    logger.error('Database initialization error:', error)
    throw error
  }
}

export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export function saveDatabase() {
  if (db) {
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(dbPath, buffer)
  }
}

export function closeDatabase() {
  if (db) {
    saveDatabase()
    db.close()
    logger.info('Database closed')
  }
}
