/**
 * Generate JWT auth token for desktop app to push signals to cloud
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const jwt = require('jsonwebtoken');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'telegram-signal-copier', 'telegram-signal-copier.db');
console.log(`📂 Database path: ${dbPath}`);

const db = new Database(dbPath);

// JWT secret (must match the secret in the web app's .env file)
const JWT_SECRET = 'development-jwt-secret-change-in-production'; // From telegramsignalmirror-web/.env

// User ID from cloud database
const userId = 'cmh6qwue40000usc89nyotsmk'; // The test user we created

// Generate JWT token
const token = jwt.sign(
  {
    userId: userId,
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
  },
  JWT_SECRET
);

console.log('\n🔑 Generated JWT Token:');
console.log(token);

// Save token to database
db.prepare(`
  INSERT OR REPLACE INTO settings (key, value, updated_at)
  VALUES ('jwt_token', ?, CURRENT_TIMESTAMP)
`).run(token);

console.log('\n✅ Token saved to database');

// Verify it was saved
const saved = db.prepare('SELECT value FROM settings WHERE key = ?').get('jwt_token');
console.log('\n✅ Verified token in database:');
console.log(saved.value.substring(0, 50) + '...');

db.close();
console.log('\n✅ Done! Restart the desktop app to use the new auth token.');
