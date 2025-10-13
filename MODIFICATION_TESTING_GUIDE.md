# Modification System Testing Guide

This guide provides step-by-step instructions to test the complete trade modification flow from Telegram messages to MT4 execution.

## System Overview

The modification flow works as follows:
1. **Telegram Message** → Update command received (e.g., "TP1 hit", "Move to breakeven")
2. **Enhanced Parser** → Detects update type using channel-specific keywords
3. **Trade Modification Handler** → Creates modification command and emits event
4. **API Server** → Queues modification command
5. **MT4 EA** → Polls, receives, executes, and acknowledges modification
6. **Database** → Updates trade status and records

## Prerequisites

Before testing, ensure:
- ✅ Desktop app is running
- ✅ Connected to Telegram
- ✅ Monitoring at least one channel
- ✅ Channel configuration is set up with update keywords
- ✅ MT4 EA is attached to a chart and running
- ✅ At least one test trade is open (created by a signal)

## Test Setup

### 1. Create Test Trades

First, you need some open trades to modify. Send this test signal via Telegram:

```
EURUSD
BUY
Entry: 1.0900
SL: 1.0850
TP1: 1.0950
TP2: 1.1000
TP3: 1.1050
```

Verify the trade opened in MT4.

### 2. Configure Channel Keywords

Open the channel settings and ensure these update keywords are configured:

**Close TP Keywords:**
- closeTP1: `["tp1 hit", "tp1 reached", "close tp1"]`
- closeTP2: `["tp2 hit", "tp2 reached", "close tp2"]`
- closeTP3: `["tp3 hit", "tp3 reached", "close tp3"]`
- closeTP4: `["tp4 hit", "tp4 reached", "close tp4"]`

**Break Even Keywords:**
- breakEven: `["move to breakeven", "move sl to entry", "breakeven"]`

**Close Position Keywords:**
- closeFull: `["close all", "close full", "exit all"]`
- closeHalf: `["close 50%", "close half"]`
- closePartial: `["close 25%", "close 30%"]`

**Set TP/SL Keywords:**
- setTP: `["new tp", "set tp", "update tp"]`
- setSL: `["new sl", "set sl", "update sl"]`

**Delete Pending:**
- deletePending: `["delete pending", "cancel pending", "remove pending orders"]`

## Test Cases

### Test 1: Close TP1 (Partial Close)

**Purpose:** Verify that TP1 close command works

**Steps:**
1. Ensure you have an open EURUSD trade
2. Send this message in the monitored Telegram channel:
   ```
   EURUSD TP1 hit
   Close 50%
   Move SL to entry
   ```
3. Check Desktop App console logs for:
   ```
   🔄 UPDATE Command detected: closeTP1
   Sending modification command: close for 1 trade(s)
   ```
4. Check MT4 Expert tab for:
   ```
   ⚙️ Processing 1 modification command(s)
   🔄 Executing modification: close
   Closing 50% of positions: Close TP1
   ✅ Closed order #12345 (0.05 lots)
   ```
5. Verify in MT4 that 50% of the position was closed

**Expected Result:** ✅ 50% of position closed, remaining 50% still open

---

### Test 2: Move to Break Even

**Purpose:** Verify that stop loss is moved to entry price

**Steps:**
1. Ensure you have an open trade with profit
2. Send this message:
   ```
   EURUSD
   Move to breakeven
   ```
3. Check logs for modification command
4. Check MT4 for SL modification:
   ```
   🔄 Executing modification: modify_sl
   Modifying SL to: 1.0900
   ✅ Modified SL for order #12345
   ```
5. Verify in MT4 that SL was moved to entry price

**Expected Result:** ✅ Stop loss moved to entry price (no loss scenario)

---

### Test 3: Close Full Position

**Purpose:** Verify complete position closure

**Steps:**
1. Ensure you have an open trade
2. Send this message:
   ```
   EURUSD close all
   Target reached
   ```
