/**
 * Creates the $NOBACKSIES config + bonding-curve pool in one transaction.
 *
 * Defaults to --dry-run (build + simulate, send nothing). Defaults to devnet.
 * Sending against mainnet additionally requires I_UNDERSTAND_NO_BACKSIES=yes
 * in the environment, because every switch this config sets is irreversible:
 * immutable authorities, 100% permanently locked LP, compounding fee mode.
 * There is no admin key that can undo any of it afterwards.
 *
 *   node src/launch.js                 # simulate on devnet
 *   node src/launch.js --send          # really create it on devnet
 *   RPC_URL=<mainnet> node src/launch.js --send
 */
import { readFileSync } from 'node:fs'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk'
import 'dotenv/config'
import { buildConfig } from './build-config.js'
import { TOKEN, QUOTE_MINT, LEFTOVER_RECEIVER } from '../config/nobacksies.config.js'

const RPC_URL = process.env.RPC_URL ?? 'https://api.devnet.solana.com'
const IS_MAINNET = /mainnet|helius|quiknode|triton/i.test(RPC_URL) && !/devnet/i.test(RPC_URL)
const SEND = process.argv.includes('--send')

function loadKeypair() {
  const path = process.env.KEYPAIR_PATH
  if (!path) throw new Error('KEYPAIR_PATH is not set (path to a solana keypair json)')
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, 'utf8'))))
}

function preflight() {
  const stop = []
  if (!TOKEN.uri) stop.push('TOKEN.uri is empty — the token would mint with no image or metadata')
  if (!LEFTOVER_RECEIVER) stop.push('LEFTOVER_RECEIVER is not set')
  if (SEND && IS_MAINNET && process.env.I_UNDERSTAND_NO_BACKSIES !== 'yes') {
    stop.push(
      'mainnet send blocked. This config is irreversible: immutable authorities, ' +
        '100% permanently locked LP, compounding fees. Nothing here can be undone ' +
        'later, including by you. Set I_UNDERSTAND_NO_BACKSIES=yes to proceed.',
    )
  }
  if (stop.length) {
    for (const s of stop) console.error(`  ✗ ${s}`)
    process.exit(1)
  }
}

async function main() {
  preflight()

  const payer = loadKeypair()
  const connection = new Connection(RPC_URL, 'confirmed')
  const client = DynamicBondingCurveClient.create(connection, 'confirmed')

  const configParams = buildConfig(LEFTOVER_RECEIVER)
  const configKp = Keypair.generate()
  const baseMintKp = Keypair.generate()

  console.log(`\n  cluster      ${IS_MAINNET ? 'MAINNET' : 'devnet'}  (${RPC_URL})`)
  console.log(`  payer        ${payer.publicKey.toBase58()}`)
  console.log(`  config       ${configKp.publicKey.toBase58()}`)
  console.log(`  base mint    ${baseMintKp.publicKey.toBase58()}`)
  console.log(`  quote mint   ${QUOTE_MINT}`)
  console.log(`  mode         ${SEND ? 'SEND' : 'dry-run (simulate only)'}\n`)

  const balance = await connection.getBalance(payer.publicKey)
  console.log(`  payer balance ${(balance / 1e9).toFixed(4)} SOL`)
  if (balance === 0) {
    console.error('  ✗ payer has no SOL')
    process.exit(1)
  }

  const tx = await client.partner.createConfigAndPool({
    ...configParams,
    config: configKp.publicKey,
    feeClaimer: new PublicKey(process.env.FEE_CLAIMER ?? payer.publicKey),
    leftoverReceiver: new PublicKey(LEFTOVER_RECEIVER),
    quoteMint: new PublicKey(QUOTE_MINT),
    payer: payer.publicKey,
    preCreatePoolParam: {
      name: TOKEN.name,
      symbol: TOKEN.symbol,
      uri: TOKEN.uri,
      poolCreator: payer.publicKey,
      baseMint: baseMintKp.publicKey,
    },
  })

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.feePayer = payer.publicKey

  // Sign with whichever of our keypairs the transaction actually asks for,
  // rather than assuming the signer set.
  const needed = tx.signatures.map((s) => s.publicKey.toBase58())
  const have = new Map(
    [payer, configKp, baseMintKp].map((kp) => [kp.publicKey.toBase58(), kp]),
  )
  const missing = needed.filter((k) => !have.has(k))
  if (missing.length) {
    console.error(`  ✗ transaction wants signatures we do not hold: ${missing.join(', ')}`)
    process.exit(1)
  }
  tx.sign(...needed.map((k) => have.get(k)))

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

  const sig = await connection.sendRawTransaction(tx.serialize())
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
  const cluster = IS_MAINNET ? '' : '?cluster=devnet'
  console.log(`  ✓ live: https://solscan.io/tx/${sig}${cluster}`)
  console.log(`\n  config     ${configKp.publicKey.toBase58()}`)
  console.log(`  base mint  ${baseMintKp.publicKey.toBase58()}`)
  console.log('\n  Save those two addresses. There is no admin key to recover them with.\n')
}

main().catch((e) => {
  console.error(`\n  ✗ ${e.message}\n`)
  process.exit(1)
})
