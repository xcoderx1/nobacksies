/**
 * Builds the $NOBACKSIES curve from config/nobacksies.config.js, runs the
 * SDK's OWN validator over it, and prints the resulting on-chain parameters.
 *
 * Touches no network and spends nothing. This is the gate every change has to
 * pass before create-config.js is allowed near a keypair.
 */
import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import {
  buildCurveWithMarketCap,
  getBaseFeeNumeratorByPeriod,
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
} from '../config/nobacksies.config.js'

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
    ['curve segments', String(c.curve.length)],
    null,
    ['sniper fee at t=0', pct(feeNumeratorToBps(c.poolFees.baseFee.cliffFeeNumerator))],
    ['floor fee', pct(CURVE.fee.baseFeeParams.feeSchedulerParam.endingFeeBps)],
    // In FeeScheduler mode firstFactor = numberOfPeriod and
    // secondFactor = seconds per period (activationType is Timestamp).
    ['decay', `${c.poolFees.baseFee.firstFactor} steps \u00d7 ${c.poolFees.baseFee.secondFactor}s = ${c.poolFees.baseFee.firstFactor * c.poolFees.baseFee.secondFactor}s (time, not trades)`],
    null,
    ['migrated pool fee', pct(c.migratedPoolFee.poolFeeBps)],
    ['migrated fee mode', `${c.migratedPoolFee.collectFeeMode} (2 = Compounding)`],
    ['compoundingFeeBps', c.compoundingFeeBps.toString(10)],
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

  const fails = []
  if (c.migratedPoolFee.collectFeeMode !== 2) fails.push('migrated pool is NOT in compounding mode')
  if (lockedLp !== 100) fails.push(`only ${lockedLp}% of LP is permanently locked`)
  if (claimableLp !== 0) fails.push(`${claimableLp}% of LP is withdrawable — that is a backsie`)
  if (c.tokenUpdateAuthority !== 1) fails.push('token authorities are not Immutable')
  if (c.migrationFee.feePercentage !== 0) fails.push('migration takes a cut')

  const todo = []
  if (!TOKEN.uri) todo.push('TOKEN.uri is empty — upload metadata json before launch')
  if (usingPlaceholder) todo.push('LEFTOVER_RECEIVER unset — validated with a placeholder key')

  console.log('')
  for (const f of fails) console.log(`  ✗ ${f}`)
  for (const t of todo) console.log(`  ○ ${t}`)
  if (fails.length) { console.log(''); process.exit(1) }
  console.log('  ✓ no backsies: LP locked, authorities burned, fees compound')
  console.log(todo.length ? '  ○ not launch-ready yet (see above)\n' : '  ✓ launch-ready\n')
}

if (import.meta.url === `file://${process.argv[1]}`) main()
