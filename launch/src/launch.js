/**
 * Creates the $NOBACKSIES config + bonding-curve pool in one transaction.
 *
 * Defaults to --dry-run (build + simulate, send nothing). The cluster is
 * determined by genesis hash, not by guessing at the RPC URL, and anything
 * not provably devnet is treated as mainnet.
 *
 * Sending to mainnet additionally requires --mainnet AND
 * I_UNDERSTAND_NO_BACKSIES=yes, because every switch this config sets is
 * irreversible: immutable authorities, 100% permanently locked LP, compounding
 * fee mode, and a fee_claimer that can never be changed. There is no admin key.
 *
 *   node src/launch.js                        # simulate (cluster auto-detected)
 *   node src/launch.js --send                 # create it, devnet only
 *   node src/launch.js --mainnet --send       # mainnet, needs the env ack too
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
} from '@solana/web3.js'
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk'
import 'dotenv/config'
import { buildConfig } from './build-config.js'
import { TOKEN, QUOTE_MINT, LEFTOVER_RECEIVER, FEE_CLAIMER_DEFAULT, CONFIG_NAME } from '../config/active.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const KEYS_DIR = join(HERE, '..', '.keys')

// Genesis hashes are the only authoritative cluster identity. A URL substring
// is not: https://solana-rpc.publicnode.com serves mainnet-beta and contains
// none of the strings an allowlist would look for.
const GENESIS = {
  '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d': 'mainnet-beta',
  EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG: 'devnet',
  '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY': 'testnet',
}

const RPC_URL = process.env.RPC_URL ?? 'https://api.devnet.solana.com'
const SEND = process.argv.includes('--send')
const MAINNET_FLAG = process.argv.includes('--mainnet')
const LEGACY_TX_LIMIT = 1232

const env = (k) => {
  const v = process.env[k]
  // dotenv sets "" for a bare `KEY=` line, and ?? does not catch that.
  return v && v.trim() ? v.trim() : null
}

/**
 * Load a keypair from disk, generating and persisting it on first use. The base
 * mint IS the token's identity and the config address IS the pool's; if these
 * were regenerated per run, a retry after an ambiguous failure would mint a
 * second immutable $NOBACKSIES instead of resending the first.
 */
function stableKeypair(name) {
  const path = join(KEYS_DIR, `${name}.json`)
  if (existsSync(path)) {
    return {
      kp: Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, 'utf8')))),
      reused: true,
      path,
    }
  }
  const kp = Keypair.generate()
  mkdirSync(KEYS_DIR, { recursive: true })
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 })
  return { kp, reused: false, path }
}

function loadPayer() {
  const path = env('KEYPAIR_PATH')
  if (!path) throw new Error('KEYPAIR_PATH is not set (path to a solana keypair json)')
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, 'utf8'))))
}

async function detectCluster(connection) {
  const hash = await connection.getGenesisHash()
  return { hash, name: GENESIS[hash] ?? 'unknown' }
}

function preflight(cluster) {
  const stop = []
  if (!TOKEN.uri) stop.push('TOKEN.uri is empty — the token would mint with no image or metadata')
  if (!LEFTOVER_RECEIVER) stop.push('LEFTOVER_RECEIVER is not set')
  // feeClaimer is burned into an immutable config and does TWO jobs:
  //   1. it is the only address that can claim curve-phase trading fees, and
  //   2. the DBC program assigns it ownership of the migrated DAMM v2 LP
  //      position NFT -- verified on mainnet migration 48YvT8fe..., where the
  //      position NFT account's owner equalled the config's feeClaimer exactly.
  // So this key permanently controls ALL post-graduation income. It cannot be
  // changed afterwards and nothing can recover it. Use a hardware wallet or a
  // multisig, never a hot key on a laptop.
  // On devnet this falls back to the Squads vault from scripts/squads-devnet.ts,
  // because testing the PDA-signing path IS the gate. On mainnet there is no
  // fallback: it must be set deliberately.
  if (!env('FEE_CLAIMER') && !FEE_CLAIMER_DEFAULT) {
    stop.push(
      'FEE_CLAIMER is not set. It is written into the immutable config and is the ' +
        'only address that can ever claim bonding-curve trading fees. Set it ' +
        'deliberately — to an address nobody can sign for if you mean the fees to ' +
        'be unclaimable.',
    )
  }
  if (CONFIG_NAME === 'devnet' && cluster.name !== 'devnet') {
    stop.push(`config is the devnet one (threshold ~1 SOL) but the cluster is ${cluster.name}. Refusing.`)
  }
  if (CONFIG_NAME === 'mainnet' && cluster.name === 'devnet' && SEND) {
    stop.push('cluster is devnet but the MAINNET config is loaded. Set NOBACKSIES_CONFIG=devnet to rehearse.')
  }
  if (SEND && cluster.name !== 'devnet') {
    // Fail closed: unknown counts as mainnet.
    if (!MAINNET_FLAG) {
      stop.push(
        `cluster is ${cluster.name} (genesis ${cluster.hash}), not devnet. ` +
          'Pass --mainnet to send here.',
      )
    }
    if (process.env.I_UNDERSTAND_NO_BACKSIES !== 'yes') {
      stop.push(
        'This config is irreversible: immutable authorities, 100% permanently ' +
          'locked LP, compounding fees, frozen fee_claimer. Nothing here can be ' +
          'undone later, including by you. Set I_UNDERSTAND_NO_BACKSIES=yes.',
      )
    }
  }
  if (stop.length) {
    for (const s of stop) console.error(`  ✗ ${s}`)
    process.exit(1)
  }
}

