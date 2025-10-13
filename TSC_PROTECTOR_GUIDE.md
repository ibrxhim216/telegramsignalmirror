# 🛡️ TSC Protector - User Guide

**Version:** 1.0
**Status:** ✅ Complete and Ready to Use
**Date:** October 2025

---

## What is TSC Protector?

**TSC Protector** is an advanced risk management system that protects your trading account from excessive losses and helps you achieve consistent profit targets. It automatically monitors your daily performance and takes protective actions when limits are reached.

### Key Benefits

✅ **Prevents Account Blowups** - Automatically closes all positions when daily loss limit is hit
✅ **Locks in Profits** - Stops trading when your daily profit target is reached
✅ **Prop Firm Compliant** - FIFO mode ensures you meet prop firm requirements
✅ **Trade Count Control** - Limits maximum trades per day to prevent overtrading
✅ **Equity Protection** - Stops trading if account equity drops too low
✅ **Automatic Reset** - Daily stats reset at your configured time

---

## Features Overview

### 1. Daily Profit Target 💰

Stop trading after reaching your profit goal for the day.

**Options:**
- Fixed amount ($500)
- Percentage of balance (5%)
- Auto-close all positions when target hit
- Or just stop opening new trades

**Use Case:** "I want to lock in $300 profit per day and stop trading"

---

### 2. Daily Loss Limit 🚨

Protect your account by limiting daily losses.

**Options:**
- Fixed amount ($200)
- Percentage of balance (2%)
- Auto-close all positions when limit hit
- Or just stop opening new trades

**Use Case:** "Never lose more than 2% of my account in a single day"

---

### 3. Maximum Trades Per Day 📊

Prevent overtrading by limiting trade count.

**Options:**
- Set maximum number of trades (e.g., 10 per day)
- Blocks new signals after limit reached
- Resets daily

**Use Case:** "Only take the best 5 signals per day"

---

### 4. FIFO Mode (First In, First Out) 🔄

Required by many prop firms - close oldest trades first.

**Options:**
- Enable FIFO compliance
- Close oldest first option
- Automatic enforcement

**Use Case:** "My prop firm requires FIFO, need to close oldest positions first"

---

### 5. Equity Protection 🛡️

Stop trading if account equity drops below a threshold.

**Options:**
- Minimum equity percentage (e.g., 80% of balance)
- Automatic trading suspension
- Resumes when equity recovers

**Use Case:** "Stop trading if equity drops below 90% of balance"

---

## How It Works

### Normal Trading Flow (No Limits Hit)

```
1. New signal received from Telegram
2. TSC Protector checks: Can this trade be opened?
   - Check daily profit/loss
   - Check trade count
   - Check equity level
3. If all checks pass → Trade opens
4. Trade closes with profit/loss
5. TSC Protector updates daily stats
6. Checks limits again
7. If limits NOT hit → Continue trading normally
```

### When Limit Is Hit

```
1. Trade closes and profit/loss updated
2. TSC Protector detects limit hit:
   - Profit target reached: $310 / $300 ✅
   OR
   - Loss limit hit: -$205 / -$200 🚨
3. Action taken based on settings:
   - Close All Positions: Immediately closes everything
   - Stop New Trades: Blocks opening new trades
   - Notify: Sends alert to user
4. Trading paused until daily reset
5. At reset time (e.g., midnight UTC):
   - Daily stats cleared
   - Counters reset to zero
   - Trading allowed again
```

---

## Configuration Guide

### Basic Setup (Recommended for Beginners)

**Step 1: Enable TSC Protector**
```
✅ Enable TSC Protector
```

**Step 2: Set Daily Loss Limit (IMPORTANT)**
```
✅ Enable daily loss limit
   Amount: $200 (or 2% of balance)
✅ Close all positions when loss limit hit
✅ Pause trading until reset
```

**Step 3: Optional Profit Target**
```
✅ Enable daily profit target
   Amount: $500 (or 5% of balance)
✅ Close all positions when profit target hit
```

**Step 4: Reset Time**
```
Reset Time: 00:00 (midnight UTC)
```

### Advanced Setup (Prop Firm Traders)

**For FTMO, MyForexFunds, etc.**

