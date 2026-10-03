/**
 * Creates a 2-of-3 Squads v4 multisig on DEVNET and prints its vault address.
 *
 * The vault is what goes in as FEE_CLAIMER for the devnet gate. That address is
 * a PDA, and a PDA signs by having the Squads program invoke cp-amm on its
 * behalf -- a different code path from the ordinary keypair we verified on
 * mainnet. Proving that path works is the whole point of the gate.
 *
 * Program ID verified on chain, not from docs:
 *   SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf
 *   executable and owned by BPFLoaderUpgradeable on BOTH devnet and mainnet.
 * The ProgramConfig PDA BSTq9w3kZwNwpBXJEvTZz2G9ZTNyKBvoSeXMvwb4cNZr exists on
 * both, but its treasury DIFFERS per cluster, so the treasury is read from chain
 * rather than hardcoded.
 *
 *   node scripts/squads-devnet.ts            # show what it would do
 *   node scripts/squads-devnet.ts --create   # actually create it
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'

const HERE = dirname(fileURLToPath(import.meta.url))
const KEYS = join(HERE, '..', '.keys')
const OUT = join(KEYS, 'squads-devnet.json')

const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const RPC = process.env.RPC_URL ?? 'https://api.devnet.solana.com'
const CREATE = process.argv.includes('--create')

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, 'utf8'))))
}

/** A member we hold the key for. Devnet only -- see the warning below. */
function localMember(name: string): Keypair {
  const p = join(KEYS, `${name}.json`)
  if (existsSync(p)) return loadKeypair(p)
  const kp = Keypair.generate()
  mkdirSync(KEYS, { recursive: true })
  writeFileSync(p, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 })
  return kp
}

async function main() {
  const connection = new Connection(RPC, 'confirmed')

  // Fail closed: this script must never touch mainnet.
  const genesis = await connection.getGenesisHash()
  if (genesis !== DEVNET_GENESIS) {
    console.error(`\n  ✗ ${RPC} is not devnet (genesis ${genesis}).`)
    console.error('    This script is devnet-only by design. Use the Squads app for a real multisig.\n')
    process.exit(1)
  }

  if (existsSync(OUT)) {
    const saved = JSON.parse(readFileSync(OUT, 'utf8'))
    console.log('\n  A devnet multisig already exists for this project.\n')
    console.log(`  multisig   ${saved.multisigPda}`)
    console.log(`  VAULT      ${saved.vaultPda}   ← this is your FEE_CLAIMER`)
    console.log(`  threshold  ${saved.threshold} of ${saved.members.length}`)
    console.log(`\n  Delete ${OUT} to create a different one.\n`)
    return
  }

  const keypairPath = process.env.KEYPAIR_PATH
  if (!keypairPath) throw new Error('KEYPAIR_PATH is not set (path to a funded devnet keypair json)')
  const creator = loadKeypair(keypairPath)

  // Members 2 and 3. Pass real pubkeys via env to keep keys off this machine;
  // otherwise they are generated here so the gate can actually approve and
  // execute, which needs 2 of the 3 signatures.
  const envB = process.env.SQUADS_MEMBER_2
  const envC = process.env.SQUADS_MEMBER_3
  const localB = envB ? null : localMember('squads-member-2')
  const localC = envC ? null : localMember('squads-member-3')
  const memberB = envB ? new PublicKey(envB) : localB!.publicKey
  const memberC = envC ? new PublicKey(envC) : localC!.publicKey

  const createKey = Keypair.generate()
  const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey })
  const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 })

  // The treasury is cluster-specific; read it rather than assuming.
  const [programConfigPda] = multisig.getProgramConfigPda({})
  const cfgInfo = await connection.getAccountInfo(programConfigPda, 'confirmed')
  if (!cfgInfo) throw new Error(`Squads ProgramConfig ${programConfigPda.toBase58()} not found on this cluster`)
  const programConfig = multisig.accounts.ProgramConfig.fromAccountInfo(cfgInfo)[0]

  const balance = await connection.getBalance(creator.publicKey)
  const all = multisig.types.Permissions.all()
  const members = [
    { key: creator.publicKey, permissions: all },
    { key: memberB, permissions: all },
    { key: memberC, permissions: all },
  ]

  console.log(`\n  cluster      devnet (${RPC})`)
  console.log(`  squads       ${multisig.PROGRAM_ID.toBase58()}`)
  console.log(`  treasury     ${programConfig.treasury.toBase58()} (read from chain)`)
  console.log(`  creation fee ${programConfig.multisigCreationFee.toString()} lamports`)
  console.log(`  payer        ${creator.publicKey.toBase58()}  ${(balance / 1e9).toFixed(4)} SOL`)
  console.log('\n  members (2 of 3):')
  console.log(`    1  ${creator.publicKey.toBase58()}  (your KEYPAIR_PATH)`)
  console.log(`    2  ${memberB.toBase58()}  ${envB ? '(from SQUADS_MEMBER_2)' : '(generated, key in .keys/)'}`)
  console.log(`    3  ${memberC.toBase58()}  ${envC ? '(from SQUADS_MEMBER_3)' : '(generated, key in .keys/)'}`)
  console.log(`\n  multisig     ${multisigPda.toBase58()}`)
  console.log(`  VAULT        ${vaultPda.toBase58()}   ← this becomes FEE_CLAIMER`)

  if (!localB || !localC) {
    // only partially local
  } else {
    console.log('\n  ⚠  Members 2 and 3 were generated on this machine, so all three keys')
    console.log('     live in .keys/. That is fine for a devnet test, where you need to')
    console.log('     approve and execute yourself. It is NOT a multisig in any meaningful')
    console.log('     sense. For mainnet, create the Squads from the Squads app with keys')
    console.log('     held on separate devices by separate people.')
  }

  if (!CREATE) {
    console.log('\n  dry run — nothing sent. Re-run with --create to create it.\n')
    return
  }
  if (balance === 0) {
    console.error('\n  ✗ payer has no devnet SOL. Run: solana airdrop 2 -u devnet\n')
    process.exit(1)
  }

  const sig = await multisig.rpc.multisigCreateV2({
    connection,
    treasury: programConfig.treasury,
    createKey,
    creator,
    multisigPda,
    configAuthority: null, // autonomous: the members govern it, nobody else
    threshold: 2,
    members,
    timeLock: 0,
    rentCollector: null,
    memo: 'NOBACKSIES devnet gate',
  })
  await connection.confirmTransaction(sig, 'confirmed')

  mkdirSync(KEYS, { recursive: true })
  writeFileSync(OUT, JSON.stringify({
    cluster: 'devnet',
    programId: multisig.PROGRAM_ID.toBase58(),
    createKey: createKey.publicKey.toBase58(),
    multisigPda: multisigPda.toBase58(),
    vaultPda: vaultPda.toBase58(),
    threshold: 2,
    members: members.map((m) => m.key.toBase58()),
    signature: sig,
  }, null, 2))

  console.log(`\n  ✓ created: https://solscan.io/tx/${sig}?cluster=devnet`)
  console.log(`  saved to ${OUT}`)
  console.log(`\n  Set this in launch/.env:\n    FEE_CLAIMER=${vaultPda.toBase58()}\n`)
}

main().catch((e) => {
  console.error(`\n  ✗ ${e.message}\n`)
  process.exit(1)
})
