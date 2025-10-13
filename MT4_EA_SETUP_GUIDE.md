# MT4 Expert Advisor - Complete Setup & Testing Guide

## 🎯 Overview

This guide walks you through installing and testing the MT4 EA that connects to your Telegram Signal Copier desktop app and automatically executes trades.

---

## 📋 Prerequisites

- ✅ Desktop app running (API server on port 3737)
- ✅ MT4 installed (demo or live account)
- ✅ EA file compiled: `TelegramSignalCopier.ex4`

---

## 🔧 Step 1: Install the EA in MT4

### 1.1 Locate Your MT4 Data Folder

1. Open MT4
2. Click **File → Open Data Folder**
3. This opens: `C:\Users\[YourName]\AppData\Roaming\MetaQuotes\Terminal\[ID]\`

### 1.2 Copy EA File

1. Navigate to: `MQL4\Experts\` folder
2. Copy `TelegramSignalCopier.mq4` (source file) to this folder
3. **Compile it**:
   - Open MetaEditor (F4 or click MetaEditor icon)
   - Open `TelegramSignalCopier.mq4`
   - Click **Compile** button (or press F7)
   - Check for errors in "Errors" tab
   - If successful, you'll see `TelegramSignalCopier.ex4` created

### 1.3 Refresh MT4

- In MT4, go to **Navigator** panel (Ctrl+N)
- Right-click → **Refresh**
- You should now see "TelegramSignalCopier" under **Expert Advisors**

---

## ⚙️ Step 2: Configure MT4 Settings

### 2.1 Enable AutoTrading

1. Click the **AutoTrading** button in MT4 toolbar (should turn green)
2. Or press **Ctrl+E**

### 2.2 Allow WebRequest for API Server

**CRITICAL**: MT4 blocks external HTTP requests by default.

1. Go to: **Tools → Options → Expert Advisors**
2. Check ✅ **"Allow WebRequest for listed URL:"**
3. Add this URL: `http://localhost:3737`
4. Click **OK**
5. **Restart MT4** for changes to take effect