```
✅ Enable TSC Protector

Daily Loss Limit:
✅ Enabled
✅ Use percentage: 2%
✅ Close all on limit
✅ Pause until reset

Daily Profit Target:
✅ Enabled
✅ Fixed amount: $300
❌ Close all on profit (let winners run)
✅ Stop new trades on profit

Max Trades Per Day:
✅ Enabled
   Count: 5 trades

FIFO Mode:
✅ Enabled
✅ Close oldest first

Equity Protection:
✅ Enabled
   Minimum: 95% of balance

Reset Time: 00:00 UTC
```

### Conservative Setup (Risk-Averse)

```
Daily Loss Limit: 1% of balance
Daily Profit Target: 3% of balance
Max Trades: 3 per day
Close all immediately on any limit
Equity Protection: 98%
```

### Aggressive Setup (Experienced Traders)

```
Daily Loss Limit: 5% of balance
Daily Profit Target: 10% of balance
Max Trades: 20 per day
Stop new trades but keep existing
Equity Protection: 80%
```

---

## Settings Explained

### Limits Tab

| Setting | Description | Recommendation |
|---------|-------------|----------------|
| **Enable Profit Target** | Stop after hitting daily profit goal | Optional |
| **Profit Amount/Percent** | Target in $ or % | 3-5% or $300-500 |
| **Enable Loss Limit** | Stop after hitting daily loss limit | **REQUIRED** |
| **Loss Amount/Percent** | Limit in $ or % | 1-2% or $100-200 |
| **Enable Trade Count** | Limit number of trades per day | Recommended |
| **Max Trades** | Maximum trades allowed | 5-10 trades |

### Actions Tab

| Setting | Description | Recommendation |
|---------|-------------|----------------|
| **Close All on Profit** | Close everything when profit target hit | Yes for day traders |
| **Close All on Loss** | Close everything when loss limit hit | **YES** (critical) |
| **Stop New Trades** | Block new signals after limit | **YES** |
| **Send Notifications** | Alert when limit hit | **YES** |
| **Reset Time** | When to reset daily stats | Midnight UTC |

### Advanced Tab

| Setting | Description | Recommendation |
|---------|-------------|----------------|
| **FIFO Mode** | Close oldest trades first | Yes for prop firms |
| **Equity Protection** | Stop if equity drops | Yes, 90-95% |
| **Pause Until Reset** | Block trades until next day | Yes for safety |
| **Allow Close Only** | Can close but not open when paused | Yes |

---

## Real-World Examples

### Example 1: Small Account Protection

**Account:** $1,000
**Goal:** Grow slowly, never blow up

```yaml
Settings:
  Daily Loss Limit: 1% ($10)
  Close All on Loss: Yes
  Daily Profit Target: 2% ($20)
  Stop New Trades on Profit: Yes
  Max Trades: 3 per day
```

**Result:** Maximum risk $10/day, maximum 3 trades. Can't blow up account.

---

### Example 2: Prop Firm Challenge

**Account:** $100,000 FTMO Challenge
**Goal:** Pass phase 1 (10% profit, 10% loss limit)

```yaml
Settings:
  Daily Loss Limit: 2% ($2,000)
  Close All on Loss: Yes
  Daily Profit Target: 5% ($5,000)
  Stop New Trades on Profit: Yes
  Max Trades: 5 per day
  FIFO Mode: Enabled
  Equity Protection: 95%
```

**Result:** Safe progress toward 10% target, can't violate daily loss rule.

---

### Example 3: Aggressive Day Trader

**Account:** $50,000
**Goal:** Make $500/day

```yaml
Settings:
  Daily Loss Limit: 3% ($1,500)
  Close All on Loss: Yes
  Daily Profit Target: 1% ($500)
  Close All on Profit: Yes (lock in profit)
  Max Trades: 10 per day
```

**Result:** Either hits $500 profit and stops, or hits $1,500 loss and stops. Controlled risk.

---

## Statistics Dashboard

### What You Can See

**Live Status:**
- Current daily P/L
- Trades opened today
- Remaining capacity (profit, loss, trades)
- Time until reset

**Example Display:**
```
📊 TSC Protector Status
-----------------------------
Account: 12345678 (MT4)
Status: ACTIVE ✅

Today's Performance:
  Profit/Loss: +$245.50
  Target: $500 (49% reached)
  Loss Limit: $200 (not hit)

Trades:
  Opened: 3 / 10 max
  Remaining: 7 trades

Next Reset: 6h 23m
```

---

## Notifications

### Limit Hit Alert

```
⚠️ TSC PROTECTOR ALERT

Account: 12345678
Limit Type: DAILY LOSS LIMIT
Current Loss: $205.00
Limit: $200.00

Action Taken: All positions closed
Status: Trading paused until midnight UTC
```

