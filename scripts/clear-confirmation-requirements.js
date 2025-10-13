/**
 * Script to clear requireConfirmationFor setting for all channels
 * This allows all signal modifications (close, delete, etc.) to auto-apply without confirmation
 */

const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')

async function clearConfirmationRequirements() {
  const dbPath = path.join(__dirname, 'data', 'signal-mirror.db')

  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found at:', dbPath)
    return
  }

  const SQL = await initSqlJs()
  const buffer = fs.readFileSync(dbPath)
  const db = new SQL.Database(buffer)

  try {
    // Get all channel configs
    const result = db.exec('SELECT channel_id, channel_name, config FROM channel_configs')

    if (result.length === 0 || result[0].values.length === 0) {
      console.log('No channels found in database')
      return
    }

    console.log(`Found ${result[0].values.length} channel(s)`)

    let updated = 0

    for (const row of result[0].values) {
      const channelId = row[0]
      const channelName = row[1]
      const configJson = row[2]

      try {
        const config = JSON.parse(configJson)

        // Clear the requireConfirmationFor array
        if (config.signalModifications) {
          const before = JSON.stringify(config.signalModifications.requireConfirmationFor)
          config.signalModifications.requireConfirmationFor = []
          const after = JSON.stringify(config.signalModifications.requireConfirmationFor)

          if (before !== after) {
            // Update the database
            db.run(
              'UPDATE channel_configs SET config = ?, updated_at = ? WHERE channel_id = ?',
              [JSON.stringify(config), new Date().toISOString(), channelId]
            )

            console.log(`✅ Updated channel ${channelId} (${channelName})`)
            console.log(`   Before: requireConfirmationFor = ${before}`)
            console.log(`   After:  requireConfirmationFor = ${after}`)
            updated++
          } else {
            console.log(`⏭️  Channel ${channelId} (${channelName}) - already cleared`)
          }
        } else {
          console.log(`⚠️  Channel ${channelId} (${channelName}) - missing signalModifications config`)
        }
      } catch (err) {
        console.error(`❌ Error processing channel ${channelId}:`, err.message)
      }
    }

    if (updated > 0) {
      // Save the database
      const data = db.export()
      fs.writeFileSync(dbPath, data)
      console.log(`\n✅ Database saved successfully! ${updated} channel(s) updated.`)
      console.log('🔄 Restart the app for changes to take effect.')
    } else {
      console.log('\n✅ No changes needed - all channels already configured correctly.')
    }

  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    db.close()
  }
}

clearConfirmationRequirements().catch(console.error)
