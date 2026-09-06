# Telegram Signal Mirror 1.0.9

## Fix
- The 1.0.8 installer excluded `sql.js/dist/sql-wasm.js` (the packaging glob `*asm*` also matched `wasm`), so a fresh install crashed on launch with "Cannot find module ... sql-wasm.js". 1.0.9 ships the file again. Installed copies of 1.0.8 that do open will auto-update; copies that never opened need 1.0.9 installed over them.

## EAs
- EA 2.1 (MT4 + MT5): see release notes on the website (input audit, MT4 parity, Split Entry on MT4).