### Profit Target Reached

```
🎉 TSC PROTECTOR ALERT

Account: 12345678
Limit Type: DAILY PROFIT TARGET
Current Profit: $502.00
Target: $500.00

Action Taken: All positions closed
Status: Great job! Stats reset at midnight UTC
```

---

## Best Practices

### ✅ Do's

1. **Always set a daily loss limit** - This is your safety net
2. **Use percentage-based limits** - Scales with account size
3. **Set realistic targets** - 2-5% per day is excellent
4. **Enable notifications** - Know when limits hit
5. **Review daily stats** - Learn from your performance
6. **Use FIFO mode** - If required by your broker/prop firm

### ❌ Don'ts

1. **Don't disable protector during losses** - That's when you need it most
2. **Don't set limits too high** - Defeats the purpose
3. **Don't ignore limit hits** - Respect the rules you set
4. **Don't overtrade** - Use max trades per day limit
5. **Don't chase losses** - Let the protector save you

---

## Troubleshooting

### Issue: Protector not blocking trades

**Solutions:**
- Verify TSC Protector is enabled
- Check account number matches
- Ensure limit is actually hit (check status)
- Restart the application

### Issue: Trades not closing on limit hit

**Solutions:**
- Verify "Close All on Limit" is checked
- Check MT4 EA is running and connected
- Check modification system is working
- Review logs for errors

### Issue: Stats not resetting

**Solutions:**
- Verify reset time is set correctly
- Check timezone (must be UTC)
- Wait for scheduled reset time
- Manually restart application at reset time

### Issue: Wrong profit/loss calculation

**Solutions:**
- Ensure all trades are tracked in database
- Check trade closing profit is reported correctly
- Verify account balance is accurate
- Review trade manager logs

---

## Integration with Other Features

### Works With:

✅ **Signal Parser** - Blocks signals when limits hit
✅ **Modification Handler** - Uses close all command
✅ **Channel Config** - Per-channel settings respected
✅ **MT4/MT5 EAs** - Automatic position closing
✅ **Multi-Account** - Separate limits per account

### Complements:

- **Per-Channel Risk Settings** - Combined with protector for double safety
- **Trade Filters** - Pre-signal filtering + post-limit protection
- **Time Filters** - Don't trade during news + daily limits

---

## FAQ

**Q: Can I have different limits for different accounts?**
A: Yes! Each account can have its own protector settings.

**Q: What happens if I manually close trades?**
A: The protector tracks all closures and updates stats accordingly.

**Q: Can I disable protector temporarily?**
A: Yes, just uncheck "Enable TSC Protector". But be careful!

**Q: Does this work with all platforms?**
A: Yes - MT4, MT5, cTrader, DXTrade, TradeLocker all supported.

**Q: What if I hit profit target but want to keep trading?**
A: Set "Stop New Trades" instead of "Close All". Your existing trades continue.

**Q: Is FIFO mode required?**
A: Only if your broker or prop firm requires it. Otherwise optional.

**Q: Can I change limits mid-day?**
A: Yes, but stats already accumulated remain. Changes apply to new trades.

**Q: What timezone is reset time in?**
A: UTC. If you want 8 AM New York time (EST), set to 13:00 UTC.

---

## Technical Details

### Database Storage

Settings stored in: `settings` table with key `protector_{platform}_{account}`
Daily stats stored in: `settings` table with key `protector_stats_{account}`

### Event System

TSC Protector emits events:
- `limitHit` - When any limit is reached
- `closeAll` - Triggers position closure
- `notification` - Sends alerts to UI
- `statsReset` - Daily reset occurred

### Performance

- Checks occur in < 10ms
- No impact on signal processing speed
- Lightweight database operations
- Automatic daily cleanup

---

## Future Enhancements

Coming soon:
- [ ] Weekly and monthly limits
- [ ] Consecutive loss protection (max 3 losses in a row)
- [ ] Time-based limits (max loss per hour)
- [ ] Profit/loss curves and analytics
- [ ] Email/SMS notifications
- [ ] Custom reset schedules (per session)

---

## Support

For issues or questions:
1. Check logs in `%APPDATA%\telegram-signal-copier\logs`
2. Verify settings in database
3. Test with small limits first
4. Contact support with account number and error details

---

**Remember: TSC Protector is your safety net. Set it up once, and trade with confidence knowing your account is protected!** 🛡️
