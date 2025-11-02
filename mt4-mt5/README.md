# MT4/MT5 Expert Advisors

## Version 2.0

The Telegram Signal Mirror Expert Advisors (EAs) for MT4 and MT5 now have **complete feature parity**. Both versions include all advanced features for professional signal copying.

## Installation

### For MT4:
1. Copy `TelegramSignalMirror.mq4` to: `[MT4 Data Folder]/MQL4/Experts/`
2. Restart MT4 or click "Refresh" in the Navigator panel
3. Drag the EA onto any chart
4. Enable "AutoTrading" button

### For MT5:
1. Copy `TelegramSignalMirror.mq5` to: `[MT5 Data Folder]/MQL5/Experts/`
2. Restart MT5 or press F4 to open MetaEditor, then compile the file
3. Drag the EA onto any chart
4. Enable "AutoTrading" button

## Enabling WebRequest

⚠️ **CRITICAL**: For the EA to communicate with the desktop app, you must allow the URL:

1. Go to: **Tools → Options → Expert Advisors**
2. Check **"Allow WebRequest for listed URL"**
3. Add: `http://127.0.0.1:3737`
4. Click OK and restart MT4/MT5

Without this, the EA cannot receive signals!

## Features

### ✅ Symbol Mapping
- **SymbolPrefix**: Add prefix to all symbols (e.g., broker uses "EURUSD.pro")
- **SymbolSuffix**: Add suffix to all symbols
- **SkipPrefixSuffixPairs**: Comma-separated list of symbols to skip mapping
- **ExcludedSymbols**: Symbols to never trade
- **SymbolsToTrade**: Whitelist of allowed symbols (empty = all allowed)

### ✅ Advanced Risk Management
Three risk modes available:

**RISK_FIXED**
- Trade fixed lot size every time
- `FixedLotSize`: Lot size to use (default: 0.01)

**RISK_PERCENT**
- Risk a percentage of account balance
- `RiskPercent`: % of balance to risk (default: 2.0%)
- Automatically calculates lot size based on SL distance

**RISK_AMOUNT**
- Risk a fixed dollar amount
- `RiskAmount`: $ amount to risk per trade (default: $100)
- Automatically calculates lot size based on SL distance

### ✅ Signal Modification
- **ReverseSignal**: Flip BUY ↔ SELL, STOP ↔ LIMIT
- **EntryModificationPips**: Adjust entry price by X pips
- **SlModificationPips**: Adjust SL by X pips
- **TpModificationPips**: Adjust all TPs by X pips

### ✅ SL/TP Override
**Predefined SL/TP Mode:**
- Set fixed SL/TP in pips regardless of signal values
- `PredefinedSL`: Override SL (in pips)
- `PredefinedTP1-5`: Override each TP level (in pips)

**Risk:Reward Mode:**
- Calculate TPs automatically based on SL distance
- `EnableRRMode`: Enable R:R mode
- `RRRatioTP1`: TP1 = SL distance × ratio (default: 2.0)
- `RRRatioTP2-5`: Additional TP levels with higher ratios

### ✅ Trade Filters
- **MaxRetries**: Retry failed orders (default: 3)
- **ForceMarketExecution**: Convert all pending orders to market orders
- **IgnoreWithoutSL**: Skip signals without stop loss
- **IgnoreWithoutTP**: Skip signals without take profit
- **CheckAlreadyOpenedOrder**: Prevent duplicate trades on same symbol
- **PipsTolerance**: Tolerance for market execution detection

### ✅ Breakeven Automation
- **EnableBreakeven**: Automatically move SL to breakeven
- **MoveSlAfterXPips**: Move SL after X pips profit
- **BreakevenPips**: Add buffer pips to entry (default: 2 pips)
- **MoveSlAfterTPHit**: Move SL to breakeven when first TP hits

### ✅ Partial Close at Each TP
- **ClosePercentAtTP1-5**: Close X% of position at each TP level
- Example: TP1=25%, TP2=25%, TP3=50% = Scale out gradually
- **Note**: MT4 has limitations with partial closes - see below

