# How to Create GitHub Release for Downloads

## Quick Steps

1. **Go to GitHub Repository**
   - Visit: https://github.com/ibrxhim216/telegramsignalmirror/releases/new

2. **Fill in Release Details**
   - **Tag version**: `v1.0.0`
   - **Release title**: `Telegram Signal Mirror v1.0.0`
   - **Description**: Copy the text below

3. **Upload Files**
   Click "Attach binaries" and upload these 3 files:
   - `C:\Users\Kulthum\Documents\Telegram Signal Mirror\release\TelegramSignalMirror-Windows-v1.0.0.zip`
   - `C:\Users\Kulthum\Documents\Telegram Signal Mirror\release\TelegramSignalMirror.ex4`
   - `C:\Users\Kulthum\Documents\Telegram Signal Mirror\release\TelegramSignalMirror.ex5`

4. **Publish**
   - Check "Set as the latest release"
   - Click "Publish release"

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

Once published, the download URLs will be:
- **Windows App**: `https://github.com/ibrxhim216/telegramsignalmirror/releases/download/v1.0.0/TelegramSignalMirror-Windows-v1.0.0.zip`
- **MT4 EA**: `https://github.com/ibrxhim216/telegramsignalmirror/releases/download/v1.0.0/TelegramSignalMirror.ex4`
- **MT5 EA**: `https://github.com/ibrxhim216/telegramsignalmirror/releases/download/v1.0.0/TelegramSignalMirror.ex5`

These URLs are already configured in the website download API!
