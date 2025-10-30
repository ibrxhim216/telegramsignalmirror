/**
 * Clean up duplicate signals from the database
 * Run this after stopping the EA to remove any pending/sent signals
 */

const path = require('path')
const Database = require('better-sqlite3')
const os = require('os')

const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'telegram-signal-copier')
const dbPath = path.join(appDataPath, 'telegram-signal-copier.db')

console.log(`Opening database at: ${dbPath}`)

const db = new Database(dbPath)

// Check for any pending or sent signals
const pendingSignals = db.prepare(`
  SELECT id, symbol, direction, status, sent_to_ea, created_at
  FROM signals
  WHERE status IN ('pending', 'sent')
  ORDER BY created_at DESC
`).all()

console.log('\n📊 Found signals:')
console.log('─'.repeat(80))

if (pendingSignals.length === 0) {
  console.log('✅ No pending or sent signals found. Database is clean!')
} else {
  console.log(`⚠️  Found ${pendingSignals.length} pending/sent signals:\n`)

  pendingSignals.forEach((signal, index) => {
    console.log(`${index + 1}. Signal ID: ${signal.id}`)
    console.log(`   Symbol: ${signal.symbol}`)
    console.log(`   Direction: ${signal.direction}`)
    console.log(`   Status: ${signal.status}`)
    console.log(`   Sent to EA: ${signal.sent_to_ea ? 'Yes' : 'No'}`)
    console.log(`   Created: ${signal.created_at}`)
    console.log()
  })

  console.log('─'.repeat(80))
  console.log('\n🗑️  Deleting these signals...\n')

  // Delete all pending and sent signals
  const result = db.prepare(`
    DELETE FROM signals
    WHERE status IN ('pending', 'sent')
  `).run()

  console.log(`✅ Deleted ${result.changes} signal(s)`)
  console.log('\n💡 Tip: These signals were likely duplicates from the loop issue.')
  console.log('   The API has been fixed to prevent this from happening again.')
}

db.close()

console.log('\n✅ Cleanup complete!')
console.log('🔄 You can now:')
console.log('   1. Recompile your EA (if you made changes)')
console.log('   2. Reload the EA on your MT5 chart')
console.log('   3. Send a new test signal')
