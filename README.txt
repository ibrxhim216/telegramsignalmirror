================================================================================
  TELEGRAM SIGNAL MIRROR v1.0.1
  Professional Trading Signal Distribution System
================================================================================

PACKAGE CONTENTS:
================================================================================
- Telegram Signal Mirror 1.0.1.exe    Desktop application (95 MB)
- TelegramSignalMirror.ex4            MetaTrader 4 Expert Advisor (101 KB)
- TelegramSignalMirror.ex5            MetaTrader 5 Expert Advisor (93 KB)
- QUICK_START.txt                     Quick setup guide (read this first!)
- README.txt                          This file - detailed documentation


WHAT'S INCLUDED:
================================================================================

Desktop Application Features:
- Monitors multiple Telegram signal channels simultaneously
- AI-powered signal parsing (supports 20+ formats)
- Cloud-based distribution to unlimited MT4/MT5 accounts
- Real-time signal feed with confidence scores
- Channel-specific configuration (lot size, risk management)
- TSC Protector v2.0 - Daily P/L limits and trade restrictions
- Multi-TP Handler - Split orders across multiple take-profit levels
- Vision AI - Analyze chart screenshots (Pro/Advance tiers)
- Secure authentication via web portal
- Automatic session persistence

MT4/MT5 Expert Advisors:
- Cloud-based signal polling (2-second intervals)
- Automatic trade execution
- Support for all order types (market, pending, stop, limit)
- Multiple TP/SL handling
- Trade modification commands (move SL, close partial, etc.)
- Risk management (lot size, max spread checks)
- Detailed logging in Experts tab


SYSTEM ARCHITECTURE:
================================================================================

  [Telegram Channels]
         |
         v
  [Desktop App]  ← Monitors channels, parses signals
         |
         v
  [Cloud API]    ← Distributes to all registered accounts
         |
         v
  [MT4/MT5 EAs]  ← Poll cloud, execute trades

This architecture means:
- Desktop app can run anywhere (home, office, VPS)
- MT4/MT5 can be on different computers
- Signals reach all accounts simultaneously
- No local network configuration needed


INSTALLATION:
================================================================================

See QUICK_START.txt for step-by-step setup instructions.


SUBSCRIPTION TIERS:
================================================================================

Basic Plan:
- 1 MT4/MT5 account
- 1 Telegram channel
- AI signal parsing
- Cloud distribution
- TSC Protector
- Multi-TP Handler

Pro Plan:
- 3 MT4/MT5 accounts
- 3 Telegram channels
- All Basic features
- Vision AI (chart analysis)
- Priority support

Lifetime Plan:
- 3 MT4/MT5 accounts
- 3 Telegram channels
- All Pro features
- One-time payment
- Lifetime updates


ADVANCED FEATURES:
================================================================================

TSC PROTECTOR v2.0:
-------------------
Protects your account from excessive losses:
- Daily loss limit (closes all trades if hit)
- Daily profit target (stops new trades when reached)
- Max trades per day limit
- Trade count tracking
- Automatic reset at midnight (broker time)

Configure in Desktop App → Settings → TSC Protector


MULTI-TP HANDLER:
-----------------
Splits signals with multiple TPs into separate orders:
- Signal: "TP1: 1.1000, TP2: 1.1050, TP3: 1.1100"
- Creates 3 orders, each with different TP
- Automatically moves SL to breakeven after first TP hit
- Can enable trailing stop after TP2

Configure in Desktop App → Settings → Multi-TP Handler


VISION AI (Pro/Advance only):
------------------------------
Analyzes chart screenshots posted in Telegram:
- Trend detection (direction, strength)
- Support/resistance levels
- Chart patterns (head & shoulders, triangles, etc.)
- Technical indicators (MA, RSI, MACD if visible)
- Trade recommendations with confidence scores

Enable in Desktop App → Settings → Vision AI


CHANNEL CONFIGURATION:
----------------------
Each Telegram channel can have custom settings:
- Default lot size
- Risk percentage
- Enable/disable TSC Protector
- Enable/disable Multi-TP
- Enable/disable Vision AI
- Custom parsing rules

Configure: Right-click channel → Channel Settings


SIGNAL PARSING:
================================================================================

Supported Signal Formats:
- Standard format: "BUY EURUSD @ 1.0950, SL: 1.0900, TP: 1.1000"
- Compact format: "SELL GBPUSD 1.2500 SL 1.2550 TP 1.2450"
- Emoji format: "🟢 BUY Gold Entry: 1950 🔴 SL: 1945 🎯 TP: 1960"
- Multi-TP: "BUY USDJPY Entry: 150.00 TP1: 150.50 TP2: 151.00 SL: 149.50"
- Range orders: "BUY EURUSD 1.0950-1.0960"
- And 15+ more variations!

The AI parser handles:
- Different languages
- Missing spaces/punctuation
- Alternative symbol names (GOLD/XAUUSD, US30/DJIA, etc.)
- Emoji and special characters
- Incomplete signals (asks for confirmation)


