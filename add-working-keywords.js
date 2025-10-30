/**
 * Add keywords for modification commands that work with cloud sync
 * Only adding keywords for commands that the EA supports
 */

const path = require('path')
const Database = require('better-sqlite3')
const os = require('os')

const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'telegram-signal-copier')
const dbPath = path.join(appDataPath, 'telegram-signal-copier.db')

console.log(`Opening database at: ${dbPath}`)

const db = new Database(dbPath)

// Get the channel
const channel = db.prepare('SELECT id, title, config FROM channels WHERE id = ?').get(-1002292376576)

if (!channel || !channel.config) {
  console.log('No config found')
  db.close()
  process.exit(1)
}

const config = JSON.parse(channel.config)

// Add safe keywords that won't match regular signals
// These only detect ACTION words in REPLIES, not declarations in original signals
const updatedConfig = {
  ...config,
  updateKeywords: {
    closeTP1: [],  // Not supported by EA
    closeTP2: [],  // Not supported by EA
    closeTP3: [],  // Not supported by EA
    closeTP4: [],  // Not supported by EA
    closeFull: ['close full', 'full close', 'exit full', 'close 100%', 'close position'],
    closeHalf: ['close half', 'half close', 'close 50%', '50% close', 'book half'],
    closePartial: ['close 25%', 'close 75%', 'partial close', 'book 30%', 'take 20%'],
    breakEven: [],  // Not supported without entry price tracking
    setTP1: [],  // Not supported by EA
    setTP2: [],  // Not supported by EA
    setTP3: [],  // Not supported by EA
    setTP4: [],  // Not supported by EA
    setTP5: [],  // Not supported by EA
    setTP: ['tp to', 'move tp to', 'target to', 'change tp', 'update tp', 'new tp'],
    setSL: ['sl to', 'move sl to', 'stop to', 'change sl', 'update sl', 'new sl'],
    deletePending: ['delete', 'cancel', 'remove']  // Already working
  },
  additionalKeywords: {
    layer: [],
    closeAll: ['close all', 'exit all', 'close everything'],
    deleteAll: ['delete all', 'cancel all', 'remove all'],  // Already working
    ignoreKeyword: [],
    skipKeyword: [],
    marketOrder: [],  // Not a modification command
    removeSL: []  // Not supported by EA yet
  },
  signalModifications: {
    ...config.signalModifications,
    enabled: true,
    autoApply: true,
    detectRepliesOnly: true
  },
  updatedAt: new Date().toISOString()
}

// Save back to database
db.prepare('UPDATE channels SET config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  .run(JSON.stringify(updatedConfig), -1002292376576)

db.close()

console.log('✅ Keywords added for working modification commands!')
console.log('')
console.log('📋 Commands that will now work:')
console.log('  1. Close Full - reply "close full" or "close 100%"')
console.log('  2. Close Half - reply "close half" or "close 50%"')
console.log('  3. Close Partial - reply "close 25%" or "close 75%"')
console.log('  4. Close All - reply "close all" or "exit all"')
console.log('  5. Set SL - reply "sl to 1.2500" or "move sl to 1.2500"')
console.log('  6. Set TP - reply "tp to 1.2600" or "move tp to 1.2600"')
console.log('  7. Delete - reply "delete" or "cancel" ✅ Already working')
console.log('  8. Delete All - reply "delete all" ✅ Already working')
console.log('')
console.log('⚠️  Commands NOT supported (need EA updates):')
console.log('  - Close TP1/TP2/TP3/TP4 (EA doesn\'t track TP levels)')
console.log('  - Set TP1 (EA only supports one TP)')
console.log('  - Break Even (desktop app doesn\'t track entry prices)')
console.log('  - Remove SL (EA has no handler)')
console.log('')
console.log('🔄 Please restart the desktop app to apply changes')
