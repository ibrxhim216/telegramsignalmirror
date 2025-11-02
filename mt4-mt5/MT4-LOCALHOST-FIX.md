# MT4 Localhost Connection Fix

## Problem
Some MT4 brokers block localhost URLs (`http://127.0.0.1` or `http://localhost`) for security reasons, causing error 5200 even when the URL is in the WebRequest whitelist.

## Symptoms
- ❌ MT4 shows: `ERROR: WebRequest failed. Error code: 5200`
- ✅ MT5 works fine with the same URL
- ✅ External URLs (like Google) work in MT4

## Solution: Use ngrok Tunnel

ngrok creates a public HTTPS URL that tunnels to your local desktop app. Since it's a real internet URL, MT4 brokers allow it.

### Step 1: Download ngrok
1. Go to https://ngrok.com/download
2. Download the Windows version
3. Extract the ZIP file to `C:\ngrok\` (or any folder)
4. (Optional) Sign up for a free account at https://ngrok.com to get a permanent URL

### Step 2: Start ngrok Tunnel
1. Open Command Prompt
2. Run:
   ```bash
   cd C:\ngrok
   ngrok http 3737
   ```
3. You'll see output like:
   ```
   Forwarding   https://abc123.ngrok.io -> http://localhost:3737
   ```
4. **Keep this window open** while trading

### Step 3: Configure MT4 EA
1. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
2. In MT4, drag the EA onto a chart
3. In EA settings, find **"API Server URL"**
4. Replace `http://127.0.0.1:3737` with your ngrok URL: `https://abc123.ngrok.io`
5. Click OK

### Step 4: Add URL to WebRequest Whitelist
1. Go to MT4: **Tools → Options → Expert Advisors**
2. Check **"Allow WebRequest for listed URL"**
3. Add your ngrok URL: `https://abc123.ngrok.io`
4. Click OK and restart MT4

### Step 5: Verify Connection
- EA should show: `✅ Successfully connected to API server`
- If still failing, check that:
  - Desktop app is running
  - ngrok window is still open
  - URL in EA matches ngrok URL exactly

## Important Notes

### Free ngrok Account:
- ❌ URL changes every time you restart ngrok
- ❌ You need to update EA settings and WebRequest whitelist each time
- ✅ No cost

### Paid ngrok Account ($8/month):
- ✅ Permanent URL (never changes)
- ✅ Set it once and forget it
- ✅ More reliable for daily trading

### Alternative: Use MT5
MT5 doesn't have this localhost restriction. Consider using MT5 if your broker supports it.

## Troubleshooting

### ngrok shows "Too many connections"
- Free ngrok limits connections. Upgrade to paid account or restart ngrok.

### EA still shows error 5200
1. Verify ngrok is running (`ngrok http 3737`)
2. Verify URL in EA matches ngrok URL exactly (including https://)
3. Verify URL is in WebRequest whitelist
4. Verify desktop app is running on port 3737

### ngrok URL changed after restart
1. Get new URL from ngrok window
2. Update EA settings with new URL
3. Update WebRequest whitelist with new URL
4. Consider upgrading to paid ngrok for permanent URL

## For Developers

If you want to avoid ngrok for customers, consider:
1. **Deploy as cloud service** - Host the app on a server with a real domain
2. **Create VPN solution** - Package app with local VPN that bypasses broker restrictions
3. **Use reverse proxy** - Set up nginx/cloudflared tunnel with permanent domain

For most users, ngrok free tier is the simplest solution.