TRADE MODIFICATION COMMANDS:
================================================================================

Your signal provider can post update commands:
- "Close all EURUSD" - Closes all EURUSD positions
- "Close 50% GBPUSD" - Closes half of GBPUSD positions
- "Move SL to breakeven USDJPY" - Sets SL to entry price
- "Move SL to 1.0980" - Updates SL to specific price
- "Close TP1 hit" - Closes first take-profit group

Desktop app detects these and sends modification commands to EAs.


TROUBLESHOOTING:
================================================================================

Desktop App Issues:
-------------------

App won't start:
1. Right-click exe → Properties → Unblock → Apply
2. Temporarily disable antivirus
3. Check Windows Event Viewer for errors

Can't login:
1. Verify credentials on web portal
2. Check internet connection
3. Try "Forgot Password" on web portal

Telegram won't connect:
1. Ensure phone number includes country code (+1234567890)
2. Check Telegram app for verification code
3. Try disconnecting and reconnecting

Signals not appearing:
1. Verify channels are being monitored (green indicator)
2. Check channel has recent messages
3. Restart monitoring


MT4/MT5 EA Issues:
------------------

EA shows "Account not found":
1. Verify account is registered in web portal
2. Ensure account number matches exactly
3. Check internet connection on MT4/MT5 computer

No trades executing:
1. Check "Allow algo trading" is enabled (MT4: AutoTrading button)
2. Verify account number in EA settings
3. Check Experts tab for error messages
4. Ensure account has sufficient margin

Wrong lot size:
1. Check channel configuration in Desktop App
2. Verify EA settings (use default lot size if not set by signal)
3. Check account leverage and free margin

Trades not closing:
1. Check broker allows EA to close trades
2. Verify internet connection
3. Look for modification commands in Telegram


Cloud/Network Issues:
---------------------

"Connection timeout" errors:
1. Check firewall settings (allow app internet access)
2. Try different network (mobile hotspot to test)
3. Contact ISP if port 443 is blocked

High latency (delayed trades):
1. Check internet speed (minimum 1 Mbps)
2. Close bandwidth-heavy applications
3. Consider using VPS for faster execution


SECURITY & PRIVACY:
================================================================================

Data Protection:
- All communication uses HTTPS/TLS encryption
- Telegram session stored locally (encrypted)
- Web portal credentials never stored in plain text
- Database encrypted at rest

What Data is Stored:
- Telegram session (for reconnection)
- Signal history (local only)
- Channel configurations
- Account statistics (TSC Protector)
- License information

What Data is Sent to Cloud:
- Parsed signal data only (symbol, direction, price levels)
- Your registered account numbers
- Authentication token

What is NOT Sent:
- Telegram messages (raw text)
- Account balance/equity
- Broker information
- Personal messages


BEST PRACTICES:
================================================================================

For Reliable Operation:
1. Run desktop app on stable computer (VPS recommended for 24/7)
2. Keep desktop app running while monitoring channels
3. Register accounts on web portal before starting EAs
4. Test with small lot sizes first
5. Monitor first few signals manually

For Optimal Performance:
1. Use VPS with low latency to broker server
2. Keep only necessary charts open in MT4/MT5
3. Close other EAs to reduce CPU usage
4. Restart MT4/MT5 daily to clear memory

For Risk Management:
1. Always set appropriate lot sizes for your account
2. Enable TSC Protector with conservative limits
3. Never risk more than 1-2% per trade
4. Monitor trades during first week
5. Have stop-loss on every trade


UPDATES:
================================================================================

How to Update:
1. Download latest version from web portal
2. Close existing desktop app
3. Replace old exe with new one
4. Restart - settings are preserved

For MT4/MT5 EAs:
1. Download new .ex4/.ex5 files
2. Close MT4/MT5
3. Replace old files in Experts folder
4. Restart MT4/MT5
5. Re-attach EA to chart


SUPPORT:
================================================================================

Telegram Support: https://t.me/tsmsignal_support (instant chat support!)
Documentation: https://www.telegramsignalmirror.com/docs
Video Tutorials: https://www.telegramsignalmirror.com/tutorials
Support Email: support@telegramsignalmirror.com
GitHub: https://github.com/ibrxhim216/telegramsignalmirror

When contacting support, please include:
- Version number (v1.0.1)
- Operating system
- Error message (if any)
- Steps to reproduce issue


LICENSE:
================================================================================

Telegram Signal Mirror is proprietary software.
License is tied to your web portal account.
Subscription required for continued use.

Terms of Service: https://www.telegramsignalmirror.com/terms
Privacy Policy: https://www.telegramsignalmirror.com/privacy


CREDITS:
================================================================================

Developed by: Telegram Signal Mirror Team
Website: https://www.telegramsignalmirror.com
Version: 1.0.1
Release Date: November 2024


Thank you for choosing Telegram Signal Mirror!
