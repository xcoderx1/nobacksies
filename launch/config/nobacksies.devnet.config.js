/**
 * DEVNET config for the gate. Identical to mainnet in every respect except the
 * scale of the curve, so the thing being tested is the real thing.
 *
 * Everything is spread from the mainnet config rather than copied, so the two
 * cannot drift: permanent lock, Compounding, compoundingFeeBps, the fee
 * schedule, authorities, vesting and migration settings are all the SAME
 * OBJECTS. Only initialMarketCap and migrationMarketCap are overridden, and the
 * ratio between them is kept at 20x so the curve SHAPE is unchanged too.
 *
 *   mainnet   30 -> 600 SOL   graduates on 109.6464 SOL  (121.83 gross)
 *   devnet   0.3 -> 6   SOL   graduates on   1.0965 SOL  (  1.22 gross)
 *
 * FEE_CLAIMER is the Squads vault created by scripts/squads-devnet.ts. It is a
 * PDA, which is the whole point: a PDA signs by CPI, and that path is not the
 * one we verified on mainnet.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CURVE as MAINNET_CURVE, TOKEN as MAINNET_TOKEN, QUOTE_MINT, VALIDATION_PLACEHOLDER_RECEIVER } from './nobacksies.config.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SQUADS = join(HERE, '..', '..', '.keys', 'squads-devnet.json')

export const CURVE = {
  ...MAINNET_CURVE,
  initialMarketCap: 0.3,
  migrationMarketCap: 6,
}

export const TOKEN = {
  ...MAINNET_TOKEN,
  name: 'No Backsies (devnet)',
  symbol: 'NOBAKDEV',
  // Devnet metadata. Still required -- a launch with a dead uri is not a
  // rehearsal of a launch with a live one.
  uri: process.env.TOKEN_URI ?? '',
}

export { QUOTE_MINT, VALIDATION_PLACEHOLDER_RECEIVER }

/** The Squads vault, read from whatever scripts/squads-devnet.ts created. */
export function squadsVault() {
  if (!existsSync(SQUADS)) return null
  try { return JSON.parse(readFileSync(SQUADS, 'utf8')).vaultPda ?? null } catch { return null }
}

// On devnet both of these default to the Squads vault: the fee claimer because
// that is what the gate exists to test, and the leftover receiver because it
// must be a real non-default address and the vault is one we control.
export const FEE_CLAIMER_DEFAULT = squadsVault()
export const LEFTOVER_RECEIVER = process.env.LEFTOVER_RECEIVER ?? squadsVault()
