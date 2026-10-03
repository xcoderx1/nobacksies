/**
 * Builds the $NOBACKSIES curve from config/nobacksies.config.js, runs the
 * SDK's OWN validator over it, and prints the resulting on-chain parameters.
 *
 * Touches no network and spends nothing. This is the gate every change has to
 * pass before create-config.js is allowed near a keypair.
 */
import 'dotenv/config'
import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import {
  buildCurveWithMarketCap,
  getBaseFeeNumeratorByPeriod,
  getTotalFeeNumerator,
  isDefaultLockedVesting,
  MAX_SQRT_PRICE,
  bpsToFeeNumerator,
  validateConfigParameters,
  getMigrationThresholdPrice,
  getPriceFromSqrtPrice,
  feeNumeratorToBps,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  CURVE,
  TOKEN,
  LEFTOVER_RECEIVER,
  VALIDATION_PLACEHOLDER_RECEIVER,
} from '../config/active.js'

const { token } = CURVE

export function buildConfig(leftoverReceiver) {
  const configParams = buildCurveWithMarketCap(CURVE)
  // validateTokenSupply() rejects PublicKey.default, so leftoverReceiver has
  // to be a real key even though `leftover: 0` means nothing is ever sent to
  // it. Throws the first actionable error; does not return a boolean.
  validateConfigParameters({
    ...configParams,
    leftoverReceiver: new PublicKey(leftoverReceiver),
  })
  return configParams
}

const pct = (bps) => `${(bps / 100).toFixed(2)}%`
const sol = (bn) => Number(bn.toString(10)) / 1e9