### ✅ Trailing Stop
- **UseTrailingStop**: Enable trailing stop
- **TrailingStartPips**: Start trailing after X pips profit (default: 5)
- **TrailingStepPips**: Move SL every X pips (default: 1)
- **TrailingDistancePips**: Distance from current price (default: 5)
- **TrailingStartAfterTPHit**: Only start trailing after TP1/2/3/4/5 hits

### ✅ Time Filter
- **EnableTimeFilter**: Only trade during specific times
- **StartTime**: Start time (HH:MM format, default: "01:00")
- **EndTime**: End time (HH:MM format, default: "23:00")
- **TradeOnMonday-Sunday**: Enable/disable trading on specific days

### ✅ Pending Orders
- **Auto-Detection**: EA automatically detects if order should be STOP or LIMIT
- Based on entry price vs current market price
- Supports: BUY STOP, SELL STOP, BUY LIMIT, SELL LIMIT

### ✅ Trade Modification Commands
The EA polls the desktop app for modification commands:
- **Close**: Close X% of position or full position
- **Modify SL**: Update stop loss to new price
- **Modify TP**: Update take profit to new price
- **Delete**: Cancel pending orders
- **Close All**: Close all positions and cancel all pending orders

### ✅ Trade Monitoring
- Automatically tracks all active trades
- Monitors breakeven, trailing stop, and partial close conditions
- Runs every 2 seconds independently of chart ticks
- Works even when market is slow or symbol not on chart

## Configuration Groups

The EA settings are organized into groups for easy navigation:

1. **Symbol Mapping** - Broker symbol compatibility
2. **Risk Management** - Lot size calculation modes
3. **Signal Modification** - Reverse or adjust signals
4. **SL/TP Override** - Override signal SL/TP values
5. **Trade Filters** - Additional trade validation
6. **Breakeven Settings** - Automatic breakeven management
7. **Partial Close Settings** - Scale out at each TP
8. **Trailing Stop Settings** - Dynamic SL management
9. **Notifications & Comments** - Trade labeling
10. **Time Filter** - Day/hour restrictions

## MT4 vs MT5 Differences

### Both Versions Support:
✅ All 100+ input parameters
✅ Symbol mapping
✅ All risk modes (FIXED/PERCENT/AMOUNT)
✅ Signal modification and reversal
✅ SL/TP override with R:R mode
✅ Pending order auto-detection
✅ Breakeven automation
✅ Trailing stop
✅ Time filters
✅ Trade tracking and monitoring
✅ Modification commands

### MT4 Limitations:
⚠️ **Partial Close**: MT4 doesn't natively support partial position closing. When a TP level is hit with partial close enabled:
- The EA will update the TP to the next level
- Full close (100%) works normally
- For true partial close, consider upgrading to MT5

### MT5 Advantages:
✅ Native partial close support
✅ Cleaner order/position separation
✅ Better performance with `CTrade` class

## Default Settings

The EA is configured with safe defaults for testing:

- **RiskMode**: RISK_FIXED (0.01 lots)
- **MaxSpread**: 9000 points (essentially disabled)
- **Slippage**: 9000 points (essentially disabled)
- **All filters disabled** - You can enable as needed
- **Breakeven**: Disabled (enable with `EnableBreakeven = true`)
- **Trailing Stop**: Disabled (enable with `UseTrailingStop = true`)
- **Partial Close**: Disabled (set ClosePercentAtTP1-5 to use)

## Troubleshooting

### EA not connecting (Error 5200):

**MT4 Brokers Block Localhost:**
Some MT4 brokers block `http://localhost` and `http://127.0.0.1` URLs for security, even when whitelisted. This causes error 5200.

**Solution 1: Use ngrok (Recommended for MT4)**
1. Download ngrok: https://ngrok.com/download
2. Run: `ngrok http 3737`
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. In EA settings, change **API Server URL** to the ngrok URL
5. Add ngrok URL to WebRequest whitelist

**See MT4-LOCALHOST-FIX.md for detailed instructions**

**Solution 2: Use MT5**
MT5 doesn't have this localhost restriction. Works with `http://127.0.0.1:3737` out of the box.

### Other connection issues:
- ✅ Check desktop app is running
- ✅ Verify URL is in WebRequest whitelist (Tools → Options → Expert Advisors)
- ✅ Check firewall isn't blocking port 3737
- ✅ Look for connection messages in MT4/MT5 Experts tab

