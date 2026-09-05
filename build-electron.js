// Build script to compile electron TypeScript files using esbuild
const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')
const glob = require('glob')

console.log('🔨 Compiling Electron TypeScript files with esbuild...')

// Bundle the customer EA binaries into assets/ea so the packaged app can install them
// into the user's MT4/MT5 Experts folder (see ipc 'ea:install'). Source of truth stays mt4-mt5/.
try {
  const eaOut = path.join(__dirname, 'assets', 'ea')
  fs.mkdirSync(eaOut, { recursive: true })
  for (const f of ['TelegramSignalMirror.ex4', 'TelegramSignalMirror.ex5']) {
    const src = path.join(__dirname, 'mt4-mt5', f)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(eaOut, f))
      console.log(`📦 Bundled ${f} → assets/ea/`)
    } else {
      console.warn(`⚠️  ${f} not found in mt4-mt5/ — EA installer will not offer it`)
    }
  }
} catch (e) {
  console.warn('⚠️  Could not bundle EA binaries:', e.message)
}

// Get all TypeScript files in electron directory
const entryPoints = glob.sync('electron/**/*.ts', {
  ignore: ['electron/index.js', 'electron/preload.js']
})

console.log(`Found ${entryPoints.length} TypeScript files to compile`)

// Build with esbuild
esbuild.build({
  entryPoints,
  outdir: 'dist/electron',
  outbase: 'electron', // Preserve directory structure
  platform: 'node',
  format: 'cjs',
  target: 'es2020',
  sourcemap: false,
  bundle: true, // Bundle but mark node_modules as external
  external: [
    'electron',
    'better-sqlite3',
    'express',
    'ws',
    'telegram',
    'winston',
    'natural',
    'compromise',
    '@anthropic-ai/sdk',
    'jsonwebtoken',
    'sql.js',
    'react',
    'react-dom',
    'zustand'
  ],
  // Allow circular dependencies (common in Node.js projects)
  logLevel: 'info'
}).then(() => {
  console.log('✅ Electron TypeScript compiled successfully!')
}).catch((error) => {
  console.error('❌ Build failed:', error)
  process.exit(1)
})
