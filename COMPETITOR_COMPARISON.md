# Competitor EA Comparison
**Our EA:** Telegram Signal Mirror (TelegramSignalMirror.mq4/mq5)
**Competitor EA:** TSCEA_v5_02.ex4
**Date:** December 19, 2024

---

## 📊 Feature Comparison Summary

| Category | Our EA | Competitor EA | Winner |
|----------|--------|---------------|--------|
| **Total Features** | 44 | ~50+ | Competitor |
| **Implemented Features** | 35 (80%) | Unknown | - |
| **Unique Features** | 3 | 8+ | Competitor |

---

## ✅ FEATURES WE BOTH HAVE

### Risk Management
| Feature | Our EA | Competitor EA | Notes |
|---------|--------|---------------|-------|
| Risk Mode Selection | ✅ Fixed/Percent/Amount | ✅ "Select Your Risk Mode" | Same |
| Fixed Lot Size | ✅ | ✅ | Same |
| Risk % per TP | ✅ RiskTP1-5 | ✅ Risk TP1-5 | Same |
| RR Mode | ✅ EnableRRMode | ✅ Enable RR Mode | Same |
| RR Ratios | ✅ RRRatioTP1-5 | ✅ Predefined RR Ratio for TP1/SL-TP5/SL | Same |
| **Risk Equally** | ❌ **MISSING** | ✅ Has it | **Competitor wins** |
| **Special Risk per Symbol** | ❌ **MISSING** | ✅ Has it | **Competitor wins** |

### Trade Filters
| Feature | Our EA | Competitor EA | Notes |
|---------|--------|---------------|-------|
| Max Retries | ✅ | ✅ | Same |
| Remove Pending Orders | ✅ (seconds) | ✅ (minutes) | **Different units** |
| Force Market Execution | ✅ | ✅ | Same |
| Ignore without SL | ✅ | ✅ | Same |
| Ignore without TP | ✅ | ✅ | Same |
| Check Duplicate Orders | ✅ | ✅ "Check Already Opened Order with Same Price" | Same |
| Multi Trades on Same Pair | ⚠️ Not implemented | ✅ Implemented | **Competitor wins** |
| Same Pair Check Type | ⚠️ Not implemented | ✅ Implemented | **Competitor wins** |
| Pips Tolerance | ⚠️ Not implemented | ✅ Implemented | **Competitor wins** |

### Signal Modifications
| Feature | Our EA | Competitor EA | Notes |
|---------|--------|---------------|-------|
| Reverse Signal | ✅ | ✅ | Same |
| Entry Modification Pips | ✅ | ✅ | Same |
| SL Modification Pips | ✅ | ✅ | Same |
| TP Modification Pips | ✅ | ✅ | Same |
| **Reverse Signal SL/TP** | ❌ **MISSING** | ✅ Has it | **Competitor wins** |
| **Calculation Spread in SL/TP** | ❌ **MISSING** | ✅ Has it | **Competitor wins** |

### SL/TP Override
| Feature | Our EA | Competitor EA | Notes |
|---------|--------|---------------|-------|
| SL Override Mode | ✅ | ✅ | Same |
| Predefined SL | ✅ | ✅ Predefined SL Pips for TP1-5 | **Competitor has per-TP SL!** |
| TP Override Mode | ✅ | ✅ | Same |
| Predefined TP1-5 | ✅ | ✅ | Same |

### Breakeven
| Feature | Our EA | Competitor EA | Notes |
|---------|--------|---------------|-------|
| Enable Breakeven | ✅ | ✅ | Same |
| Breakeven Pips | ✅ | ✅ | Same |
| Move SL After X Pips | ✅ | ✅ | Same |
| **Move SL to Entry Trigger** | ❌ **MISSING** | ✅ 4 options: PIPS, RR, Money, TP Hit | **Competitor wins - much more flexible** |
| **Move SL to Entry Type** | ❌ **MISSING** | ✅ 3 options: Only Move SL, Only CloseHalf, Move SL & CloseHalf | **Competitor wins - has CloseHalf!** |
| Move to BE after TP Hit (Group) | ✅ | ❌ Not visible | **We win** |

**Competitor's Breakeven System Details:**

