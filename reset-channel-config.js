/**
 * Reset Channel Configuration
 * This script resets the channel config to use the new default keywords
 */

const path = require('path')
const Database = require('better-sqlite3')
const os = require('os')

// Determine app data path (same as in database.ts)
const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'telegram-signal-copier')
const dbPath = path.join(appDataPath, 'telegram-signal-copier.db')

console.log(`Opening database at: ${dbPath}`)

const db = new Database(dbPath)

// Get all channels
const channels = db.prepare('SELECT id, title, config FROM channels').all()

console.log(`Found ${channels.length} channels`)

for (const channel of channels) {
  console.log(`\nChannel: ${channel.title} (ID: ${channel.id})`)

  if (!channel.config) {
    console.log('  No config found, skipping')
    continue
  }

  try {
    const config = JSON.parse(channel.config)

    // Update ONLY the DELETE keywords - keep others empty to avoid false positives
    const updated = {
      ...config,
      updateKeywords: {
        ...config.updateKeywords,
        deletePending: ['delete', 'cancel', 'remove']
      },
      additionalKeywords: {
        ...config.additionalKeywords,
        deleteAll: ['delete all', 'cancel all', 'remove all']
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
      .run(JSON.stringify(updated), channel.id)

    console.log('  ✅ Config updated successfully')
    console.log(`  - deletePending: ${updated.updateKeywords.deletePending.join(', ')}`)
    console.log(`  - deleteAll: ${updated.additionalKeywords.deleteAll.join(', ')}`)
    console.log(`  - Modifications enabled: ${updated.signalModifications.enabled}`)
    console.log(`  - Auto-apply: ${updated.signalModifications.autoApply}`)
  } catch (error) {
    console.error(`  ❌ Error updating config: ${error.message}`)
  }
}

db.close()
console.log('\n✅ All channels updated!')
console.log('\nPlease restart the desktop app to apply changes.')
