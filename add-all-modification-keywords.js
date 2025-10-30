/**
 * Add keywords for ALL modification commands including newly implemented ones
 * This includes Close TP1-4, Set TP1, Break Even, and Remove SL
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

// Add keywords for ALL modification commands
const updatedConfig = {
  ...config,
  updateKeywords: {
    // Close specific TP levels - NOW SUPPORTED
    closeTP1: ['close tp1', 'exit tp1', 'close at tp1', 'hit tp1', 'tp1 hit'],
    closeTP2: ['close tp2', 'exit tp2', 'close at tp2', 'hit tp2', 'tp2 hit'],
    closeTP3: ['close tp3', 'exit tp3', 'close at tp3', 'hit tp3', 'tp3 hit'],
    closeTP4: ['close tp4', 'exit tp4', 'close at tp4', 'hit tp4', 'tp4 hit'],

    // Close by percentage - WORKING
    closeFull: ['close full', 'full close', 'exit full', 'close 100%', 'close position'],
    closeHalf: ['close half', 'half close', 'close 50%', '50% close', 'book half'],
    closePartial: ['close 25%', 'close 75%', 'partial close', 'book 30%', 'take 20%'],

    // Break Even - NOW SUPPORTED
    breakEven: ['break even', 'breakeven', 'move to be', 'sl to entry', 'be now'],

    // Set TP levels - Set TP1 NOW SUPPORTED
    setTP1: ['set tp1', 'tp1 to', 'move tp1 to', 'change tp1', 'update tp1'],
    setTP2: [],  // Not supported by EA yet
    setTP3: [],  // Not supported by EA yet
    setTP4: [],  // Not supported by EA yet
    setTP5: [],  // Not supported by EA yet

    // Set general TP - WORKING
    setTP: ['tp to', 'move tp to', 'target to', 'change tp', 'update tp', 'new tp'],

    // Set SL - WORKING
    setSL: ['sl to', 'move sl to', 'stop to', 'change sl', 'update sl', 'new sl'],

    // Delete pending - WORKING
    deletePending: ['delete', 'cancel', 'remove']
  },
  additionalKeywords: {
    layer: [],

    // Close All - WORKING
    closeAll: ['close all', 'exit all', 'close everything'],

    // Delete All - WORKING
    deleteAll: ['delete all', 'cancel all', 'remove all'],

    // Remove SL - NOW SUPPORTED
    removeSL: ['remove sl', 'delete sl', 'no sl', 'clear sl', 'remove stop'],

    ignoreKeyword: [],
    skipKeyword: [],
    marketOrder: []
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

console.log('✅ ALL modification keywords added successfully!')
console.log('')
console.log('📋 Modification commands now available:')
console.log('')
console.log('🎯 Close Commands:')
console.log('  1. Close Full - "close full" or "close 100%"')
console.log('  2. Close Half - "close half" or "close 50%"')
console.log('  3. Close Partial - "close 25%" or "close 75%"')
console.log('  4. Close All - "close all" or "exit all"')
console.log('  5. Close TP1 - "close tp1" or "hit tp1" ✨ NEW')
console.log('  6. Close TP2 - "close tp2" or "hit tp2" ✨ NEW')
console.log('  7. Close TP3 - "close tp3" or "hit tp3" ✨ NEW')
console.log('  8. Close TP4 - "close tp4" or "hit tp4" ✨ NEW')
console.log('')
console.log('🎯 Stop Loss Commands:')
console.log('  9. Set SL - "sl to 1.2500" or "move sl to 1.2500"')
console.log(' 10. Break Even - "break even" or "move to be" ✨ NEW')
console.log(' 11. Remove SL - "remove sl" or "no sl" ✨ NEW')
console.log('')
console.log('🎯 Take Profit Commands:')
console.log(' 12. Set TP - "tp to 1.2600" or "move tp to 1.2600"')
console.log(' 13. Set TP1 - "set tp1 to 1.2600" or "tp1 to 1.2600" ✨ NEW')
console.log('')
console.log('🎯 Order Management:')
console.log(' 14. Delete - "delete" or "cancel" (already working)')
console.log(' 15. Delete All - "delete all" (already working)')
console.log('')
console.log('⚠️  Commands still NOT supported (need EA updates):')
console.log('  - Set TP2/TP3/TP4/TP5 (EA only supports TP1 modification)')
console.log('')
console.log('🔄 Please restart the desktop app to apply changes')
