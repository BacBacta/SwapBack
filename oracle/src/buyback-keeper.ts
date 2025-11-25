/**
 * Buyback Keeper - Automatisation du système de buyback
 * 
 * Fonctionnement:
 * 1. Poll USDC vault balance toutes les heures
 * 2. Si balance ≥ threshold (100 USDC): exécute buyback
 * 3. Fetch quote Jupiter pour USDC → BACK
 * 4. Execute swap transaction via Jupiter
 * 5. Call finalize_buyback() on-chain pour mettre à jour l'état
 * 6. Logs + monitoring avec retry logic et circuit breaker
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// ==== CONFIGURATION ====
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const JUPITER_API = 'https://quote-api.jup.ag/v6';

// Program IDs
const BUYBACK_PROGRAM_ID = new PublicKey('F8S1r81FcTsSBb9vP3jFNuVoTMYNrxaCptbvkzSXcEce'); // Nouveau après upgrade

// Token Mints
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); // Devnet
const BACK_MINT = new PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux'); // Token-2022

// Thresholds
const MIN_BUYBACK_THRESHOLD = 100_000_000; // 100 USDC (6 decimals)
const SLIPPAGE_BPS = 200; // 2% max slippage
const POLLING_INTERVAL_MS = 60 * 60 * 1000; // 1 heure

// Circuit Breaker
const MAX_CONSECUTIVE_FAILURES = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

// ==== STATE ====
let consecutiveFailures = 0;
let circuitBreakerActive = false;
let lastSuccessfulBuyback: Date | null = null;

// ==== HELPERS ====
function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data }),
  };
  
  console.log(JSON.stringify(logEntry));
  
  // TODO: Send to monitoring service (Datadog, Grafana, etc.)
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==== JUPITER INTEGRATION ====
async function fetchJupiterQuote(
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: number
): Promise<any> {
  try {
    log('INFO', 'Fetching Jupiter quote', {
      inputMint: inputMint.toString(),
      outputMint: outputMint.toString(),
      amount,
    });

    const response = await axios.get(`${JUPITER_API}/quote`, {
      params: {
        inputMint: inputMint.toString(),
        outputMint: outputMint.toString(),
        amount: amount.toString(),
        slippageBps: SLIPPAGE_BPS,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
      },
      timeout: 10000, // 10s timeout
    });

    if (!response.data) {
      throw new Error('Empty response from Jupiter API');
    }

    log('INFO', 'Jupiter quote received', {
      inAmount: response.data.inAmount,
      outAmount: response.data.outAmount,
      priceImpactPct: response.data.priceImpactPct,
    });

    return response.data;
  } catch (error: any) {
    log('ERROR', 'Failed to fetch Jupiter quote', {
      error: error.message,
      response: error.response?.data,
    });
    throw error;
  }
}

async function executeJupiterSwap(
  connection: Connection,
  wallet: Keypair,
  quoteResponse: any
): Promise<string> {
  try {
    log('INFO', 'Requesting swap transaction from Jupiter');

    const swapResponse = await axios.post(
      `${JUPITER_API}/swap`,
      {
        quoteResponse,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        computeUnitPriceMicroLamports: 'auto',
      },
      { timeout: 10000 }
    );

    if (!swapResponse.data?.swapTransaction) {
      throw new Error('No swap transaction in response');
    }

    log('INFO', 'Swap transaction received, deserializing');

    // Deserialize transaction
    const swapTransactionBuf = Buffer.from(swapResponse.data.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // Sign transaction
    transaction.sign([wallet]);

    log('INFO', 'Sending swap transaction');

    // Send transaction
    const signature = await connection.sendTransaction(transaction, {
      maxRetries: 3,
      skipPreflight: false,
    });

    log('INFO', 'Swap transaction sent', { signature });

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    log('INFO', 'Swap transaction confirmed', { signature });

    return signature;
  } catch (error: any) {
    log('ERROR', 'Failed to execute Jupiter swap', {
      error: error.message,
      response: error.response?.data,
    });
    throw error;
  }
}

// ==== ON-CHAIN FINALIZATION ====
async function finalizeBuybackOnChain(
  connection: Connection,
  wallet: Keypair,
  usdcSpent: number,
  backReceived: number
): Promise<void> {
  try {
    log('INFO', 'Calling finalize_buyback() on-chain', {
      usdcSpent: usdcSpent / 1e6,
      backReceived: backReceived / 1e9,
    });

    // Load IDL
    const idlPath = path.join(__dirname, '../../target/idl/swapback_buyback.json');
    
    if (!fs.existsSync(idlPath)) {
      throw new Error(`IDL not found at ${idlPath}`);
    }

    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

    const provider = new AnchorProvider(
      connection,
      new Wallet(wallet),
      { commitment: 'confirmed' }
    );

    const program = new Program(idl, provider);

    // Derive PDAs
    const [buybackState] = PublicKey.findProgramAddressSync(
      [Buffer.from('buyback_state')],
      BUYBACK_PROGRAM_ID
    );

    const [backVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('back_vault'), buybackState.toBuffer()],
      BUYBACK_PROGRAM_ID
    );

    // Call finalize_buyback
    const tx = await program.methods
      .finalizeBuyback(new BN(usdcSpent), new BN(backReceived))
      .accounts({
        buybackState,
        backVault,
        backMint: BACK_MINT,
        authority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await connection.confirmTransaction(tx, 'confirmed');

    log('INFO', '✅ finalize_buyback() successful', { signature: tx });
  } catch (error: any) {
    log('ERROR', 'Failed to finalize buyback on-chain', { error: error.message });
    throw error;
  }
}

async function executeSplitDistribution(
  connection: Connection,
  wallet: Keypair,
  totalBackReceived: number
): Promise<void> {
  try {
    log('INFO', 'Executing 50/50 split (distribution + burn)', {
      totalBack: totalBackReceived / 1e9,
    });

    // Calculate 50/50 split
    const burnAmount = Math.floor(totalBackReceived * 0.5);
    const distributionPool = totalBackReceived - burnAmount;

    log('INFO', 'Split calculated', {
      burnAmount: burnAmount / 1e9,
      distributionPool: distributionPool / 1e9,
    });

    // Load IDL and setup program
    const idlPath = path.join(__dirname, '../../target/idl/swapback_buyback.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

    const provider = new AnchorProvider(
      connection,
      new Wallet(wallet),
      { commitment: 'confirmed' }
    );

    const program = new Program(idl, provider);

    // Derive PDAs
    const [buybackState] = PublicKey.findProgramAddressSync(
      [Buffer.from('buyback_state')],
      BUYBACK_PROGRAM_ID
    );

    const [backVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('back_vault'), buybackState.toBuffer()],
      BUYBACK_PROGRAM_ID
    );

    // Step 1: Burn 50%
    log('INFO', 'Burning 50% of BACK tokens', { amount: burnAmount / 1e9 });

    const burnTx = await program.methods
      .burnBack(new BN(burnAmount))
      .accounts({
        buybackState,
        backVault,
        backMint: BACK_MINT,
        authority: wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    await connection.confirmTransaction(burnTx, 'confirmed');

    log('INFO', '✅ burn_back() successful', {
      amount: burnAmount / 1e9,
      signature: burnTx,
    });

    // Step 2: Distribution is handled per-user when they claim
    // No need to execute here - just log that distribution pool is ready
    log('INFO', '✅ Distribution pool ready for claims', {
      availableForDistribution: distributionPool / 1e9,
      note: 'Users with cNFT can now call distribute_buyback() to claim their share',
    });

    log('INFO', '🎉 50/50 split executed successfully');
  } catch (error: any) {
    log('ERROR', 'Failed to execute split distribution', { error: error.message });
    throw error;
  }
}

// ==== BUYBACK LOGIC ====
async function checkVaultBalance(connection: Connection): Promise<number> {
  try {
    // Derive USDC vault PDA
    const [usdcVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('usdc_vault')],
      BUYBACK_PROGRAM_ID
    );

    log('INFO', 'Checking USDC vault balance', { vault: usdcVaultPDA.toString() });

    const vaultInfo = await connection.getTokenAccountBalance(usdcVaultPDA);
    const balance = Number(vaultInfo.value.amount);

    log('INFO', 'USDC vault balance', {
      vault: usdcVaultPDA.toString(),
      balance,
      uiAmount: vaultInfo.value.uiAmount,
    });

    return balance;
  } catch (error: any) {
    log('ERROR', 'Failed to check vault balance', { error: error.message });
    throw error;
  }
}

async function executeBuyback(
  connection: Connection,
  wallet: Keypair,
  usdcAmount: number
): Promise<boolean> {
  try {
    log('INFO', '🚀 Starting buyback execution', { usdcAmount });

    // 1. Fetch Jupiter quote
    const quote = await fetchJupiterQuote(USDC_MINT, BACK_MINT, usdcAmount);

    if (!quote || !quote.outAmount) {
      throw new Error('Invalid quote from Jupiter');
    }

    const backExpected = Number(quote.outAmount);

    log('INFO', 'Quote received', {
      usdcIn: usdcAmount / 1e6,
      backOut: backExpected / 1e9,
      priceImpact: quote.priceImpactPct,
    });

    // 2. Execute Jupiter swap
    const swapSignature = await executeJupiterSwap(connection, wallet, quote);

    log('INFO', '✅ Jupiter swap successful', { signature: swapSignature });

    // 3. Call finalize_buyback() on-chain
    await finalizeBuybackOnChain(connection, wallet, usdcAmount, backExpected);

    // 4. Execute 50/50 split: Distribution + Burn
    await executeSplitDistribution(connection, wallet, backExpected);

    // Update success state
    lastSuccessfulBuyback = new Date();
    consecutiveFailures = 0;

    log('INFO', '🎉 Buyback completed successfully', {
      usdcSpent: usdcAmount / 1e6,
      backReceived: backExpected / 1e9,
      signature: swapSignature,
    });

    return true;
  } catch (error: any) {
    log('ERROR', '❌ Buyback execution failed', { error: error.message });
    consecutiveFailures++;

    // Activate circuit breaker if too many failures
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      circuitBreakerActive = true;
      log('WARN', '🔴 Circuit breaker activated', {
        consecutiveFailures,
        cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS,
      });

      // Schedule circuit breaker reset
      setTimeout(() => {
        circuitBreakerActive = false;
        consecutiveFailures = 0;
        log('INFO', '🟢 Circuit breaker reset', {});
      }, CIRCUIT_BREAKER_COOLDOWN_MS);
    }

    return false;
  }
}

// ==== MAIN KEEPER LOOP ====
async function keeperLoop() {
  log('INFO', '🚀 Buyback Keeper started', {
    pollingIntervalMs: POLLING_INTERVAL_MS,
    minThreshold: MIN_BUYBACK_THRESHOLD / 1e6,
    slippageBps: SLIPPAGE_BPS,
  });

  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Load wallet
  const walletPath = path.join(process.env.HOME || '', '.config/solana/id.json');
  
  if (!fs.existsSync(walletPath)) {
    log('ERROR', 'Wallet keypair not found', { path: walletPath });
    process.exit(1);
  }

  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );

  log('INFO', 'Wallet loaded', { publicKey: walletKeypair.publicKey.toString() });

  // Main loop
  while (true) {
    try {
      // Check circuit breaker
      if (circuitBreakerActive) {
        log('WARN', 'Circuit breaker active, skipping iteration', {
          consecutiveFailures,
        });
        await sleep(POLLING_INTERVAL_MS);
        continue;
      }

      // Check vault balance
      const vaultBalance = await checkVaultBalance(connection);

      if (vaultBalance >= MIN_BUYBACK_THRESHOLD) {
        log('INFO', '✅ Threshold met, executing buyback', {
          balance: vaultBalance / 1e6,
          threshold: MIN_BUYBACK_THRESHOLD / 1e6,
        });

        await executeBuyback(connection, walletKeypair, vaultBalance);
      } else {
        log('INFO', '⏳ Vault balance below threshold', {
          balance: vaultBalance / 1e6,
          threshold: MIN_BUYBACK_THRESHOLD / 1e6,
          remaining: (MIN_BUYBACK_THRESHOLD - vaultBalance) / 1e6,
        });
      }

      // Wait for next iteration
      log('INFO', 'Sleeping until next check', {
        nextCheckIn: new Date(Date.now() + POLLING_INTERVAL_MS).toISOString(),
      });
      
      await sleep(POLLING_INTERVAL_MS);
    } catch (error: any) {
      log('ERROR', 'Error in keeper loop', { error: error.message });
      
      // Wait 5 minutes before retry on unexpected errors
      await sleep(5 * 60 * 1000);
    }
  }
}

// ==== ENTRY POINT ====
if (require.main === module) {
  keeperLoop().catch((error) => {
    log('ERROR', 'Fatal error in keeper', { error: error.message });
    process.exit(1);
  });
}

export { checkVaultBalance, executeBuyback, fetchJupiterQuote };
