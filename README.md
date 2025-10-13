# Telegram Signal Copier

A powerful desktop application that automatically copies trading signals from Telegram channels to MT4/MT5/cTrader trading platforms with AI-powered signal parsing and advanced risk management.

## Features

✅ **Telegram Integration**
- Connect with your Telegram account
- Monitor unlimited channels and groups
- Real-time signal detection
- Support for private and public channels

✅ **AI Signal Parser**
- Parse signals in any format (no keyword configuration needed)
- Support for multiple languages
- Extract: Symbol, Direction, Entry, SL, TP levels
- High confidence scoring

✅ **Multi-Platform Support**
- MetaTrader 4/5
- cTrader
- DXTrade
- TradeLocker

✅ **Risk Management**
- Fixed lot size
- Dynamic lot size (% risk or $ amount)
- Per-channel risk settings
- Daily profit/loss limits

✅ **Modern UI**
- Dark mode interface
- Real-time signal feed
- Channel management
- Trade monitoring

## Installation

### Prerequisites

- Node.js 18+ (https://nodejs.org)
- npm or yarn
- Telegram account
- Trading platform (MT4/MT5/cTrader/etc.)

### Setup

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Telegram API**
   - Go to https://my.telegram.org/apps
   - Create a new application
   - Copy your `api_id` and `api_hash`
   - Open `electron/services/telegram.ts`
   - Replace the values:
     ```typescript
     const API_ID = your_api_id_here
     const API_HASH = 'your_api_hash_here'
     ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   # Windows
   npm run build:win

   # macOS
   npm run build:mac

   # Linux
   npm run build:linux
   ```

## MT4/MT5 Setup

### Expert Advisor Installation

1. Copy the EA file from `/mt4-mt5/TelegramSignalCopier.mq4` (or `.mq5`) to your MT4/MT5 `Experts` folder
2. Restart MT4/MT5 or refresh the Navigator panel
3. Drag the EA onto any chart
4. Configure the EA settings:
   - **WebSocket URL**: `ws://localhost:8080` (or your server IP)
   - **Magic Number**: Unique identifier for this EA
   - **Risk Settings**: Lot size, risk %, etc.

### EA Parameters

- `WebSocketURL` - Connection to desktop app (default: ws://localhost:8080)
- `MagicNumber` - Unique identifier for trades
- `FixedLotSize` - Fixed lot size per trade
- `UseRiskPercent` - Enable dynamic risk calculation
- `RiskPercent` - % of account balance to risk per trade
- `MaxSpread` - Maximum allowed spread in points

## Usage

### 1. Connect to Telegram

1. Launch the application
2. Enter your phone number (with country code)
3. Enter the verification code sent to your Telegram app
4. Wait for connection confirmation

### 2. Select Channels

1. Click "Refresh" to load your Telegram channels/groups
2. Click on channels to select them (blue highlight = selected)
3. You can select multiple channels

### 3. Start Monitoring

1. Click "Start Monitoring"
2. The app will listen for new messages in selected channels
3. Signals will appear in the Signal Feed in real-time

### 4. Connect MT4/MT5

1. Make sure the desktop app is running
2. Attach the EA to any chart in MT4/MT5
3. Enable "Auto Trading" in MT4/MT5
4. The EA will automatically receive and execute signals

## Signal Format Examples

The AI parser can understand various signal formats:

**Example 1: Standard Format**
```
EURUSD
BUY @ 1.0850
SL: 1.0820
TP1: 1.0880
TP2: 1.0910
TP3: 1.0950
```

**Example 2: Compact Format**
```
GOLD SELL 2050
SL 2065
TP 2035, 2020, 2000
```

**Example 3: Conversational**
```
Looking at a buy opportunity on GBP/USD around 1.2650
Stop loss at 1.2620
Targets: 1.2680, 1.2710, 1.2750
```

## Project Structure

```
telegram-signal-copier/
├── electron/              # Electron main process
│   ├── main.ts           # Application entry point
│   ├── preload.ts        # IPC bridge
│   ├── database.ts       # SQLite database
│   ├── services/         # Backend services
│   │   ├── telegram.ts   # Telegram integration
│   │   ├── signalParser.ts # AI signal parser
│   │   └── websocket.ts  # WebSocket server for EA
│   └── utils/
│       └── logger.ts     # Logging system
├── src/                  # React frontend
│   ├── components/       # UI components
│   ├── store/           # State management
│   ├── App.tsx          # Main app component
│   └── main.tsx         # React entry point
├── mt4-mt5/             # MT4/MT5 Expert Advisors
│   ├── TelegramSignalCopier.mq4
│   └── TelegramSignalCopier.mq5
└── package.json
```

## Technologies Used

- **Desktop Framework**: Electron
- **Frontend**: React + TypeScript + Tailwind CSS
- **State Management**: Zustand
- **Database**: SQLite (better-sqlite3)
- **Telegram**: telegram.js library
- **AI/NLP**: natural.js, compromise
- **Communication**: WebSocket (ws)
- **Build Tool**: Vite

## Troubleshooting

### Telegram connection fails
- Make sure you have valid API credentials
- Check your internet connection
- Verify phone number format (+country_code)

### No channels showing
- Make sure you're a member of Telegram channels/groups
- Click "Refresh" to reload channels
- Check that you're logged into the correct Telegram account

### EA not connecting
- Verify WebSocket URL in EA settings
- Check that desktop app is running
- Ensure port 8080 is not blocked by firewall
- Enable "WebRequest" URL in MT4/MT5 settings

### Signals not parsing
- Check that message contains trading information
- View logs in application data folder
- Signal must have at least symbol and direction

## Roadmap

- [ ] Image-based signal recognition (OCR)
- [ ] cTrader, DXTrade, TradeLocker integration
- [ ] Advanced risk management (TSC Protector)
- [ ] Trailing stop loss
- [ ] Reverse trading mode
- [ ] Multi-account support
- [ ] Performance analytics
- [ ] Cloud sync
- [ ] Mobile app

## License

MIT License - feel free to use and modify

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

## Disclaimer

Trading involves substantial risk. This software is provided "as is" without warranty. Use at your own risk. Always test with a demo account first.
