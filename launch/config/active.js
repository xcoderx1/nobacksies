/**
 * Picks the config the scripts run against.
 *
 *   NOBACKSIES_CONFIG=devnet   -> nobacksies.devnet.config.js
 *   anything else / unset      -> nobacksies.config.js  (mainnet shape)
 *
 * One switch, so a devnet rehearsal cannot accidentally run the mainnet curve
 * or the other way round.
 */
const DEVNET = process.env.NOBACKSIES_CONFIG === 'devnet'

const mod = DEVNET
  ? await import('./nobacksies.devnet.config.js')
  : await import('./nobacksies.config.js')

export const IS_DEVNET_CONFIG = DEVNET
export const CONFIG_NAME = DEVNET ? 'devnet' : 'mainnet'
export const CURVE = mod.CURVE
export const TOKEN = mod.TOKEN
export const QUOTE_MINT = mod.QUOTE_MINT
export const LEFTOVER_RECEIVER = mod.LEFTOVER_RECEIVER
export const VALIDATION_PLACEHOLDER_RECEIVER = mod.VALIDATION_PLACEHOLDER_RECEIVER
export const FEE_CLAIMER_DEFAULT = mod.FEE_CLAIMER_DEFAULT ?? null
