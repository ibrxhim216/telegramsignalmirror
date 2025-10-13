// Entry point that loads TypeScript files using ts-node
require('ts-node').register({
  transpileOnly: true,
  project: require('path').join(__dirname, 'tsconfig.json')
})

require('./main.ts')
