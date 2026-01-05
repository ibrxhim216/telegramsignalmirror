// Feature audit script
const fs = require('fs');
const path = require('path');

const features = [
  'RemovePendingAfter',
  'ForceMarketExecution',
  'IgnoreWithoutSL',
  'IgnoreWithoutTP',
  'CheckAlreadyOpenedOrder',
  'SamePairMode',
  'PipsTolerance',
  'ReverseSignal',
  'EntryModificationPips',
  'SlModificationPips',
  'TpModificationPips',
  'SlOverrideMode',
  'PredefinedSL',
  'TpOverrideMode',
  'PredefinedTP1',
  'PredefinedTP2',
  'PredefinedTP3',
  'PredefinedTP4',
  'PredefinedTP5',
  'EnableRRMode',
  'RRRatioTP1',
  'TrailingAlsoMoveTP',
  'UseTrailingStopTP',
  'TrailingStartAfterTPHit',
  'SmartProfitLockPercent',
  'EnableTimeFilter',
  'EnableEditMessage',
  'MoveSlToEntryType',
  'BreakevenPips',
  'MoveSlAfterXPips',
  'MoveToBreakevenAfterFirstTP',
  'ClosePercentAtTP1',
  'ClosePercentAtTP2',
  'ClosePercentAtTP3',
  'ClosePercentAtTP4',
  'ClosePercentAtTP5',
  'UseTrailingStop',
  'TrailingStartPips',
  'TrailingStepPips',
  'TrailingDistancePips',
  'EnableProtector',
  'DailyLossLimit',
  'DailyProfitTarget',
  'MaxTradesPerDay'
];

const mq4File = path.join(__dirname, '../mt4-mt5/TelegramSignalMirror.mq4');
const content = fs.readFileSync(mq4File, 'utf8');

const unusedFeatures = [];
const usedFeatures = [];

features.forEach(feature => {
  const regex = new RegExp(feature, 'g');
  const matches = content.match(regex);
  const count = matches ? matches.length : 0;

  if (count === 0) {
    console.log(`❌ ${feature}: NOT FOUND`);
  } else if (count === 1) {
    unusedFeatures.push(feature);
    console.log(`⚠️  ${feature}: Only defined (${count} occurrence) - LIKELY NOT IMPLEMENTED`);
  } else {
    usedFeatures.push(feature);
    console.log(`✅ ${feature}: Used (${count} occurrences)`);
  }
});

console.log('\n\n=== SUMMARY ===');
console.log(`Total features checked: ${features.length}`);
console.log(`Implemented features: ${usedFeatures.length}`);
console.log(`Unimplemented features: ${unusedFeatures.length}`);

if (unusedFeatures.length > 0) {
  console.log('\n⚠️  UNIMPLEMENTED FEATURES:');
  unusedFeatures.forEach(f => console.log(`  - ${f}`));
}
