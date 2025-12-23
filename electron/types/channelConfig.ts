/**
 * Channel Configuration Types
 * Based on Telegram Signal Copier's per-channel keyword configuration system
 */

export interface SignalKeywords {
  entryPoint: string[]      // Keywords for entry price (e.g., "entry", "@", "price")
  buy: string[]             // Keywords for BUY signals
  sell: string[]            // Keywords for SELL signals
  stopLoss: string[]        // Keywords for SL (e.g., "sl", "stop loss", "stop")
  takeProfit: string[]      // Keywords for TP (e.g., "tp", "take profit", "target")
}

export interface UpdateKeywords {
  closeTP1: string[]        // Close only TP1
  closeTP2: string[]        // Close only TP2
  closeTP3: string[]        // Close only TP3
  closeTP4: string[]        // Close only TP4
  closeFull: string[]       // Close full trade
  closeHalf: string[]       // Close half of the trade
  closePartial: string[]    // Close partial amount
  breakEven: string[]       // Move SL to entry
  setTP1: string[]          // Change TP1
  setTP2: string[]          // Change TP2
  setTP3: string[]          // Change TP3
  setTP4: string[]          // Change TP4
  setTP5: string[]          // Change TP5
  setTP: string[]           // Change all TPs
  setSL: string[]           // Change SL
  deletePending: string[]   // Delete pending order
}

export interface AdditionalKeywords {
  layer: string[]           // Re-entry signal
  closeAll: string[]        // Close all active trades
  deleteAll: string[]       // Remove all pending trades
  ignoreKeyword: string[]   // Ignore this command
  skipKeyword: string[]     // Skip this signal
  marketOrder: string[]     // Force market order
  removeSL: string[]        // Remove SL from trade
}

export interface ChannelAdvancedSettings {
  delayInMsec: number       // Delay before executing (stealth mode)
  entryRangeStrategy: 'first' | 'last' | 'middle'      // How to handle entry price ranges (e.g., "4326-4429")
  slInPips: boolean         // SL given in pips vs price
  tpInPips: boolean         // TP given in pips vs price
  tpFormatMode: 'comma_separated' | 'separate_keywords'  // TP format: "TP: 5, 10" vs "TP1: 5, TP2: 10"
  readImage: boolean        // Enable OCR for images
  delimiters: string        // Custom delimiters for parsing
  allOrder: boolean         // Execute all order types
  readForwarded: boolean    // Read forwarded messages
}

export interface ChannelRiskSettings {
  riskMode: 'fixed' | 'percent' | 'amount'  // Risk calculation mode
  fixedLotSize: number      // Fixed lot size
  riskPercent: number       // Risk % of account balance
  riskAmount: number        // Risk $ amount
  maxSpread: number         // Maximum allowed spread
  slippage: number          // Maximum slippage
  // Risk per TP level
  riskTP1: number           // Lot size for TP1
  riskTP2: number           // Lot size for TP2
  riskTP3: number           // Lot size for TP3
  riskTP4: number           // Lot size for TP4
  riskTP5: number           // Lot size for TP5
}

export interface TradeFilters {
  ignoreWithoutSL: boolean          // Skip signals without SL
  ignoreWithoutTP: boolean          // Skip signals without TP
  forceMarketExecution: boolean     // Execute pending orders as market
  checkAlreadyOpenedOrder: boolean  // Prevent duplicate positions
  samePairMode: 'allowed' | 'not_allowed' | 'hedge_only'  // Multiple trades on same pair
  samePairCheckType: 'today' | 'all_time'  // Check only today's trades or all
  maxRetriesOrderSend: number       // Retries if order fails
  removePendingIfNotActivated: number  // Remove pending after N seconds (0=disabled)
  pipsTolerance: number             // Price tolerance for market execution
}

export interface SLTPOverrideSettings {
  slOverrideMode: 'use_signal' | 'use_predefined'  // Use signal's SL or predefined
  tpOverrideMode: 'use_signal' | 'use_predefined'  // Use signal's TP or predefined
  predefinedSL: number              // Predefined SL in pips
  predefinedTP: number[]            // Predefined TPs in pips [TP1, TP2, TP3, TP4, TP5]
  enableRRMode: boolean             // Enable Risk:Reward mode
  rrRatio: number[]                 // RR ratios [TP1/SL, TP2/SL, TP3/SL, TP4/SL, TP5/SL]
  calculateSpreadInSLTP: boolean    // Auto-adjust SL/TP for broker spread
}