3. Check logs for close command
4. Check MT4:
   ```
   Closing 100% of positions: Close Full
   ✅ Closed order #12345 (0.10 lots)
   ```
5. Verify position is completely closed

**Expected Result:** ✅ All positions closed, no remaining orders

---

### Test 4: Set New Take Profit

**Purpose:** Verify TP modification

**Steps:**
1. Open a EURUSD trade
2. Send this message:
   ```
   EURUSD
   New TP: 1.1100
   ```
3. Check logs for modify_tp command
4. Check MT4:
   ```
   Modifying TP to: 1.1100
   ✅ Modified TP for order #12345
   ```
5. Verify TP was updated in MT4

**Expected Result:** ✅ Take profit updated to 1.1100

---

### Test 5: Set New Stop Loss

**Purpose:** Verify SL modification

**Steps:**
1. Open a trade
2. Send:
   ```
   EURUSD
   Set SL: 1.0870
   ```
3. Check for modify_sl command
4. Verify SL updated in MT4

**Expected Result:** ✅ Stop loss updated to 1.0870

---

### Test 6: Delete Pending Orders

**Purpose:** Verify pending order deletion

**Steps:**
1. Place a pending BUYSTOP order via signal or manually
2. Send:
   ```
   EURUSD
   Delete pending orders
   ```
3. Check logs for delete command
4. Check MT4:
   ```
   Deleting pending orders
   ✅ Deleted pending order #12346
   ```
5. Verify pending order was deleted

**Expected Result:** ✅ Pending orders deleted, market positions unaffected

---

### Test 7: Close All (Emergency)

**Purpose:** Verify emergency close all functionality

**Steps:**
1. Open multiple trades on different symbols
2. Send:
   ```
   Close all positions immediately
   ```
3. Check logs for close_all command
4. Check MT4:
   ```
   Closing ALL positions
   ✅ Closed order #12345
   ✅ Closed order #12346
   ```
5. Verify all positions are closed

**Expected Result:** ✅ All positions and pending orders closed

---

### Test 8: Partial Close with Percentage

**Purpose:** Verify custom percentage closure

**Steps:**
1. Open a 0.10 lot trade
2. Send:
   ```
   EURUSD
   Close 25%
   ```
3. Verify 0.025 lots (25%) are closed
4. Verify 0.075 lots (75%) remain open

**Expected Result:** ✅ Exact percentage closed

---

### Test 9: Multiple Modifications

**Purpose:** Verify sequential modification handling

**Steps:**
1. Open a trade
2. Send multiple commands in sequence:
   ```
   EURUSD TP1 hit
   Close 50%
   ```
3. Wait 3 seconds, then send:
   ```
   EURUSD
   Move to breakeven
   ```
4. Wait 3 seconds, then send:
   ```
   EURUSD
   New TP: 1.1200
   ```
5. Verify each command executes in order

**Expected Result:** ✅ All modifications executed sequentially

---

### Test 10: Invalid/Ignored Messages

**Purpose:** Verify ignore keywords work

**Steps:**
1. Configure ignore keywords: `["ignore", "not a signal"]`
2. Send:
   ```
   Ignore this message
   EURUSD might go up
   ```
3. Verify no modification command is created
4. Check logs for:
   ```
   ⏭️ Message ignored due to skip keyword
   ```

**Expected Result:** ✅ Message ignored, no action taken

---

## Monitoring and Debugging

### Desktop App Console Logs

Watch for these key log messages:

```
✅ NEW Signal detected
🔄 UPDATE Command detected: [type]
Sending modification command: [type] for [N] trade(s)
EA acknowledged modification
```

### MT4 Expert Tab

Watch for these messages:

```
⚙️ Processing N modification command(s)
🔄 Executing modification: [type]
✅ Closed/Modified order #[ticket]
❌ Failed to close/modify order #[ticket]: [error]
Acknowledged modification
```

### Common Issues and Solutions

