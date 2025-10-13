# Quick Start Guide - Telegram Signal Copier

## What We've Built

✅ **Complete MVP (Minimum Viable Product)** with:
- Electron desktop app with React + TypeScript
- Telegram integration for monitoring channels
- AI signal parser (text-based)
- WebSocket server for MT4/MT5 communication
- SQLite database for persistence
- Dark mode UI
- MT4/MT5 Expert Advisors

## Project Structure

```
Telegram Signal Mirror/
├── electron/                  # Backend (Node.js)
│   ├── main.ts               # Electron entry point
│   ├── preload.ts            # IPC bridge
│   ├── database.ts           # SQLite database
│   ├── services/
│   │   ├── telegram.ts       # Telegram integration
│   │   ├── signalParser.ts   # AI signal parser
│   │   └── websocket.ts      # WebSocket server
│   └── utils/
│       └── logger.ts         # Logging system
├── src/                      # Frontend (React)
│   ├── components/           # UI components
│   │   ├── TelegramAuth.tsx  # Login screen
│   │   ├── Dashboard.tsx     # Main dashboard
│   │   ├── ChannelList.tsx   # Channel selector
│   │   ├── SignalFeed.tsx    # Signal display
│   │   └── Header.tsx        # Top bar
│   ├── store/
│   │   └── appStore.ts       # State management
│   ├── App.tsx               # Main app
│   └── main.tsx              # React entry
├── mt4-mt5/                  # Trading platform EAs
│   ├── TelegramSignalCopier.mq4  # MT4 EA
│   ├── TelegramSignalCopier.mq5  # MT5 EA
│   └── README.md
├── package.json
└── README.md
```

## Next Steps

### 1. Configure Telegram API Credentials

**IMPORTANT**: You need Telegram API credentials to connect.

1. Go to https://my.telegram.org/apps
2. Log in with your Telegram account
3. Create a new application
4. Copy your `api_id` and `api_hash`
5. Open `electron/services/telegram.ts` (line 11-12)
6. Replace:
   ```typescript
   const API_ID = 0              // Replace with your api_id
   const API_HASH = ''           // Replace with your api_hash
   ```

### 2. Install Dependencies

The installation may have timed out. Run it again:

```bash
npm install
```

If you encounter errors, try:
```bash
npm install --legacy-peer-deps
```

### 3. Run the Application

```bash
npm run dev
```

This will:
- Start the Vite dev server (frontend)
- Launch Electron with the app
- Open dev tools for debugging

### 4. First Time Setup

1. **Connect Telegram**:
   - Enter your phone number (with country code, e.g., +1234567890)
   - Enter the verification code from Telegram
   - You'll be connected!

2. **Select Channels**:
   - Click "Refresh" to load your channels
   - Click on channels to select them (blue highlight)
   - You can select multiple channels

3. **Start Monitoring**:
   - Click "Start Monitoring"
   - The app will listen for messages
   - Signals will appear in the feed

### 5. Connect MT4/MT5 (Optional)

1. **Copy the EA**:
   - MT4: Copy `mt4-mt5/TelegramSignalCopier.mq4` to `MT4/MQL4/Experts/`
   - MT5: Copy `mt4-mt5/TelegramSignalCopier.mq5` to `MT5/MQL5/Experts/`

2. **Enable WebRequest**:
   - In MT4/MT5: Tools → Options → Expert Advisors
   - Check "Allow WebRequest for listed URL"
   - Add: `http://localhost:8080`

3. **Attach EA**:
   - Drag the EA onto any chart
   - Enable "Auto Trading"
   - Check the Experts tab for connection status

## Testing the Signal Parser

You can test the signal parser with sample messages. The parser understands formats like:

```
EURUSD
BUY @ 1.0850
SL: 1.0820
TP1: 1.0880
TP2: 1.0910
TP3: 1.0950
```

Or:
```
GOLD SELL 2050
SL 2065
TP 2035, 2020, 2000
```

Or even conversational:
```
Looking at a buy opportunity on GBP/USD around 1.2650
Stop loss at 1.2620
Targets: 1.2680, 1.2710
```

## Current Features

✅ **Implemented in MVP:**
- Telegram phone authentication
- Channel/group listing
- Real-time message monitoring
- AI signal parsing (symbol, direction, entry, SL, TP)
- WebSocket server
- SQLite database
- Modern dark UI
- MT4/MT5 EAs with basic execution
- Fixed lot size mode
- Winston logging

🚧 **Not Yet Implemented (Future Phases):**
- Image signal recognition (OCR)
- Dynamic risk calculation (% or $)
- Multiple TP levels management
- Trailing stop loss
- cTrader/DXTrade/TradeLocker integration
- Reverse trading mode
- TSC Protector (daily limits)
- Time filters
- Symbol mapping
- Multi-account support
- Performance analytics
- Cloud sync

## Troubleshooting

### "npm install" fails
- Try: `npm install --legacy-peer-deps`
- Or install Node.js 18 LTS: https://nodejs.org

### "Telegram connection error"
- Make sure you added API_ID and API_HASH in `electron/services/telegram.ts`
- Check internet connection
- Verify phone number format (+country_code)

### "No channels showing"
- Click "Refresh"
- Make sure you're in Telegram channels/groups
- Check browser console for errors

### EA not connecting
- Ensure desktop app is running
- Check WebRequest URL is whitelisted in MT4/MT5
- Verify port 8080 is not blocked

## Development Commands

```bash
# Development mode (with hot reload)
npm run dev

# Build production app
npm run build

# Windows installer
npm run build:win

# macOS installer
npm run build:mac

# Linux installer
npm run build:linux

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Database Location

The SQLite database is stored at:
```
Windows: C:\Users\<YourName>\AppData\Roaming\telegram-signal-copier\telegram-signal-copier.db
macOS: ~/Library/Application Support/telegram-signal-copier/telegram-signal-copier.db
Linux: ~/.config/telegram-signal-copier/telegram-signal-copier.db
```

## Logs Location

Application logs are saved to:
```
Windows: C:\Users\<YourName>\AppData\Roaming\telegram-signal-copier\
macOS: ~/Library/Application Support/telegram-signal-copier/
Linux: ~/.config/telegram-signal-copier/
```

Files:
- `error.log` - Errors only
- `combined.log` - All logs

## Next Development Phase

If you want to continue building, the next priorities would be:

1. **Risk Management**:
   - Implement dynamic lot sizing (% risk)
   - Add TSC Protector (daily limits)
   - Per-channel risk settings

2. **Advanced Signal Handling**:
   - Multiple TP levels with partial closes
   - Pending orders (BUY/SELL LIMIT/STOP)
   - Signal update detection (when provider edits)

3. **Platform Expansion**:
   - cTrader integration
   - DXTrade API
   - TradeLocker API

4. **UI Enhancements**:
   - Settings panel
   - Trade history view
   - Performance analytics
   - Chart/graphs

Need help with any of these? Just ask!