![WebRequest Settings](https://i.imgur.com/example.png)

---

## 🚀 Step 3: Attach EA to Chart

### 3.1 Drag EA onto Chart

1. Open any chart (e.g., EURUSD, XAUUSD)
2. In Navigator, find **Expert Advisors → TelegramSignalCopier**
3. **Drag and drop** it onto the chart

### 3.2 Configure EA Parameters

A dialog will appear with these settings:

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| **ApiServerURL** | `http://localhost:3737` | Desktop app API server URL |
| **AccountNumber** | `YOUR_MT4_ACCOUNT` | **CHANGE THIS** to your actual MT4 account number |
| **MagicNumber** | `12345` | Unique identifier for EA trades |
| **FixedLotSize** | `0.01` | Lot size when not using risk % |
| **UseRiskPercent** | `false` | Set to `true` to calculate lots by risk % |
| **RiskPercent** | `1.0` | % of account balance to risk per trade |
| **Slippage** | `3` | Maximum slippage in points |
| **MaxSpread** | `30` | Skip signals if spread > this value |
| **PollInterval** | `2` | Poll API server every N seconds |

**IMPORTANT**: Set `AccountNumber` to your MT4 account number!

Example: If your account is `12345678`, set `AccountNumber = "12345678"`

### 3.3 Enable Live Trading

1. Check ✅ **"Allow live trading"**
2. Check ✅ **"Allow DLL imports"** (if prompted)
3. Click **OK**

---

## ✅ Step 4: Verify Connection

### 4.1 Check Expert Tab

1. Open **Terminal** panel (Ctrl+T)
2. Go to **Experts** tab
3. You should see:

```
===========================================
Telegram Signal Copier EA v1.0
===========================================
API Server: http://localhost:3737
Account: YOUR_ACCOUNT_NUMBER
Poll Interval: 2 seconds
✅ Successfully connected to API server
EA initialized successfully - Waiting for signals...
```

### 4.2 Troubleshooting Connection Issues

If you see errors:

**Error: "URL not allowed"**
```
ERROR: Function is not allowed for call
```
✅ **Solution**: Go back to Step 2.2 and add `http://localhost:3737` to WebRequest whitelist

**Warning: "Cannot connect to API server"**
```
WARNING: Cannot reach API server (Error 4060)
```
✅ **Solution**:
1. Make sure desktop app is running
2. Verify API server started (check desktop app logs)
3. Try accessing `http://localhost:3737/api/health` in your browser

---

## 🧪 Step 5: Test the Complete Flow

### 5.1 Start Desktop App

1. Launch Telegram Signal Copier desktop app
2. Connect to Telegram
3. Select a test channel
4. Click **"Start Monitoring"**

### 5.2 Send a Test Signal

In your Telegram channel, send a test signal:

```
XAUUSD
BUY
Entry: 2650.50
SL: 2645
TP: 2655
```

### 5.3 Watch the Magic!

**In Desktop App:**
- Signal appears in Signal Feed
- Signal is parsed by AI
- Signal added to API queue

**In MT4 Experts Tab:**
```
========================================
📊 NEW SIGNAL RECEIVED
========================================
Signal ID: 1234567890-0
Symbol: XAUUSD
Direction: BUY
Entry: 2650.5
Stop Loss: 2645
Current Spread: 15 points
Calculated Lot Size: 0.01
Attempting to BUY XAUUSD at 2650.52
Lot Size: 0.01 | SL: 2645
✅ BUY order opened successfully!
   Ticket: 123456789
   Symbol: XAUUSD
   Lots: 0.01
   Price: 2650.52
✅ Signal acknowledged: success
========================================
```

**In MT4 Terminal:**
- Go to **Trade** tab
- You should see your new order!

---

## 📊 How It Works (Architecture)

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Telegram   │────────▶│ Desktop App  │         │     MT4      │
│   Channel    │         │ (Port 3737)  │         │      EA      │
└──────────────┘         └──────────────┘         └──────────────┘
                                │                         │
                                │   1. Signal arrives     │
                                │   2. AI parses it       │
                                │   3. Added to queue     │
                                │                         │
                                │                         │  Polls every 2s
                                │◀────────────────────────┤
                                │                         │
                                │  GET /api/signals/pending?account=123
                                │─────────────────────────▶
                                │                         │
                                │  Response: [{signal}]   │
                                │─────────────────────────▶
                                │                         │
                                │                         │  4. Executes trade
                                │                         │  5. Gets ticket
                                │                         │
                                │◀────────────────────────┤
                                │                         │
                                │  POST /api/signals/ack  │
                                │  {status: "success", ticket: 123}
                                │◀────────────────────────┤
```

---

## 🐛 Common Issues & Solutions

### Issue 1: EA Not Receiving Signals

**Symptoms**: Desktop app shows signals, but MT4 EA doesn't receive them

**Solutions**:
1. Check `AccountNumber` parameter is set correctly
2. Verify API server is running (check desktop app)
3. Check Experts tab for connection errors
4. Try restarting both desktop app and MT4

### Issue 2: Orders Not Executing

**Symptoms**: EA receives signals but orders fail

**Solutions**:
1. Check AutoTrading is enabled (green button)
2. Verify you have sufficient margin
3. Check spread is not too high (increase `MaxSpread` if needed)
4. Look for error codes in Experts tab:
   - **Error 134**: Not enough money
   - **Error 130**: Invalid stops (SL/TP too close to market)
   - **Error 132**: Market is closed

### Issue 3: "Trade is not allowed" Error

**Error**: `ERROR: AutoTrading is not enabled!`

**Solution**: Click the AutoTrading button in MT4 toolbar (should turn green)

### Issue 4: Multiple Duplicate Trades

**Symptoms**: Each signal creates multiple identical trades

**Solutions**:
1. Check you only have ONE EA instance running
2. Remove EA from other charts
3. Increase `PollInterval` to 3-5 seconds

---

## 📈 Performance Optimization

### Reduce Latency

- Set `PollInterval = 1` for faster polling (1 second)
- Run desktop app and MT4 on same machine
- Use VPS with low latency

### Risk Management

- Set `UseRiskPercent = true` to calculate lot sizes dynamically
- Adjust `RiskPercent` based on your risk tolerance (0.5% - 2%)
- Set `MaxSpread` to avoid trading in volatile conditions

---

## 🎓 Next Steps

1. ✅ **Test with demo account** first
2. ✅ Send multiple test signals to verify behavior
3. ✅ Test with different symbols (EURUSD, GBPUSD, XAUUSD, etc.)
4. ✅ Monitor performance for 1-2 days
5. ✅ Once confident, switch to live account

---

## 💡 Pro Tips

1. **Multiple Accounts**: To copy to multiple MT4 accounts, run multiple MT4 instances, each with the EA attached
2. **Different Settings**: Each EA instance can have different `RiskPercent` or `FixedLotSize`
3. **Channel-Specific Routing**: In future, desktop app can route signals to specific accounts
4. **Monitoring**: Keep Experts tab open to watch for errors
5. **Logging**: All activity is logged - check logs if issues occur

---

## 🆘 Support

If you encounter issues:

1. **Check Experts tab** for error messages
2. **Check desktop app logs** (`dev.log` or `error.log`)
3. **Verify API server** is accessible: `http://localhost:3737/api/health`
4. **Test with simple signal** first before complex ones

---

## ✅ Success Checklist

Before going live, verify:

- [ ] Desktop app running and connected to Telegram
- [ ] Monitoring at least one channel
- [ ] MT4 EA installed and configured
- [ ] AutoTrading enabled (green button)
- [ ] WebRequest URL whitelisted
- [ ] Test signal successfully opened trade
- [ ] Signal acknowledgment received
- [ ] Account number set correctly in EA
- [ ] Risk settings configured appropriately

---

**🎉 Congratulations!** You now have a fully automated Telegram-to-MT4 signal copying system!
