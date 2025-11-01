// Build script to compile electron TypeScript files using esbuild
const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')
const glob = require('glob')

console.log('🔨 Compiling Electron TypeScript files with esbuild...')

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
