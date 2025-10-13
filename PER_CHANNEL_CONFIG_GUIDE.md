# Per-Channel Configuration System - Complete Guide

## 🎉 Overview

We've implemented a **complete per-channel keyword configuration system** that allows you to customize how signals are parsed for each Telegram channel. This matches the functionality shown in the TSC 5.2.0 screenshots.

---

## ✨ Features Implemented

### 1. **Channel-Specific Keyword Configuration**
- Define unique keywords for each channel
- Signal Keywords (Entry, BUY, SELL, SL, TP)
- Update Keywords (Close TP1-4, Break Even, Set TP/SL, Delete)
- Additional Keywords (Layer, Close All, Market Order, Remove SL)

### 2. **Advanced Settings Per Channel**
- **Delay in Milliseconds** - Stealth mode delay before execution
- **Prefer Entry** - Choose first/second/average/all entry prices
- **SL/TP in Pips** - Parse stop loss and take profit as pips
- **Read Image** - Enable OCR for image-based signals (future)
- **Read Forwarded** - Include or skip forwarded messages
- **Delimiters** - Custom delimiters for parsing

### 3. **Enhanced Signal Parser**
- **Keyword-Based Parsing** - Uses channel-specific keywords
- **AI Fallback** - Falls back to AI parser if keywords don't match
- **Signal Type Detection** - Distinguishes between NEW signals and UPDATE commands
- **Confidence Scoring** - Rates parsing confidence 0-100%
- **Update Command Detection** - Identifies Close TP1, Break Even, etc.

### 4. **Configuration Management**
- **Save/Load** - Configurations stored in SQLite database
- **Export/Import** - Share configs between channels (JSON format)
- **Reset to Defaults** - One-click reset to default keywords
- **Per-Channel Enable/Disable** - Turn off specific channels

---

## 📂 File Structure

```
electron/
├── types/
│   └── channelConfig.ts          # TypeScript interfaces
├── services/
│   ├── channelConfigService.ts   # CRUD operations
│   ├── enhancedSignalParser.ts   # Keyword-based parser
│   └── telegram.ts               # Integration (updated)
└── database.ts                   # Storage (channels.config)

src/
└── components/
    ├── ChannelConfigDialog.tsx   # Configuration UI
    └── ChannelList.tsx           # Settings button (updated)
```

---

## 🚀 How to Use

### Step 1: Start the Application
```bash
npm run dev
```

### Step 2: Connect to Telegram
1. Enter your phone number
2. Enter verification code
3. Load channels

### Step 3: Configure a Channel
1. **Click the ⚙️ Settings icon** next to any channel
2. **Configure keywords** in the 3 tabs:
   - **Signal Keyword** - How to parse initial signals
   - **Update Keyword** - How to handle trade updates
   - **Additional Keyword** - Advanced options
3. **Click Save**

### Step 4: Start Monitoring
- Select channels (blue highlight)
- Click "Start Monitoring"
- The enhanced parser will use your configurations!

---

## 📋 Configuration Tabs Explained

### Tab 1: Signal Keyword

Define how **NEW trading signals** are parsed:

| Field | Purpose | Example Keywords |
|-------|---------|------------------|
| **Entry Point** | Entry price keywords | `entry, enter, @, price` |
| **BUY** | Buy signal keywords | `buy, long, call` |
| **SELL** | Sell signal keywords | `sell, short, put` |
| **SL** | Stop loss keywords | `sl, stop loss, stop` |
| **TP** | Take profit keywords | `tp, take profit, target, tp1, tp2` |

**Example Signal:**
```
EURUSD
BUY @ 1.0850
SL: 1.0820
TP1: 1.0880
TP2: 1.0910
```

### Tab 2: Update Keyword

Define how **UPDATE commands** are detected:

| Field | Purpose | Example Keywords |
|-------|---------|------------------|
| **Close TP1** | Close only TP1 | `close tp1, hit tp1, tp1 hit` |
| **Close TP2** | Close only TP2 | `close tp2, hit tp2` |
| **Close Full** | Close entire trade | `close all, close full, exit` |
| **Close Half** | Close 50% of trade | `close half, close 50%` |
| **Break Even** | Move SL to entry | `breakeven, move to entry, be` |
| **Set TP** | Change TP levels | `change tp, update tp` |
| **Set SL** | Change SL | `change sl, update sl` |
| **Delete** | Cancel pending order | `delete, cancel, remove` |

