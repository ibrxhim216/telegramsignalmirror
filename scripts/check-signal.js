/**
 * Check parsed data for signal 226
 */

const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')
const os = require('os')

async function checkSignal() {
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
    const result = db.exec('SELECT parsed_data FROM signals WHERE id = 226')

    if (result.length === 0 || result[0].values.length === 0) {
      console.log('Signal 226 not found')
    } else {
      const parsedData = JSON.parse(result[0].values[0][0])
      console.log('Signal 226 parsed data:')
      console.log(JSON.stringify(parsedData, null, 2))
    }

  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    db.close()
  }
}

checkSignal().catch(console.error)
