# $NOBACKSIES

Jarold is a jar. You put it in, it stays in.

A Solana memecoin launched on Meteora's Dynamic Bonding Curve, configured so that
the three things a rug needs — a mint authority, a withdrawable LP position, and a
fee wallet — do not exist.

```
nobacksies/
├── site/                  landing page (static, no build step)
│   ├── index.html
│   └── assets/            banner.png (1500×500), logo.png (1000×1000)
└── launch/                on-chain launch tooling
    ├── config/nobacksies.config.js    the only file you edit
    └── src/
        ├── build-config.js            build + validate offline, spends nothing
        └── launch.js                  create config + pool (dry-run by default)
```

## Quick start

```bash
cd launch && npm install && npm run build:config
```

That builds the curve, runs the SDK's own `validateConfigParameters` over it, and
prints every resulting on-chain value. It touches no network and spends nothing.
Nothing else should be run until it passes.

```bash
cp .env.example .env     # set KEYPAIR_PATH and LEFTOVER_RECEIVER
npm run launch:devnet    # builds + simulates the real transaction, sends nothing
```

## What the chain enforces

Every line here was checked against the type definitions and validator source of
`@meteora-ag/dynamic-bonding-curve-sdk@1.5.13`, not against documentation.

| Claim | How it is enforced |
|---|---|
| Supply can never change | `tokenAuthorityOption: Immutable` — no mint authority, no metadata update authority |
| 100% of LP locked forever | `partnerPermanentLockedLiquidityPercentage: 100`, everything else 0. `validateLPPercentages` requires the six LP numbers to sum to exactly 100, so there is no withdrawable remainder |
| Fees compound into the pool | `migratedPoolFee.collectFeeMode: MigratedCollectFeeMode.Compounding` (2) on a DAMM v2 pool |
| No team allocation | `lockedVesting` all zeros — passes `isDefaultLockedVesting()` |
| No migration skim | `migrationFee: { feePercentage: 0, creatorFeePercentage: 0 }` |
| Snipers pay most | `FeeSchedulerExponential`, 10% → 1% in 60 steps over 3600s |

Three constraints worth knowing, because they shape the config:

- **`MigrationFeeOption.Customizable` is mandatory.** `validateMigratedPoolFee`
  silently forces the entire `migratedPoolFee` block to zeros unless
  `migrationFeeOption === Customizable`, and `validateMigrationFeeOption` only
  permits `Customizable` when migrating to DAMM v2. Pick a fixed-bps option and
  compounding mode is thrown away without an error.
- **DAMM v1 is dead.** `getMigratedPoolFeeParams` throws outright on
  `MigrationOption.MET_DAMM`.
- **`compoundingFeeBps` must be > 0.** `validateCompoundingFeeBps` requires
  `0 < compoundingFeeBps <= 10000` whenever the mode is `Compounding`, and
  exactly `0` otherwise.

## What the chain does not enforce

Worth stating plainly, because the landing page is a sales pitch and this file is not:

- **Bonding-curve-phase fees do not compound.** Compounding is a property of the
  migrated DAMM v2 pool. While the token is still on the curve, trading fees accrue
  to the `feeClaimer` — the program has no mechanism to route them into the curve.
  Not claiming them is a promise, not a guarantee. Set `FEE_CLAIMER` deliberately.
- **The protocol cut is taken BEFORE fees compound.** `compoundingFeeBps` semantics
  ARE provable, from `@meteora-ag/cp-amm-sdk` (already a dependency) at
  `dist/index.js:8231` — an earlier version of this file wrongly said they were not:

  ```
  protocolFee    = feeAmount * protocolFeePercent / 100     <- removed first
  tradingFee     = feeAmount - protocolFee
  compoundingFee = tradingFee * compoundingFeeBps / 10000
  claimingFee    = tradingFee - compoundingFee
  ```

  So `10000` means 100% of **the LP's share**, not 100% of the fee. "Every trading
  fee compounds back into the pool" is false by exactly `protocolFeePercent`.
  That percent is a per-pool field with no constant in cp-amm, so its value for the
  migrated pool is still unknown and must be read off the devnet pool. The 80% in the
  landing-page sim footer is `PROTOCOL_FEE_PERCENT = 20` from the **bonding-curve**
  phase, misapplied to the migrated pool — it is an assumption, not a measurement.
