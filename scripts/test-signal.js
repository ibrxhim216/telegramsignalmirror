// Test Signal Parser
// Run this with: node test-signal.js

const testSignal = `Pair - XAUUSD

SELL STOP - 3338.3

SL - 20 pips
TP - 40 pips
RR - 1:2`;

console.log('='.repeat(60));
console.log('TESTING SIGNAL PARSER');
console.log('='.repeat(60));
console.log('\nTest Signal:');
console.log(testSignal);
console.log('\n' + '-'.repeat(60));

// Simulate parsing logic
const normalized = testSignal.toUpperCase();

// Extract Symbol
const symbolMatch = normalized.match(/XAUUSD|GOLD|EURUSD|GBPUSD|US30|NAS100/);
const symbol = symbolMatch ? symbolMatch[0] : null;

// Extract Direction
let direction = null;
if (normalized.includes('BUY STOP')) direction = 'BUY STOP';
else if (normalized.includes('SELL STOP')) direction = 'SELL STOP';
else if (normalized.includes('BUY LIMIT')) direction = 'BUY LIMIT';
else if (normalized.includes('SELL LIMIT')) direction = 'SELL LIMIT';
else if (normalized.includes('BUY')) direction = 'BUY';
else if (normalized.includes('SELL')) direction = 'SELL';

// Extract Entry Price (for pending orders)
const entryMatch = normalized.match(/(BUY|SELL)\s*(STOP|LIMIT)\s*[-:]\s*([0-9]+\.?[0-9]*)/i);
const entryPrice = entryMatch ? parseFloat(entryMatch[3]) : null;

// Extract SL (pips)
const slMatch = normalized.match(/SL[:\s-]+([0-9]+\.?[0-9]*)\s*PIPS?/i);
const slPips = slMatch ? parseFloat(slMatch[1]) : null;

// Extract TP (pips)
const tpMatch = normalized.match(/TP[:\s-]+([0-9]+\.?[0-9]*)\s*PIPS?/i);
const tpPips = tpMatch ? parseFloat(tpMatch[1]) : null;

console.log('\n📊 PARSING RESULTS:');
console.log('-'.repeat(60));
console.log(`Symbol:       ${symbol}`);
console.log(`Direction:    ${direction}`);
console.log(`Entry Price:  ${entryPrice}`);
console.log(`SL (pips):    ${slPips}`);
console.log(`TP (pips):    ${tpPips}`);

// Convert pips to prices for XAUUSD
if (symbol === 'XAUUSD' && entryPrice && slPips && tpPips) {
  const pipValue = 0.1; // Gold: 1 pip = 0.1

  // For SELL STOP: SL is above entry, TP is below entry
  const slPrice = entryPrice + (slPips * pipValue);
  const tpPrice = entryPrice - (tpPips * pipValue);

  console.log('\n💰 CONVERTED TO PRICES (XAUUSD):');
  console.log('-'.repeat(60));
  console.log(`Entry:        ${entryPrice}`);
  console.log(`SL:           ${slPrice.toFixed(1)} (${slPips} pips above entry)`);
  console.log(`TP:           ${tpPrice.toFixed(1)} (${tpPips} pips below entry)`);
}

// Calculate confidence
let confidence = 0;
if (symbol) confidence += 0.3;
if (direction) confidence += 0.3;
if (entryPrice) confidence += 0.15;
if (slPips) confidence += 0.15;
if (tpPips) confidence += 0.1;

console.log('\n✅ SIGNAL VALIDITY:');
console.log('-'.repeat(60));
console.log(`Confidence:   ${(confidence * 100).toFixed(0)}%`);
console.log(`Status:       ${confidence >= 0.5 ? '✅ VALID - Will execute' : '❌ INVALID - Will skip'}`);
console.log('='.repeat(60));
