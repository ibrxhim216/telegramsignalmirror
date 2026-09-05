/**
 * Build the ADVANCED (personal) desktop app: "TSM Advanced".
 *
 * Same codebase as the customer app; the difference is the bundled .env:
 *   - .env           → customer build (no Anthropic key, no ADVANCED_FEATURES)   →  npm run build:win
 *   - .env.advanced  → advanced build (keys + ADVANCED_FEATURES=true)            →  npm run build:advanced
 *
 * electron-builder only knows how to bundle a file literally named ".env", so this script
 * temporarily swaps .env.advanced into place, builds with the advanced product name, and
 * restores the customer .env afterwards — even if the build fails.
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = __dirname
const envCustomer = path.join(root, '.env')
const envAdvanced = path.join(root, '.env.advanced')
const envBackup = path.join(root, '.env.customer.tmp')

if (!fs.existsSync(envAdvanced)) {
  console.error('❌ .env.advanced not found. Create it (copy .env, add ANTHROPIC_API_KEY, ANTHROPIC_WORKSPACE_ID, ADVANCED_FEATURES=true).')
  process.exit(1)
}
const advancedText = fs.readFileSync(envAdvanced, 'utf8')
if (!/^ADVANCED_FEATURES=true\s*$/m.test(advancedText)) {
  console.error('❌ .env.advanced must contain ADVANCED_FEATURES=true')
  process.exit(1)
}

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, cwd: root })
  if (r.status !== 0) throw new Error(`${cmd} exited with ${r.status}`)
}

let swapped = false
try {
  // 1. Swap env files
  if (fs.existsSync(envCustomer)) fs.copyFileSync(envCustomer, envBackup)
  fs.copyFileSync(envAdvanced, envCustomer)
  swapped = true
  console.log('🔁 Using .env.advanced for this build')

  // 2. Compile + package with the advanced product name (drives the exe filename).
  //    Use `npm run` for every step — nested `npx` under `npm run` is unreliable on Windows.
  run('npm', ['run', 'build:electron'])
  run('npm', ['run', 'build:renderer'])
  run('npm', ['run', 'pack:advanced'])

  console.log('\n✅ Advanced build complete → release/TSM Advanced <version>.exe')
} catch (e) {
  console.error('\n❌ Advanced build failed:', e.message)
  process.exitCode = 1
} finally {
  // 3. Always restore the customer .env so `npm run build:win` stays safe
  if (swapped) {
    if (fs.existsSync(envBackup)) {
      fs.copyFileSync(envBackup, envCustomer)
      fs.unlinkSync(envBackup)
      console.log('🔁 Restored customer .env')
    } else {
      fs.unlinkSync(envCustomer)
      console.log('🔁 Removed temporary .env (no customer .env existed before)')
    }
  }
}
