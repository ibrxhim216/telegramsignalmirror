/**
 * Clear ALL keywords from channel config except DELETE keywords
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

// Clear ALL updateKeywords EXCEPT deletePending
const clearedConfig = {
  ...config,
  updateKeywords: {
    closeTP1: [],
    closeTP2: [],
    closeTP3: [],
    closeTP4: [],
    closeFull: [],
    closeHalf: [],
    closePartial: [],
    breakEven: [],
    setTP1: [],
    setTP2: [],
    setTP3: [],
    setTP4: [],
    setTP5: [],
    setTP: [],
    setSL: [],
    deletePending: ['delete', 'cancel', 'remove']
  },
  additionalKeywords: {
    layer: [],
    closeAll: [],
    deleteAll: ['delete all', 'cancel all', 'remove all'],
    ignoreKeyword: [],
    skipKeyword: [],
    marketOrder: [],
    removeSL: []
  },
  signalModifications: {
    ...config.signalModifications,
    enabled: true,
    autoApply: true,
    detectRepliesOnly: true
  },
  updatedAt: new Date().toISOString()
}

// Save back
db.prepare('UPDATE channels SET config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  .run(JSON.stringify(clearedConfig), -1002292376576)

db.close()

console.log('✅ All keywords cleared except DELETE keywords!')
console.log('🔄 Please restart the desktop app')
