const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'telegram-signal-copier', 'telegram-signal-copier.db');
console.log(`📂 Database path: ${dbPath}`);

const db = new Database(dbPath);

// Check if account already exists
const existing = db.prepare('SELECT * FROM trading_accounts WHERE account_number = ?').get('52555244');

if (existing) {
  console.log('✅ Account 52555244 already exists');
  console.log(JSON.stringify(existing, null, 2));

  // Make sure it's active
  db.prepare('UPDATE trading_accounts SET is_active = 1 WHERE id = ?').run(existing.id);
  console.log('✅ Set account as active');
} else {
  // Insert new account
  const result = db.prepare(`
    INSERT INTO trading_accounts (platform, account_number, account_name, is_active)
    VALUES (?, ?, ?, ?)
  `).run('MT5', '52555244', 'MT5 Live Account', 1);

  console.log('✅ Added new account with ID:', result.lastInsertRowid);
}

// Show all accounts
const accounts = db.prepare('SELECT * FROM trading_accounts').all();
console.log('\n📋 All trading accounts:');
console.table(accounts);

db.close();
console.log('\n✅ Done! Please restart the desktop app for changes to take effect.');
