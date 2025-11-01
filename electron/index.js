// Entry point for Electron app
// In development: use ts-node to load TypeScript files
// In production: load compiled JavaScript files

const path = require('path')
const isDev = process.env.NODE_ENV === 'development'

if (isDev) {
  // Development mode - use ts-node
  require('ts-node').register({
    transpileOnly: true,
    project: path.join(__dirname, '../tsconfig.electron.json')
  })
  require('./main.ts')
} else {
  // Production mode - load compiled JavaScript from dist/electron
  require(path.join(__dirname, '../dist/electron/main.js'))
}