export interface ModificationSettings {
  reverseSignal: boolean            // Reverse trade direction (BUY → SELL)
  reverseSLTPInPips: boolean        // Keep SL/TP pip distances when reversing
  entryModificationPips: number     // Add/subtract pips to entry (0=disabled)
  slModificationPips: number        // Add/subtract pips to SL (0=disabled)
  tpModificationPips: number        // Add/subtract pips to TP (0=disabled)
}

export interface BreakevenSettings {
  enableBreakeven: boolean          // Move SL to entry after profit
  breakevenPips: number             // Buffer pips (e.g., +5 pips above entry)
  moveSlAfterTPHit: boolean         // Move SL when TP is hit
  moveSlAfterXPips: number          // Move SL after X pips profit (0=disabled)
}

export interface TrailingStopSettings {
  useTrailingStop: boolean          // Enable trailing stop
  trailingStartPips: number         // Start trailing after X pips profit
  trailingStepPips: number          // Move SL by X pips each time
  trailingDistancePips: number      // Distance from current price
  trailingStartAfterTPHit: string   // Start after TP hit ('none', 'TP1', 'TP2', 'TP3', 'TP4', 'TP5')
  trailingAlsoMoveTP: boolean       // Also move TP when trailing
  smartProfitLockPercent: number    // Lock X% profit when TP1 hits
}

export interface PartialCloseSettings {
  partialClosePercent: number       // Close X% of lots at each TP
  halfClosePercent: number          // Close half at specific condition
  closePercentAtTP1: number         // % to close at TP1 (0=disabled)
  closePercentAtTP2: number         // % to close at TP2 (0=disabled)
  closePercentAtTP3: number         // % to close at TP3 (0=disabled)
  closePercentAtTP4: number         // % to close at TP4 (0=disabled)
  closePercentAtTP5: number         // % to close at TP5 (0=disabled)
}

export interface SymbolMappingSettings {
  enableMapping: boolean            // Enable symbol mapping
  symbolPrefix: string              // Add prefix (e.g., "" → "EURUSD")
  symbolSuffix: string              // Add suffix (e.g., "" → "EURUSDm")
  skipSuffixPrefixList: string[]    // Symbols to skip mapping
  excludedSymbols: string[]         // Symbols to never trade
  symbolsToTrade: string[]          // Whitelist (empty=all allowed)
}

export interface TimeFilterSettings {
  enableTimeFilter: boolean         // Enable time filtering
  startTime: string                 // Start time (HH:MM format)
  endTime: string                   // End time (HH:MM format)
  tradeOnMonday: boolean            // Trade on Monday
  tradeOnTuesday: boolean           // Trade on Tuesday
  tradeOnWednesday: boolean         // Trade on Wednesday
  tradeOnThursday: boolean          // Trade on Thursday
  tradeOnFriday: boolean            // Trade on Friday
  tradeOnSaturday: boolean          // Trade on Saturday
  tradeOnSunday: boolean            // Trade on Sunday
}

export interface SignalModificationSettings {
  enabled: boolean                  // Enable modification detection
  autoApply: boolean                // Auto-apply modifications without confirmation
  detectRepliesOnly: boolean        // Only process modifications that are replies
  requireConfirmationFor: string[]  // Modification types requiring confirmation (e.g., ['closeAll', 'deleteAll'])
}

export interface OtherSettings {
  enableEditMessage: boolean        // Process signal provider edits
  customComment: string             // Custom comment for trades
  sendMT5Notifications: boolean     // Send push notifications to mobile
  onComment: boolean                // Add comment to trades
}

export interface ChannelConfig {
  channelId: number
  channelName: string

  // Keyword configurations
  signalKeywords: SignalKeywords
  updateKeywords: UpdateKeywords
  additionalKeywords: AdditionalKeywords

  // Advanced settings
  advancedSettings: ChannelAdvancedSettings

  // Risk management
  riskSettings: ChannelRiskSettings

  // Trade filters
  tradeFilters: TradeFilters

  // SL/TP Override
  sltpOverride: SLTPOverrideSettings

  // Modification settings
  modification: ModificationSettings

  // Breakeven settings
  breakeven: BreakevenSettings

  // Trailing stop settings
  trailingStop: TrailingStopSettings

  // Partial close settings
  partialClose: PartialCloseSettings

  // Symbol mapping
  symbolMapping: SymbolMappingSettings

  // Time filter
  timeFilter: TimeFilterSettings

  // Signal modifications (replies to signals)
  signalModifications: SignalModificationSettings

  // Other settings
  other: OtherSettings

