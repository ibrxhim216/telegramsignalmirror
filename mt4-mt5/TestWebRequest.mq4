//+------------------------------------------------------------------+
//|                                           TestWebRequest.mq4     |
//+------------------------------------------------------------------+
#property copyright "Test"
#property version   "1.00"
#property strict

//+------------------------------------------------------------------+
//| Expert initialization function                                    |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("=== Testing WebRequest ===");

   // Test 1: Try local IP
   TestURL("http://192.168.0.13:3737/api/health");

   // Test 2: Try localhost (we know this fails)
   TestURL("http://localhost:3737/api/health");

   // Test 3: Try a public URL (Google)
   TestURL("https://www.google.com");

   Print("=== Tests Complete ===");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Test WebRequest with a URL                                       |
//+------------------------------------------------------------------+
void TestURL(string url)
{
   Print("Testing URL: ", url);

   string headers = "";
   char data[];
   char result[];
   string result_headers;
   int timeout = 5000;

   ResetLastError();
   int res = WebRequest("GET", url, headers, timeout, data, result, result_headers);

   int error = GetLastError();

   Print("  Result code: ", res);
   Print("  Error code: ", error);

   if(res == -1)
   {
      if(error == 5200)
         Print("  ❌ ERROR 5200: URL not in whitelist or WebRequest disabled");
      else if(error == 4060)
         Print("  ❌ ERROR 4060: Function not allowed");
      else
         Print("  ❌ ERROR: ", error);
   }
   else if(res == 200)
   {
      Print("  ✅ SUCCESS - WebRequest is working!");
   }
   else
   {
      Print("  ⚠️  HTTP Status: ", res);
   }

   Print("---");
}

//+------------------------------------------------------------------+
//| Expert tick function                                              |
//+------------------------------------------------------------------+
void OnTick()
{
   // Do nothing
}
//+------------------------------------------------------------------+
