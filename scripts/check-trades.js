/**
 * Check trades for signal 226
 */

const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')
const os = require('os')

async function checkTrades() {
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
    // Check signal 226
    const result = db.exec(`
      SELECT id, ticket, symbol, direction, status, entry_price
      FROM trades
      WHERE signal_id = 226
    `)

    if (result.length === 0 || result[0].values.length === 0) {
      console.log('No trades found for signal 226')
    } else {
      console.log('Trades for signal 226:')
      for (const row of result[0].values) {
        console.log(`  - ID: ${row[0]}, Ticket: ${row[1]}, Symbol: ${row[2]}, Direction: ${row[3]}, Status: ${row[4]}, Entry: ${row[5]}`)
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    db.close()
  }
}

checkTrades().catch(console.error)