  // Enabled/disabled
  isEnabled: boolean

  // Use AI parser as fallback
  useAIParser: boolean

  // Last updated
  updatedAt: string
}

/**
 * Default channel configuration
 */
export const DEFAULT_CHANNEL_CONFIG: Omit<ChannelConfig, 'channelId' | 'channelName' | 'updatedAt'> = {
  signalKeywords: {
    entryPoint: [],  // Empty by default - placeholder shows example
    buy: [],
    sell: [],
    stopLoss: [],
    takeProfit: []
  },

  updateKeywords: {
    closeTP1: [],
    closeTP2: [],
    closeTP3: [],
    closeTP4: [],
    closeFull: [],
    closeHalf: [],
    closePartial: [],
    breakEven: [],
    setTP1: [],
    setTP2: [],
    setTP3: [],
    setTP4: [],
    setTP5: [],
    setTP: [],
    setSL: [],
    deletePending: []
  },

  additionalKeywords: {
    layer: [],
    closeAll: [],
    deleteAll: [],
    ignoreKeyword: [],
    skipKeyword: [],
    marketOrder: [],
    removeSL: []
  },

  advancedSettings: {
    delayInMsec: 0,
    entryRangeStrategy: 'first',  // Default: use first price in range (e.g., 4326 from "4326-4429")
    slInPips: false,
    tpInPips: false,
    tpFormatMode: 'separate_keywords',  // Default: TP1:, TP2:, TP3: format
    readImage: false,
    delimiters: ',;',
    allOrder: false,
    readForwarded: true
  },

  riskSettings: {
    riskMode: 'fixed',
    fixedLotSize: 0.01,
    riskPercent: 2.0,
    riskAmount: 100,
    maxSpread: 30,
    slippage: 3,
    riskTP1: 0.01,
    riskTP2: 0.01,
    riskTP3: 0.01,
    riskTP4: 0.01,
    riskTP5: 0.01
  },

  tradeFilters: {
    ignoreWithoutSL: false,
    ignoreWithoutTP: false,
    forceMarketExecution: false,
    checkAlreadyOpenedOrder: false,
    samePairMode: 'allowed',
    samePairCheckType: 'today',
    maxRetriesOrderSend: 3,
    removePendingIfNotActivated: 0,
    pipsTolerance: 7
  },

  sltpOverride: {
    slOverrideMode: 'use_signal',
    tpOverrideMode: 'use_signal',
    predefinedSL: 0,
    predefinedTP: [0, 0, 0, 0, 0],
    enableRRMode: false,
    rrRatio: [2.0, 3.0, 4.0, 5.0, 6.0],
    calculateSpreadInSLTP: false
  },

  modification: {
    reverseSignal: false,
    reverseSLTPInPips: false,
    entryModificationPips: 0,
    slModificationPips: 0,
    tpModificationPips: 0
  },

  breakeven: {
    enableBreakeven: false,
    breakevenPips: 2,
    moveSlAfterTPHit: false,
    moveSlAfterXPips: 0
  },

  trailingStop: {
    useTrailingStop: false,
    trailingStartPips: 5,
    trailingStepPips: 1,
    trailingDistancePips: 5,
    trailingStartAfterTPHit: 'none',
    trailingAlsoMoveTP: false,
    smartProfitLockPercent: 50
  },

  partialClose: {
    partialClosePercent: 25,
    halfClosePercent: 50,
    closePercentAtTP1: 0,
    closePercentAtTP2: 0,
    closePercentAtTP3: 0,
    closePercentAtTP4: 0,
    closePercentAtTP5: 0
  },

  symbolMapping: {
    enableMapping: false,
    symbolPrefix: '',
    symbolSuffix: '',
    skipSuffixPrefixList: [],
    excludedSymbols: [],
    symbolsToTrade: []
  },

  timeFilter: {
    enableTimeFilter: false,
    startTime: '01:00',
    endTime: '23:00',
    tradeOnMonday: true,
    tradeOnTuesday: true,
    tradeOnWednesday: true,
    tradeOnThursday: true,
    tradeOnFriday: true,
    tradeOnSaturday: true,
    tradeOnSunday: true
  },

  signalModifications: {
    enabled: true,
    autoApply: true,
    detectRepliesOnly: true,
    requireConfirmationFor: []  // Empty for testing - auto-apply all modifications
  },

  other: {
    enableEditMessage: false,
    customComment: '',
    sendMT5Notifications: true,
    onComment: true
  },

  isEnabled: true,
  useAIParser: true
}
