# Create GitHub Release v1.0.2 with all files
# Run this in a NEW PowerShell window after installing GitHub CLI

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GitHub Release Creator for TSM v1.0.2" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if gh is installed
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: GitHub CLI (gh) is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install from: https://cli.github.com/" -ForegroundColor Yellow
    Write-Host "Or run: winget install --id GitHub.cli" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Then restart PowerShell and run this script again." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[OK] GitHub CLI found!" -ForegroundColor Green

# Check if authenticated
Write-Host ""
Write-Host "Checking GitHub authentication..." -ForegroundColor Yellow
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Not authenticated with GitHub." -ForegroundColor Yellow
    Write-Host "Starting authentication process..." -ForegroundColor Yellow
    Write-Host ""
    gh auth login
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Authentication failed!" -ForegroundColor Red
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "[OK] Authenticated with GitHub!" -ForegroundColor Green

# Navigate to repository
$repoPath = "C:\Users\Kulthum\Documents\Telegram Signal Mirror"
Set-Location $repoPath

Write-Host ""
Write-Host "Repository: $repoPath" -ForegroundColor Cyan

# File paths
$files = @(
    "release\TelegramSignalMirror-Windows-v1.0.2.zip",
    "release\TelegramSignalMirror.ex4",
    "release\TelegramSignalMirror.ex5"
)

# Check if all files exist
Write-Host ""
Write-Host "Verifying files..." -ForegroundColor Yellow
$allFilesExist = $true
foreach ($file in $files) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length / 1MB
        $sizeRounded = [math]::Round($size, 2)
        Write-Host "  [OK] $file ($sizeRounded MB)" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $file (NOT FOUND)" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Host ""
    Write-Host "ERROR: Some files are missing!" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Release notes
$releaseNotes = @'
# Telegram Signal Mirror v1.0.2

## What's Included

### Desktop Application (Windows)
- **TelegramSignalMirror-Windows-v1.0.2.zip** - Complete Windows desktop application
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
'@

Write-Host ""
Write-Host "Creating GitHub Release v1.0.2..." -ForegroundColor Yellow
Write-Host "This may take a few minutes due to the 147 MB ZIP file..." -ForegroundColor Yellow
Write-Host ""

# Create the release
gh release create v1.0.2 $files[0] $files[1] $files[2] --title "Telegram Signal Mirror v1.0.2" --notes $releaseNotes

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "[SUCCESS] Release created successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Download URLs:" -ForegroundColor Cyan
    Write-Host "  - Windows App: https://github.com/ibrxhim216/telegramsignalmirror/releases/download/v1.0.2/TelegramSignalMirror-Windows-v1.0.2.zip" -ForegroundColor White
    Write-Host "  - MT4 EA: https://github.com/ibrxhim216/telegramsignalmirror/releases/download/v1.0.2/TelegramSignalMirror.ex4" -ForegroundColor White
    Write-Host "  - MT5 EA: https://github.com/ibrxhim216/telegramsignalmirror/releases/download/v1.0.2/TelegramSignalMirror.ex5" -ForegroundColor White
    Write-Host ""
    Write-Host "View release: https://github.com/ibrxhim216/telegramsignalmirror/releases/tag/v1.0.2" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Visit the release page to verify all files uploaded correctly" -ForegroundColor White
    Write-Host "  2. Test downloads from: https://www.telegramsignalmirror.com/dashboard/downloads" -ForegroundColor White
    Write-Host "  3. Push website changes to deploy to production" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "[FAILED] Release creation failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check the error message above." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to exit"