**Example Update:**
```
"TP1 HIT! Move to breakeven"
→ Detected as: closeTP1 + breakEven
```

### Tab 3: Additional Keyword

Advanced keywords and settings:

| Field | Purpose | Example Keywords |
|-------|---------|------------------|
| **Layer** | Re-entry signal | `layer, re-enter, add position` |
| **Close All** | Close all trades | `close all trades, exit all` |
| **Delete All** | Cancel all pending | `delete all, cancel all` |
| **Market Order** | Force market execution | `market, now, instant` |
| **Remove SL** | Remove stop loss | `remove sl, no sl, delete sl` |

**Advanced Settings:**
- **Delay in Msec** - Delay execution (stealth mode for prop firms)
- **Prefer Entry** - Which entry price to use if multiple found
- **SL In Pips** - Parse SL as pips instead of price
- **TP In Pips** - Parse TP as pips instead of price
- **Read Image** - Enable OCR (future feature)
- **Read Forwarded** - Process forwarded messages

---

## 🔧 How It Works

### Signal Processing Flow

```
1. Telegram Message Received
   ↓
2. Load Channel Config
   ↓
3. Check if Enabled
   ↓
4. Check Forwarded Message Setting
   ↓
5. Parse with Enhanced Parser
   ↓
6. Detect Signal Type (new vs update)
   ↓
7. Apply Delay (if configured)
   ↓
8. Emit Signal Event
   ↓
9. Send to MT4/MT5 EA
```

### Enhanced Parser Logic

```typescript
1. Check ignore/skip keywords → Return null if matched
2. Detect if it's an update command → Parse as UPDATE
3. Extract symbol using configured keywords
4. Extract direction using configured BUY/SELL keywords
5. Extract entry price using configured entry keywords
6. Extract SL using configured SL keywords
7. Extract TPs using configured TP keywords
8. Calculate confidence score
9. If confidence < 0.4 AND useAIParser = true → Fallback to AI
10. Return parsed signal
```

---

## 💾 Configuration Storage

Configurations are stored in **SQLite database** in the `channels.config` field as JSON:

```sql
SELECT id, title, config FROM channels WHERE id = 123;
```

**Example JSON:**
```json
{
  "channelId": 123,
  "channelName": "Premium Signals",
  "signalKeywords": {
    "entryPoint": ["entry", "@"],
    "buy": ["buy", "long"],
    "sell": ["sell", "short"],
    "stopLoss": ["sl", "stop"],
    "takeProfit": ["tp", "target"]
  },
  "updateKeywords": {
    "closeTP1": ["close tp1", "tp1 hit"],
    "breakEven": ["breakeven", "move to entry"]
  },
  "advancedSettings": {
    "delayInMsec": 2000,
    "preferEntry": "first",
    "slInPips": false,
    "tpInPips": false
  }
}
```

---

## 🎯 Signal Type Detection

The enhanced parser returns an `EnhancedParsedSignal` with:

```typescript
{
  symbol: string          // e.g., "EURUSD"
  direction: string       // e.g., "BUY"
  entryPrice?: number
  stopLoss?: number
  takeProfits?: number[]
  confidence: number      // 0.0 to 1.0
  signalType: 'new' | 'update'
  update?: {              // Only for update commands
    type: 'closeTP1' | 'breakEven' | ...
    value?: number
    percentage?: number
  }
  delayMs: number
  forceMarket: boolean
}
```

---

## 📊 Logging

Enhanced parser logs with clear indicators:

```
✅ NEW Signal: EURUSD BUY (Confidence: 85%)
🔄 UPDATE Command: closeTP1
⚠️ Could not parse signal from channel 123: ...
```

---

## 🔄 Export/Import Configurations

### Export
1. Open channel config dialog
2. Click **Export** button
3. Save JSON file: `channel-123-config.json`

### Import
1. Open channel config dialog
2. Click **Import** button
3. Select JSON file
4. Configuration is applied immediately

**Use Cases:**
- Backup configurations
- Share configs with team
- Clone config to multiple channels
- Test different parsing strategies

---

## 🧪 Testing

### Test with Sample Signals

1. Create a test Telegram channel
2. Configure keywords
3. Send test signals:
   ```
   EURUSD
   BUY @ 1.0850
   SL: 1.0820
   TP1: 1.0880
   TP2: 1.0910
   ```
