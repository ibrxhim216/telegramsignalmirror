"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/database.ts
var database_exports = {};
__export(database_exports, {
  closeDatabase: () => closeDatabase,
  getDatabase: () => getDatabase,
  initDatabase: () => initDatabase,
  saveDatabase: () => saveDatabase
});
module.exports = __toCommonJS(database_exports);
var import_sql = __toESM(require("sql.js"));
var import_path2 = __toESM(require("path"));
var import_fs = __toESM(require("fs"));
var import_electron2 = require("electron");

// electron/utils/logger.ts
var import_winston = __toESM(require("winston"));
var import_path = __toESM(require("path"));
var import_electron = require("electron");
var logDir = import_electron.app.getPath("userData");
var logger = import_winston.default.createLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  format: import_winston.default.format.combine(
    import_winston.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    import_winston.default.format.errors({ stack: true }),
    import_winston.default.format.splat(),
    import_winston.default.format.json()
  ),
  defaultMeta: { service: "telegram-signal-mirror" },
  transports: [
    // Write all logs with importance level of 'error' or less to error.log
    new import_winston.default.transports.File({
      filename: import_path.default.join(logDir, "error.log"),
      level: "error",
      maxsize: 5242880,
      // 5MB
      maxFiles: 5
    }),
    // Write all logs with importance level of 'info' or less to combined.log
    new import_winston.default.transports.File({
      filename: import_path.default.join(logDir, "combined.log"),
      maxsize: 5242880,
      // 5MB
      maxFiles: 5
    })
  ]
});
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new import_winston.default.transports.Console({
      format: import_winston.default.format.combine(
        import_winston.default.format.colorize(),
        import_winston.default.format.simple()
      )
    })
  );
}

// electron/database.ts
var db = null;
var dbPath = "";
function runMigrations() {
  if (!db) return;
  try {
    const tradesTableInfo = db.exec("PRAGMA table_info(trades)");
    if (tradesTableInfo.length > 0) {
      const columns = tradesTableInfo[0].values.map((row) => row[1]);
      if (!columns.includes("channel_id")) {
        logger.info("Migration: Adding channel_id column to trades table");
        db.run("ALTER TABLE trades ADD COLUMN channel_id INTEGER");
      }
      if (!columns.includes("ticket")) {
        logger.info("Migration: Adding ticket column to trades table");
        db.run("ALTER TABLE trades ADD COLUMN ticket INTEGER");
      }
    }
    const signalsTableInfo = db.exec("PRAGMA table_info(signals)");
    if (signalsTableInfo.length > 0) {
      const signalsColumns = signalsTableInfo[0].values.map((row) => row[1]);
      if (!signalsColumns.includes("cloud_signal_id")) {
        logger.info("Migration: Adding cloud_signal_id column to signals table");
        db.run("ALTER TABLE signals ADD COLUMN cloud_signal_id TEXT");
      }
    }
    logger.info("Database migrations completed");
  } catch (error) {
    logger.error("Migration error:", error);
  }
}
async function initDatabase() {
  try {
    dbPath = import_path2.default.join(import_electron2.app.getPath("userData"), "telegram-signal-mirror.db");
    const SQL = await (0, import_sql.default)();
    if (import_fs.default.existsSync(dbPath)) {
      const buffer = import_fs.default.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
    logger.info(`Database initialized at: ${dbPath}`);
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
    `);
    runMigrations();
    saveDatabase();
    logger.info("Database tables created successfully");
  } catch (error) {
    logger.error("Database initialization error:", error);
    throw error;
  }
}
function getDatabase() {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    import_fs.default.writeFileSync(dbPath, buffer);
  }
}
function closeDatabase() {
  if (db) {
    saveDatabase();
    db.close();
    logger.info("Database closed");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  closeDatabase,
  getDatabase,
  initDatabase,
  saveDatabase
});
