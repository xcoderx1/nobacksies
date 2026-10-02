/**
 * $NOBACKSIES — launch config (single source of truth)
 *
 * Every value below was checked against the real type definitions and
 * validator source of @meteora-ag/dynamic-bonding-curve-sdk@1.5.13
 * (node_modules/.../dist/index.d.ts and index.js). Constraints quoted in
 * comments are copied from those validators, not from docs.
 *
 * Run `npm run build:config` to re-run the SDK's own validateConfigParameters
 * over this file before you spend a lamport.
 */
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  DammV2DynamicFeeMode,
  MigratedCollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
} from '@meteora-ag/dynamic-bonding-curve-sdk'

export const TOKEN = {
  name: 'No Backsies',
  symbol: 'NOBACKSIES',
  // Metadata JSON uri. Upload site/assets/logo.png + a metadata json first,
  // then paste the metadata uri here. Left blank on purpose so a half-ready
  // launch fails loudly instead of minting with a dead image.
  uri: '',
}

/** Quote asset. Native SOL. */
export const QUOTE_MINT = 'So11111111111111111111111111111111111111112'

export const CURVE = {
  // --- Supply and authorities -------------------------------------------
  token: {
    tokenType: TokenType.SPLToken,
    tokenBaseDecimal: TokenDecimal.SIX,
    tokenQuoteDecimal: 9, // SOL
    // Immutable = no mint authority and no metadata update authority, ever.
    // This is the first "no backsies": the supply and the name cannot be
    // changed after launch, by us or anyone.
    tokenAuthorityOption: TokenAuthorityOption.Immutable,
    totalTokenSupply: 1_000_000_000,
    leftover: 0, // no unsold tail swept to a wallet
  },

  // --- Bonding-curve phase fees -----------------------------------------
  fee: {
    // Anti-sniper. FeeScheduler is TIME-based: the fee decays over
    // `totalDuration` seconds in `numberOfPeriod` steps. It is NOT
    // trade-count based — BaseFeeMode.RateLimiter is the amount-based
    // variant and it is marked @deprecated ("New configs and pools cannot
    // use RateLimiter"), so time decay is the only option available.
    baseFeeParams: {
      baseFeeMode: BaseFeeMode.FeeSchedulerExponential,
      feeSchedulerParam: {
        startingFeeBps: 1000, // 10%  — must be <= MAX_FEE_BPS (9900)
        endingFeeBps: 100, //  1%  — must be >= MIN_FEE_BPS (25)
        numberOfPeriod: 60,
        totalDuration: 3600, // seconds (activationType = Timestamp)
      },
    },
    dynamicFeeEnabled: true,
    collectFeeMode: CollectFeeMode.QuoteToken,
    // Curve-phase trading fees accrue to the partner fee claimer. They
    // CANNOT be routed into the curve — the compounding mechanism only
    // exists in the migrated DAMM v2 pool. See README "What the chain
    // enforces vs what we promise".
    creatorTradingFeePercentage: 0,
    poolCreationFee: 0,
    enableFirstSwapWithMinFee: false,
  },

  // --- Migration into the compounding pool ------------------------------
  migration: {
    // DAMM v1 is @deprecated in the SDK and getMigratedPoolFeeParams throws
    // on it. v2 is the only option for a new config.
    migrationOption: MigrationOption.MET_DAMM_V2,
    // Customizable (6) is MANDATORY to set migratedPoolFee at all:
    // validateMigratedPoolFee forces the whole block to zeros unless
    // migrationFeeOption === Customizable. And validateMigrationFeeOption
    // only allows Customizable when migrationOption is MET_DAMM_V2.
    migrationFeeOption: MigrationFeeOption.Customizable,
    // We take nothing off the top at migration.
    migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
    migratedPoolFee: {
      // THE WHOLE THESIS. Compounding = 2 routes collected fees back into
      // pool liquidity instead of to a fee claimer.
      collectFeeMode: MigratedCollectFeeMode.Compounding,
      dynamicFee: DammV2DynamicFeeMode.Enabled,
      // Must be within [MIN_MIGRATED_POOL_FEE_BPS, MAX_MIGRATED_POOL_FEE_BPS]
      // = [10, 1000]. 100 bps = 1%.
      poolFeeBps: 100,
      // THE SPLIT. cp-amm splitFees (cp-amm-sdk dist/index.js:8231) takes
      // Meteora's protocol cut first, then divides what is left:
      //   compoundingFee = tradingFee * compoundingFeeBps / 10000  -> into the pool
      //   claimingFee    = tradingFee - compoundingFee             -> claimable
      // validateCompoundingFeeBps requires 0 < bps <= 10000 in Compounding mode.
      //
      // 5000 = half the pool's fee share compounds into liquidity, half accrues
      // as claimable fees on the LP position. At a 1% pool fee that is ~0.4% of
      // all volume, i.e. ~400 SOL per 100,000 SOL traded.
      //
      // The LP stays 100% PERMANENTLY LOCKED either way -- the capital can never
      // be withdrawn. getUnClaimLpFee sizes a claim with positionLiquidity(),
      // which includes permanentLockedLiquidity (cp-amm index.js:10856), so a
      // locked position still earns fees.
      //
      // UNRESOLVED: claim_position_fee authorises on the holder of
      // position_nft_account, and that account is a cp-amm PDA
      // (derivePositionNftAccount). Whether the partner can sign for the
      // migrated position is NOT establishable from either SDK. THE DEVNET RUN
      // MUST CONFIRM IT before this number means anything.
      compoundingFeeBps: 5_000,
    },
  },

  // --- LP distribution: nobody gets backsies ----------------------------
  // validateLPPercentages requires these six numbers to sum to exactly 100.
  // validateMinimumLockedLiquidity requires >= 1000 bps (10%) still locked
  // one day after migration. 100% permanent beats that by 10x.
  liquidityDistribution: {
    partnerPermanentLockedLiquidityPercentage: 100,
    partnerLiquidityPercentage: 0,
    creatorPermanentLockedLiquidityPercentage: 0,
    creatorLiquidityPercentage: 0,
  },

  // No team allocation, no cliff, no vesting. isDefaultLockedVesting().
  lockedVesting: {
    totalLockedVestingAmount: 0,
    numberOfVestingPeriod: 0,
    cliffUnlockAmount: 0,
    totalVestingDuration: 0,
    cliffDurationFromMigrationTime: 0,
  },

  // Timestamp => every duration above is in seconds, not slots.
  activationType: ActivationType.Timestamp,

  // --- Curve shape ------------------------------------------------------
  // Consumed by buildCurveWithMarketCap. Quoted in SOL terms.
  initialMarketCap: 30,
  migrationMarketCap: 600,
}

/**
 * Where unsold leftover base tokens go. We set `leftover: 0` so nothing is
 * ever sent here, but validateTokenSupply still rejects PublicKey.default,
 * so a real address is required whenever `totalTokenSupply` is set.
 * create-config.js refuses to run without it; build-config.js substitutes a
 * clearly-labelled placeholder so the offline validation still works.
 */
export const LEFTOVER_RECEIVER = process.env.LEFTOVER_RECEIVER ?? null

/** Only used by build-config.js to satisfy the validator offline. */
export const VALIDATION_PLACEHOLDER_RECEIVER =
  'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN'
