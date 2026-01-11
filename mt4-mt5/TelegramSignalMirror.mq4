//+------------------------------------------------------------------+
//|                                      TelegramSignalMirror.mq4    |
//|                        Telegram Signal Mirror - MT4 Expert       |
//+------------------------------------------------------------------+
#property copyright "Telegram Signal Mirror"
#property link      ""
#property version   "2.00"
#property strict

// Server Connection
input group "========== SERVER CONNECTION =========="
input string   ApiServerURL = "https://telegramsignalmirror.com"; // API Server URL

// Hidden/Fixed settings
int    PollInterval = 2;                                // Poll every 2 seconds
int    MagicNumber = 123456;                            // Magic number for trade identification
string AccountNumber;                                   // Auto-detected from MT4 account

// Symbol Mapping
input group "========== SYMBOL MAPPING =========="
input string   CustomSymbolMap = "";                    // Custom Symbol Mapping (e.g., XAUUSD=GOLD,US30=DJ30)
input string   SymbolPrefix = "";                       // Symbol Prefix
input string   SymbolSuffix = "";                       // Symbol Suffix
input string   SkipPrefixSuffixPairs = "";              // Skip Prefix/Suffix for these symbols (comma separated)
input string   ExcludedSymbols = "";                    // Excluded Symbols (comma separated)
input string   SymbolsToTrade = "";                     // Symbols to Trade - whitelist (empty = all allowed)

// Risk Management
input group "========== RISK MANAGEMENT =========="
enum ENUM_RISK_MODE { RISK_FIXED, RISK_PERCENT, RISK_AMOUNT };
input ENUM_RISK_MODE RiskMode = RISK_FIXED;             // Risk Mode
input double   FixedLotSize = 0.01;                     // Fixed Lot Size
input double   RiskPercent = 2.0;                       // Risk % of Balance
input double   RiskAmount = 100.0;                      // Risk $ Amount
input double   RiskTP1 = 0.01;                          // Risk/Lot for TP1
input double   RiskTP2 = 0.01;                          // Risk/Lot for TP2
input double   RiskTP3 = 0.01;                          // Risk/Lot for TP3
input double   RiskTP4 = 0.01;                          // Risk/Lot for TP4
input double   RiskTP5 = 0.01;                          // Risk/Lot for TP5
input double   RiskTP6 = 0.01;                          // Risk/Lot for TP6
input double   RiskTP7 = 0.01;                          // Risk/Lot for TP7
input double   RiskTP8 = 0.01;                          // Risk/Lot for TP8
input double   RiskTP9 = 0.01;                          // Risk/Lot for TP9
input double   RiskTP10 = 0.01;                         // Risk/Lot for TP10

// Hidden settings (not exposed to user)
int      MaxSpread = 9000;                               // Maximum Spread in Points (hidden)
int      Slippage = 9000;                                // Maximum Slippage in Points (hidden)

// Signal Modification
input group "========== SIGNAL MODIFICATION =========="
input bool     ReverseSignal = false;                   // Reverse Signal Direction
input double   EntryModificationPips = 0;               // Entry Modification Pips (0=disabled)
input double   SlModificationPips = 0;                  // SL Modification Pips (0=disabled)
input double   TpModificationPips = 0;                  // TP Modification Pips (0=disabled)

// SL/TP Override
input group "========== SL/TP OVERRIDE =========="
enum ENUM_OVERRIDE_MODE { USE_SIGNAL, USE_PREDEFINED };
input ENUM_OVERRIDE_MODE SlOverrideMode = USE_SIGNAL;   // SL Override Mode
input double   PredefinedSL = 0;                        // Predefined SL in Pips (0=disabled)
input ENUM_OVERRIDE_MODE TpOverrideMode = USE_SIGNAL;   // TP Override Mode
input double   PredefinedTP1 = 0;                       // Predefined TP1 in Pips
input double   PredefinedTP2 = 0;                       // Predefined TP2 in Pips
input double   PredefinedTP3 = 0;                       // Predefined TP3 in Pips
input double   PredefinedTP4 = 0;                       // Predefined TP4 in Pips
input double   PredefinedTP5 = 0;                       // Predefined TP5 in Pips
input double   PredefinedTP6 = 0;                       // Predefined TP6 in Pips
input double   PredefinedTP7 = 0;                       // Predefined TP7 in Pips
input double   PredefinedTP8 = 0;                       // Predefined TP8 in Pips
input double   PredefinedTP9 = 0;                       // Predefined TP9 in Pips
input double   PredefinedTP10 = 0;                      // Predefined TP10 in Pips
input bool     EnableRRMode = false;                    // Enable Risk:Reward Mode
input double   RRRatioTP1 = 2.0;                        // RR Ratio for TP1 (TP1/SL)
input double   RRRatioTP2 = 3.0;                        // RR Ratio for TP2 (TP2/SL)
input double   RRRatioTP3 = 4.0;                        // RR Ratio for TP3 (TP3/SL)
input double   RRRatioTP4 = 5.0;                        // RR Ratio for TP4 (TP4/SL)
input double   RRRatioTP5 = 6.0;                        // RR Ratio for TP5 (TP5/SL)
input double   RRRatioTP6 = 7.0;                        // RR Ratio for TP6 (TP6/SL)
input double   RRRatioTP7 = 8.0;                        // RR Ratio for TP7 (TP7/SL)
input double   RRRatioTP8 = 9.0;                        // RR Ratio for TP8 (TP8/SL)
input double   RRRatioTP9 = 10.0;                       // RR Ratio for TP9 (TP9/SL)
input double   RRRatioTP10 = 11.0;                      // RR Ratio for TP10 (TP10/SL)

// Trade Filters
input group "========== TRADE FILTERS =========="
input int      MaxRetries = 3;                          // Max Retries if OrderSend Failed
input int      RemovePendingAfter = 0;                  // Remove Pending Orders after N seconds (0=disabled)
input bool     ForceMarketExecution = false;            // Force Market Execution (no pending orders)
input bool     IgnoreWithoutSL = false;                 // Ignore Trades without SL
input bool     IgnoreWithoutTP = false;                 // Ignore Trades without TP
input bool     CheckAlreadyOpenedOrder = false;         // Check Already Opened Order with Same Pair
input int      PipsTolerance = 7;                       // Pips Tolerance for Market Execution

// Breakeven Settings
input group "========== BREAKEVEN SETTINGS =========="
input bool     EnableBreakeven = false;                 // Enable Breakeven
enum ENUM_MOVE_SL_TYPE { ONLY_TO_ENTRY, ENTRY_PLUS_BUFFER };
input ENUM_MOVE_SL_TYPE MoveSlToEntryType = ENTRY_PLUS_BUFFER; // Move SL to Entry Type
input double   MoveSlAfterXPips = 0;                    // Move SL After X Pips Profit (0=disabled)
input double   BreakevenPips = 0;                       // Breakeven Buffer Pips
input bool     MoveSlAfterTPHit = false;                // Move SL to Breakeven after TP Hit

// Partial Close Settings
input group "========== PARTIAL CLOSE SETTINGS =========="
input double   ClosePercentAtTP1 = 0;                   // Close % at TP1 (0=disabled)
input double   ClosePercentAtTP2 = 0;                   // Close % at TP2 (0=disabled)
input double   ClosePercentAtTP3 = 0;                   // Close % at TP3 (0=disabled)
input double   ClosePercentAtTP4 = 0;                   // Close % at TP4 (0=disabled)
input double   ClosePercentAtTP5 = 0;                   // Close % at TP5 (0=disabled)
input double   ClosePercentAtTP6 = 0;                   // Close % at TP6 (0=disabled)
input double   ClosePercentAtTP7 = 0;                   // Close % at TP7 (0=disabled)
input double   ClosePercentAtTP8 = 0;                   // Close % at TP8 (0=disabled)
input double   ClosePercentAtTP9 = 0;                   // Close % at TP9 (0=disabled)
input double   ClosePercentAtTP10 = 0;                  // Close % at TP10 (0=disabled)

// Trailing Stop Settings
input group "========== TRAILING STOP SETTINGS =========="
input bool     UseTrailingStop = false;                 // Use Trailing Stop
input double   TrailingStartPips = 5;                   // Trailing Start after X Pips
input double   TrailingStepPips = 1;                    // Trailing Step Pips
input double   TrailingDistancePips = 5;                // Trailing Distance from Current Price

// Notifications & Comments
input group "========== NOTIFICATIONS & COMMENTS =========="
input bool     OnComment = true;                        // Add Comment to Trades
input string   CustomComment = "TSM Signal";            // Custom Comment
input bool     SendMT4Notifications = true;             // Send MT4 Push Notifications

// Time Filter
input group "========== TIME FILTER =========="
input bool     EnableTimeFilter = false;                // Enable Day and Time Filter
input string   StartTime = "01:00";                     // Start Time (HH:MM)
input string   EndTime = "23:00";                       // End Time (HH:MM)
input bool     TradeOnMonday = true;                    // Trade on Monday
input bool     TradeOnTuesday = true;                   // Trade on Tuesday
input bool     TradeOnWednesday = true;                 // Trade on Wednesday
input bool     TradeOnThursday = true;                  // Trade on Thursday
input bool     TradeOnFriday = true;                    // Trade on Friday
input bool     TradeOnSaturday = true;                  // Trade on Saturday
input bool     TradeOnSunday = true;                    // Trade on Sunday

// TSM Protector
input group "========== TSM PROTECTOR =========="
input bool     EnableProtector = false;                 // Enable TSM Protector
input double   DailyLossLimit = 100.0;                  // Daily Loss Limit ($)
input bool     UseLossPercent = false;                  // Use Loss Limit as % of Balance
input double   DailyLossLimitPercent = 2.0;             // Daily Loss Limit (%)
input double   DailyProfitTarget = 200.0;               // Daily Profit Target ($)
input bool     UseProfitPercent = false;                // Use Profit Target as % of Balance
input double   DailyProfitTargetPercent = 5.0;          // Daily Profit Target (%)
input int      MaxTradesPerDay = 10;                    // Max Trades Per Day (0=unlimited)
input bool     CloseAllOnLossLimit = true;              // Close All on Loss Limit
input bool     CloseAllOnProfitTarget = false;          // Close All on Profit Target
input bool     StopNewTradesOnLimit = true;             // Stop New Trades on Limit
input string   ProtectorResetTime = "00:00";            // Daily Reset Time (HH:MM)

// Signal-specific configuration structure
struct SignalConfig
{
   // Risk settings
   string riskMode;           // 'fixed', 'percent', 'amount'
   double fixedLotSize;
   double riskPercent;
   double riskAmount;
   int maxSpread;
   int slippage;

   // Trade filters
   bool checkDuplicates;
   int maxRetries;
   int removePendingAfter;    // Remove pending orders after N seconds (0=disabled)

   // Breakeven settings
   bool enableBreakeven;
   double breakevenPips;
   bool moveSlAfterTPHit;
   double moveSlAfterXPips;

   // Trailing stop settings
   bool useTrailingStop;
   double trailingStartPips;
   double trailingStepPips;
   double trailingDistancePips;

   // Partial close settings
   double closePercentAtTP1;
   double closePercentAtTP2;
   double closePercentAtTP3;
   double closePercentAtTP4;
   double closePercentAtTP5;
   double closePercentAtTP6;
   double closePercentAtTP7;
   double closePercentAtTP8;
   double closePercentAtTP9;
   double closePercentAtTP10;

   // Other settings
   string customComment;
};

// Trade tracking structure
struct TradeInfo
{
   int ticket;
   string symbol;
   double entryPrice;
   double stopLoss;
   double originalSL;
   double takeProfits[10];
   int tpsHit;               // Bitmask of which TPs have been hit
   bool breakevenSet;
   int breakevenRetries;     // Count breakeven modification attempts
   datetime openTime;
   SignalConfig config;
   string signalGroupId;     // Groups orders from the same signal together
};

// Symbol mapping structure
struct SymbolMapping
{
   string fromSymbol;
   string toSymbol;
};

