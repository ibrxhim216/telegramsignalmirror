/**
 * Give yourself a free lifetime Advance license
 * Run this script with: node give-free-license.js
 */

const path = require('path')
const fs = require('fs')
const initSqlJs = require('sql.js')
const os = require('os')
const crypto = require('crypto')

// Generate machine ID
function generateMachineId() {
  const data = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || '',
  ].join('|')

  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32)
}

async function giveFreeAdvanceLicense() {
  try {
    // Get database path
    const userDataPath = process.env.APPDATA ||
      (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config')
    const dbPath = path.join(userDataPath, 'telegram-signal-copier', 'telegram-signal-copier.db')

    console.log('Database path:', dbPath)

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      console.error('❌ Database not found! Please run the app at least once to create the database.')
      return
    }

    // Load database
    const SQL = await initSqlJs()
    const buffer = fs.readFileSync(dbPath)
    const db = new SQL.Database(buffer)

    // Create lifetime Advance license
    const now = new Date()
    const machineId = generateMachineId()

    const license = {
      licenseKey: 'FREE-LIFETIME-ADVANCE-2024',
      tier: 'advance',
      status: 'active',
      userId: 'free_user',
      email: 'free@localhost',
      telegramPhone: '',
      isLifetime: true,
      isTrial: false,
      activatedAt: now.toISOString(),
      expiresAt: '', // No expiration for lifetime
      lastValidated: now.toISOString(),
      limits: {
        maxAccounts: -1,      // Unlimited
        maxChannels: -1,      // Unlimited
        multiTP: true,
        tscProtector: true,
        tradeModifications: true,
        aiParser: true,
        visionAI: true,
        multiPlatform: true,
      },
      currentAccounts: 0,
      currentChannels: 0,
      machineId: machineId,
      allowedMachines: 3,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    // Save license to database
    db.run(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES ('license', ?, CURRENT_TIMESTAMP)
    `, [JSON.stringify(license)])

    // Save database to file
    const data = db.export()
    const newBuffer = Buffer.from(data)
    fs.writeFileSync(dbPath, newBuffer)

    console.log('✅ SUCCESS! Free lifetime Advance license activated!')
    console.log('')
    console.log('License Details:')
    console.log('  Tier: Advance (Lifetime)')
    console.log('  Accounts: Unlimited')
    console.log('  Channels: Unlimited')
    console.log('  All Features: Enabled')
    console.log('')
    console.log('Please restart the desktop app to see the changes.')

    db.close()
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

giveFreeAdvanceLicense()