#### Issue 1: No modifications detected
**Symptoms:** Telegram messages not triggering modifications
**Solutions:**
- Check channel configuration keywords match message text
- Verify channel is being monitored
- Check Desktop App logs for parsing errors
- Ensure `isEnabled` is true for the channel

#### Issue 2: EA not receiving modifications
**Symptoms:** Commands queued but EA doesn't execute
**Solutions:**
- Check EA is running and attached to chart
- Verify API_URL is set to `http://localhost:3737`
- Check MT4 Tools → Options → Expert Advisors → Allow WebRequest is enabled
- Add `http://localhost:3737` to allowed URLs

#### Issue 3: Modifications fail to execute
**Symptoms:** EA receives but can't execute
**Solutions:**
- Check trade exists with correct MagicNumber
- Verify broker allows modifications during trading hours
- Check minimum lot size for partial closes
- Review MT4 error codes in Expert tab

#### Issue 4: Partial close fails
**Symptoms:** Full position closes instead of partial
**Solutions:**
- Check broker supports partial close
- Verify lot size calculation (must be >= minimum lot)
- Some brokers require full close for small positions

## Database Verification

After testing, check the database to ensure trades are tracked:

1. Open SQLite database at: `%APPDATA%\telegram-signal-copier\telegram-signal-copier.db`
2. Query trades table:
   ```sql
   SELECT * FROM trades ORDER BY created_at DESC LIMIT 10;
   ```
3. Verify:
   - `tp_level` is set correctly
   - `status` changes from 'open' to 'closed'
   - `profit` is recorded
   - `closed_at` timestamp is set

## API Endpoint Testing

You can also test the API directly:

### Check Pending Modifications
```bash
curl http://localhost:3737/api/modifications/pending?account=YOUR_ACCOUNT_NUMBER
```

Expected response:
```json
{
  "modifications": [
    {
      "type": "close",
      "accountNumber": "1234567",
      "platform": "MT4",
      "trades": [...],
      "percentage": 50,
      "reason": "Close TP1"
    }
  ]
}
```

### Check Queue Status
```bash
curl http://localhost:3737/api/signals/status
```

Expected response:
```json
{
  "queueSize": 0,
  "processedCount": 5
}
```

## Success Criteria

✅ **Complete Success** if:
1. All 10 test cases pass
2. No errors in Desktop App logs
3. No errors in MT4 Expert tab
4. Trades are modified correctly in MT4
5. Database records are accurate
6. EA acknowledges all commands

⚠️ **Partial Success** if:
1. Most tests pass but some edge cases fail
2. Minor parsing issues with specific keyword formats
3. Broker-specific limitations (e.g., no partial close)

❌ **Failure** if:
1. Modifications are not detected from Telegram
2. Commands not sent to EA
3. EA doesn't receive or execute commands
4. System crashes or freezes

## Performance Benchmarks

Expected performance metrics:
- **Telegram → Parser:** < 100ms
- **Parser → Modification Handler:** < 50ms
- **Handler → API Queue:** < 10ms
- **EA Poll → Execute:** < 2 seconds (poll interval)
- **Total Latency:** 2-3 seconds from Telegram message to execution

## Next Steps After Testing

Once all tests pass:
1. ✅ Mark modification system as complete
2. 📝 Update PROJECT_STATUS.md
3. 🎯 Move to next priority: TSC Protector implementation
4. 📊 Consider adding analytics dashboard for modifications
5. 🔒 Add error recovery and retry logic

## Additional Resources

- **Per-Channel Config Guide:** `PER_CHANNEL_CONFIG_GUIDE.md`
- **Project Status:** `PROJECT_STATUS.md`
- **Signal Parser Types:** `electron/types/channelConfig.ts`
- **Modification Handler:** `electron/services/tradeModificationHandler.ts`
- **MT4 EA Code:** `mt4-ea/TelegramSignalCopier.mq4`

---

**Last Updated:** October 2025
**Version:** 1.0
**Status:** Ready for testing
