// Quick script to add MT5 account to database
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join(process.env.APPDATA, 'telegram-signal-copier', 'telegram-signal-copier.db');

async function addAccount() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Add account
  db.run(`
    INSERT INTO trading_accounts (platform, account_number, account_name, is_active)
    VALUES ('MT5', '52555244', 'IC Markets Demo', 1)
  `);

  // Save database
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));

  console.log('✅ Account added successfully!');
  console.log('Account Number: 52555244');
  console.log('Platform: MT5');
  console.log('Status: Active');
}

addAccount().catch(console.error);