- **The fee decay is time-based, not trade-based.** `BaseFeeMode.RateLimiter` is
  the amount-based variant and it is marked deprecated — "New configs and pools
  cannot use RateLimiter." A sniper who waits an hour pays 1% like everyone else.
- **Locked liquidity is not a price floor.** A deeper pool absorbs a dump with less
  price impact. It does not prevent one.
- **The simulator on the landing page is a toy.** Its assumptions are listed in the
  page footer. It is not the SDK's curve math and should not be read as a forecast.
- **Both Meteora programs are upgradeable.** `dbcij3LW…` and `cpamdpZC…` are owned by
  BPFLoaderUpgradeable. The config this launch writes is immutable; the code that
  interprets it is not. Whoever holds the upgrade authority can change what the
  permanent LP lock and compounding mode do, after launch. "No custom contract to
  audit" is true and is not the same as "nothing can change".
- **A cp-amm operator can turn compounding off.** `update_pool_fees` can lower
  `compounding_fee_bps` on a live pool, and `set_pool_status` can halt it. The launch
  team holds no such key, and neither can it prevent the holder from using one.
- **Freeze authority is never checked.** The site says "authorities burned" and counts
  two. SPL mints have three. Nothing in this repo asserts `freezeAuthority === null`.
- **Curve-phase fees are extractable, and the amount is known.** Walking the real curve
  with the SDK's own `getSwapResult`: a graduation entirely at t=0 routes ~9.72 SOL to
  `feeClaimer`; entirely after t=3600s, ~0.89 SOL. It accrues in `partner_quote_fee`
  and survives migration, claimable forever by whoever holds that key. Setting
  `FEE_CLAIMER` to an address nobody can sign for is the only way to close it — a
  promise not to claim is not a closure.

## Before mainnet

1. `npm run build:config` passes with no `✗` and no `○`.
2. Metadata json uploaded, `TOKEN.uri` set. It is immutable after launch.
3. **Write the missing graduation path first.** SDK 1.5.13 exposes
   `client.migration.migrateToDammV2` but has **no** `createDammV2MigrationMetadata`
   (only the v1 variant), while the program requires `migration_damm_v2_create_metadata`.
   Verify with:

   ```bash
   cd launch && node -e 'const c=require("@meteora-ag/dynamic-bonding-curve-sdk");console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(c.DynamicBondingCurveClient.create({},"confirmed").migration)))'
   ```

   That instruction has to be built by hand from `DynamicBondingCurveIdl` against
   `deriveDammV2MigrationMetadataAddress(pool)`. Until it exists, the pool cannot
   graduate — on devnet or on mainnet — and every post-graduation claim is untested.
4. `npm run launch:devnet -- --send` on devnet, then trade through the curve to
   graduation and assert, against the decoded accounts rather than an explorer:
   `getMint(baseMint)` has `mintAuthority === null` **and** `freezeAuthority === null`;
   the migrated pool's `collect_fee_mode === 2`; the position NFT owner is not the
   payer, the fee claimer or the pool creator; `second_position` was never created;
   and the pool's `protocol_fee_percent` (record the real number — the site's 80% is
   an assumption).
5. Decide who `FEE_CLAIMER` is and say so publicly before launch, not after.
   `launch.js` refuses to run without it rather than defaulting to the payer.

   **Use a hardware wallet or multisig for this key.** It does two jobs, both
   permanent: it claims curve-phase fees, and the DBC program assigns it
   ownership of the migrated DAMM v2 LP position — verified on mainnet
   migration `48YvT8fe...`, where the position NFT account's owner equalled the
   config's `feeClaimer` exactly. So it permanently controls all
   post-graduation income (~0.4% of volume, ongoing). It cannot be changed and
   nothing recovers it. A hot key on a laptop is the wrong choice here.

   The same lever decides the pitch. An address nobody can sign for makes
   "nobody takes anything out" literally true and forfeits every lamport of
   post-graduation income. A wallet you control earns the income and obliges
   the page to say so. You cannot have both.
6. Fetch `TOKEN.uri` and assert it returns JSON with the right name/symbol and a live
   image. It is immutable after launch, and nothing recovers a dead link.
7. `launch.js` refuses a mainnet send unless `I_UNDERSTAND_NO_BACKSIES=yes`. The
   guard is there because none of this is reversible — there is no admin key.

## Disclaimer

$NOBACKSIES does not exist yet. This repository is a configuration and a concept
page, not an offer to buy anything. Memecoins are speculative and most go to zero.
Jarold is a cartoon, not financial advice.
