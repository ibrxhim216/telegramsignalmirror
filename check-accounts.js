// Script to check and activate MT5 account
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join(process.env.APPDATA, 'telegram-signal-copier', 'telegram-signal-copier.db');

async function checkAccounts() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Get all accounts
  const accounts = db.exec('SELECT * FROM trading_accounts');

  console.log('\n📋 Trading Accounts:');
  if (accounts.length > 0 && accounts[0].values.length > 0) {
    accounts[0].values.forEach((row) => {
      console.log(`  ID: ${row[0]}, Platform: ${row[1]}, Account: ${row[2]}, Name: ${row[3]}, Active: ${row[4]}`);
    });
  } else {
    console.log('  No accounts found');
  }

  // Update account 52555244 to be active
  db.run("UPDATE trading_accounts SET is_active = 1 WHERE account_number = '52555244'");

  // Save database
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));

  console.log('\n✅ Account 52555244 set to active');

  // Verify
  const result = db.exec("SELECT * FROM trading_accounts WHERE account_number = '52555244'");
  if (result.length > 0 && result[0].values.length > 0) {
    const row = result[0].values[0];
    console.log('\n✅ Verified:');
    console.log(`  Platform: ${row[1]}`);
    console.log(`  Account: ${row[2]}`);
    console.log(`  Name: ${row[3]}`);
    console.log(`  Active: ${row[4] ? '✅ YES' : '❌ NO'}`);
  }
}

checkAccounts().catch(console.error);
