/**
 * Fix the status of pending orders that were incorrectly marked as 'open'
 */

const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')
const os = require('os')

async function fixPendingStatus() {
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
    // Find all trades with LIMIT or STOP in direction but status='open'
    const result = db.exec(`
      SELECT id, ticket, symbol, direction, status
      FROM trades
      WHERE status = 'open'
        AND (direction LIKE '%LIMIT%' OR direction LIKE '%STOP%')
    `)

    if (result.length === 0 || result[0].values.length === 0) {
      console.log('✅ No pending orders need fixing')
      db.close()
      return
    }

    console.log(`Found ${result[0].values.length} pending order(s) to fix:`)

    for (const row of result[0].values) {
      const id = row[0]
      const ticket = row[1]
      const symbol = row[2]
      const direction = row[3]
      const status = row[4]

      console.log(`  - Ticket ${ticket} (${symbol} ${direction}) - status: '${status}' → 'pending'`)

      // Update status to 'pending'
      db.run('UPDATE trades SET status = ? WHERE id = ?', ['pending', id])
    }

    // Save the database
    const data = db.export()
    fs.writeFileSync(dbPath, data)

    console.log(`\n✅ Successfully updated ${result[0].values.length} trade(s)!`)

  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    db.close()
  }
}

fixPendingStatus().catch(console.error)
