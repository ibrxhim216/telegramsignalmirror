/**
 * Quick fix script to clear requireConfirmationFor for channel
 */

const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')
const os = require('os')

async function fixConfirmation() {
  // Database is in AppData/Roaming/telegram-signal-copier/
  const dbPath = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'telegram-signal-copier',
    'telegram-signal-copier.db'
  )

  console.log('Database path:', dbPath)

  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found at:', dbPath)
    return
  }

  const SQL = await initSqlJs()
  const buffer = fs.readFileSync(dbPath)
  const db = new SQL.Database(buffer)

  try {
    // Get the channel config
    const channelId = -1002292376576
    const result = db.exec('SELECT config FROM channels WHERE id = ?', [channelId])

    if (result.length === 0 || result[0].values.length === 0) {
      console.error('❌ Channel not found in database')
      db.close()
      return
    }

    const configJson = result[0].values[0][0]
    const config = JSON.parse(configJson)

    console.log('Before:', config.signalModifications?.requireConfirmationFor)

    // Clear the requireConfirmationFor array
    if (config.signalModifications) {
      config.signalModifications.requireConfirmationFor = []
    }

    console.log('After:', config.signalModifications?.requireConfirmationFor)

    // Update the database
    db.run(
      'UPDATE channels SET config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(config), channelId]
    )

    // Save the database
    const data = db.export()
    fs.writeFileSync(dbPath, data)

    console.log('✅ Successfully cleared confirmation requirements!')
    console.log('🔄 Restart the app for changes to take effect.')

  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    db.close()
  }
}

fixConfirmation().catch(console.error)
