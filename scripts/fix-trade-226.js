/**
 * Fix status for trade 1265085673
 */

const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')
const os = require('os')

async function fixTrade() {
  const dbPath = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'telegram-signal-copier',
    'telegram-signal-copier.db'
  )

  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found')
    return
  }

  const SQL = await initSqlJs()
  const buffer = fs.readFileSync(dbPath)
  const db = new SQL.Database(buffer)

  try {
    // Update the specific trade
    db.run('UPDATE trades SET status = ? WHERE ticket = ?', ['pending', '1265085673'])

    // Save
    const data = db.export()
    fs.writeFileSync(dbPath, data)

    console.log('✅ Updated ticket 1265085673 status to "pending"')
    console.log('🔄 The change will be reflected when the app reloads the database')

  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    db.close()
  }
}

fixTrade().catch(console.error)
