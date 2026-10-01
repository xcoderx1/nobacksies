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
- **`compoundingFeeBps` semantics are unverified.** The SDK only range-checks the
  field and passes it to the on-chain program. What split `10000` actually encodes
  is not provable from the SDK, so the devnet run is what confirms it. Do not
  advertise a specific number until it has been observed on devnet.
- **The fee decay is time-based, not trade-based.** `BaseFeeMode.RateLimiter` is
  the amount-based variant and it is marked deprecated — "New configs and pools
  cannot use RateLimiter." A sniper who waits an hour pays 1% like everyone else.
- **Locked liquidity is not a price floor.** A deeper pool absorbs a dump with less
  price impact. It does not prevent one.
- **The simulator on the landing page is a toy.** Its assumptions are listed in the
  page footer. It is not the SDK's curve math and should not be read as a forecast.

## Before mainnet

1. `npm run build:config` passes with no `✗` and no `○`.
2. Metadata json uploaded, `TOKEN.uri` set. It is immutable after launch.
3. `npm run launch:devnet -- --send` on devnet, then trade through the curve to
   graduation and confirm with an explorer that the migrated pool really is in
   compounding mode and that the LP position has no withdraw authority.
4. Decide who `FEE_CLAIMER` is and say so publicly before launch, not after.
5. `launch.js` refuses a mainnet send unless `I_UNDERSTAND_NO_BACKSIES=yes`. The
   guard is there because none of this is reversible — there is no admin key.

## Disclaimer

$NOBACKSIES does not exist yet. This repository is a configuration and a concept
page, not an offer to buy anything. Memecoins are speculative and most go to zero.
Jarold is a cartoon, not financial advice.
