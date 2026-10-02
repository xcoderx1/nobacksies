/**
 * Graduates the $NOBACKSIES bonding curve into its DAMM v2 compounding pool.
 *
 * SDK 1.5.13 exposes client.migration.migrateToDammV2 but has NO
 * createDammV2MigrationMetadata -- only the DAMM v1 variant -- while the program
 * requires migration_damm_v2_create_metadata first. So step 1 is hand-built.
 *
 * The bundled IDL ships that instruction with every signer/writable flag
 * STRIPPED (seven bare account names, no flags), so the layout below was
 * recovered from a real mainnet execution rather than from the IDL:
 *   tx 44mRcFKLszdsJWgS8yRX55hEA64jahaKze85DLzZDqgpWuM8NtRsfwM8iPZmRiHJWRdroS22WcbetpWkvJGxe7Hx
 *
 *   ix data: 8 bytes, discriminator only, no args
 *   0 virtual_pool        w
 *   1 config              r
 *   2 migration_metadata  w     (deriveDammV2MigrationMetadataAddress(pool))
 *   3 payer               w, SIGNER
 *   4 system_program      r
 *   5 event_authority     r     (deriveDbcEventAuthority(), verified to match)
 *   6 program             r     (the DBC program itself)
 *
 *   node src/migrate.js <poolAddress>            # simulate
 *   node src/migrate.js <poolAddress> --send
 */
import { readFileSync } from 'node:fs'
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  DynamicBondingCurveClient,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  DAMM_V2_MIGRATION_FEE_ADDRESS,
  MigrationFeeOption,
  deriveDammV2MigrationMetadataAddress,
  deriveDbcEventAuthority,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import 'dotenv/config'

const CREATE_METADATA_DISCRIMINATOR = Buffer.from([109, 189, 19, 36, 195, 183, 222, 82])
const RPC_URL = process.env.RPC_URL ?? 'https://api.devnet.solana.com'
const SEND = process.argv.includes('--send')
const POOL = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null

/** Hand-built migration_damm_v2_create_metadata. */
export function createDammV2MigrationMetadataIx({ pool, config, payer }) {
  return new TransactionInstruction({
    programId: DYNAMIC_BONDING_CURVE_PROGRAM_ID,
    data: CREATE_METADATA_DISCRIMINATOR,
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: deriveDammV2MigrationMetadataAddress(pool), isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: deriveDbcEventAuthority(), isSigner: false, isWritable: false },
      { pubkey: DYNAMIC_BONDING_CURVE_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
  })
}

async function main() {
  if (!POOL) {
    console.error('\n  usage: node src/migrate.js <poolAddress> [--send]\n')
    process.exit(1)
  }
  const keypairPath = process.env.KEYPAIR_PATH
  if (!keypairPath) throw new Error('KEYPAIR_PATH is not set')
  const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keypairPath, 'utf8'))))

  const connection = new Connection(RPC_URL, 'confirmed')
  const client = DynamicBondingCurveClient.create(connection, 'confirmed')
  const pool = new PublicKey(POOL)

  const poolState = await client.state.getPool(pool)
  if (!poolState) throw new Error(`pool ${POOL} not found on ${RPC_URL}`)
  const config = (poolState.poolState ?? poolState).config

  const threshold = await client.state.getPoolMigrationQuoteThreshold(pool).catch(() => null)
  const progress = await client.state.getPoolQuoteTokenCurveProgress(pool).catch(() => null)
  console.log(`\n  pool       ${pool.toBase58()}`)
  console.log(`  config     ${config.toBase58()}`)
  if (progress != null) console.log(`  progress   ${(Number(progress) * 100).toFixed(2)}% of the curve`)
  if (threshold) console.log(`  threshold  ${Number(threshold.toString(10)) / 1e9} SOL`)

  const metadata = deriveDammV2MigrationMetadataAddress(pool)
  const already = await connection.getAccountInfo(metadata)
  console.log(`  metadata   ${metadata.toBase58()} ${already ? '(exists)' : '(will be created)'}`)

  // The Customizable config is the one that carries our compounding settings.
  const dammConfig = DAMM_V2_MIGRATION_FEE_ADDRESS[MigrationFeeOption.Customizable]
  console.log(`  damm cfg   ${dammConfig.toBase58()} (Customizable)\n`)

  // Step 1 -- create the migration metadata, if it does not exist yet.
  if (!already) {
    const tx = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 120_000 }))
      .add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 }))
      .add(createDammV2MigrationMetadataIx({ pool, config, payer: payer.publicKey }))
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    tx.recentBlockhash = blockhash
    tx.feePayer = payer.publicKey
    tx.sign(payer)

    const sim = await connection.simulateTransaction(tx)
    if (sim.value.err) {
      console.error(`  ✗ create-metadata simulation failed: ${JSON.stringify(sim.value.err)}`)
      for (const l of sim.value.logs ?? []) console.error(`    ${l}`)
      process.exit(1)
    }
    console.log(`  ✓ create-metadata simulates ok (${sim.value.unitsConsumed} CU)`)
    if (SEND) {
      const sig = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 5 })
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
      console.log(`  ✓ metadata created: ${sig}`)
    }
  }

  // Step 2 -- migrate. The SDK builds this one.
  if (!already && !SEND) {
    console.log('\n  dry run: metadata does not exist yet, so the migration itself')
    console.log('  cannot be simulated until step 1 has actually been sent.\n')
    return
  }

  const result = await client.migration.migrateToDammV2({ payer: payer.publicKey, pool, dammConfig })
  const tx2 = result.transaction
  tx2.instructions.unshift(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 }),
  )
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  tx2.recentBlockhash = blockhash
  tx2.feePayer = payer.publicKey
  tx2.sign(payer, result.firstPositionNftKeypair, result.secondPositionNftKeypair)

  const sim2 = await connection.simulateTransaction(tx2)
  if (sim2.value.err) {
    console.error(`\n  ✗ migration simulation failed: ${JSON.stringify(sim2.value.err)}`)
    for (const l of sim2.value.logs ?? []) console.error(`    ${l}`)
    process.exit(1)
  }
  console.log(`  ✓ migration simulates ok (${sim2.value.unitsConsumed} CU)`)

  if (!SEND) {
    console.log('\n  dry run — nothing sent. Re-run with --send to graduate.\n')
    return
  }

  const sig = await connection.sendRawTransaction(tx2.serialize(), { maxRetries: 5 })
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
  console.log(`  ✓ migrated: ${sig}`)
  console.log(`\n  first position NFT mint  ${result.firstPositionNftKeypair.publicKey.toBase58()}`)
  console.log(`  second position NFT mint ${result.secondPositionNftKeypair.publicKey.toBase58()}`)
  console.log('\n  Now verify, against the decoded accounts:')
  console.log('   - the position NFT account owner is your FEE_CLAIMER')
  console.log('   - the migrated pool collect_fee_mode == 2 (Compounding)')
  console.log('   - getUnClaimLpFee on the locked position returns a non-zero accrual after a trade\n')
}

main().catch((e) => {
  console.error(`\n  ✗ ${e.message}`)
  if (e.logs) for (const l of e.logs) console.error(`    ${l}`)
  console.error('')
  process.exit(1)
})