// Global variables
bool isConnected = false;
datetime lastPoll = 0;
datetime lastModificationPoll = 0;
datetime lastTimerRun = 0;
string lastError = "";
TradeInfo activeTrades[];     // Track all active trades for breakeven/trailing
SymbolMapping customMappings[];  // Custom symbol mappings

// TSM Protector Variables
double protectorDailyPL = 0;          // Daily profit/loss tracker
int protectorDailyTrades = 0;         // Daily trade counter
datetime protectorLastReset = 0;      // Last reset date
bool protectorLimitHit = false;       // Flag if limit was hit today
string protectorLimitReason = "";     // Reason for limit hit

//+------------------------------------------------------------------+
//| Array Remove function (MT4 doesn't have this built-in)           |
//+------------------------------------------------------------------+
void ArrayRemove(TradeInfo &array[], int index, int count)
{
   int size = ArraySize(array);
   if(index < 0 || index >= size || count <= 0) return;

   // Shift elements left
   for(int i = index; i < size - count; i++)
   {
      array[i] = array[i + count];
   }

   // Resize array
   ArrayResize(array, size - count);
}

//+------------------------------------------------------------------+
//| Initialize custom symbol mappings from input string              |
//+------------------------------------------------------------------+
void InitializeSymbolMappings()
{
   ArrayResize(customMappings, 0); // Clear array

   if(CustomSymbolMap == "") return; // No custom mappings defined

   // Parse the custom mapping string
   // Format: "XAUUSD=GOLD,XAGUSD=SILVER,US30=DJ30"
   string pairs[];
   int pairCount = StringSplit(CustomSymbolMap, ',', pairs);

   for(int i = 0; i < pairCount; i++)
   {
      // Trim whitespace
      StringTrimLeft(pairs[i]);
      StringTrimRight(pairs[i]);

      // Split by '='
      string mapping[];
      int parts = StringSplit(pairs[i], '=', mapping);

      if(parts == 2)
      {
         // Trim whitespace from both parts
         StringTrimLeft(mapping[0]);
         StringTrimRight(mapping[0]);
         StringTrimLeft(mapping[1]);
         StringTrimRight(mapping[1]);

         // Add to mappings array
         int size = ArraySize(customMappings);
         ArrayResize(customMappings, size + 1);
         customMappings[size].fromSymbol = mapping[0];
         customMappings[size].toSymbol = mapping[1];

         Print("Custom Symbol Mapping: ", mapping[0], " → ", mapping[1]);
      }
   }

   if(ArraySize(customMappings) > 0)
   {
      Print("Loaded ", ArraySize(customMappings), " custom symbol mapping(s)");
   }
}

//+------------------------------------------------------------------+
//| Expert initialization function                                    |
//+------------------------------------------------------------------+
int OnInit()
{
   // Auto-detect account number from MT4
   AccountNumber = IntegerToString(AccountNumber());

   Print("===========================================");
   Print("Telegram Signal Mirror EA v2.0 (MT4)");
   Print("===========================================");
   Print("API Server: ", ApiServerURL);
   Print("Account: ", AccountNumber);
   Print("Magic Number: ", MagicNumber);
   Print("Poll Interval: ", PollInterval, " seconds");

   // Initialize custom symbol mappings
   InitializeSymbolMappings();

   // Check if trading is allowed
   if(!IsTradeAllowed())
   {
      Alert("ERROR: Auto trading is not enabled!");
      Print("ERROR: Please enable auto trading (click AutoTrading button)");
      return(INIT_FAILED);
   }

   // Test API server connection
   if(!TestApiConnection())
   {
      Alert("WARNING: Cannot connect to API server at ", ApiServerURL);
      Print("WARNING: Make sure desktop app is running");
      Print("WARNING: EA will continue trying to connect...");
   }
   else
   {
      Print("✅ Successfully connected to API server");
      isConnected = true;
   }

   lastPoll = TimeCurrent();
   lastModificationPoll = TimeCurrent();
   lastTimerRun = TimeCurrent();

   // Initialize TSM Protector
   protectorLastReset = 0;
   CheckProtectorReset();

   Print("⏱️  Timer will monitor trades every 2 seconds");
   Print("EA initialized successfully - Waiting for signals...");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                  |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("===========================================");
   Print("Telegram Signal Mirror EA shutting down");
   Print("Reason: ", reason);
   Print("===========================================");
}

//+------------------------------------------------------------------+
//| Expert tick function                                              |
//+------------------------------------------------------------------+
void OnTick()
{
   // Poll API server at defined interval
   if(TimeCurrent() - lastPoll >= PollInterval)
   {
      PollApiServer();
      lastPoll = TimeCurrent();
   }

   // Simulate timer function (MT4 doesn't have OnTimer on all accounts)
   // Run every 2 seconds
   if(TimeCurrent() - lastTimerRun >= 2)
   {
      MonitorActiveTrades();

      // Poll for modification commands every 2 seconds
      if(TimeCurrent() - lastModificationPoll >= 2)
      {
         PollModifications();
         lastModificationPoll = TimeCurrent();
      }

      // Check TSM Protector daily reset and update display
      CheckProtectorReset();
      UpdateProtectorDisplay();

      lastTimerRun = TimeCurrent();
   }
}

//+------------------------------------------------------------------+
//| Test API server connection                                        |
//+------------------------------------------------------------------+
bool TestApiConnection()
{
   string url = ApiServerURL + "/api/health";
   string headers = "Content-Type: application/json\r\n";
   char data[];
   char result[];
   string result_headers;

   int timeout = 5000; // 5 seconds

   ResetLastError();
   int res = WebRequest("GET", url, headers, timeout, data, result, result_headers);

   if(res == -1)
   {
      int error = GetLastError();
      Print("ERROR: WebRequest failed. Error code: ", error);

      if(error == 4060)
      {
         Print("ERROR: URL not allowed. Add this URL to allowed WebRequest list:");
         Print("       Tools -> Options -> Expert Advisors");
         Print("       Check 'Allow WebRequest for listed URL'");
         Print("       Add: ", ApiServerURL);
      }

      return false;
   }

   if(res == 200)
   {
      string response = CharArrayToString(result);
      Print("API Server Health Check: ", response);
      return true;
   }

   Print("API Server returned status: ", res);
   return false;
}

//+------------------------------------------------------------------+
//| Poll API server for pending signals                               |
//+------------------------------------------------------------------+
void PollApiServer()
{
   string url = ApiServerURL + "/api/signals/pending?account=" + AccountNumber;
   string headers = "Content-Type: application/json\r\n";
   char data[];
   char result[];
   string result_headers;

   int timeout = 5000;

   ResetLastError();
   int res = WebRequest("GET", url, headers, timeout, data, result, result_headers);

   if(res == -1)
   {
      int error = GetLastError();

      // Only print error if it's not the "URL not allowed" error (avoid spam)
      if(error != 4060 && lastError != "webrequest_failed")
      {
         Print("WARNING: Cannot reach API server (Error ", error, ")");
         lastError = "webrequest_failed";
         isConnected = false;
      }

      return;
   }

   if(res != 200)
   {
      // Handle authorization errors specifically
      if(res == 403)
      {
         // Parse error message from response
         string errorResponse = CharArrayToString(result);
         string errorMessage = ExtractValue(errorResponse, "message");

         if(errorMessage == "")
            errorMessage = "Account not authorized. Please register at " + ApiServerURL;

         // Show alert only once to avoid spam
         if(lastError != "unauthorized")
         {
            Alert("🚫 ACCOUNT NOT AUTHORIZED\n\n", errorMessage, "\n\nEA will not receive signals until authorized.");
            Print("❌ AUTHORIZATION ERROR: ", errorMessage);
            Comment("🚫 Account Not Authorized\n", errorMessage);
            lastError = "unauthorized";
         }
      }
      else if(lastError != "http_error")
      {
         Print("WARNING: API server returned status ", res);
         lastError = "http_error";
      }
      return;
   }

   // Successfully connected
   if(!isConnected)
   {
      Print("✅ Reconnected to API server");
      isConnected = true;
      lastError = "";
   }

   // Parse response
   string response = CharArrayToString(result);

   // Check if there are any signals
   if(StringFind(response, "\"signals\":[]") >= 0)
   {
      // No signals in queue
      return;
   }

   // Process signals
   ProcessSignalsResponse(response);
}

//+------------------------------------------------------------------+
//| Process signals from API response                                 |
//+------------------------------------------------------------------+
void ProcessSignalsResponse(string response)
{
   // Extract signals array from response
   // Response format: {"signals":[{...},{...}]}

   int start = StringFind(response, "\"signals\":[");
   if(start < 0)
   {
      Print("No signals array found in response");
      return;
   }

   start += 11; // Move past "signals":[

   // Find each signal object
   int pos = start;
   int signalCount = 0;

   while(pos < StringLen(response))
   {
      // Find start of signal object
      int objStart = StringFind(response, "{", pos);
      if(objStart < 0) break;

      // Find end of signal object
      int objEnd = StringFind(response, "}", objStart);
      if(objEnd < 0) break;

      // Extract signal JSON
      string signalJson = StringSubstr(response, objStart, objEnd - objStart + 1);

      // Process this signal
      ProcessSignal(signalJson);

      signalCount++;

      // Move to next signal
      pos = objEnd + 1;

      // Check if we've reached the end of the array
      if(StringFind(response, "]", pos) == pos) break;
   }

   // Silent polling - only log when signals are actually processed
   // if(signalCount > 0)
   // {
   //    Print("Processed ", signalCount, " signal(s)");
   // }
}

//+------------------------------------------------------------------+
//| Apply symbol mapping (custom mappings, then prefix/suffix)        |
//+------------------------------------------------------------------+
string ApplySymbolMapping(string symbol)
{
   // First, check custom symbol mappings
   for(int i = 0; i < ArraySize(customMappings); i++)
   {
      if(customMappings[i].fromSymbol == symbol)
      {
         // Found a custom mapping, return the mapped symbol
         return customMappings[i].toSymbol;
      }
   }

   // No custom mapping found, check if in skip list for prefix/suffix
   if(SkipPrefixSuffixPairs != "")
   {
      string skipList[];
      StringSplit(SkipPrefixSuffixPairs, ',', skipList);
      for(int i = 0; i < ArraySize(skipList); i++)
      {
         StringTrimLeft(skipList[i]);
         StringTrimRight(skipList[i]);
         if(skipList[i] == symbol) return symbol; // Skip mapping for this symbol
      }
   }

   // Apply prefix and suffix
   return SymbolPrefix + symbol + SymbolSuffix;
}

