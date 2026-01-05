// Simple script to check Multi-TP status
// Run with: node check-multitp.js

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function checkMultiTP() {
  try {
    // Find database location (Windows)
    const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const dbPath = path.join(appDataPath, 'telegram-signal-copier', 'telegram-signal-copier.db');

    console.log('Looking for database at:', dbPath);

    if (!fs.existsSync(dbPath)) {
      console.error('❌ Database not found at:', dbPath);
      console.log('💡 Make sure you have run the desktop app at least once.');
      process.exit(1);
    }

    // Load database
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    // Get current settings
    const result = db.exec("SELECT value FROM settings WHERE key = 'multi_tp_settings'");

    if (result.length > 0 && result[0].values.length > 0) {
      const settings = JSON.parse(result[0].values[0][0]);
      console.log('\n📊 Multi-TP Settings:');
      console.log('====================');
      console.log('Status:', settings.enabled ? '✅ ENABLED' : '❌ DISABLED');
      console.log('Split Strategy:', settings.splitStrategy);
      console.log('TP Percentages:', `${settings.tp1Percent}%, ${settings.tp2Percent}%, ${settings.tp3Percent}%, ${settings.tp4Percent}%`);
      console.log('\nBreakeven:');
      console.log('  Enabled:', settings.moveToBreakevenEnabled);
      console.log('  After TP:', settings.moveToBreakevenAfterTP);
      console.log('  Offset:', settings.breakevenPipsOffset, 'pips');
      console.log('\nTrailing Stop:');
      console.log('  Enabled:', settings.trailingStopEnabled);
      console.log('  After TP:', settings.trailingStopAfterTP);
      console.log('  Distance:', settings.trailingStopPips, 'pips');

      console.log('\n' + (settings.enabled
        ? '⚠️  Multi-TP is ENABLED - Desktop app will split signals into multiple orders'
        : '✅ Multi-TP is DISABLED - Desktop app sends single signal, EA handles partial closes'
      ));
    } else {
      console.log('⚠️  No Multi-TP settings found in database');
      console.log('📌 Multi-TP will use default settings (DISABLED by default)');
    }

    db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkMultiTP();