function main() {
  const usingPlaceholder = !LEFTOVER_RECEIVER
  const c = buildConfig(LEFTOVER_RECEIVER ?? VALIDATION_PLACEHOLDER_RECEIVER)

  const price = (sqrt) =>
    getPriceFromSqrtPrice(sqrt, token.tokenBaseDecimal, token.tokenQuoteDecimal)
  const startPrice = price(c.sqrtStartPrice)
  // There is no migrationSqrtPrice field on ConfigParameters; the migration
  // price is a function of the threshold and the curve.
  const migrationPrice = price(
    getMigrationThresholdPrice(c.migrationQuoteThreshold, c.sqrtStartPrice, c.curve),
  )

  // buildCurveWithMarketCap emits ONE priced segment plus a tail pinned at
  // MAX_SQRT_PRICE that absorbs 0 SOL. Reporting curve.length as "segments"
  // implies a two-segment shape that was never selected.
  const priced = c.curve.filter((pt) => !pt.sqrtPrice.eq(MAX_SQRT_PRICE)).length

  // dynamicFeeEnabled adds a volatility component on top of the base fee, so
  // every "10% -> 1%" figure is a floor, not the fee.
  const maxVol = { volatilityAccumulator: new BN(c.poolFees.dynamicFee.maxVolatilityAccumulator) }
  const totalAt = (baseNumerator) =>
    pct(feeNumeratorToBps(getTotalFeeNumerator(baseNumerator, c.poolFees.dynamicFee, maxVol)))

  const lockedLp =
    c.partnerPermanentLockedLiquidityPercentage + c.creatorPermanentLockedLiquidityPercentage
  const claimableLp = c.partnerLiquidityPercentage + c.creatorLiquidityPercentage

  const rows = [
    ['token', `${TOKEN.name} ($${TOKEN.symbol})`],
    ['supply', token.totalTokenSupply.toLocaleString('en-US')],
    ['decimals', String(c.tokenDecimal)],
    ['update authority', `${c.tokenUpdateAuthority} (1 = Immutable)`],
    null,
    ['start price', `${startPrice.toSignificantDigits(6)} SOL`],
    ['migration price', `${migrationPrice.toSignificantDigits(6)} SOL`],
    ['price multiple', `${migrationPrice.div(startPrice).toFixed(1)}×`],
    ['migration threshold', `${sol(c.migrationQuoteThreshold).toFixed(3)} SOL`],
    ['curve segments', `${priced} priced + ${c.curve.length - priced} dust tail`],
    null,
    ['sniper fee at t=0', `${pct(feeNumeratorToBps(c.poolFees.baseFee.cliffFeeNumerator))} base, up to ${totalAt(c.poolFees.baseFee.cliffFeeNumerator)} with dynamic fee`],
    ['floor fee', `${pct(CURVE.fee.baseFeeParams.feeSchedulerParam.endingFeeBps)} base, up to ${totalAt(bpsToFeeNumerator(CURVE.fee.baseFeeParams.feeSchedulerParam.endingFeeBps))} with dynamic fee`],
    // In FeeScheduler mode firstFactor = numberOfPeriod and
    // secondFactor = seconds per period (activationType is Timestamp).
    ['decay', `${c.poolFees.baseFee.firstFactor} steps \u00d7 ${c.poolFees.baseFee.secondFactor}s = ${c.poolFees.baseFee.firstFactor * c.poolFees.baseFee.secondFactor}s (time, not trades)`],
    null,
    ['migrated pool fee', pct(c.migratedPoolFee.poolFeeBps)],
    ['migrated fee mode', `${c.migratedPoolFee.collectFeeMode} (2 = Compounding)`],
    ['fee split', `${(Number(c.compoundingFeeBps) / 100).toFixed(0)}% compounds into the pool, ${((10000 - Number(c.compoundingFeeBps)) / 100).toFixed(0)}% claimable`],
    ['team income', `~${(((10000 - Number(c.compoundingFeeBps)) / 10000) * (c.migratedPoolFee.poolFeeBps / 10000) * 0.8 * 100000).toFixed(0)} SOL per 100,000 SOL of volume (if claimable \u2014 unconfirmed)`],
    ['migrationFeeOption', `${c.migrationFeeOption} (6 = Customizable)`],
    null,
    ['LP permanently locked', `${lockedLp}%`],
    ['LP anyone can pull', `${claimableLp}%`],
    ['team vesting', `${CURVE.lockedVesting.totalLockedVestingAmount} tokens`],
    ['migration skim', `${c.migrationFee.feePercentage}% / creator ${c.migrationFee.creatorFeePercentage}%`],
  ]

  console.log('\n  $NOBACKSIES — validated by the SDK’s own validateConfigParameters\n')
  for (const r of rows) console.log(r ? `  ${r[0].padEnd(23)} ${r[1]}` : '')

  // Real fee at real timestamps, from the SDK's own scheduler math rather
  // than from re-implementing the exponential decay here.
  const bf = c.poolFees.baseFee
  console.log('\n  sniper fee decay (exponential, from the SDK scheduler):')
  for (const period of [0, 5, 15, 30, 45, 60]) {
    const n = getBaseFeeNumeratorByPeriod(
      bf.cliffFeeNumerator,
      bf.firstFactor,
      new BN(period),
      new BN(bf.thirdFactor),
      bf.baseFeeMode,
    )
    console.log(`    t = ${String(period * bf.secondFactor).padStart(4)}s   ${pct(feeNumeratorToBps(n))}`)
  }

  // Every switch that has to hold for the public promise to be true. The
  // earlier five-predicate version passed hostile edits the SDK itself accepts
  // — a 99% permanent exit tax and a 10%-of-supply creator unlock among them.
  const fails = []
  const sched = CURVE.fee.baseFeeParams.feeSchedulerParam
  if (c.migratedPoolFee.collectFeeMode !== 2) fails.push('migrated pool is NOT in compounding mode')
  if (c.migrationFeeOption !== 6) fails.push(`migrationFeeOption is ${c.migrationFeeOption}, not Customizable(6) — the whole migratedPoolFee block is silently zeroed`)
  // Must be set deliberately: it decides the split between the pool and the
  // team. 0 would be invalid in Compounding mode; 10000 pays the team nothing.
  if (Number(c.compoundingFeeBps) !== CURVE.migration.migratedPoolFee.compoundingFeeBps)
    fails.push(`compoundingFeeBps landed as ${c.compoundingFeeBps}, config says ${CURVE.migration.migratedPoolFee.compoundingFeeBps}`)
  if (lockedLp !== 100) fails.push(`only ${lockedLp}% of LP is permanently locked`)
  if (claimableLp !== 0) fails.push(`${claimableLp}% of LP is withdrawable — that is a backsie`)
  if (c.tokenUpdateAuthority !== 1) fails.push('token authorities are not Immutable')
  if (c.migrationFee.feePercentage !== 0) fails.push('migration takes a cut')
  if (c.migrationFee.creatorFeePercentage !== 0) fails.push('migration takes a creator cut')
  if (c.creatorTradingFeePercentage !== 0) fails.push(`creatorTradingFeePercentage is ${c.creatorTradingFeePercentage}, not 0`)
  if (!isDefaultLockedVesting(c.lockedVesting)) fails.push('lockedVesting is non-default — someone gets a token unlock')
  if (!c.poolCreationFee.isZero()) fails.push(`poolCreationFee is ${c.poolCreationFee.toString(10)}, not 0`)
  if (CURVE.token.leftover !== 0) fails.push(`leftover is ${CURVE.token.leftover}, not 0 — unsold supply would be sweepable`)
  if (sched.endingFeeBps > 100) fails.push(`endingFeeBps is ${sched.endingFeeBps} — a permanent ${(sched.endingFeeBps / 100).toFixed(2)}% trade tax`)
  if (c.migratedPoolFee.poolFeeBps !== 100) fails.push(`migrated poolFeeBps is ${c.migratedPoolFee.poolFeeBps}, not the advertised 100`)

  const todo = []
  if (!TOKEN.uri) todo.push('TOKEN.uri is empty — upload metadata json before launch')
  // The legacy transaction is already ~1104 of its 1232 bytes with a short
  // Arweave uri, and the compute-budget instructions add 52 more. launch.js
  // measures the real size; catch an over-long uri here, before the send.
  else if (TOKEN.uri.length > 120) fails.push(`TOKEN.uri is ${TOKEN.uri.length} chars — past ~120 the legacy transaction exceeds 1232 bytes. Use https://arweave.net/<43-char-txid>`)
  if (usingPlaceholder) todo.push('LEFTOVER_RECEIVER unset — validated with a placeholder key')

  console.log('')
  for (const f of fails) console.log(`  ✗ ${f}`)
  for (const t of todo) console.log(`  ○ ${t}`)
  if (fails.length) { console.log(''); process.exit(1) }
  console.log('  ✓ no backsies: LP locked, authorities burned, fees compound')
  console.log(todo.length ? '  ○ not launch-ready yet (see above)\n' : '  ✓ launch-ready\n')
}

if (import.meta.url === `file://${process.argv[1]}`) main()
