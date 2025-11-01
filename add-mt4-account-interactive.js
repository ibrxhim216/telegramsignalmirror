/**
 * Interactive script to add an MT4 account to the database
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const initSqlJs = require('sql.js');

const dbPath = path.join(process.env.APPDATA, 'telegram-signal-copier', 'telegram-signal-copier.db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function addMT4Account() {
  console.log('📂 Database path:', dbPath);
  console.log('\n===========================================');
  console.log('    Add MT4 Account to Database');
  console.log('===========================================\n');

  // Get account details from user
  const accountNumber = await question('Enter MT4 Account Number: ');
  const accountName = await question('Enter Account Name (e.g., "XM Demo MT4"): ');

  if (!accountNumber || !accountName) {
    console.error('❌ Error: Account number and name are required');
    rl.close();
    return;
  }

  // Load database
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Check if account already exists
  const existing = db.exec(`
    SELECT * FROM trading_accounts
    WHERE account_number = '${accountNumber}' AND platform = 'MT4'
  `);

  if (existing.length > 0 && existing[0].values.length > 0) {
    console.log('\n✅ Account', accountNumber, 'already exists');

    // Show existing account
    const account = existing[0].values[0];
    console.log({
      id: account[0],
      platform: account[1],
      account_number: account[2],
      account_name: account[3],
      is_active: account[4],
      config: account[5],
      created_at: account[6],
      updated_at: account[7]
    });

    // Ask if they want to set it as active
    const setActive = await question('\nSet this account as active? (y/n): ');
    if (setActive.toLowerCase() === 'y') {
      // Deactivate all other accounts
      db.run(`UPDATE trading_accounts SET is_active = 0`);
      // Activate this one
      db.run(`UPDATE trading_accounts SET is_active = 1 WHERE account_number = '${accountNumber}' AND platform = 'MT4'`);

      // Save database
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));

      console.log('✅ Set account as active');
    }
  } else {
    // Deactivate all other accounts
    db.run(`UPDATE trading_accounts SET is_active = 0`);

    // Add new account
    db.run(`
      INSERT INTO trading_accounts (platform, account_number, account_name, is_active)
      VALUES ('MT4', '${accountNumber}', '${accountName}', 1)
    `);

    // Save database
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));

    console.log('\n✅ Account added successfully!');
    console.log('Account Number:', accountNumber);
    console.log('Platform: MT4');
    console.log('Status: Active');
  }

  // Show all accounts
  console.log('\n📋 All trading accounts:');
  const allAccounts = db.exec(`SELECT * FROM trading_accounts`);
  if (allAccounts.length > 0) {
    const accounts = allAccounts[0].values.map(row => ({
      id: row[0],
      platform: row[1],
      account_number: row[2],
      account_name: row[3],
      is_active: row[4],
      config: row[5],
      created_at: row[6],
      updated_at: row[7]
    }));
    console.table(accounts);
  }

  console.log('\n✅ Done! Please restart the desktop app for changes to take effect.');

  rl.close();
}

addMT4Account().catch(console.error);
