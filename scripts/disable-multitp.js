// Simple script to disable Multi-TP
// Run with: node disable-multitp.js

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function disableMultiTP() {
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

    let settings;
    if (result.length > 0 && result[0].values.length > 0) {
      settings = JSON.parse(result[0].values[0][0]);
      console.log('📊 Current Multi-TP status:', settings.enabled ? 'ENABLED' : 'DISABLED');
    } else {
      console.log('⚠️  No existing Multi-TP settings found, will create new');
      settings = {
        enabled: false,
        splitStrategy: 'weighted',
        tp1Percent: 40,
        tp2Percent: 30,
        tp3Percent: 20,
        tp4Percent: 10,
        tp5Percent: 0,
        moveToBreakevenEnabled: true,
        moveToBreakevenAfterTP: 1,
        breakevenPipsOffset: 0,
        trailingStopEnabled: false,
        trailingStopAfterTP: 2,
        trailingStopPips: 20,
        closeAllIfSLHit: true,
        linkOrders: true,
        minLotSize: 0.01,
        roundLotSize: true,
        skipIfTooSmall: true,
      };
    }

    // Disable Multi-TP
    settings.enabled = false;

    // Save back to database
    db.run(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES ('multi_tp_settings', ?, datetime('now'))
    `, [JSON.stringify(settings)]);

    // Write database back to file
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));

    console.log('✅ Multi-TP has been DISABLED');
    console.log('🔄 Please restart the desktop app and restart monitoring for changes to take effect');

    db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

disableMultiTP();
