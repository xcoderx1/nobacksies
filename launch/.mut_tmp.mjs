import { PublicKey } from '@solana/web3.js'
import { buildCurveWithMarketCap, validateConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { CURVE, VALIDATION_PLACEHOLDER_RECEIVER } from 'file:///Users/xcoderx/Documents/nobacksies/launch/config/nobacksies.config.js'

const clone = (o) => JSON.parse(JSON.stringify(o, (k,v)=> v))
function deepClone(o){
  if (o===null||typeof o!=='object') return o
  if (Array.isArray(o)) return o.map(deepClone)
  const r={}; for(const k of Object.keys(o)) r[k]=deepClone(o[k]); return r
}

// EXACT replica of build-config.js:106-111
function gate(c, CURVE_USED) {
  const lockedLp = c.partnerPermanentLockedLiquidityPercentage + c.creatorPermanentLockedLiquidityPercentage
  const claimableLp = c.partnerLiquidityPercentage + c.creatorLiquidityPercentage
  const fails = []
  if (c.migratedPoolFee.collectFeeMode !== 2) fails.push('migrated pool is NOT in compounding mode')
  if (lockedLp !== 100) fails.push(`only ${lockedLp}% of LP is permanently locked`)
  if (claimableLp !== 0) fails.push(`${claimableLp}% of LP is withdrawable`)
  if (c.tokenUpdateAuthority !== 1) fails.push('token authorities are not Immutable')
  if (c.migrationFee.feePercentage !== 0) fails.push('migration takes a cut')
  return fails
}

const muts = {
  'BASELINE (unmutated)': (x) => x,
  'compoundingFeeBps 10000 -> 1': (x) => { x.migration.migratedPoolFee.compoundingFeeBps = 1; return x },
  'leftover 0 -> 50_000_000': (x) => { x.token.leftover = 50_000_000; return x },
  'poolCreationFee 0 -> 10 SOL': (x) => { x.fee.poolCreationFee = 10; return x },
  'lockedVesting -> 100M cliffUnlock': (x) => { x.lockedVesting = { totalLockedVestingAmount: 100_000_000, numberOfVestingPeriod: 0, cliffUnlockAmount: 100_000_000, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 }; return x },
  'endingFeeBps 100 -> 9900 (as stated)': (x) => { x.fee.baseFeeParams.feeSchedulerParam.endingFeeBps = 9900; return x },
  'FLAT 99%: start=end=9900, periods=0, dur=0': (x) => { x.fee.baseFeeParams.feeSchedulerParam = { startingFeeBps: 9900, endingFeeBps: 9900, numberOfPeriod: 0, totalDuration: 0 }; return x },
  'creatorTradingFeePercentage 0 -> 100': (x) => { x.fee.creatorTradingFeePercentage = 100; return x },
  'migrationFee 50% / creator 100%': (x) => { x.migration.migrationFee = { feePercentage: 50, creatorFeePercentage: 100 }; return x },
  'migrationFee creator 100% ONLY (fee 0)': (x) => { x.migration.migrationFee = { feePercentage: 0, creatorFeePercentage: 100 }; return x },
  'enableFirstSwapWithMinFee -> true': (x) => { x.fee.enableFirstSwapWithMinFee = true; return x },
}

for (const [name, fn] of Object.entries(muts)) {
  const cur = fn(deepClone(CURVE))
  let c, err = null
  try {
    c = buildCurveWithMarketCap(cur)
  } catch (e) { console.log(`${name.padEnd(42)} BUILD THREW: ${e.message}`); continue }
  try {
    validateConfigParameters({ ...c, leftoverReceiver: new PublicKey(VALIDATION_PLACEHOLDER_RECEIVER) })
  } catch (e) { console.log(`${name.padEnd(42)} VALIDATOR THREW: ${e.message}`); continue }
  const fails = gate(c, cur)
  const extra = []
  extra.push(`cliffFeeNum=${c.poolFees.baseFee.cliffFeeNumerator.toString()}`)
  extra.push(`periods=${c.poolFees.baseFee.firstFactor}`)
  extra.push(`cFeeBps=${c.compoundingFeeBps}`)
  extra.push(`cliffUnlock=${c.lockedVesting.cliffUnlockAmount.toString()}`)
  extra.push(`poolCreationFee=${c.poolCreationFee?.toString?.() ?? c.poolCreationFee}`)
  extra.push(`creatorTradeFee%=${c.creatorTradingFeePercentage}`)
  extra.push(`migFee=${c.migrationFee.feePercentage}/${c.migrationFee.creatorFeePercentage}`)
  console.log(`${name.padEnd(42)} ${fails.length ? 'FAILS -> ' + fails.join('; ') : 'PASSES ✓'}   [${extra.join(' ')}]`)
}