**Trigger Options (When to activate breakeven):**
1. **PIPS** - When trade is X pips in profit (same as ours)
2. **RR** - When trade reaches X:1 risk/reward ratio (we don't have)
3. **Money** - When trade has $X profit (we don't have)
4. **TP Hit** - When specific TP level (1-5) is hit (we don't have)
   - Example: Set trigger to "TP Hit" and input "2" → breakeven activates when TP2 is hit

**Type Options (What to do when triggered):**
1. **Only Move SL to Entry** - Just move SL to breakeven (similar to ours)
2. **Only CloseHalf** - Close 50% of position, keep SL where it is (we don't have)
3. **Move SL to Entry & CloseHalf** - Both actions together (we don't have)

**Our Limitations:**
- We only support PIPS trigger
- We only support "Move SL to Entry" type (with buffer)
- We have NO CloseHalf functionality

### Partial Close
| Feature | Our EA | Competitor EA | Notes |
|---------|--------|---------------|-------|
| Close % at TP1-5 | ✅ | ✅ | Same |
| Partial Close % | ✅ | ✅ | Same |
| Half Close % | ✅ | ✅ | Same |
| **Smart Profit Lock %** | ⚠️ Not implemented | ✅ Implemented | **Competitor wins** |

**Competitor's "Smart Profit Lock %" Feature:**
Progressive profit locking - close % of remaining positions after each TP hit:
- Example: Set to "10,20,50"
- TP1 hits → Close 10% of TP2/TP3/TP4/TP5
- TP2 hits → Close 20% of TP3/TP4/TP5
- TP3 hits → Close 50% of TP4/TP5

This is DIFFERENT from CloseHalf - it's more granular and progressive.

### Trailing Stop
| Feature | Our EA | Competitor EA | Notes |
|---------|--------|---------------|-------|
| Use Trailing Stop | ✅ | ✅ | Same |
| Trailing Start Pips | ✅ | ✅ | Same |
| Trailing Step Pips | ✅ | ✅ | Same |
| Trailing Distance Pips | ✅ | ✅ | Same |
| **Trailing Also Move TP** | ⚠️ Not implemented | ✅ Implemented | **Competitor wins** |
| **Use Trailing Stop TP** | ⚠️ Not implemented | ✅ Implemented - **CASCADING SL** | **Competitor wins - Very powerful!** |
| **Trailing Start After TP Hit** | ⚠️ Not implemented | ✅ Implemented | **Competitor wins** |

**Competitor's "Use Trailing Stop TP" Feature Details:**
This is an **automatic cascading SL system** that moves SL as each TP is hit:
- When TP1 hits → Move all remaining orders' SL to breakeven
- When TP2 hits → Move TP3/TP4/TP5 SL to TP1 price
- When TP3 hits → Move TP4/TP5 SL to TP2 price
- When TP4 hits → Move TP5 SL to TP3 price

**Example:**
```
BUY 2300, SL: 2290, TP1: 2310, TP2: 2320, TP3: 2330
TP1 hits → SL of TP2/TP3 moves to 2300 (breakeven)
TP2 hits → SL of TP3 moves to 2310 (TP1 price)
```

**Our Feature:** We have `MoveToBreakevenAfterFirstTP` which only moves to breakeven, doesn't cascade to previous TP levels

### Time Filter
| Feature | Our EA | Competitor EA | Notes |
|---------|--------|---------------|-------|
| Enable Time Filter | ✅ | ✅ | Same |
| Start/End Time | ✅ | ✅ | Same |
| Trade on Each Day | ✅ | ✅ | Same |

### Comments & Notifications
| Feature | Our EA | Competitor EA | Notes |
|---------|--------|---------------|-------|
| On Comment | ✅ | ✅ | Same |
| Custom Comment | ✅ | ✅ | Same |
| Send MT4 Notifications | ✅ | ✅ | Same |

### Other
| Feature | Our EA | Competitor EA | Notes |
|---------|--------|---------------|-------|
| Enable Edit Message | ⚠️ Not implemented | ✅ Implemented | **Competitor wins** |
| **Close by Opposite Signal** | ❌ **MISSING** | ✅ Has it | **Competitor wins** |

---

## ❌ FEATURES WE DON'T HAVE (Competitor Has)

### 1. **Risk Equally**
- **Status:** We don't have this
- **What it does:** Splits risk equally across all TP levels
- **Priority:** Medium

### 2. **Special Risk per Symbol**
- **Status:** We don't have this
- **What it does:** `SYMBOL:RiskTP1-RiskTP2-RiskTP3-RiskTP4-RiskTP5.SY`
- **Priority:** Low (advanced feature)

### 3. **Reverse Signal SL/TP in Pips**
- **Status:** We don't have this
- **What it does:** When reversing, adjust SL/TP by X pips
- **Priority:** Low

### 4. **Calculation Spread in SL/TP**
- **Status:** We don't have this
- **What it does:** Include spread in SL/TP calculations
- **Priority:** High (important for accuracy)

### 5. **Predefined SL per TP Level**
- **Status:** We only have one global SL
- **What it does:** Different SL for each TP level
- **Priority:** Medium

### 6. **Move SL to Entry Trigger**
- **Status:** We don't have this
- **What it does:** Separate trigger condition for breakeven
- **Priority:** Medium

### 7. **Move SL After X (Pips/RR/Money/TP)**
- **Status:** We only support Pips
- **What it does:** Multiple trigger types (RR ratio, $ amount, TP hit)
- **Priority:** High (very flexible)

### 8. **CloseHalf Functionality (Breakeven Type)**
- **Status:** We don't have this at all
- **What it does:** 3 options when breakeven triggers:
  - Only Move SL to Entry (we have this)
  - Only CloseHalf - Close 50% and keep SL (we don't have)
  - Move SL to Entry & CloseHalf - Both actions (we don't have)
- **Priority:** High (powerful risk management tool)

### 9. **Close by Opposite Signal (Same Channel)**
- **Status:** We don't have this
- **What it does:** Auto-close when opposite signal arrives
- **Priority:** High (very useful)

---

## ✅ FEATURES WE HAVE (Competitor Might Not Have)

### 1. **TSM Protector (Daily Limits)**
- Daily Loss Limit
- Daily Profit Target
- Max Trades Per Day
- Auto-close on limits
- **Status:** Not visible in competitor's EA

### 2. **Symbol Mapping**
- Custom Symbol Map
- Symbol Prefix/Suffix
- Skip Prefix/Suffix for specific pairs
- Excluded Symbols
- Symbols to Trade (whitelist)
- **Status:** Not visible in competitor's EA

### 3. **Move to Breakeven After First TP Hit (Group Feature)**
- **Status:** We have this, competitor doesn't show it
- **What it does:** When one order in a group hits TP, move all others to BE
- **Priority:** This is UNIQUE to us!

---

## 🔍 CRITICAL FINDINGS

### 1. **Remove Pending Orders - Different Units**
- **Our EA:** Seconds
- **Competitor:** Minutes
- **Recommendation:** Add option for both (seconds AND minutes)

### 2. **Breakeven Feature - THEIRS IS 2-DIMENSIONAL (We Have 1-Dimensional)**

**Competitor's System:** 2-dimensional breakeven control
- **Dimension 1 - Trigger (WHEN to activate):**
  - PIPS - When trade is X pips in profit ✅ (we have this)
  - RR - When trade reaches X:1 risk/reward ratio ❌ (we don't have)
  - Money - When trade has $X profit ❌ (we don't have)
  - TP Hit - When specific TP level is hit ❌ (we don't have)

- **Dimension 2 - Type (WHAT to do):**
  - Only Move SL to Entry ✅ (we have this)
  - Only CloseHalf ❌ (we don't have)
  - Move SL to Entry & CloseHalf ❌ (we don't have)

**Our System:** 1-dimensional breakeven
- Only PIPS trigger
- Only "Move SL to Entry" action
- No CloseHalf functionality at all

**Our advantage:** We have GROUP BREAKEVEN (move all related orders when one hits TP) - they don't have this

### 3. **Trailing Stop - THEY HAVE CASCADING SL SYSTEM**
They have implemented:
- ✅ Trailing also move TP (we defined but not implemented)
- ✅ **Use Trailing Stop TP - CASCADING SL SYSTEM** (we defined but not implemented)
- ✅ Trailing start after TP hit (we defined but not implemented)

**All 3 of these are dormant in our EA!**

**Their "Use Trailing Stop TP" is VERY powerful:**
- Automatically moves SL to breakeven when first TP hits
- Then moves SL to previous TP levels as more TPs are hit
- Example: TP1 hits → SL to breakeven, TP2 hits → SL to TP1 price, TP3 hits → SL to TP2 price
- This is MORE advanced than our `MoveToBreakevenAfterFirstTP` which only moves to breakeven once

**Our MoveToBreakevenAfterFirstTP:**
- Only moves to breakeven when first TP hits
- Does NOT cascade to previous TP levels
- Less sophisticated than competitor's system

### 4. **Close by Opposite Signal - THEY HAVE IT**
This is a VERY useful feature we don't have:
- When a SELL signal comes, auto-close all BUY positions
- And vice versa
- Only works for same channel

---

## 📊 OVERALL ASSESSMENT

### Competitor Strengths:
1. ✅ **Cascading SL System** (UseTrailingStopTP) - automatically moves SL to breakeven then to previous TP levels
2. ✅ More flexible breakeven triggers (Pips/RR/Money/TP Hit with TP level selection)
3. ✅ CloseHalf functionality (3 breakeven types: Move SL, CloseHalf, Both)
4. ✅ Smart Profit Lock % - progressive profit locking
5. ✅ All trailing stop advanced features implemented
6. ✅ Close by opposite signal
7. ✅ Spread calculation in SL/TP
8. ✅ Multi-trades and same-pair modes fully implemented
9. ✅ Pips tolerance implemented
10. ✅ Per-TP SL values

### Our Strengths:
1. ✅ TSM Protector (daily limits system)
2. ✅ Advanced symbol mapping
3. ✅ Group breakeven feature (unique!)
4. ✅ Clean, modern codebase
5. ✅ Both MT4 and MT5 support
6. ✅ Cloud sync integration

### Our Weaknesses:
1. ❌ 8 features defined but not implemented (most critical: Cascading SL system)
2. ❌ **No Cascading SL System** - Our MoveToBreakevenAfterFirstTP only moves to BE once, doesn't cascade to previous TP levels
3. ❌ Missing "Close by opposite signal"
4. ❌ Missing spread calculation
5. ❌ Less flexible breakeven (only PIPS trigger, no RR/Money/TP Hit)
6. ❌ No CloseHalf functionality (powerful risk management tool)
7. ❌ No Smart Profit Lock % (progressive profit locking)
8. ❌ No risk-per-symbol customization

---

## 🎯 RECOMMENDATIONS

### Priority 1 (Must Implement - Competitor Has These):
1. **Implement Cascading SL System (UseTrailingStopTP)** - **HIGHEST PRIORITY**
   - Currently dormant in our EA
   - Automatically moves SL to breakeven when TP1 hits
   - Then cascades SL to previous TP levels as more TPs are hit
   - Much more powerful than our current MoveToBreakevenAfterFirstTP
   - This is their killer feature for risk management
2. **Implement CloseHalf Functionality** (Breakeven Type options: Only CloseHalf, Move SL & CloseHalf)
   - Powerful risk management tool
   - Allows partial profit taking when breakeven triggers
   - Works with all breakeven triggers (Pips, RR, Money, TP Hit)
3. **Implement Flexible Breakeven Triggers** (RR, Money, TP Hit - not just Pips)
   - Makes breakeven much more versatile
   - Competitor has 4 trigger types, we only have 1
   - TP Hit trigger allows specifying which TP (1-5) activates breakeven
4. **Implement Smart Profit Lock %** (currently dormant SmartProfitLockPercent)
   - Progressive profit locking after each TP hit
   - More granular than simple partial close
5. **Implement TrailingAlsoMoveTP and TrailingStartAfterTPHit** (other dormant trailing features)
6. **Implement Close by Opposite Signal** (very useful feature)
7. **Implement Calculation Spread in SL/TP** (important for accuracy)
8. **Implement Multi Trades on Same Pair modes** (SamePairMode)
9. **Implement Pips Tolerance** (already defined)

### Priority 2 (Nice to Have):
10. **Predefined SL per TP level** (currently we only have one global SL)
11. **Risk Equally mode**
12. **Reverse Signal SL/TP adjustment**

### Priority 3 (Advanced):
13. **Special Risk per Symbol**
14. **Add Minutes option for Remove Pending** (currently only seconds)

---

## 💡 OUR UNIQUE SELLING POINTS

These features make us BETTER than the competitor:

1. **TSM Protector** - Daily loss/profit limits with auto-close
2. **Symbol Mapping** - Advanced symbol translation and filtering
3. **Group Breakeven** - Move ALL related orders to BE when one hits TP
4. **Cloud Sync** - Integration with web dashboard
5. **Modern Architecture** - Clean, maintainable code
6. **Dual Platform** - MT4 + MT5 with feature parity

---

## 📈 FEATURE PARITY SCORE

**Implemented Features:**
- Our EA: 35/44 (80%)
- Competitor: Unknown (appears to be ~90%+)

**Overall Feature Count:**
- Our EA: 44 features
- Competitor: ~50+ features

**Verdict:** Competitor has MORE features and BETTER implementation of advanced trailing/breakeven. Their **Cascading SL System** is a killer feature that's far more sophisticated than our simple MoveToBreakevenAfterFirstTP. Their 2-dimensional breakeven (4 triggers × 3 types) gives much more control than our 1-dimensional system. BUT we have UNIQUE features they don't have (TSM Protector, Symbol Mapping, Cloud Sync).

---

**Key Competitive Gap:**
The competitor's **Cascading SL System** (UseTrailingStopTP) is their most powerful feature:
- Moves SL to breakeven when TP1 hits
- Then progressively moves SL to previous TP levels as more TPs are hit
- This is MUCH better than our MoveToBreakevenAfterFirstTP which only moves to breakeven once

**Recommendation:**
1. **PRIORITY 1:** Implement Cascading SL System (UseTrailingStopTP) - this is their killer feature
2. Implement CloseHalf functionality for 2-dimensional breakeven control
3. Implement other 7 dormant features
4. Add "Close by Opposite Signal"
5. Implement Smart Profit Lock % for progressive profit locking

This will achieve feature parity while maintaining our unique advantages (TSM Protector, Symbol Mapping, Cloud Sync).
