# Telegram Signal Mirror v1.0.8

Release date: TBD (deploy desktop app, MT4 EA, and MT5 EA together)

## ⚠️ Important: position sizes change in this release

**Risk Amount and Risk % now apply to the whole signal, not to each take-profit order.**

Before: a signal with three TPs opened three orders, each sized to lose your full risk amount at the stop. A stop-out cost 3× what you set.

Now: the risk amount is divided across the TP orders, so a stop-out costs exactly what you set. With three TPs, each position is one-third the size it was before.

To keep the previous behaviour, set **Risk Applies To = Per TP Order** in the EA inputs. Fixed-lot mode is unchanged (0.01 fixed still means 0.01 per order).

If your account is small and the divided size would fall below your broker's minimum lot, the EA opens as many TP orders as fit (starting at TP1) and logs which TPs were skipped, instead of rounding every order up and exceeding your risk.

## MT4 EA — now matches the MT5 EA

- Risk modes (% of balance, $ amount) are now active. They were present as inputs but not used.
- `RiskTP1..10` inputs are replaced by `EnableTP1..10` (on/off per TP) plus the lot weighting inputs. **MT4 users: re-save your preset (.set) after updating** — old RiskTP values are not carried over.
- New management commands supported: close at TP1–TP4, set TP1, remove SL.
- The EA now polls on a 2-second timer, so it keeps working when the chart has no ticks (weekends, quiet symbols).

## Both EAs

- Risk log shows your account currency instead of `$`.

## Desktop app

- **Restarts no longer stop copying.** The app reconnects to Telegram with the saved session and resumes monitoring the channels you had selected, with no clicks. A VPS reboot or Windows update no longer leaves the copier idle until you log in.
- **Sign in from the website.** The login screen has *Sign in with your browser*: the website hands your session to the app through a `tsm://` link, so there is no password to retype. The website's Downloads page and Overview also have *Sign in to the desktop app*.
- **Website opens already signed in.** *Web dashboard*, *Manage plan* and the trading-account links open the portal through single sign-on.
- **Telegram two-step verification works.** Accounts with a Telegram cloud password are asked for it. Previously the sign-in hung.
- **Annual plans show the right tier.** Basic (Annual) and Pro (Annual) were treated as trial inside the app, which hid Pro features and showed an *Activate License* button that did not work. The legacy license-key dialog is gone; plan changes go through the website.
- **Trading accounts reach the website.** An account the EA registers locally is now also registered on your web account, so it shows on the portal and cloud-mode EAs receive signals. If the number belongs to another user or your plan is full, the app tells you.
- Header shows the real state: Telegram disconnected / connected but not monitoring / copying N channels.

- **Setup checklist** on the dashboard: Telegram, channels, channel config, trading account, EA status. Each row explains what's missing. Collapses once everything is green. Header shows a 7-day summary (signals, updates, executed, skipped).
- **One-click EA install** from the checklist: finds your MetaTrader data folders and copies the EA into each Experts folder. Includes the WebRequest allow-list steps.
- **Nothing is dropped silently.** Messages that don't produce a trade now appear in the feed as "Skipped" with the reason (no stop loss, matched an ignore keyword, outside time filter, duplicate, no open trades to modify, etc.).
- **Edited messages** (per channel, Advanced → Other → Process signal provider edits): when a provider edits a signal to add TPs or move the SL, the app applies the change to existing orders instead of ignoring it. It never re-opens orders from an edit.
- **Trading account auto-registers** the first time your EA polls the app (local mode).
- **Export History** button in channel settings: saves the channel's recent text messages to a JSON file.
- New channels default to **Ignore Without SL = on**. Existing channel configs are unchanged.

## Fixes

- Trade sync no longer logs "tried to bind a value of an unknown type" every 30 seconds.
- Multi-order signals are now tracked per ticket in the local database instead of as one combined entry.