//+------------------------------------------------------------------+
//| Check if symbol is excluded                                       |
//+------------------------------------------------------------------+
bool IsSymbolExcluded(string symbol)
{
   if(ExcludedSymbols == "") return false;

   string excluded[];
   StringSplit(ExcludedSymbols, ',', excluded);
   for(int i = 0; i < ArraySize(excluded); i++)
   {
      StringTrimLeft(excluded[i]);
      StringTrimRight(excluded[i]);
      if(excluded[i] == symbol) return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Check if symbol is in whitelist                                   |
//+------------------------------------------------------------------+
bool IsSymbolAllowed(string symbol)
{
   if(SymbolsToTrade == "") return true; // Empty = all allowed

   string allowed[];
   StringSplit(SymbolsToTrade, ',', allowed);
   for(int i = 0; i < ArraySize(allowed); i++)
   {
      StringTrimLeft(allowed[i]);
      StringTrimRight(allowed[i]);
      if(allowed[i] == symbol) return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Check time filter                                                 |
//+------------------------------------------------------------------+
bool PassesTimeFilter()
{
   if(!EnableTimeFilter) return true;

   MqlDateTime now;
   TimeToStruct(TimeCurrent(), now);

   // Check day of week
   bool dayAllowed = false;
   if(now.day_of_week == 0 && TradeOnSunday) dayAllowed = true;
   else if(now.day_of_week == 1 && TradeOnMonday) dayAllowed = true;
   else if(now.day_of_week == 2 && TradeOnTuesday) dayAllowed = true;
   else if(now.day_of_week == 3 && TradeOnWednesday) dayAllowed = true;
   else if(now.day_of_week == 4 && TradeOnThursday) dayAllowed = true;
   else if(now.day_of_week == 5 && TradeOnFriday) dayAllowed = true;
   else if(now.day_of_week == 6 && TradeOnSaturday) dayAllowed = true;

   if(!dayAllowed) return false;

   // Check time range
   string currentTime = StringFormat("%02d:%02d", now.hour, now.min);
   if(currentTime < StartTime || currentTime > EndTime) return false;

   return true;
}

//+------------------------------------------------------------------+
//| Get pip value for symbol                                          |
//+------------------------------------------------------------------+
double GetPipValue(string symbol)
{
   if(StringFind(symbol, "JPY") >= 0) return 0.01;
   if(StringFind(symbol, "XAU") >= 0 || StringFind(symbol, "GOLD") >= 0) return 0.1;
   if(StringFind(symbol, "XAG") >= 0 || StringFind(symbol, "SILVER") >= 0) return 0.01;
   if(StringFind(symbol, "US30") >= 0 || StringFind(symbol, "NAS100") >= 0 || StringFind(symbol, "SPX500") >= 0) return 1.0;
   if(StringFind(symbol, "BTC") >= 0) return 1.0;
   if(StringFind(symbol, "ETH") >= 0) return 0.1;
   return 0.0001; // Default forex
}

//+------------------------------------------------------------------+
//| Auto-detect order type based on entry price vs market price      |
//+------------------------------------------------------------------+
string DetectOrderType(string direction, double entryPrice, string symbol)
{
   // If already has STOP or LIMIT keyword, no need to detect
   if(StringFind(direction, "STOP") >= 0) return "STOP";
   if(StringFind(direction, "LIMIT") >= 0) return "LIMIT";

   // Determine if BUY or SELL
   bool isBuy = (StringFind(direction, "BUY") >= 0);

   // Get current market price
   double currentPrice = isBuy ? MarketInfo(symbol, MODE_ASK) : MarketInfo(symbol, MODE_BID);

   // Tolerance for "at market" (10 pips)
   double pipValue = GetPipValue(symbol);
   double tolerance = 10 * pipValue;

   // If entry price is very close to current price, treat as market order
   if(MathAbs(entryPrice - currentPrice) <= tolerance)
   {
      return ""; // Market order
   }

   // Detect order type based on entry vs market relationship
   if(isBuy)
   {
      // BUY orders
      if(entryPrice < currentPrice)
         return "LIMIT"; // Buy when price drops to entry
      else
         return "STOP"; // Buy breakout when price rises to entry
   }
   else
   {
      // SELL orders
      if(entryPrice > currentPrice)
         return "LIMIT"; // Sell when price rises to entry
      else
         return "STOP"; // Sell breakout when price drops to entry
   }
}

//+------------------------------------------------------------------+
//| Process a single signal                                           |
//+------------------------------------------------------------------+
void ProcessSignal(string signalJson)
{
   Print("========================================");
   Print("📊 NEW SIGNAL RECEIVED");
   Print("========================================");

   // Extract signal ID
   string signalId = ExtractValue(signalJson, "id");

   // Parse configuration
   SignalConfig config = ParseSignalConfig(signalJson);

   // Check time filter first
   if(!PassesTimeFilter())
   {
      Print("⏰ Signal rejected by time filter");
      AcknowledgeSignal(signalId, "skipped", "Time filter");
      return;
   }

   // Extract signal data
   string symbol = ExtractValue(signalJson, "symbol");
   string direction = ExtractValue(signalJson, "direction");
   double entryPrice = StrToDouble(ExtractValue(signalJson, "entryPrice"));
   double stopLoss = StrToDouble(ExtractValue(signalJson, "stopLoss"));

   // Extract all take profits
   double takeProfits[10];
   takeProfits[0] = StrToDouble(ExtractValue(signalJson, "takeProfit1"));
   takeProfits[1] = StrToDouble(ExtractValue(signalJson, "takeProfit2"));
   takeProfits[2] = StrToDouble(ExtractValue(signalJson, "takeProfit3"));
   takeProfits[3] = StrToDouble(ExtractValue(signalJson, "takeProfit4"));
   takeProfits[4] = StrToDouble(ExtractValue(signalJson, "takeProfit5"));
   takeProfits[5] = StrToDouble(ExtractValue(signalJson, "takeProfit6"));
   takeProfits[6] = StrToDouble(ExtractValue(signalJson, "takeProfit7"));
   takeProfits[7] = StrToDouble(ExtractValue(signalJson, "takeProfit8"));
   takeProfits[8] = StrToDouble(ExtractValue(signalJson, "takeProfit9"));
   takeProfits[9] = StrToDouble(ExtractValue(signalJson, "takeProfit10"));

   // Validate symbol
   if(symbol == "")
   {
      Print("❌ ERROR: No symbol specified. Using chart symbol: ", Symbol());
      symbol = Symbol();
   }

   // Check if symbol is excluded
   if(IsSymbolExcluded(symbol))
   {
      Print("🚫 Symbol ", symbol, " is excluded");
      AcknowledgeSignal(signalId, "skipped", "Symbol excluded");
      return;
   }

   // Check if symbol is in whitelist
   if(!IsSymbolAllowed(symbol))
   {
      Print("🚫 Symbol ", symbol, " not in whitelist");
      AcknowledgeSignal(signalId, "skipped", "Symbol not in whitelist");
      return;
   }

   // Apply symbol mapping (prefix/suffix)
   string originalSymbol = symbol;
   symbol = ApplySymbolMapping(symbol);
   if(symbol != originalSymbol)
   {
      Print("🔄 Symbol mapped: ", originalSymbol, " → ", symbol);
   }

   // Auto-detect order type if not specified (before any modifications)
   string detectedOrderType = DetectOrderType(direction, entryPrice, symbol);
   if(detectedOrderType != "" && StringFind(direction, "STOP") < 0 && StringFind(direction, "LIMIT") < 0)
   {
      // Add detected order type to direction
      direction = direction + " " + detectedOrderType;
      Print("🔍 Auto-detected order type: ", direction);
   }

   // Apply signal modifications (reverse, pips adjustments)
   if(ReverseSignal)
   {
      // Extract base direction and order type
      string baseDirection = "";
      string orderType = "";

      if(StringFind(direction, "STOP") >= 0)
      {
         orderType = "STOP";
         baseDirection = StringSubstr(direction, 0, StringFind(direction, " "));
      }
      else if(StringFind(direction, "LIMIT") >= 0)
      {
         orderType = "LIMIT";
         baseDirection = StringSubstr(direction, 0, StringFind(direction, " "));
      }
      else
      {
         baseDirection = direction;
      }

      // Flip direction (BUY ↔ SELL)
      if(baseDirection == "BUY") baseDirection = "SELL";
      else if(baseDirection == "SELL") baseDirection = "BUY";

      // Flip order type (LIMIT ↔ STOP, market stays market)
      if(orderType == "LIMIT") orderType = "STOP";
      else if(orderType == "STOP") orderType = "LIMIT";

      // Reconstruct direction string
      if(orderType != "")
         direction = baseDirection + " " + orderType;
      else
         direction = baseDirection;

      // Reverse SL and TP positions (flip them to opposite sides of entry)
      if(stopLoss != 0 && entryPrice != 0)
      {
         double slDistance = MathAbs(entryPrice - stopLoss);
         double originalSL = stopLoss;

         // Calculate new SL on opposite side of entry
         if(stopLoss > entryPrice)
            stopLoss = entryPrice - slDistance; // Was above, now below
         else
            stopLoss = entryPrice + slDistance; // Was below, now above

         Print("🔄 SL reversed: ", originalSL, " → ", stopLoss);
      }

      // Reverse all TPs
      for(int i = 0; i < 5; i++)
      {
         if(takeProfits[i] != 0 && entryPrice != 0)
         {
            double tpDistance = MathAbs(entryPrice - takeProfits[i]);
            double originalTP = takeProfits[i];

            // Calculate new TP on opposite side of entry
            if(takeProfits[i] > entryPrice)
               takeProfits[i] = entryPrice - tpDistance; // Was above, now below
            else
               takeProfits[i] = entryPrice + tpDistance; // Was below, now above

            if(i == 0) Print("🔄 TP", i+1, " reversed: ", originalTP, " → ", takeProfits[i]);
         }
      }

      Print("🔄 Signal reversed: ", direction);
   }

   // Apply SL/TP override or RR mode
   double pipValue = GetPipValue(symbol);
   if(SlOverrideMode == USE_PREDEFINED && PredefinedSL > 0)
   {
      bool isBuy = StringFind(direction, "BUY") >= 0;
      stopLoss = entryPrice + (PredefinedSL * pipValue * (isBuy ? -1 : 1));
      Print("🔧 SL overridden: ", stopLoss, " (", PredefinedSL, " pips)");
   }

   if(EnableRRMode && stopLoss != 0)
   {
      // Calculate TPs based on RR ratios
      bool isBuy = StringFind(direction, "BUY") >= 0;
      double slDistance = MathAbs(entryPrice - stopLoss);
      takeProfits[0] = entryPrice + (slDistance * RRRatioTP1 * (isBuy ? 1 : -1));
      takeProfits[1] = entryPrice + (slDistance * RRRatioTP2 * (isBuy ? 1 : -1));
      takeProfits[2] = entryPrice + (slDistance * RRRatioTP3 * (isBuy ? 1 : -1));
      takeProfits[3] = entryPrice + (slDistance * RRRatioTP4 * (isBuy ? 1 : -1));
      takeProfits[4] = entryPrice + (slDistance * RRRatioTP5 * (isBuy ? 1 : -1));
      Print("🎯 TPs calculated by RR mode");
   }
   else if(TpOverrideMode == USE_PREDEFINED)
   {
      // Use predefined TPs
      bool isBuy = StringFind(direction, "BUY") >= 0;
      if(PredefinedTP1 > 0) takeProfits[0] = entryPrice + (PredefinedTP1 * pipValue * (isBuy ? 1 : -1));
      if(PredefinedTP2 > 0) takeProfits[1] = entryPrice + (PredefinedTP2 * pipValue * (isBuy ? 1 : -1));
      if(PredefinedTP3 > 0) takeProfits[2] = entryPrice + (PredefinedTP3 * pipValue * (isBuy ? 1 : -1));
      if(PredefinedTP4 > 0) takeProfits[3] = entryPrice + (PredefinedTP4 * pipValue * (isBuy ? 1 : -1));
      if(PredefinedTP5 > 0) takeProfits[4] = entryPrice + (PredefinedTP5 * pipValue * (isBuy ? 1 : -1));
      Print("🔧 TPs overridden with predefined values");
   }

   // Apply pips modifications
   if(EntryModificationPips != 0) entryPrice = entryPrice + (EntryModificationPips * pipValue);
   if(SlModificationPips != 0) stopLoss = stopLoss + (SlModificationPips * pipValue);
   if(TpModificationPips != 0)
   {
      for(int i = 0; i < 5; i++)
         if(takeProfits[i] != 0) takeProfits[i] = takeProfits[i] + (TpModificationPips * pipValue);
   }

   // Convert pips mode to actual prices (negative values indicate pips)
   // Desktop app sends negative values when "SL in pips" or "TP in pips" is checked
   bool isBuy = StringFind(direction, "BUY") >= 0;
   double referencePrice = entryPrice;

   // If entry is 0, use current market price as reference
   if(referencePrice == 0)
   {
      referencePrice = isBuy ? MarketInfo(symbol, MODE_ASK) : MarketInfo(symbol, MODE_BID);
      Print("📍 No entry price, using current market as reference: ", referencePrice);
   }

   // Convert SL from pips to price if negative
   if(stopLoss < 0)
   {
      double slPips = MathAbs(stopLoss);
      // For BUY: SL below entry, for SELL: SL above entry
      stopLoss = referencePrice + (slPips * pipValue * (isBuy ? -1 : 1));
      Print("🔢 Converted SL from ", slPips, " pips to price: ", stopLoss);
   }

   // Convert TPs from pips to prices if negative
   for(int i = 0; i < 5; i++)
   {
      if(takeProfits[i] < 0)
      {
         double tpPips = MathAbs(takeProfits[i]);
         // For BUY: TP above entry, for SELL: TP below entry
         takeProfits[i] = referencePrice + (tpPips * pipValue * (isBuy ? 1 : -1));
         if(i == 0) Print("🔢 Converted TP", i+1, " from ", tpPips, " pips to price: ", takeProfits[i]);
      }
   }

   // Check ignore filters
   if(IgnoreWithoutSL && stopLoss == 0)
   {
      Print("❌ Signal rejected: No Stop Loss");
      AcknowledgeSignal(signalId, "skipped", "No SL");
      return;
   }

   if(IgnoreWithoutTP && takeProfits[0] == 0)
   {
      Print("❌ Signal rejected: No Take Profit");
      AcknowledgeSignal(signalId, "skipped", "No TP");
      return;
   }

   // Force market execution if enabled
   if(ForceMarketExecution)
   {
      if(StringFind(direction, "STOP") >= 0 || StringFind(direction, "LIMIT") >= 0)
      {
         direction = StringFind(direction, "SELL") >= 0 ? "SELL" : "BUY";
         Print("🔄 Forced market execution");
      }
   }

   Print("Signal ID: ", signalId);
   Print("Symbol: ", symbol);
   Print("Direction: ", direction);
   Print("Entry: ", entryPrice);
   Print("Stop Loss: ", stopLoss);
   Print("Take Profits: TP1=", takeProfits[0], " TP2=", takeProfits[1], " TP3=", takeProfits[2]);

   // Validate symbol exists
   double symbolPoint = MarketInfo(symbol, MODE_POINT);
   if(symbolPoint == 0)
   {
      Print("❌ ERROR: Symbol ", symbol, " not found on broker. Skipping signal.");
      AcknowledgeSignal(signalId, "error", "Symbol not found");
      return;
   }

   // Check for duplicate trades if enabled
   if(config.checkDuplicates && HasOpenTrade(symbol, direction))
   {
      Print("⚠️  Duplicate trade detected for ", symbol, " ", direction, ". Skipping signal.");
      AcknowledgeSignal(signalId, "skipped", "Duplicate trade");
      return;
   }

   // TSM Protector check
   if(EnableProtector)
   {
      string protectorReason = "";
      if(!CanOpenNewTrade(protectorReason))
      {
         Print("🛑 TSM PROTECTOR: Trade blocked - ", protectorReason);
         AcknowledgeSignal(signalId, "blocked", protectorReason);
         return;
      }
   }

   // Check spread
   double spread = MarketInfo(symbol, MODE_SPREAD);
   Print("Current Spread: ", spread, " points");

   if(spread > config.maxSpread)
   {
      Print("❌ Spread too high (", spread, " > ", config.maxSpread, "). Skipping signal.");
      AcknowledgeSignal(signalId, "skipped", "Spread too high");
      return;
   }

   // Parse order type (STOP, LIMIT) from direction
   string orderType = "";
   string baseDirection = direction;

   if(StringFind(direction, "STOP") >= 0)
   {
      orderType = "STOP";
      baseDirection = StringSubstr(direction, 0, StringFind(direction, " "));
   }
   else if(StringFind(direction, "LIMIT") >= 0)
   {
      orderType = "LIMIT";
      baseDirection = StringSubstr(direction, 0, StringFind(direction, " "));
   }

   Print("Order Type: ", orderType == "" ? "MARKET" : orderType);
   Print("Base Direction: ", baseDirection);

   // Prepare lot sizes for each TP using RiskTP1-10
   double lotSizes[10];
   lotSizes[0] = RiskTP1;
   lotSizes[1] = RiskTP2;
   lotSizes[2] = RiskTP3;
   lotSizes[3] = RiskTP4;
   lotSizes[4] = RiskTP5;
   lotSizes[5] = RiskTP6;
   lotSizes[6] = RiskTP7;
   lotSizes[7] = RiskTP8;
   lotSizes[8] = RiskTP9;
   lotSizes[9] = RiskTP10;

   // Count how many TPs we have
   int tpCount = 0;
   for(int i = 0; i < 10; i++)
   {
      if(takeProfits[i] != 0 || (i == 0 && takeProfits[0] == 0 && lotSizes[0] > 0)) tpCount++;
   }

   Print("📊 Creating ", tpCount, " separate orders (one per TP level)");

   // Store all ticket numbers for this signal (initialize to 0!)
   int tickets[10] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
   int successCount = 0;

   // Create separate orders for each TP level
   for(int tpIdx = 0; tpIdx < 10; tpIdx++)
   {
      // Skip if no TP at this level (but allow TP=0 for first TP only, meaning "Open")
      if(takeProfits[tpIdx] == 0 && tpIdx > 0) continue;

      // Skip if lot size is 0 or negative (means ignore this TP)
      if(lotSizes[tpIdx] <= 0) continue;

      double tpLotSize = lotSizes[tpIdx];
      double tpPrice = takeProfits[tpIdx];

      Print("📈 Creating order #", tpIdx+1, " for TP", tpIdx+1, " at ", tpPrice, " with lot ", tpLotSize);

      int ticket = 0;
      int retries = 0;

      while(ticket == 0 && retries < config.maxRetries)
      {
         if(baseDirection == "BUY")
         {
            if(orderType == "STOP")
               ticket = ExecuteBuyStop(symbol, entryPrice, tpLotSize, stopLoss, tpPrice, config.customComment + " TP" + IntegerToString(tpIdx+1), config.slippage);
            else if(orderType == "LIMIT")
               ticket = ExecuteBuyLimit(symbol, entryPrice, tpLotSize, stopLoss, tpPrice, config.customComment + " TP" + IntegerToString(tpIdx+1), config.slippage);
            else
               ticket = ExecuteBuy(symbol, tpLotSize, stopLoss, tpPrice, config.customComment + " TP" + IntegerToString(tpIdx+1), config.slippage);
         }
         else if(baseDirection == "SELL")
         {
            if(orderType == "STOP")
               ticket = ExecuteSellStop(symbol, entryPrice, tpLotSize, stopLoss, tpPrice, config.customComment + " TP" + IntegerToString(tpIdx+1), config.slippage);
            else if(orderType == "LIMIT")
               ticket = ExecuteSellLimit(symbol, entryPrice, tpLotSize, stopLoss, tpPrice, config.customComment + " TP" + IntegerToString(tpIdx+1), config.slippage);
            else
               ticket = ExecuteSell(symbol, tpLotSize, stopLoss, tpPrice, config.customComment + " TP" + IntegerToString(tpIdx+1), config.slippage);
         }

         retries++;

         if(ticket == 0 && retries < config.maxRetries)
         {
            Print("⚠️  Order failed, retrying... (", retries, "/", config.maxRetries, ")");
            Sleep(1000);
         }
      }

      if(ticket > 0)
      {
         tickets[tpIdx] = ticket;
         successCount++;
         Print("✅ Order #", tpIdx+1, " created successfully! Ticket: ", ticket);
      }
      else
      {
         tickets[tpIdx] = 0;
         Print("❌ Failed to create order #", tpIdx+1, " after ", retries, " retries");
      }
   }

   // Track all orders and send acknowledgment
   if(successCount > 0)
   {
      Print("✅ Successfully created ", successCount, " out of ", tpCount, " orders");

      // Track all orders with the same signal group ID (using first ticket as group ID)
      string signalGroupId = signalId;

      for(int i = 0; i < 10; i++)
      {
         if(tickets[i] > 0)
         {
            // Create single-TP array for this order
            double singleTP[10] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
            singleTP[i] = takeProfits[i];

            // Track this order
            TrackTrade(tickets[i], symbol, entryPrice, stopLoss, singleTP, config, signalGroupId);

            // Notify TSM Protector (once per order)
            OnProtectorTradeOpened();
         }
      }

      // Build acknowledgment message with all tickets
      string ackMessage = "";
      double actualEntryPrice = entryPrice;
      string orderStatus = "FILLED";

      for(int i = 0; i < 10; i++)
      {
         if(tickets[i] > 0)
         {
            if(ackMessage != "") ackMessage += ",";
            ackMessage += IntegerToString(tickets[i]);

            // Get actual entry from first order
            if(actualEntryPrice == 0 && OrderSelect(tickets[i], SELECT_BY_TICKET))
            {
               actualEntryPrice = OrderOpenPrice();

               // Check if pending
               if(OrderType() >= 2) orderStatus = "PENDING";
            }
         }
      }

      ackMessage += "|" + DoubleToString(actualEntryPrice, 5) + "|" + orderStatus;
      AcknowledgeSignal(signalId, "success", ackMessage);
      Print("✅ All trades executed successfully! Tickets: ", ackMessage);
   }
   else
   {
      AcknowledgeSignal(signalId, "error", "Failed to create any orders");
      Print("❌ Trade execution failed - no orders created");
   }

   Print("========================================");
}

//+------------------------------------------------------------------+
//| Calculate lot size based on risk settings                         |
//+------------------------------------------------------------------+
double CalculateLotSize(string symbol, double entryPrice, double stopLoss, SignalConfig &config)
{
   double lotSize = 0;

   if(config.riskMode == "fixed")
   {
      lotSize = config.fixedLotSize;
   }
   else if(stopLoss == 0)
   {
      // No SL, use fixed lot
      lotSize = config.fixedLotSize;
   }
   else if(config.riskMode == "percent")
   {
      double accountBalance = AccountBalance();
      double riskAmount = accountBalance * config.riskPercent / 100.0;

      double tickValue = MarketInfo(symbol, MODE_TICKVALUE);
      double point = MarketInfo(symbol, MODE_POINT);

      // If entryPrice is 0 (market order), use current market price
      double referencePrice = entryPrice;
      if(referencePrice == 0)
      {
         referencePrice = MarketInfo(symbol, MODE_BID);
      }

      double stopLossPips = MathAbs(referencePrice - stopLoss) / point;

      // Avoid division by zero or extremely small values
      if(stopLossPips < 1.0)
      {
         Print("⚠️  Stop loss too close (", stopLossPips, " points), using fixed lot size");
         lotSize = config.fixedLotSize;
      }
      else
      {
         lotSize = riskAmount / (stopLossPips * tickValue);
         Print("💰 Risk calculation: Balance=", accountBalance, " Risk%=", config.riskPercent, " RiskAmount=", riskAmount, " SLPips=", stopLossPips, " TickValue=", tickValue, " LotSize=", lotSize);
      }
   }
   else if(config.riskMode == "amount")
   {
      double riskAmount = config.riskAmount;

      double tickValue = MarketInfo(symbol, MODE_TICKVALUE);
      double point = MarketInfo(symbol, MODE_POINT);

      // If entryPrice is 0 (market order), use current market price
      double referencePrice = entryPrice;
      if(referencePrice == 0)
      {
         referencePrice = MarketInfo(symbol, MODE_BID);
      }

      double stopLossPips = MathAbs(referencePrice - stopLoss) / point;

      // Avoid division by zero or extremely small values
      if(stopLossPips < 1.0)
      {
         Print("⚠️  Stop loss too close (", stopLossPips, " points), using fixed lot size");
         lotSize = config.fixedLotSize;
      }
      else
      {
         lotSize = riskAmount / (stopLossPips * tickValue);
         Print("💰 Risk calculation: RiskAmount=$", riskAmount, " SLPips=", stopLossPips, " TickValue=", tickValue, " LotSize=", lotSize);
      }
   }

   // Normalize lot size
   double minLot = MarketInfo(symbol, MODE_MINLOT);
   double maxLot = MarketInfo(symbol, MODE_MAXLOT);
   double lotStep = MarketInfo(symbol, MODE_LOTSTEP);

   lotSize = MathMax(minLot, MathMin(maxLot, lotSize));
   lotSize = NormalizeDouble(MathFloor(lotSize / lotStep) * lotStep, 2);

   return lotSize;
}

//+------------------------------------------------------------------+
//| Check if there's already an open trade for this symbol/direction |
//+------------------------------------------------------------------+
bool HasOpenTrade(string symbol, string direction)
{
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
      {
         if(OrderSymbol() == symbol && OrderMagicNumber() == MagicNumber)
         {
            int orderType = OrderType();
            if((orderType == OP_BUY && StringFind(direction, "BUY") >= 0) ||
               (orderType == OP_SELL && StringFind(direction, "SELL") >= 0))
            {
               return true;
            }
         }
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Add trade to tracking array                                       |
//+------------------------------------------------------------------+
void TrackTrade(int ticket, string symbol, double entryPrice, double stopLoss, double &tps[], SignalConfig &config, string groupId = "")
{
   int size = ArraySize(activeTrades);
   ArrayResize(activeTrades, size + 1);

   // If entryPrice is 0 (market order), get actual fill price from order
   if(entryPrice == 0 && OrderSelect(ticket, SELECT_BY_TICKET))
   {
      entryPrice = OrderOpenPrice();
      Print("📍 Entry price was 0, using actual fill price: ", entryPrice);
   }

   activeTrades[size].ticket = ticket;
   activeTrades[size].symbol = symbol;
   activeTrades[size].entryPrice = entryPrice;
   activeTrades[size].stopLoss = stopLoss;
   activeTrades[size].originalSL = stopLoss;
   ArrayCopy(activeTrades[size].takeProfits, tps);
   activeTrades[size].tpsHit = 0;
   activeTrades[size].breakevenSet = false;
   activeTrades[size].breakevenRetries = 0;
   activeTrades[size].openTime = TimeCurrent();
   activeTrades[size].config = config;
   activeTrades[size].signalGroupId = groupId;

   Print("📊 Now tracking ticket ", ticket, " (Group: ", groupId, ") for breakeven/trailing/partial close");
}

//+------------------------------------------------------------------+
//| Execute BUY order                                                 |
//+------------------------------------------------------------------+
int ExecuteBuy(string symbol, double lots, double sl, double tp, string comment, int slippage)
{
   double ask = MarketInfo(symbol, MODE_ASK);

   Print("Attempting to BUY ", symbol, " at ", ask);
   Print("Lot Size: ", lots, " | SL: ", sl, " | TP: ", tp);

   int ticket = OrderSend(symbol, OP_BUY, lots, ask, slippage, sl, tp, comment, MagicNumber, 0, clrGreen);

   if(ticket > 0)
   {
      Print("✅ BUY order opened successfully!");
      Print("   Ticket: ", ticket);
      Print("   Symbol: ", symbol);
      Print("   Lots: ", lots);
      Print("   Price: ", ask);
      Print("   SL: ", sl, " | TP: ", tp);
      return ticket;
   }
   else
   {
      int error = GetLastError();
      Print("❌ Failed to open BUY order. Error code: ", error);
      Print("   Error description: ", ErrorDescription(error));
      return 0;
   }
}

//+------------------------------------------------------------------+
//| Execute SELL order                                                |
//+------------------------------------------------------------------+
int ExecuteSell(string symbol, double lots, double sl, double tp, string comment, int slippage)
{
   double bid = MarketInfo(symbol, MODE_BID);

   Print("Attempting to SELL ", symbol, " at ", bid);
   Print("Lot Size: ", lots, " | SL: ", sl, " | TP: ", tp);

   int ticket = OrderSend(symbol, OP_SELL, lots, bid, slippage, sl, tp, comment, MagicNumber, 0, clrRed);

   if(ticket > 0)
   {
      Print("✅ SELL order opened successfully!");
      Print("   Ticket: ", ticket);
      Print("   Symbol: ", symbol);
      Print("   Lots: ", lots);
      Print("   Price: ", bid);
      Print("   SL: ", sl, " | TP: ", tp);
      return ticket;
   }
   else
   {
      int error = GetLastError();
      Print("❌ Failed to open SELL order. Error code: ", error);
      Print("   Error description: ", ErrorDescription(error));
      return 0;
   }
}

//+------------------------------------------------------------------+
//| Execute BUY STOP order                                            |
//+------------------------------------------------------------------+
int ExecuteBuyStop(string symbol, double price, double lots, double sl, double tp, string comment, int slippage)
{
   Print("Attempting to place BUY STOP order on ", symbol, " at ", price);
   Print("Lot Size: ", lots, " | SL: ", sl, " | TP: ", tp);

   int ticket = OrderSend(symbol, OP_BUYSTOP, lots, price, slippage, sl, tp, comment, MagicNumber, 0, clrGreen);

   if(ticket > 0)
   {
      Print("✅ BUY STOP order placed successfully!");
      Print("   Ticket: ", ticket);
      Print("   Symbol: ", symbol);
      Print("   Lots: ", lots);
      Print("   Entry Price: ", price);
      Print("   SL: ", sl, " | TP: ", tp);
      return ticket;
   }
   else
   {
      int error = GetLastError();
      Print("❌ Failed to place BUY STOP order. Error code: ", error);
      Print("   Error description: ", ErrorDescription(error));
      return 0;
   }
}

//+------------------------------------------------------------------+
//| Execute SELL STOP order                                           |
//+------------------------------------------------------------------+
int ExecuteSellStop(string symbol, double price, double lots, double sl, double tp, string comment, int slippage)
{
   Print("Attempting to place SELL STOP order on ", symbol, " at ", price);
   Print("Lot Size: ", lots, " | SL: ", sl, " | TP: ", tp);

   int ticket = OrderSend(symbol, OP_SELLSTOP, lots, price, slippage, sl, tp, comment, MagicNumber, 0, clrRed);

   if(ticket > 0)
   {
      Print("✅ SELL STOP order placed successfully!");
      Print("   Ticket: ", ticket);
      Print("   Symbol: ", symbol);
      Print("   Lots: ", lots);
      Print("   Entry Price: ", price);
      Print("   SL: ", sl, " | TP: ", tp);
      return ticket;
   }
   else
   {
      int error = GetLastError();
      Print("❌ Failed to place SELL STOP order. Error code: ", error);
      Print("   Error description: ", ErrorDescription(error));
      return 0;
   }
}

//+------------------------------------------------------------------+
//| Execute BUY LIMIT order                                           |
//+------------------------------------------------------------------+
int ExecuteBuyLimit(string symbol, double price, double lots, double sl, double tp, string comment, int slippage)
{
   Print("Attempting to place BUY LIMIT order on ", symbol, " at ", price);
   Print("Lot Size: ", lots, " | SL: ", sl, " | TP: ", tp);

   int ticket = OrderSend(symbol, OP_BUYLIMIT, lots, price, slippage, sl, tp, comment, MagicNumber, 0, clrGreen);

   if(ticket > 0)
   {
      Print("✅ BUY LIMIT order placed successfully!");
      Print("   Ticket: ", ticket);
      Print("   Symbol: ", symbol);
      Print("   Lots: ", lots);
      Print("   Entry Price: ", price);
      Print("   SL: ", sl, " | TP: ", tp);
      return ticket;
   }
   else
   {
      int error = GetLastError();
      Print("❌ Failed to place BUY LIMIT order. Error code: ", error);
      Print("   Error description: ", ErrorDescription(error));
      return 0;
   }
}

//+------------------------------------------------------------------+
//| Execute SELL LIMIT order                                          |
//+------------------------------------------------------------------+
int ExecuteSellLimit(string symbol, double price, double lots, double sl, double tp, string comment, int slippage)
{
   Print("Attempting to place SELL LIMIT order on ", symbol, " at ", price);
   Print("Lot Size: ", lots, " | SL: ", sl, " | TP: ", tp);

   int ticket = OrderSend(symbol, OP_SELLLIMIT, lots, price, slippage, sl, tp, comment, MagicNumber, 0, clrRed);

   if(ticket > 0)
   {
      Print("✅ SELL LIMIT order placed successfully!");
      Print("   Ticket: ", ticket);
      Print("   Symbol: ", symbol);
      Print("   Lots: ", lots);
      Print("   Entry Price: ", price);
      Print("   SL: ", sl, " | TP: ", tp);
      return ticket;
   }
   else
   {
      int error = GetLastError();
      Print("❌ Failed to place SELL LIMIT order. Error code: ", error);
      Print("   Error description: ", ErrorDescription(error));
      return 0;
   }
}

//+------------------------------------------------------------------+
//| Send acknowledgment to API server                                 |
//+------------------------------------------------------------------+
void AcknowledgeSignal(string signalId, string status, string message)
{
   string url = ApiServerURL + "/api/signals/acknowledge";
   string headers = "Content-Type: application/json\r\n";

   // Build JSON body
   string body = "{";
   body += "\"signalId\":\"" + signalId + "\",";
   body += "\"accountNumber\":\"" + AccountNumber + "\",";
   body += "\"status\":\"" + status + "\",";
   body += "\"message\":\"" + message + "\"";
   body += "}";

   // Convert string to char array
   char data[];
   StringToCharArray(body, data, 0, StringLen(body));

   char result[];
   string result_headers;
   int timeout = 5000;

   ResetLastError();
   int res = WebRequest("POST", url, headers, timeout, data, result, result_headers);

   if(res == 200)
   {
      Print("✅ Signal acknowledged: ", status);
   }
   else
   {
      Print("⚠️  Failed to acknowledge signal (status: ", res, ")");
   }
}

//+------------------------------------------------------------------+
//| Parse configuration from signal JSON                              |
//+------------------------------------------------------------------+
SignalConfig ParseSignalConfig(string signalJson)
{
   SignalConfig config;

   // Use EA input parameters as defaults
   // Risk settings
   if(RiskMode == RISK_FIXED) config.riskMode = "fixed";
   else if(RiskMode == RISK_PERCENT) config.riskMode = "percent";
   else if(RiskMode == RISK_AMOUNT) config.riskMode = "amount";

   config.fixedLotSize = FixedLotSize;
   config.riskPercent = RiskPercent;
   config.riskAmount = RiskAmount;
   config.maxSpread = MaxSpread;
   config.slippage = Slippage;

   // Trade filters
   config.checkDuplicates = CheckAlreadyOpenedOrder;
   config.maxRetries = MaxRetries;
   config.removePendingAfter = RemovePendingAfter;

   // Breakeven settings
   config.enableBreakeven = EnableBreakeven;
   config.breakevenPips = BreakevenPips;
   config.moveSlAfterTPHit = MoveSlAfterTPHit;
   config.moveSlAfterXPips = MoveSlAfterXPips;

   // Trailing stop settings
   config.useTrailingStop = UseTrailingStop;
   config.trailingStartPips = TrailingStartPips;
   config.trailingStepPips = TrailingStepPips;
   config.trailingDistancePips = TrailingDistancePips;

   // Partial close settings
   config.closePercentAtTP1 = ClosePercentAtTP1;
   config.closePercentAtTP2 = ClosePercentAtTP2;
   config.closePercentAtTP3 = ClosePercentAtTP3;
   config.closePercentAtTP4 = ClosePercentAtTP4;
   config.closePercentAtTP5 = ClosePercentAtTP5;
   config.closePercentAtTP6 = ClosePercentAtTP6;
   config.closePercentAtTP7 = ClosePercentAtTP7;
   config.closePercentAtTP8 = ClosePercentAtTP8;
   config.closePercentAtTP9 = ClosePercentAtTP9;
   config.closePercentAtTP10 = ClosePercentAtTP10;

   // Other settings
   config.customComment = CustomComment;

   return config;
}

//+------------------------------------------------------------------+
//| Monitor active trades for breakeven/trailing/partial close       |
//+------------------------------------------------------------------+
void MonitorActiveTrades()
{
   // Update active trades array
   for(int i = ArraySize(activeTrades) - 1; i >= 0; i--)
   {
      // Check if order still exists
      if(!OrderSelect(activeTrades[i].ticket, SELECT_BY_TICKET))
      {
         // Order closed - check if in history
         if(OrderSelect(activeTrades[i].ticket, SELECT_BY_TICKET, MODE_HISTORY))
         {
            double profit = OrderProfit() + OrderSwap() + OrderCommission();
            OnProtectorTradeClosed(profit);
         }

         // Remove from tracking
         ArrayRemove(activeTrades, i, 1);
         continue;
      }

      // Handle pending orders
      int orderType = OrderType();
      if(orderType > 1) // Pending orders have types 2-5
      {
         // Check if we should remove pending orders after N seconds
         if(activeTrades[i].config.removePendingAfter > 0)
         {
            datetime orderOpenTime = OrderOpenTime();
            int elapsedSeconds = (int)(TimeCurrent() - orderOpenTime);

            if(elapsedSeconds >= activeTrades[i].config.removePendingAfter)
            {
               if(OrderDelete(activeTrades[i].ticket))
               {
                  Print("🗑️ Removed pending order #", activeTrades[i].ticket, " after ", elapsedSeconds, " seconds");
                  // Remove from tracking
                  ArrayRemove(activeTrades, i, 1);
               }
               else
               {
                  Print("❌ Failed to remove pending order #", activeTrades[i].ticket, " - Error: ", GetLastError());
               }
            }
         }
         continue;
      }

      // Update entry price if it was 0 (filled pending order or market order)
      if(activeTrades[i].entryPrice == 0)
      {
         activeTrades[i].entryPrice = OrderOpenPrice();
         Print("📍 Updated entry price for ticket ", activeTrades[i].ticket, ": ", activeTrades[i].entryPrice);
      }

      double currentPrice = OrderClosePrice();
      double currentSL = OrderStopLoss();
      string symbol = activeTrades[i].symbol;
      double point = MarketInfo(symbol, MODE_POINT);
      bool isBuy = orderType == OP_BUY;

      double profitPips = isBuy ?
         (currentPrice - activeTrades[i].entryPrice) / point :
         (activeTrades[i].entryPrice - currentPrice) / point;

      // Breakeven logic
      if(activeTrades[i].config.enableBreakeven && !activeTrades[i].breakevenSet)
      {
         bool shouldMoveToBreakeven = false;

         // Check if should move to breakeven based on pips profit
         if(activeTrades[i].config.moveSlAfterXPips > 0 &&
            profitPips >= activeTrades[i].config.moveSlAfterXPips)
         {
            shouldMoveToBreakeven = true;
         }

         // Check if TP hit and moveSlAfterTPHit enabled
         if(activeTrades[i].config.moveSlAfterTPHit && activeTrades[i].tpsHit > 0)
         {
            shouldMoveToBreakeven = true;
         }

         if(shouldMoveToBreakeven)
         {
            // Use actual fill price (not signal entry price)
            double actualEntry = OrderOpenPrice();
            double newSL = actualEntry +
               (activeTrades[i].config.breakevenPips * point * (isBuy ? 1 : -1));

            if(OrderModify(activeTrades[i].ticket, OrderOpenPrice(), newSL, OrderTakeProfit(), 0, clrNONE))
            {
               Print("✅ Breakeven set for ticket ", activeTrades[i].ticket, " at ", newSL, " (Entry: ", actualEntry, ")");
               activeTrades[i].breakevenSet = true;
               activeTrades[i].stopLoss = newSL;
            }
         }
      }

      // Trailing stop logic
      if(activeTrades[i].config.useTrailingStop && profitPips >= activeTrades[i].config.trailingStartPips)
      {
         double trailDistance = activeTrades[i].config.trailingDistancePips * point;
         double newSL = isBuy ?
            currentPrice - trailDistance :
            currentPrice + trailDistance;

         // Only move SL in profit direction
         bool shouldUpdate = isBuy ? (newSL > currentSL) : (newSL < currentSL);

         if(shouldUpdate && MathAbs(newSL - currentSL) >= activeTrades[i].config.trailingStepPips * point)
         {
            if(OrderModify(activeTrades[i].ticket, OrderOpenPrice(), newSL, OrderTakeProfit(), 0, clrNONE))
            {
               Print("✅ Trailing stop updated for ticket ", activeTrades[i].ticket, " to ", newSL);
               activeTrades[i].stopLoss = newSL;
            }
         }
      }

      // Multi-Order Breakeven: When any order in a signal group hits TP,
      // move SL of all other orders in that group to their entry price
      if(activeTrades[i].signalGroupId != "" && !activeTrades[i].breakevenSet)
      {
         // Check if ANY order in this signal group has closed (TP hit)
         bool anyTPHitInGroup = false;

         for(int j = ArraySize(activeTrades) - 1; j >= 0; j--)
         {
            if(activeTrades[j].signalGroupId == activeTrades[i].signalGroupId)
            {
               // Check if this order in the group no longer exists (was closed by TP)
               // Use SELECT_BY_TICKET with MODE_HISTORY to check if it's in history (closed)
               if(OrderSelect(activeTrades[j].ticket, SELECT_BY_TICKET, MODE_HISTORY))
               {
                  // Order is in history = it's closed
                  anyTPHitInGroup = true;
                  break;
               }
            }
         }

         // If any TP in the group hit, move THIS order's SL to entry
         if(anyTPHitInGroup)
         {
            // Check retry limit (stop after 10 attempts)
            if(activeTrades[i].breakevenRetries >= 10)
            {
               Print("⚠️ Breakeven retry limit reached for ticket ", activeTrades[i].ticket, " - giving up");
               activeTrades[i].breakevenSet = true; // Stop trying
               continue;
            }

            // Make sure THIS order still exists and is open before modifying
            if(OrderSelect(activeTrades[i].ticket, SELECT_BY_TICKET) && OrderCloseTime() == 0)
            {
               double actualEntry = OrderOpenPrice();
               double currentSL = OrderStopLoss();
               double newSL = actualEntry +
                  (activeTrades[i].config.breakevenPips * point * (isBuy ? 1 : -1));

               // Check if SL is already "close enough" (within 2 pips)
               double slDifference = MathAbs(currentSL - newSL) / point;
               if(slDifference < 2.0)
               {
                  Print("✅ SL already at breakeven for ticket ", activeTrades[i].ticket, " (within 2 pips)");
                  activeTrades[i].breakevenSet = true;
                  continue;
               }

               // Detect manual SL changes (if SL changed but we didn't track it)
               if(currentSL != activeTrades[i].stopLoss && activeTrades[i].breakevenRetries > 0)
               {
                  Print("👤 User manually changed SL for ticket ", activeTrades[i].ticket, " - respecting manual control");
                  activeTrades[i].breakevenSet = true;
                  activeTrades[i].stopLoss = currentSL;
                  continue;
               }

               // Attempt to modify SL
               activeTrades[i].breakevenRetries++;
               if(OrderModify(activeTrades[i].ticket, OrderOpenPrice(), newSL, OrderTakeProfit(), 0, clrNONE))
               {
                  Print("🎯 Group breakeven: Moved SL to entry for ticket ", activeTrades[i].ticket,
                        " (Group: ", activeTrades[i].signalGroupId, ")");
                  activeTrades[i].breakevenSet = true;
                  activeTrades[i].stopLoss = newSL;
               }
               // else: Will retry on next tick (silently)
            }
         }
      }

      // Partial close logic (check each TP level) - DISABLED for multi-order approach
      // Orders now have individual TPs and close automatically when TP is hit
      for(int tpIdx = 0; tpIdx < 10; tpIdx++)
      {
         // Skip if already hit
         if((activeTrades[i].tpsHit & (1 << tpIdx)) != 0) continue;

         // Skip if no TP set
         if(activeTrades[i].takeProfits[tpIdx] == 0) continue;

         // Check if price hit this TP
         bool tpHit = isBuy ?
            (currentPrice >= activeTrades[i].takeProfits[tpIdx]) :
            (currentPrice <= activeTrades[i].takeProfits[tpIdx]);

         if(tpHit)
         {
            double closePercent = 0;
            if(tpIdx == 0) closePercent = activeTrades[i].config.closePercentAtTP1;
            else if(tpIdx == 1) closePercent = activeTrades[i].config.closePercentAtTP2;
            else if(tpIdx == 2) closePercent = activeTrades[i].config.closePercentAtTP3;
            else if(tpIdx == 3) closePercent = activeTrades[i].config.closePercentAtTP4;
            else if(tpIdx == 4) closePercent = activeTrades[i].config.closePercentAtTP5;
            else if(tpIdx == 5) closePercent = activeTrades[i].config.closePercentAtTP6;
            else if(tpIdx == 6) closePercent = activeTrades[i].config.closePercentAtTP7;
            else if(tpIdx == 7) closePercent = activeTrades[i].config.closePercentAtTP8;
            else if(tpIdx == 8) closePercent = activeTrades[i].config.closePercentAtTP9;
            else if(tpIdx == 9) closePercent = activeTrades[i].config.closePercentAtTP10;

            if(closePercent > 0)
            {
               double currentVolume = OrderLots();
               double closeVolume = NormalizeDouble(currentVolume * closePercent / 100.0, 2);

               if(closeVolume > 0 && closePercent >= 100)
               {
                  // Full close
                  if(OrderClose(activeTrades[i].ticket, currentVolume, currentPrice, 3, clrNONE))
                  {
                     Print("✅ Full close at TP", tpIdx+1);
                     activeTrades[i].tpsHit |= (1 << tpIdx); // Mark TP as hit
                  }
               }
               else if(closeVolume > 0)
               {
                  // Partial close (MT4 doesn't support partial close natively, need to close and re-open)
                  Print("ℹ️  TP", tpIdx+1, " hit - MT4 doesn't support true partial close");
                  Print("   Consider using full close or manual management");
                  activeTrades[i].tpsHit |= (1 << tpIdx); // Mark TP as hit

                  // Update TP to next level
                  double nextTP = 0;
                  for(int nextIdx = tpIdx + 1; nextIdx < 10; nextIdx++)
                  {
                     if(activeTrades[i].takeProfits[nextIdx] != 0)
                     {
                        nextTP = activeTrades[i].takeProfits[nextIdx];
                        break;
                     }
                  }

                  // Update TP on order (or set to 0 if no more TPs)
                  if(OrderModify(activeTrades[i].ticket, OrderOpenPrice(), currentSL, nextTP, 0, clrNONE))
                  {
                     if(nextTP != 0)
                        Print("📊 Updated TP on order to TP", (tpIdx + 2), ": ", nextTP);
                     else
                        Print("📊 Removed TP from order (all TPs hit)");
                  }
               }
            }
            else
            {
               // Just mark as hit, no partial close
               activeTrades[i].tpsHit |= (1 << tpIdx);
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Helper function to extract value from JSON string                 |
//+------------------------------------------------------------------+
string ExtractValue(string json, string key)
{
   // Simplified JSON parser - in production use a proper JSON library
   string searchKey = "\"" + key + "\":";
   int startPos = StringFind(json, searchKey);

   if(startPos < 0) return "";

   startPos += StringLen(searchKey);

   // Skip whitespace
   while(StringGetChar(json, startPos) == ' ')
   {
      startPos++;
   }

   // Check value type
   int firstChar = StringGetChar(json, startPos);
   bool isQuoted = (firstChar == '"');
   bool isArray = (firstChar == '[');
   bool isObject = (firstChar == '{');

   int endPos = startPos;

   if(isQuoted)
   {
      // For quoted strings, extract until closing quote
      startPos++; // Skip opening quote
      endPos = startPos;
      while(endPos < StringLen(json))
      {
         int ch = StringGetChar(json, endPos);
         if(ch == '"')
            break;
         endPos++;
      }
   }
   else if(isArray)
   {
      // For arrays, extract until matching closing bracket
      int bracketDepth = 0;
      while(endPos < StringLen(json))
      {
         int ch = StringGetChar(json, endPos);
         if(ch == '[') bracketDepth++;
         if(ch == ']') bracketDepth--;
         endPos++;
         if(bracketDepth == 0)
            break;
      }
   }
   else if(isObject)
   {
      // For objects, extract until matching closing brace
      int braceDepth = 0;
      while(endPos < StringLen(json))
      {
         int ch = StringGetChar(json, endPos);
         if(ch == '{') braceDepth++;
         if(ch == '}') braceDepth--;
         endPos++;
         if(braceDepth == 0)
            break;
      }
   }
   else
   {
      // For non-quoted values (numbers, booleans, null), extract until delimiter
      while(endPos < StringLen(json))
      {
         int ch = StringGetChar(json, endPos);
         if(ch == ',' || ch == '}' || ch == ']' || ch == ' ')
            break;
         endPos++;
      }
   }

   return StringSubstr(json, startPos, endPos - startPos);
}

//+------------------------------------------------------------------+
//| Parse tickets array from JSON format [123,456,789]               |
//+------------------------------------------------------------------+
int ParseTicketsArray(string ticketsStr, int &tickets[])
{
   // Remove brackets, spaces, and quotes
   StringReplace(ticketsStr, "[", "");
   StringReplace(ticketsStr, "]", "");
   StringReplace(ticketsStr, "\"", "");
   StringReplace(ticketsStr, " ", "");

   if(StringLen(ticketsStr) == 0)
      return 0;

   // Split by comma
   string ticketStrings[];
   int count = StringSplit(ticketsStr, ',', ticketStrings);

   if(count <= 0)
      return 0;

   ArrayResize(tickets, count);

   for(int i = 0; i < count; i++)
   {
      tickets[i] = StrToInteger(ticketStrings[i]);
   }

   return count;
}

//+------------------------------------------------------------------+
//| Convert tickets array to string for logging                       |
//+------------------------------------------------------------------+
string TicketsArrayToString(int &tickets[], int count)
{
   if(count == 0)
      return "[]";

   string result = "[";
   for(int i = 0; i < count; i++)
   {
      result += IntegerToString(tickets[i]);
      if(i < count - 1)
         result += ",";
   }
   result += "]";

   return result;
}

//+------------------------------------------------------------------+
//| Poll API server for pending modifications                         |
//+------------------------------------------------------------------+
void PollModifications()
{
   static datetime lastDebugLog = 0;
   bool shouldLog = (TimeCurrent() - lastDebugLog >= 10); // Log every 10 seconds

   // Silent polling - no noise in experts tab
   if(shouldLog)
   {
      // Print("[MOD POLL] Polling for modifications...");
      lastDebugLog = TimeCurrent();
   }

   string url = ApiServerURL + "/api/modifications/pending?account=" + AccountNumber;
   string headers = "Content-Type: application/json\r\n";
   char data[];
   char result[];
   string result_headers;

   int timeout = 5000;

   ResetLastError();
   int res = WebRequest("GET", url, headers, timeout, data, result, result_headers);

   if(res == 403)
   {
      // Account not authorized - already handled in main polling, don't spam
      if(shouldLog) Print("[MOD POLL] Account not authorized (403)");
      return;
   }

   if(res == -1 || res != 200)
   {
      // Log errors for debugging
      if(shouldLog)
      {
         Print("[MOD POLL] HTTP request failed: ", res);
         if(res == -1) Print("[MOD POLL] Last error: ", GetLastError());
      }
      return;
   }

   // Silent polling
   // if(shouldLog) Print("[MOD POLL] Response received: ", res);

   // Parse response
   string response = CharArrayToString(result);

   // Check if there are any modifications
   if(StringFind(response, "\"modifications\":[]") >= 0)
   {
      // No modifications in queue - silent
      // if(shouldLog) Print("[MOD POLL] No modifications in queue");
      return;
   }

   // Process modifications
   Print("[MOD POLL] Modifications found! Processing...");
   // Print("[MOD POLL] Response: ", response); // Too verbose
   ProcessModificationsResponse(response);
}

//+------------------------------------------------------------------+
//| Process modifications from API response                           |
//+------------------------------------------------------------------+
void ProcessModificationsResponse(string response)
{
   // Extract modifications array from response
   // Print("[MOD DEBUG] Response: ", response); // Too verbose

   // Search for "modifications" key
   int start = StringFind(response, "\"modifications\"");
   if(start < 0)
   {
      Print("[MOD DEBUG] No modifications key found");
      return;
   }

   // Find the opening bracket [ after the key
   start = StringFind(response, "[", start);
   if(start < 0)
   {
      Print("[MOD DEBUG] No opening bracket found");
      return;
   }

   start += 1; // Move past "["

   // Find each modification object
   int pos = start;
   int modCount = 0;

   while(pos < StringLen(response))
   {
      // Find start of modification object
      int objStart = StringFind(response, "{", pos);
      if(objStart < 0) break;

      // Find end of modification object
      int objEnd = StringFind(response, "}", objStart);
      if(objEnd < 0) break;

      // Extract modification JSON
      string modJson = StringSubstr(response, objStart, objEnd - objStart + 1);

      // Process this modification
      ProcessModification(modJson);

      modCount++;

      // Move to next modification
      pos = objEnd + 1;

      // Check if we've reached the end of the array
      if(StringFind(response, "]", pos) == pos) break;
   }

   if(modCount > 0)
   {
      Print("✅ Processed ", modCount, " modification(s)");
      AcknowledgeModifications();
   }
}

//+------------------------------------------------------------------+
//| Process a single modification command                             |
//+------------------------------------------------------------------+
void ProcessModification(string modJson)
{
   // Extract modification data
   string type = ExtractValue(modJson, "type");
   string reason = ExtractValue(modJson, "reason");

   Print("========================================");
   Print("🔧 MODIFICATION COMMAND: ", type);
   Print("Reason: ", reason);
   Print("========================================");

   if(type == "close")
   {
      // Close partial or full position
      double percentage = StrToDouble(ExtractValue(modJson, "percentage"));
      if(percentage == 0) percentage = 100;

      ApplyCloseModification(percentage, reason);
   }
   else if(type == "modify_sl")
   {
      // Update stop loss
      double newSL = StrToDouble(ExtractValue(modJson, "newValue"));
      ApplyModifySL(newSL, reason);
   }
   else if(type == "modify_tp")
   {
      // Update take profit
      double newTP = StrToDouble(ExtractValue(modJson, "newValue"));
      ApplyModifyTP(newTP, reason);
   }
   else if(type == "delete")
   {
      // Cancel pending orders - extract specific tickets
      string ticketsStr = ExtractValue(modJson, "tickets");
      // Print("[MOD DEBUG] Extracted tickets string: '", ticketsStr, "'"); // Too verbose

      // Parse tickets array from JSON format [123,456,789]
      int tickets[];
      int ticketCount = ParseTicketsArray(ticketsStr, tickets);

      if(ticketCount > 0)
      {
         // Print("[MOD DEBUG] Parsed ", ticketCount, " ticket(s) to delete"); // Too verbose
         ApplyCancelPending(tickets, ticketCount, reason);
      }
      else
      {
         Print("⚠️  No tickets specified in delete command - skipping for safety");
      }
   }
   else if(type == "breakeven")
   {
      // Move SL to breakeven (entry price + buffer)
      ApplyBreakeven(reason);
   }
   else if(type == "close_all")
   {
      // Close all positions
      ApplyCloseAll(reason);
   }
   else
   {
      Print("⚠️  Unknown modification type: ", type);
   }
}

//+------------------------------------------------------------------+
//| Apply close modification (partial or full)                        |
//+------------------------------------------------------------------+
void ApplyCloseModification(double percentage, string reason)
{
   int closedCount = 0;

   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
      {
         if(OrderMagicNumber() == MagicNumber && OrderType() <= 1)
         {
            int ticket = OrderTicket();
            string symbol = OrderSymbol();
            double volume = OrderLots();
            double closePrice = OrderType() == OP_BUY ? MarketInfo(symbol, MODE_BID) : MarketInfo(symbol, MODE_ASK);

            if(percentage >= 100)
            {
               // Close full position
               if(OrderClose(ticket, volume, closePrice, 3, clrNONE))
               {
                  Print("✅ Closed position: Ticket ", ticket, " - ", reason);
                  closedCount++;
               }
            }
            else
            {
               // MT4 doesn't support partial close natively
               Print("ℹ️  Partial close requested (", percentage, "%) - MT4 limitation");
               Print("   Consider closing full position or manual management");
            }
         }
      }
   }

   if(closedCount > 0)
   {
      Print("✅ Modification applied to ", closedCount, " position(s)");
   }
   else
   {
      Print("⚠️  No positions found to close");
   }
}

//+------------------------------------------------------------------+
//| Apply modify SL modification                                      |
//+------------------------------------------------------------------+
void ApplyModifySL(double newSL, string reason)
{
   int modifiedCount = 0;

   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
      {
         if(OrderMagicNumber() == MagicNumber && OrderType() <= 1)
         {
            int ticket = OrderTicket();
            double currentTP = OrderTakeProfit();

            if(OrderModify(ticket, OrderOpenPrice(), newSL, currentTP, 0, clrNONE))
            {
               Print("✅ Modified SL to ", newSL, " for ticket ", ticket, " - ", reason);
               modifiedCount++;

               // Update tracked trade if exists
               for(int j = 0; j < ArraySize(activeTrades); j++)
               {
                  if(activeTrades[j].ticket == ticket)
                  {
                     activeTrades[j].stopLoss = newSL;
                     if(MathAbs(newSL - activeTrades[j].entryPrice) < 0.0001)
                     {
                        activeTrades[j].breakevenSet = true;
                     }
                     break;
                  }
               }
            }
         }
      }
   }

   if(modifiedCount > 0)
   {
      Print("✅ SL modified for ", modifiedCount, " position(s)");
   }
   else
   {
      Print("⚠️  No positions found to modify");
   }
}

//+------------------------------------------------------------------+
//| Apply modify TP modification                                      |
//+------------------------------------------------------------------+
void ApplyModifyTP(double newTP, string reason)
{
   int modifiedCount = 0;

   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
      {
         if(OrderMagicNumber() == MagicNumber && OrderType() <= 1)
         {
            int ticket = OrderTicket();
            double currentSL = OrderStopLoss();

            if(OrderModify(ticket, OrderOpenPrice(), currentSL, newTP, 0, clrNONE))
            {
               Print("✅ Modified TP to ", newTP, " for ticket ", ticket, " - ", reason);
               modifiedCount++;
            }
         }
      }
   }

   if(modifiedCount > 0)
   {
      Print("✅ TP modified for ", modifiedCount, " position(s)");
   }
   else
   {
      Print("⚠️  No positions found to modify");
   }
}

//+------------------------------------------------------------------+
//| Apply breakeven modification                                      |
//+------------------------------------------------------------------+
void ApplyBreakeven(string reason)
{
   int modifiedCount = 0;

   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
      {
         if(OrderMagicNumber() == MagicNumber && OrderType() <= 1)
         {
            int ticket = OrderTicket();
            double entryPrice = OrderOpenPrice();
            double currentTP = OrderTakeProfit();
            string symbol = OrderSymbol();
            double point = MarketInfo(symbol, MODE_POINT);
            bool isBuy = OrderType() == OP_BUY;

            // Calculate new SL at breakeven (entry price + buffer)
            double newSL = entryPrice + (BreakevenPips * point * (isBuy ? 1 : -1));

            if(OrderModify(ticket, entryPrice, newSL, currentTP, 0, clrNONE))
            {
               Print("✅ Moved SL to breakeven: ", newSL, " for ticket ", ticket, " - ", reason);
               modifiedCount++;

               // Update tracked trade if exists
               for(int j = 0; j < ArraySize(activeTrades); j++)
               {
                  if(activeTrades[j].ticket == ticket)
                  {
                     activeTrades[j].stopLoss = newSL;
                     activeTrades[j].breakevenSet = true;
                     break;
                  }
               }
            }
            else
            {
               Print("⚠️  Failed to move SL to breakeven for ticket ", ticket, " - Error: ", GetLastError());
            }
         }
      }
   }

   if(modifiedCount > 0)
   {
      Print("✅ Breakeven set for ", modifiedCount, " position(s)");
   }
   else
   {
      Print("⚠️  No positions found to modify");
   }
}

//+------------------------------------------------------------------+
//| Apply cancel pending orders modification                          |
//+------------------------------------------------------------------+
void ApplyCancelPending(int &specificTickets[], int ticketCount, string reason)
{
   int canceledCount = 0;

   Print("[DELETE] Deleting ", ticketCount, " specific ticket(s): ", TicketsArrayToString(specificTickets, ticketCount));

   // Only delete the specific tickets provided
   for(int i = 0; i < ticketCount; i++)
   {
      int ticket = specificTickets[i];

      // Select the order by ticket
      if(OrderSelect(ticket, SELECT_BY_TICKET, MODE_TRADES))
      {
         if(OrderMagicNumber() == MagicNumber)
         {
            if(OrderType() > 1) // Pending order
            {
               if(OrderDelete(ticket))
               {
                  Print("✅ Canceled pending order: Ticket ", ticket, " - ", reason);
                  canceledCount++;
               }
               else
               {
                  Print("❌ Failed to cancel pending order: Ticket ", ticket, " - Error: ", GetLastError());
               }
            }
            else
            {
               Print("⚠️  Ticket ", ticket, " is not a pending order - skipping");
            }
         }
         else
         {
            Print("⚠️  Ticket ", ticket, " has different MagicNumber - skipping");
         }
      }
      else
      {
         Print("⚠️  Ticket ", ticket, " not found or already deleted");
      }
   }

   if(canceledCount > 0)
   {
      Print("✅ Canceled ", canceledCount, " of ", ticketCount, " pending order(s)");
   }
   else
   {
      Print("⚠️  No pending orders were canceled");
   }
}

//+------------------------------------------------------------------+
//| Apply close all modification                                      |
//+------------------------------------------------------------------+
void ApplyCloseAll(string reason)
{
   Print("🚨 CLOSE ALL POSITIONS - ", reason);

   int closedCount = 0;

   // Close all positions
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
      {
         if(OrderMagicNumber() == MagicNumber)
         {
            int ticket = OrderTicket();
            int orderType = OrderType();

            if(orderType <= 1)
            {
               // Close position
               string symbol = OrderSymbol();
               double closePrice = orderType == OP_BUY ? MarketInfo(symbol, MODE_BID) : MarketInfo(symbol, MODE_ASK);

               if(OrderClose(ticket, OrderLots(), closePrice, 3, clrNONE))
               {
                  Print("✅ Closed position: Ticket ", ticket);
                  closedCount++;
               }
            }
            else
            {
               // Cancel pending order
               if(OrderDelete(ticket))
               {
                  Print("✅ Canceled pending order: Ticket ", ticket);
                  closedCount++;
               }
            }
         }
      }
   }

   if(closedCount > 0)
   {
      Print("✅ CLOSE ALL completed: ", closedCount, " position(s)/order(s) closed");
   }
   else
   {
      Print("⚠️  No positions or orders found");
   }
}

//+------------------------------------------------------------------+
//| Acknowledge modifications processed                                |
//+------------------------------------------------------------------+
void AcknowledgeModifications()
{
   string url = ApiServerURL + "/api/modifications/ack";
   string headers = "Content-Type: application/json\r\n";

   // Build JSON body
   string body = "{";
   body += "\"accountNumber\":\"" + AccountNumber + "\",";
   body += "\"trades\":[],";
   body += "\"status\":\"applied\"";
   body += "}";

   // Convert string to char array
   char data[];
   StringToCharArray(body, data, 0, StringLen(body));

   char result[];
   string result_headers;
   int timeout = 5000;

   ResetLastError();
   int res = WebRequest("POST", url, headers, timeout, data, result, result_headers);

   if(res == 200)
   {
      Print("✅ Modifications acknowledged");
   }
}

//+------------------------------------------------------------------+
//| TSM Protector: Check daily reset                                  |
//+------------------------------------------------------------------+
void CheckProtectorReset()
{
   if(!EnableProtector) return;

   MqlDateTime now;
   TimeToStruct(TimeCurrent(), now);

   // Parse reset time (HH:MM)
   string resetTimeParts[];
   StringSplit(ProtectorResetTime, ':', resetTimeParts);
   int resetHour = (int)StringToInteger(resetTimeParts[0]);
   int resetMin = (int)StringToInteger(resetTimeParts[1]);

   // Get current date at reset time
   datetime resetDateTime = StringToTime(StringFormat("%04d.%02d.%02d %02d:%02d",
      now.year, now.mon, now.day, resetHour, resetMin));

   // If we've passed reset time and haven't reset yet today
   if(TimeCurrent() >= resetDateTime && protectorLastReset < resetDateTime)
   {
      Print("🔄 TSM PROTECTOR: Daily reset triggered");
      protectorDailyPL = 0;
      protectorDailyTrades = 0;
      protectorLimitHit = false;
      protectorLimitReason = "";
      protectorLastReset = resetDateTime;
      Print("📊 TSM PROTECTOR: Stats reset - Ready for new trading day");
   }
}

//+------------------------------------------------------------------+
//| TSM Protector: Check if new trade can be opened                   |
//+------------------------------------------------------------------+
bool CanOpenNewTrade(string &reason)
{
   if(!EnableProtector) return true;

   // Check if limit already hit and stop new trades is enabled
   if(protectorLimitHit && StopNewTradesOnLimit)
   {
      reason = "TSM Protector limit hit: " + protectorLimitReason;
      return false;
   }

   // Check max trades per day
   if(MaxTradesPerDay > 0 && protectorDailyTrades >= MaxTradesPerDay)
   {
      reason = "Max trades per day reached (" + IntegerToString(MaxTradesPerDay) + ")";
      return false;
   }

   // Check daily loss limit
   double accountBalance = AccountBalance();

   double lossLimit = UseLossPercent ?
      (accountBalance * DailyLossLimitPercent / 100.0) :
      DailyLossLimit;

   if(protectorDailyPL <= -lossLimit)
   {
      reason = "Daily loss limit reached: -$" + DoubleToString(MathAbs(protectorDailyPL), 2);
      return false;
   }

   // Check daily profit target
   double profitTarget = UseProfitPercent ?
      (accountBalance * DailyProfitTargetPercent / 100.0) :
      DailyProfitTarget;

   if(protectorDailyPL >= profitTarget && StopNewTradesOnLimit)
   {
      reason = "Daily profit target reached: +$" + DoubleToString(protectorDailyPL, 2);
      return false;
   }

   return true;
}

//+------------------------------------------------------------------+
//| TSM Protector: Trade opened notification                          |
//+------------------------------------------------------------------+
void OnProtectorTradeOpened()
{
   if(!EnableProtector) return;

   protectorDailyTrades++;
   Print("📊 TSM PROTECTOR: Trade opened - Daily count: ", protectorDailyTrades);
}

//+------------------------------------------------------------------+
//| TSM Protector: Trade closed notification                          |
//+------------------------------------------------------------------+
void OnProtectorTradeClosed(double profit)
{
   if(!EnableProtector) return;

   protectorDailyPL += profit;
   Print("📊 TSM PROTECTOR: Trade closed - Profit: $", DoubleToString(profit, 2),
         " | Daily P/L: $", DoubleToString(protectorDailyPL, 2));

   CheckProtectorLimits();
}

//+------------------------------------------------------------------+
//| TSM Protector: Check if limits exceeded                           |
//+------------------------------------------------------------------+
void CheckProtectorLimits()
{
   if(!EnableProtector || protectorLimitHit) return;

   double accountBalance = AccountBalance();

   double lossLimit = UseLossPercent ?
      (accountBalance * DailyLossLimitPercent / 100.0) :
      DailyLossLimit;

   double profitTarget = UseProfitPercent ?
      (accountBalance * DailyProfitTargetPercent / 100.0) :
      DailyProfitTarget;

   // Check loss limit
   if(protectorDailyPL <= -lossLimit)
   {
      protectorLimitHit = true;
      protectorLimitReason = "Daily loss limit hit: -$" + DoubleToString(MathAbs(protectorDailyPL), 2);
      Print("🛑 TSM PROTECTOR: ", protectorLimitReason);

      if(CloseAllOnLossLimit)
      {
         Print("🚨 TSM PROTECTOR: Closing all positions due to loss limit");
         ApplyCloseAll("TSM Protector: Daily loss limit");
      }

      if(SendMT4Notifications)
      {
         SendNotification("TSM Protector: " + protectorLimitReason);
      }

      return;
   }

   // Check profit target
   if(protectorDailyPL >= profitTarget)
   {
      protectorLimitHit = true;
      protectorLimitReason = "Daily profit target hit: +$" + DoubleToString(protectorDailyPL, 2);
      Print("✅ TSM PROTECTOR: ", protectorLimitReason);

      if(CloseAllOnProfitTarget)
      {
         Print("🚨 TSM PROTECTOR: Closing all positions due to profit target");
         ApplyCloseAll("TSM Protector: Daily profit target");
      }

      if(SendMT4Notifications)
      {
         SendNotification("TSM Protector: " + protectorLimitReason);
      }

      return;
   }
}

//+------------------------------------------------------------------+
//| TSM Protector: Update chart display                               |
//+------------------------------------------------------------------+
void UpdateProtectorDisplay()
{
   if(!EnableProtector) return;

   string display = "\n";
   display += "========== TSM PROTECTOR ==========\n";
   display += "Daily P/L: $" + DoubleToString(protectorDailyPL, 2) + "\n";
   display += "Daily Trades: " + IntegerToString(protectorDailyTrades);

   if(MaxTradesPerDay > 0)
      display += "/" + IntegerToString(MaxTradesPerDay);

   display += "\n";

   if(protectorLimitHit)
   {
      display += "⚠️ LIMIT HIT: " + protectorLimitReason + "\n";
   }
   else
   {
      double accountBalance = AccountBalance();

      double lossLimit = UseLossPercent ?
         (accountBalance * DailyLossLimitPercent / 100.0) :
         DailyLossLimit;

      double profitTarget = UseProfitPercent ?
         (accountBalance * DailyProfitTargetPercent / 100.0) :
         DailyProfitTarget;

      double remainingLoss = lossLimit + protectorDailyPL;
      double remainingProfit = profitTarget - protectorDailyPL;

      display += "Loss Remaining: $" + DoubleToString(remainingLoss, 2) + "\n";
      display += "Profit Remaining: $" + DoubleToString(remainingProfit, 2) + "\n";
   }

   display += "===================================\n";
   Comment(display);
}

//+------------------------------------------------------------------+
//| Get error description from error code                             |
//+------------------------------------------------------------------+
string ErrorDescription(int error_code)
{
   switch(error_code)
   {
      case 0:    return "No error";
      case 1:    return "No error, but result is unknown";
      case 2:    return "Common error";
      case 3:    return "Invalid trade parameters";
      case 4:    return "Trade server is busy";
      case 5:    return "Old version of the client terminal";
      case 6:    return "No connection with trade server";
      case 7:    return "Not enough rights";
      case 8:    return "Too frequent requests";
      case 9:    return "Malfunctional trade operation";
      case 64:   return "Account disabled";
      case 65:   return "Invalid account";
      case 128:  return "Trade timeout";
      case 129:  return "Invalid price";
      case 130:  return "Invalid stops";
      case 131:  return "Invalid trade volume";
      case 132:  return "Market is closed";
      case 133:  return "Trade is disabled";
      case 134:  return "Not enough money";
      case 135:  return "Price changed";
      case 136:  return "Off quotes";
      case 137:  return "Broker is busy";
      case 138:  return "Requote";
      case 139:  return "Order is locked";
      case 140:  return "Long positions only allowed";
      case 141:  return "Too many requests";
      case 145:  return "Modification denied because order is too close to market";
      case 146:  return "Trade context is busy";
      case 147:  return "Expirations are denied by broker";
      case 148:  return "Amount of open and pending orders has reached the limit";
      case 4000: return "No error";
      case 4060: return "Function is not allowed for call";
      default:   return "Unknown error (" + IntegerToString(error_code) + ")";
   }
}
//+------------------------------------------------------------------+
