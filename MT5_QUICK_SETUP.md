# MT5 Quick Setup & Testing Guide

## 🚀 Quick Steps (5 minutes)

### Step 1: Install EA

1. Open MT5
2. **File → Open Data Folder**
3. Navigate to `MQL5\Experts\`
4. Copy `TelegramSignalCopier.mq5` to this folder
5. In MT5, press **F4** (opens MetaEditor)
6. Open `TelegramSignalCopier.mq5`
7. Click **Compile** (F7)
8. Close MetaEditor

### Step 2: Enable WebRequest

**CRITICAL - EA won't work without this!**

1. **Tools → Options → Expert Advisors**
2. Check ✅ **"Allow WebRequest for listed URL:"**
3. Add: `http://localhost:3737`
4. Click **OK**
5. **Restart MT5**

### Step 3: Attach EA to Chart

1. Open any chart (EURUSD, XAUUSD, etc.)
2. In **Navigator** panel (Ctrl+N):
   - Find **Expert Advisors → TelegramSignalCopier**
3. **Drag and drop** onto chart
4. Configure parameters:
   - **AccountNumber**: Change `YOUR_MT5_ACCOUNT` to your actual MT5 account number
   - Keep other defaults for now
5. Check ✅ **"Allow live trading"**
6. Click **OK**

### Step 4: Enable AutoTrading

- Click the **AutoTrading** button in toolbar (should turn green)
- Or press **Ctrl+E**

### Step 5: Verify Connection

Open **Terminal** panel (Ctrl+T) → **Experts** tab

You should see:
```
===========================================
Telegram Signal Copier EA v1.0 (MT5)
===========================================
API Server: http://localhost:3737
Account: YOUR_ACCOUNT_NUMBER
✅ Successfully connected to API server
EA initialized successfully - Waiting for signals...
```

---

## 🧪 Test Now!

### Prerequisites
- ✅ Desktop app running
- ✅ Telegram connected
- ✅ At least one channel monitoring
- ✅ MT5 EA attached and connected

### Send Test Signal

In your Telegram channel, send:
```
XAUUSD
SELL STOP
Entry: 2650
SL: 2655
TP: 2645
```

### Watch the Logs!

**In MT5 Experts Tab:**
```
========================================
📊 NEW SIGNAL RECEIVED
========================================
Signal ID: 1234567890-0
Symbol: XAUUSD
Direction: SELL
Entry: 2650
Stop Loss: 2655
Current Spread: 15 points
Calculated Lot Size: 0.01
Attempting to SELL XAUUSD at 2650.12
✅ SELL order opened successfully!
   Ticket: 123456789
✅ Signal acknowledged: success
========================================
```

**In MT5 Terminal → Trade Tab:**
- Your order should appear!

---

## 🐛 Troubleshooting

### Error: "URL not allowed"
**Solution**: Go back to Step 2, add `http://localhost:3737` to WebRequest whitelist, restart MT5

### Warning: "Cannot connect to API server"
**Solution**: Make sure desktop app is running and connected to Telegram

### No trades executing
**Solutions**:
- Check AutoTrading is enabled (green button)
- Verify `AccountNumber` is set correctly
- Check you have sufficient margin
- Look for errors in Experts tab

---

## ✅ MT5 Advantages Over MT4

- ✅ Better error messages (built-in descriptions)
- ✅ More reliable trade execution
- ✅ Better position management
- ✅ Modern MQL5 syntax
- ✅ Native 64-bit support

---

## 🎯 Next: Test the Full Flow!

Once you confirm connection works, send a real test signal and verify:
1. Signal appears in desktop app
2. MT5 EA receives it
3. Trade is executed
4. Confirmation sent back to desktop app

**Ready to test? Let's go!** 🚀