async function priorityFee(connection, keys) {
  try {
    const recent = await connection.getRecentPrioritizationFees({ lockedWritableAccounts: keys })
    const fees = recent.map((r) => r.prioritizationFee).filter((f) => f > 0).sort((a, b) => a - b)
    if (!fees.length) return 10_000
    // 75th percentile, floored so the tx is never priced at zero.
    return Math.max(10_000, fees[Math.floor(fees.length * 0.75)])
  } catch {
    return 10_000
  }
}

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed')
  const cluster = await detectCluster(connection)
  preflight(cluster)

  const payer = loadPayer()
  const client = DynamicBondingCurveClient.create(connection, 'confirmed')
  const configParams = buildConfig(LEFTOVER_RECEIVER)

  const config = stableKeypair('config')
  const baseMint = stableKeypair('base-mint')
  const feeClaimerStr = env('FEE_CLAIMER') ?? FEE_CLAIMER_DEFAULT
  const feeClaimer = new PublicKey(feeClaimerStr)

  console.log(`\n  config       ${CONFIG_NAME}`)
  console.log(`  cluster      ${cluster.name}  (${RPC_URL})`)
  console.log(`  genesis      ${cluster.hash}`)
  console.log(`  payer        ${payer.publicKey.toBase58()}`)
  console.log(`  config       ${config.kp.publicKey.toBase58()}  ${config.reused ? '(reused from .keys)' : '(new, saved to .keys)'}`)
  console.log(`  base mint    ${baseMint.kp.publicKey.toBase58()}  ${baseMint.reused ? '(reused from .keys)' : '(new, saved to .keys)'}`)
  console.log(`  quote mint   ${QUOTE_MINT}`)
  console.log(`  fee claimer  ${feeClaimer.toBase58()}${env('FEE_CLAIMER') ? '' : '  (Squads vault)'}`)
  if (feeClaimer.equals(payer.publicKey)) {
    console.log('')
    console.log('  \u26a0  FEE_CLAIMER is the same key as the payer.')
    console.log('     This key will permanently own the migrated LP position and all')
    console.log('     post-graduation fee income. It can never be changed. If you lose')
    console.log('     it, that income is gone forever. Use a hardware wallet or multisig.')
  }
  console.log(`  mode         ${SEND ? 'SEND' : 'dry-run (simulate only)'}\n`)

  // If the config account already exists, the launch already happened. Resending
  // would fail anyway, but say so clearly rather than letting it look like a
  // fresh attempt.
  const existing = await connection.getAccountInfo(config.kp.publicKey)
  if (existing) {
    console.log('  ✓ this config already exists on chain — the launch has already run.')
    console.log(`    config    ${config.kp.publicKey.toBase58()}`)
    console.log(`    base mint ${baseMint.kp.publicKey.toBase58()}\n`)
    return
  }

  const balance = await connection.getBalance(payer.publicKey)
  console.log(`  payer balance ${(balance / 1e9).toFixed(4)} SOL`)
  if (balance === 0) {
    console.error('  ✗ payer has no SOL')
    process.exit(1)
  }

  const tx = await client.partner.createConfigAndPool({
    ...configParams,
    config: config.kp.publicKey,
    feeClaimer,
    leftoverReceiver: new PublicKey(LEFTOVER_RECEIVER),
    quoteMint: new PublicKey(QUOTE_MINT),
    payer: payer.publicKey,
    preCreatePoolParam: {
      name: TOKEN.name,
      symbol: TOKEN.symbol,
      uri: TOKEN.uri,
      poolCreator: payer.publicKey,
      baseMint: baseMint.kp.publicKey,
    },
  })

  // The SDK adds no compute budget instructions. Without a unit price the
  // transaction is scheduled last by every leader and can simply never land.
  const writable = tx.instructions
    .flatMap((ix) => ix.keys.filter((k) => k.isWritable).map((k) => k.pubkey))
    .slice(0, 16)
  const microLamports = await priorityFee(connection, writable.map((k) => k.toBase58()))
  tx.instructions.unshift(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
  )
  console.log(`  priority fee  ${microLamports} microLamports/CU`)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.feePayer = payer.publicKey

  // Sign explicitly. tx.signatures is EMPTY until the transaction is compiled,
  // so deriving the signer set from it yields [] and tx.sign() then throws
  // "No signers". All three of these are required signers for
  // create_config + initialize_virtual_pool_with_spl_token.
  tx.sign(payer, config.kp, baseMint.kp)

  // Legacy transactions cap at 1232 bytes and this one is close, mostly because
  // of TOKEN.uri. Measure it rather than trusting a character limit.
  const size = tx.serialize().length
  console.log(`  tx size       ${size} / ${LEGACY_TX_LIMIT} bytes`)
  if (size > LEGACY_TX_LIMIT) {
    console.error(
      `  ✗ transaction is ${size - LEGACY_TX_LIMIT} bytes over the legacy limit. ` +
        `Shorten TOKEN.uri (currently ${TOKEN.uri.length} chars) — ` +
        'https://arweave.net/<43-char-txid> is the shortest usable form.',
    )
    process.exit(1)
  }

  const sim = await connection.simulateTransaction(tx)
  if (sim.value.err) {
    console.error(`\n  ✗ simulation failed: ${JSON.stringify(sim.value.err)}`)
    for (const l of sim.value.logs ?? []) console.error(`    ${l}`)
    process.exit(1)
  }
  console.log(`  ✓ simulation ok (${sim.value.unitsConsumed} CU)\n`)

  if (!SEND) {
    console.log('  dry run — nothing sent. Re-run with --send to create it.\n')
    return
  }

  const sig = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 5 })
  console.log(`  sent ${sig}`)
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')

  const suffix = cluster.name === 'mainnet-beta' ? '' : `?cluster=${cluster.name}`
  console.log(`  ✓ confirmed: https://solscan.io/tx/${sig}${suffix}`)

  // Read the config back and assert the irreversible fields actually landed as
  // intended. A launch that lands with a wrong value is otherwise
  // indistinguishable from a correct one.
  const onChain = await client.state.getPoolConfig(config.kp.publicKey)
  const checks = [
    ['fee claimer', onChain.feeClaimer.toBase58(), feeClaimer.toBase58()],
    ['leftover receiver', onChain.leftoverReceiver.toBase58(), new PublicKey(LEFTOVER_RECEIVER).toBase58()],
    ['token update authority', onChain.tokenUpdateAuthority, 1],
    ['partner locked LP %', onChain.partnerLockedLpPercentage ?? onChain.partnerPermanentLockedLiquidityPercentage, 100],
    ['migrated collect fee mode', onChain.migratedPoolFee?.collectFeeMode, 2],
    ['migration fee %', onChain.migrationFeePercentage ?? onChain.migrationFee?.feePercentage, 0],
  ]
  console.log('\n  on-chain readback:')
  let bad = 0
  for (const [label, got, want] of checks) {
    const ok = String(got) === String(want)
    if (!ok) bad++
    console.log(`    ${ok ? '✓' : '✗'} ${label.padEnd(26)} ${got} ${ok ? '' : `(expected ${want})`}`)
  }
  if (bad) {
    console.error(`\n  ✗ ${bad} field(s) did not land as intended. Do NOT publish the site.\n`)
    process.exit(1)
  }

  console.log(`\n  config     ${config.kp.publicKey.toBase58()}`)
  console.log(`  base mint  ${baseMint.kp.publicKey.toBase58()}`)
  console.log(`  keys saved in ${KEYS_DIR} (gitignored)\n`)
}

main().catch((e) => {
  console.error(`\n  ✗ ${e.message}`)
  if (e instanceof SendTransactionError && e.logs) {
    for (const l of e.logs) console.error(`    ${l}`)
  }
  if (e.signature) console.error(`    signature: ${e.signature}`)
  console.error('')
  process.exit(1)
})