4. Check logs in `error.log` and `combined.log`

### Verify Parsing

Check the `signals` table in SQLite:

```sql
SELECT
  id,
  channel_id,
  message_text,
  parsed_data,
  received_at
FROM signals
ORDER BY id DESC
LIMIT 10;
```

---

## 🚨 Troubleshooting

### Signal Not Parsing

**Problem:** Signal shows as "Could not parse"

**Solutions:**
1. Check keywords match the signal format
2. Verify channel is enabled
3. Check AI fallback is enabled
4. Add more keyword variations
5. Check logs for details

### Channel Config Not Loading

**Problem:** Config not found when monitoring starts

**Solutions:**
1. Open config dialog and click Save
2. Restart monitoring
3. Check database: `SELECT config FROM channels WHERE id = ?`

### Forwarded Messages Ignored

**Problem:** Signal from forwarded message not processing

**Solutions:**
1. Open channel config
2. Go to Additional Keyword tab
3. Enable "Read Forwarded" checkbox
4. Save configuration

---

## 🎓 Best Practices

### 1. **Use Comma-Separated Keywords**
```
entry, enter, @, price, at
```

### 2. **Include Common Variations**
```
sl, stop loss, stop, stoploss, s/l
```

### 3. **Start with Defaults, Then Customize**
- Default keywords work for most channels
- Add specific keywords only if signals aren't parsing

### 4. **Test Before Going Live**
- Test with demo account first
- Verify parsing with real channel messages
- Check logs for confidence scores

### 5. **Export Important Configs**
- Backup successful configurations
- Store externally for safety

---

## 🔮 Future Enhancements

These features are **partially implemented** and need completion:

### Image Recognition (OCR)
- Checkbox is in UI
- Parser has placeholder
- **TODO:** Integrate Tesseract or Google Vision

### Multiple TP Levels
- Parser extracts multiple TPs
- **TODO:** Handle partial closes at each TP in EA

### Trade Modification Handler
- Update commands are detected
- **TODO:** Implement handlers in main.ts
- **TODO:** Send commands to EA

---

## 📝 Code References

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `channelConfig.ts:1-110` | Type definitions | All interfaces |
| `channelConfigService.ts:1-180` | CRUD operations | Service class |
| `enhancedSignalParser.ts:1-400` | Parsing logic | Main parser |
| `telegram.ts:146-185` | Config loading | startMonitoring() |
| `telegram.ts:203-292` | Parser usage | handleNewMessage() |
| `ChannelConfigDialog.tsx:1-300` | UI component | Full UI |

### API Methods

**Get Config:**
```typescript
const config = channelConfigService.getConfig(channelId)
```

**Save Config:**
```typescript
const success = channelConfigService.saveConfig(config)
```

**Parse Signal:**
```typescript
const signal = enhancedSignalParser.parse(text, config)
```

---

## ✅ What's Complete

- ✅ Per-channel keyword configuration
- ✅ 3-tab UI (Signal/Update/Additional)
- ✅ Enhanced parser with keyword detection
- ✅ Update command detection
- ✅ Configuration save/load/export/import
- ✅ Telegram service integration
- ✅ Delay execution support
- ✅ Forwarded message filtering
- ✅ AI parser fallback
- ✅ Confidence scoring
- ✅ Settings button in channel list

---

## 🚧 What's Next

1. **Test with Real Signals** - Validate parsing works correctly
2. **Implement Trade Modifications** - Handle Close TP1, Break Even, etc.
3. **Multiple TP Support** - Execute partial closes
4. **TSC Protector** - Daily profit/loss limits

---

## 💡 Tips

1. **Keywords are case-insensitive** - "BUY" matches "buy", "Buy", "BUY"
2. **Use specific keywords first** - "buy stop" before "buy"
3. **Test with channel history** - Check if keywords match past signals
4. **Export successful configs** - Save working configurations
5. **Enable AI fallback** - Catches signals that keywords miss

---

## 📞 Support

If parsing fails:
1. Check logs: `AppData/Roaming/telegram-signal-copier/combined.log`
2. Verify keywords match signal format
3. Enable AI parser fallback
4. Test with simpler signals first

---

**Built with ❤️ for Telegram Signal Mirror**
