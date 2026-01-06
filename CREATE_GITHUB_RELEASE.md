# How to Deploy a New Release

## Complete Deployment Steps

### Step 1: Build the Desktop App

1. **Update version** in `package.json` (e.g., `"version": "1.0.4"`)
2. **Build Windows app**: `npm run build:win`
3. **Compiled files** will be in `release/` folder

### Step 2: Create ZIP Package

1. Create a folder named `Telegram-Signal-Mirror-v1.0.X`
2. Copy these files into it:
   - `release/Telegram Signal Mirror 1.0.X.exe` (rename to match version)
   - `mt4-mt5/TelegramSignalMirror.ex4`
   - `mt4-mt5/TelegramSignalMirror.ex5`
   - `QUICKSTART.md` or other docs
3. **ZIP the folder** → `Telegram-Signal-Mirror-v1.0.X.zip`

### Step 3: Upload to GitHub Release

1. **Go to GitHub Repository**
   - Visit: https://github.com/ibrxhim216/telegramsignalmirror/releases/new

2. **Fill in Release Details**
   - **Tag version**: `v1.0.X`
   - **Release title**: `Telegram Signal Mirror v1.0.X`
   - **Description**: Copy the text below (update version numbers)

3. **Upload Files**
   Click "Attach binaries" and upload these 3 files:
   - `Telegram-Signal-Mirror-v1.0.X.zip`
   - `TelegramSignalMirror.ex4`
   - `TelegramSignalMirror.ex5`

4. **Publish**
   - Check "Set as the latest release"
   - Click "Publish release"

### Step 4: Update Website Download Files

**IMPORTANT**: The website serves downloads from `public/downloads/` folder, NOT from GitHub!

1. **Copy files to website repository**:
   ```bash
   # From desktop app repo
   cp "release/Telegram-Signal-Mirror-v1.0.X.zip" "../telegramsignalmirror-web/public/downloads/"
   cp "mt4-mt5/TelegramSignalMirror.ex4" "../telegramsignalmirror-web/public/downloads/"
   cp "mt4-mt5/TelegramSignalMirror.ex5" "../telegramsignalmirror-web/public/downloads/"
   ```

2. **Update API URLs** in `telegramsignalmirror-web/app/api/downloads/[file]/route.ts`:
   ```typescript
   const DOWNLOAD_URLS: Record<string, string> = {
     'windows-app': `${BASE_URL}/downloads/Telegram-Signal-Mirror-v1.0.X.zip`,
     'mt4-ea': `${BASE_URL}/downloads/TelegramSignalMirror.ex4`,
     'mt5-ea': `${BASE_URL}/downloads/TelegramSignalMirror.ex5`,
   }

   const FILE_MAP: Record<string, { filename: string; description: string }> = {
     'windows-app': {
       filename: 'Telegram-Signal-Mirror-v1.0.X.zip',
       description: 'Windows Desktop Application',
     },
     // ... rest stays same
   }
   ```

3. **Update version numbers** in `telegramsignalmirror-web/app/dashboard/downloads/page.tsx`:
   ```typescript
   const latestVersion = {
     desktop: '1.0.X',
     mt4EA: '1.0.X',
     mt5EA: '1.0.X'
   }
   ```

4. **Commit and push to deploy**:
   ```bash
   cd telegramsignalmirror-web
   git add .
   git commit -m "chore: Update downloads to v1.0.X"
   git push
   ```

5. **Vercel auto-deploys** in 2-3 minutes

## Release Description (Copy This)

```markdown
# Telegram Signal Mirror v1.0.0

## What's Included

### Desktop Application (Windows)
- **TelegramSignalMirror-Windows-v1.0.0.zip** - Complete Windows desktop application
- AI-powered signal parser
- Multi-account support (based on license tier)
- Unlimited Telegram channels
- Real-time signal monitoring

### MetaTrader Expert Advisors
- **TelegramSignalMirror.ex4** - MetaTrader 4 Expert Advisor
- **TelegramSignalMirror.ex5** - MetaTrader 5 Expert Advisor

## Installation

### Desktop App
1. Download the Windows app ZIP file
2. Extract to your preferred location
3. Run `Telegram Signal Copier.exe`
4. Follow the setup wizard

### EA Installation
1. Download the appropriate EA (.ex4 for MT4, .ex5 for MT5)
2. Copy to your MetaTrader's `Experts` folder
3. Restart MetaTrader
4. Drag the EA onto a chart
5. Connect to your desktop app

## Support

For issues or questions, contact: info@telegramsignalmirror.com

## License Tiers

- **Basic ($20/mo)**: 1 trading account, unlimited channels
- **Pro ($50/mo)**: 3 trading accounts, unlimited channels
- **Lifetime ($499)**: 3 trading accounts, unlimited channels, one-time payment

Start your 7-day free trial at: https://www.telegramsignalmirror.com
```

## After Publishing

Once published, the GitHub release URLs will be:
- **Windows App**: `https://github.com/ibrxhim216/telegramsignalmirror/releases/download/v1.0.X/Telegram-Signal-Mirror-v1.0.X.zip`
- **MT4 EA**: `https://github.com/ibrxhim216/telegramsignalmirror/releases/download/v1.0.X/TelegramSignalMirror.ex4`
- **MT5 EA**: `https://github.com/ibrxhim216/telegramsignalmirror/releases/download/v1.0.X/TelegramSignalMirror.ex5`

**Note**: GitHub releases are for distribution/backup only. The website serves downloads from its own `public/downloads/` folder.

---

## Troubleshooting

### Downloads Return "401 Unauthorized"

**Cause**: The frontend is reading the wrong localStorage key for the auth token.

**Check**: In `app/dashboard/downloads/page.tsx`, verify it uses:
```typescript
const token = localStorage.getItem('token')  // ✅ CORRECT
// NOT 'authToken' ❌
```

**Why**: The login page stores the token as `'token'`:
```typescript
// app/login/page.tsx
localStorage.setItem('token', data.token)
```

### Downloads Not Working in Incognito Mode

**Cause**: User isn't logged in. The download system requires authentication.

**Solution**: Users must log in first, even in incognito mode, before they can download files.

### Old Version Still Downloading

**Cause**: Forgot to update files in `public/downloads/` folder or didn't update API URLs.

**Fix**: Follow Step 4 above to copy new files and update both:
1. `app/api/downloads/[file]/route.ts` - Update URLs and filenames
2. `app/dashboard/downloads/page.tsx` - Update version numbers displayed
3. Copy actual files to `public/downloads/`