### No trades executing:
- ✅ Enable "AutoTrading" button (top toolbar)
- ✅ Check "Allow automated trading" in EA settings
- ✅ Verify you have sufficient free margin
- ✅ Check if spread filter is blocking (reduce MaxSpread if needed)
- ✅ Ensure symbol exists on your broker

### Lot size errors:
- ✅ Check broker's minimum/maximum lot size limits
- ✅ Reduce FixedLotSize or RiskPercent/RiskAmount
- ✅ Verify symbol is tradable on your account type

### Signals not executing as expected:
- ✅ Check if symbol mapping is needed (prefix/suffix)
- ✅ Review time filter settings
- ✅ Check if duplicate trade filter is blocking
- ✅ Look for skip/exclude symbol lists

### Breakeven/Trailing not working:
- ✅ Ensure feature is enabled in settings
- ✅ Check if profit threshold is met (MoveSlAfterXPips / TrailingStartPips)
- ✅ Verify trade is being tracked (check for "Now tracking ticket X" message)

## Signal Format

The EA receives signals from the desktop app in JSON format:

```json
{
  "id": "signal_123",
  "symbol": "EURUSD",
  "direction": "BUY",
  "entryPrice": 1.0850,
  "stopLoss": 1.0820,
  "takeProfit1": 1.0880,
  "takeProfit2": 1.0910,
  "takeProfit3": 1.0950,
  "takeProfit4": 0,
  "takeProfit5": 0
}
```

The EA automatically:
- Validates symbol exists
- Applies symbol mapping
- Calculates lot size based on risk settings
- Applies signal modifications
- Detects if pending or market order is needed
- Places the order with retry logic
- Starts tracking for breakeven/trailing/partial close

## Advanced Usage

### Example: Conservative Scalping Setup
```
RiskMode = RISK_PERCENT
RiskPercent = 1.0
EnableBreakeven = true
MoveSlAfterXPips = 10
BreakevenPips = 2
UseTrailingStop = true
TrailingStartPips = 15
TrailingDistancePips = 10
```

### Example: Aggressive Multi-TP Setup
```
RiskMode = RISK_AMOUNT
RiskAmount = 100.0
ClosePercentAtTP1 = 33.33
ClosePercentAtTP2 = 33.33
ClosePercentAtTP3 = 33.34
EnableRRMode = true
RRRatioTP1 = 1.5
RRRatioTP2 = 2.5
RRRatioTP3 = 4.0
```

### Example: Symbol Mapping for ICMarkets
```
SymbolPrefix = ""
SymbolSuffix = ".raw"
SkipPrefixSuffixPairs = "BTCUSD,ETHUSD"
```

## Performance Tips

1. **Use appropriate risk settings** - Start with 0.5-1% risk per trade
2. **Enable time filter** - Avoid trading during low liquidity hours
3. **Set reasonable spread limit** - Skip trades during high spread
4. **Use breakeven** - Protect profits automatically
5. **Monitor logs** - Check MT4/MT5 Experts tab for messages
6. **Test on demo first** - Always validate with demo account before live

## Version History

### v2.0 (Current)
- ✅ Complete MT4/MT5 feature parity
- ✅ Added RISK_AMOUNT mode
- ✅ Added symbol mapping system
- ✅ Added signal modification (reverse, pips adjustment)
- ✅ Added SL/TP override with R:R mode
- ✅ Added pending order auto-detection
- ✅ Added breakeven automation
- ✅ Added partial close at each TP
- ✅ Added full trailing stop implementation
- ✅ Added time filter (day/hour)
- ✅ Added trade monitoring (every 2 seconds)
- ✅ Added modification commands support
- ✅ 100+ configurable parameters

### v1.0 (Previous)
- Basic signal execution
- Fixed lot size only
- Simple risk percent mode
- No advanced features

## Support

For issues or questions:
- Check the main README.md in the root folder
- Review desktop app logs
- Check MT4/MT5 Experts tab for EA messages
- Ensure WebRequest URL is whitelisted

## Disclaimer

Trading involves substantial risk. This EA executes trades automatically based on signals. Always:
- Test thoroughly on demo account
- Use appropriate risk management
- Monitor your account regularly
- Understand all EA settings before use
- Never risk more than you can afford to lose

The EA is provided "as is" without warranty.
