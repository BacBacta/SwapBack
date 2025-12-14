// Test script for direct Orca Whirlpool swap via SwapBack Router
// Uses Anchor SDK for proper instruction serialization

import { Connection, PublicKey, Keypair, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, getAccount } from '@solana/spl-token';
import anchor from '@coral-xyz/anchor';
const { Program, AnchorProvider, BN, Wallet } = anchor;
import * as fs from 'fs';

// Load IDL
const idl = JSON.parse(fs.readFileSync('/workspaces/SwapBack/target/idl/swapback_router.json', 'utf-8'));

// Constants
const ORCA_WHIRLPOOL_PROGRAM = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');
const SWAPBACK_ROUTER = new PublicKey('APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN');

// SOL/USDC Pool (most liquid, tickSpacing=4, TVL=$32M)
const SOL_USDC_POOL = new PublicKey('Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE');

// Mints
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Pyth Push Feed Oracles (Pyth Receiver program)
const SOL_USD_ORACLE = new PublicKey('7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE');
const USDC_USD_ORACLE = new PublicKey('Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX');

async function main() {
  console.log('=== SwapBack Direct Orca Whirlpool Swap Test ===');
  console.log('');
  
  // Load wallet
  const walletPath = '/workspaces/SwapBack/mainnet-deploy-keypair.json';
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );
  console.log('Wallet:', walletKeypair.publicKey.toBase58());
  
  // Connect to mainnet
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  
  // Create Anchor provider and program
  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const program = new Program(idl, provider);
  
  console.log('Program ID:', program.programId.toBase58());
  
  // Pool data
  const poolInfo = await connection.getAccountInfo(SOL_USDC_POOL);
  if (!poolInfo) throw new Error('Pool not found');
  
  const tickSpacing = poolInfo.data.readUInt16LE(41);
  const tickCurrentIndex = poolInfo.data.readInt32LE(81);
  
  console.log('Pool:', SOL_USDC_POOL.toBase58());
  console.log('Current tick:', tickCurrentIndex);
  console.log('Tick spacing:', tickSpacing);
  
  // Parse pool vaults from data (these are ORCA vaults, for remaining_accounts)
  // Correct offsets: mint_a at 101, vault_a at 133, mint_b at 181, vault_b at 213
  const orcaVaultA = new PublicKey(poolInfo.data.slice(133, 165));
  const orcaVaultB = new PublicKey(poolInfo.data.slice(213, 245));
  
  console.log('Orca VaultA:', orcaVaultA.toBase58());
  console.log('Orca VaultB:', orcaVaultB.toBase58());
  
  // Router vaults (ATAs of routerState)
  const routerWsolVault = new PublicKey('BSVsRmHChmtm7XSBKtVXusykGNvxnXnY68jesM5yEHft');
  const routerUsdcVault = new PublicKey('5cybd6H8UJKqgs5CrGEcn9nYJHq4xcAcHQ6tpPDKWmRn');
  
  console.log('Router wSOL vault:', routerWsolVault.toBase58());
  console.log('Router USDC vault:', routerUsdcVault.toBase58());
  
  // Tick arrays for a_to_b = true (tick decreases)
  const ticksInArray = 88 * tickSpacing;
  const currentArrayIndex = Math.floor(tickCurrentIndex / ticksInArray);
  
  const startTicks = [
    currentArrayIndex * ticksInArray,
    (currentArrayIndex - 1) * ticksInArray,
    (currentArrayIndex - 2) * ticksInArray
  ];
  
  const tickArrayPdas = startTicks.map(startTick => {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('tick_array'),
        SOL_USDC_POOL.toBuffer(),
        Buffer.from(startTick.toString())
      ],
      ORCA_WHIRLPOOL_PROGRAM
    );
    return { startTick, pda };
  });
  
  console.log('');
  console.log('Tick arrays:');
  tickArrayPdas.forEach((ta, i) => {
    console.log(`  tickArray${i}: ${ta.pda.toBase58()}`);
  });
  
  // Orca Oracle PDA
  const [orcaOracle] = PublicKey.findProgramAddressSync(
    [Buffer.from('oracle'), SOL_USDC_POOL.toBuffer()],
    ORCA_WHIRLPOOL_PROGRAM
  );
  
  // User token accounts
  const userWsolAta = await getAssociatedTokenAddress(WSOL_MINT, walletKeypair.publicKey);
  const userUsdcAta = await getAssociatedTokenAddress(USDC_MINT, walletKeypair.publicKey);
  
  console.log('');
  console.log('User accounts:');
  console.log('  wSOL:', userWsolAta.toBase58());
  console.log('  USDC:', userUsdcAta.toBase58());
  
  // Check wSOL balance
  try {
    const wsolAccount = await getAccount(connection, userWsolAta);
    console.log('  wSOL balance:', Number(wsolAccount.amount) / 1e9);
  } catch {
    throw new Error('User wSOL account not found');
  }
  
  // Router state PDA
  const [routerState] = PublicKey.findProgramAddressSync(
    [Buffer.from('router_state')],
    SWAPBACK_ROUTER
  );
  
  // Rebate vault PDA
  const [rebateVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('rebate_vault'), routerState.toBuffer()],
    SWAPBACK_ROUTER
  );
  
  // Oracle cache PDA
  const [oracleCache] = PublicKey.findProgramAddressSync(
    [Buffer.from('oracle_cache'), SOL_USD_ORACLE.toBuffer()],
    SWAPBACK_ROUTER
  );
  
  // Venue score PDA
  const [venueScore] = PublicKey.findProgramAddressSync(
    [Buffer.from('venue_score'), routerState.toBuffer()],
    SWAPBACK_ROUTER
  );
  
  console.log('');
  console.log('PDAs:');
  console.log('  routerState:', routerState.toBase58());
  console.log('  rebateVault:', rebateVault.toBase58());
  
  // Build SwapArgs
  const swapArgs = {
    amountIn: new BN(1_000_000),  // 0.001 wSOL
    minOut: new BN(1),  // Minimum 1 unit (required > 0)
    slippageTolerance: 100,  // 1% - now with proper decimal handling
    twapSlices: null,
    useDynamicPlan: false,
    planAccount: null,
    useBundle: false,
    primaryOracleAccount: SOL_USD_ORACLE,
    fallbackOracleAccount: null,  // No fallback oracle - single source
    directDexVenue: ORCA_WHIRLPOOL_PROGRAM,  // Direct Orca swap!
    jupiterRoute: null,
    jupiterSwapIxData: null,
    liquidityEstimate: null,
    volatilityBps: null,
    minVenueScore: null,
    slippagePerVenue: null,
    tokenADecimals: 9,  // SOL
    tokenBDecimals: 6,  // USDC
    maxStalenessOverride: null,
    jitoBundle: null,
  };
  
  console.log('');
  console.log('SwapArgs:');
  console.log('  amountIn:', swapArgs.amountIn.toString(), 'lamports (0.001 SOL)');
  console.log('  directDexVenue:', swapArgs.directDexVenue.toBase58());
  
  // Build the instruction using Anchor
  console.log('');
  console.log('Building instruction...');
  
  const ix = await program.methods
    .swapToc(swapArgs)
    .accounts({
      state: routerState,
      user: walletKeypair.publicKey,
      primaryOracle: SOL_USD_ORACLE,
      fallbackOracle: null,  // No fallback - SOL/USD is single source
      userTokenAccountA: userWsolAta,
      userTokenAccountB: userUsdcAta,
      vaultTokenAccountA: routerWsolVault,
      vaultTokenAccountB: routerUsdcVault,
      plan: null,
      userNft: null,
      buybackProgram: null,
      buybackUsdcVault: null,
      buybackState: null,
      userRebateAccount: null,
      userRebate: null,
      rebateVault: rebateVault,
      oracleCache: null,  // Optional, skip
      venueScore: null,   // Optional, skip
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: PublicKey.default,
    })
    .remainingAccounts([
      // Orca CPI accounts - order from Orca SDK:
      // 0: tokenProgram
      // 1: tokenAuthority (user/signer)
      // 2: whirlpool
      // 3: tokenOwnerAccountA (user wSOL ATA)
      // 4: tokenVaultA (pool vault)
      // 5: tokenOwnerAccountB (user USDC ATA)
      // 6: tokenVaultB (pool vault)
      // 7-9: tickArrays
      // 10: oracle
      // 11: whirlpool program (for CPI invoke)
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: false },
      { pubkey: SOL_USDC_POOL, isSigner: false, isWritable: true },
      { pubkey: userWsolAta, isSigner: false, isWritable: true },
      { pubkey: orcaVaultA, isSigner: false, isWritable: true },
      { pubkey: userUsdcAta, isSigner: false, isWritable: true },
      { pubkey: orcaVaultB, isSigner: false, isWritable: true },
      { pubkey: tickArrayPdas[0].pda, isSigner: false, isWritable: true },
      { pubkey: tickArrayPdas[1].pda, isSigner: false, isWritable: true },
      { pubkey: tickArrayPdas[2].pda, isSigner: false, isWritable: true },
      { pubkey: orcaOracle, isSigner: false, isWritable: true },
      { pubkey: ORCA_WHIRLPOOL_PROGRAM, isSigner: false, isWritable: false },
    ])
    .instruction();
  
  console.log('Instruction built successfully');
  console.log('Data size:', ix.data.length, 'bytes');
  console.log('Account count:', ix.keys.length);
  
  // Build transaction
  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));
  tx.add(ix);
  
  tx.feePayer = walletKeypair.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  
  console.log('');
  console.log('=== SIMULATING TRANSACTION ===');
  
  const simulation = await connection.simulateTransaction(tx, [walletKeypair]);
  
  console.log('');
  console.log('Simulation result:');
  console.log('  Error:', simulation.value.err);
  console.log('  Units consumed:', simulation.value.unitsConsumed);
  console.log('');
  console.log('Logs:');
  simulation.value.logs?.forEach(log => console.log('  ', log));
  
  if (!simulation.value.err) {
    console.log('');
    console.log('✅ SIMULATION SUCCEEDED!');
    
    // Execute real transaction
    console.log('');
    console.log('=== EXECUTING REAL TRANSACTION ===');
    
    // Get balances before
    const wsolBefore = await connection.getTokenAccountBalance(userWsolAta);
    const usdcBefore = await connection.getTokenAccountBalance(userUsdcAta);
    console.log('Before swap:');
    console.log('  wSOL:', wsolBefore.value.uiAmount);
    console.log('  USDC:', usdcBefore.value.uiAmount);
    
    // Sign and send
    tx.sign(walletKeypair);
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    console.log('');
    console.log('Transaction sent:', signature);
    console.log('Waiting for confirmation...');
    
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');
    
    if (confirmation.value.err) {
      console.log('❌ Transaction failed:', confirmation.value.err);
    } else {
      console.log('✅ Transaction confirmed!');
      console.log('');
      console.log('Explorer: https://solscan.io/tx/' + signature);
      
      // Get balances after
      const wsolAfter = await connection.getTokenAccountBalance(userWsolAta);
      const usdcAfter = await connection.getTokenAccountBalance(userUsdcAta);
      console.log('');
      console.log('After swap:');
      console.log('  wSOL:', wsolAfter.value.uiAmount);
      console.log('  USDC:', usdcAfter.value.uiAmount);
      console.log('');
      console.log('Swapped:', (wsolBefore.value.uiAmount - wsolAfter.value.uiAmount).toFixed(6), 'SOL');
      console.log('Received:', (usdcAfter.value.uiAmount - usdcBefore.value.uiAmount).toFixed(6), 'USDC');
    }
  }
}

main().catch(console.error);
