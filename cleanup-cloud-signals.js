/**
 * Clean up stuck signals in the cloud database
 * This will delete signals that have been pending/sent for more than 10 minutes
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

// Read auth token from desktop app config
const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'telegram-signal-copier')
const configPath = path.join(appDataPath, 'config.json')

let authToken = null

try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    authToken = config.cloudSync?.authToken
  }
} catch (error) {
  console.error('Error reading config:', error.message)
}

if (!authToken) {
  console.error('❌ Error: No authentication token found')
  console.error('   Please make sure you are logged in to the web app')
  process.exit(1)
}

const API_URL = 'https://telegramsignalmirror.com' // Change if using different domain

async function cleanupSignals() {
  try {
    console.log('🔍 Checking for stuck signals...\n')

    // First, check how many stuck signals there are
    const checkResponse = await fetch(`${API_URL}/api/signals/cleanup`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    })

    if (!checkResponse.ok) {
      throw new Error(`HTTP ${checkResponse.status}: ${await checkResponse.text()}`)
    }

    const checkResult = await checkResponse.json()
    console.log(`📊 Found ${checkResult.stuckSignals} stuck signal(s)`)

    if (checkResult.stuckSignals === 0) {
      console.log('✅ No cleanup needed!')
      return
    }

    console.log('\n🗑️  Cleaning up...\n')

    // Now delete them
    const cleanupResponse = await fetch(`${API_URL}/api/signals/cleanup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!cleanupResponse.ok) {
      throw new Error(`HTTP ${cleanupResponse.status}: ${await cleanupResponse.text()}`)
    }

    const cleanupResult = await cleanupResponse.json()
    console.log(`✅ ${cleanupResult.message}`)
    console.log('\n💡 You can now reload your EA and try again!')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('\nTroubleshooting:')
    console.error('1. Make sure you are logged in to the web app')
    console.error('2. Check that the API URL is correct')
    console.error('3. Verify your internet connection')
    process.exit(1)
  }
}

cleanupSignals()
