/**
 * Buyback & Burn SDK
 * 
 * Fonctions pour interagir avec le programme swapback_buyback :
 * - executeBuyback() : Exécuter un buyback USDC → $BACK
 * - getBuybackStats() : Lire les statistiques on-chain
 * - estimateNextBuyback() : Estimer le prochain buyback
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';

// Program IDs
export const BUYBACK_PROGRAM_ID = new PublicKey('46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU');
export const JUPITER_PROGRAM_ID = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');

// Mints
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const BACK_MINT = new PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux'); // $BACK Token-2022 mint

/**
 * Structure de l'état du buyback on-chain
 */
export interface BuybackState {
  authority: PublicKey;
  backMint: PublicKey;
  usdcVault: PublicKey;
  minBuybackAmount: BN;
  totalUsdcSpent: BN;
  totalBackBurned: BN;
  buybackCount: BN;
  bump: number;
}

/**
 * Résultat de l'estimation du prochain buyback
 */
export interface BuybackEstimation {
  usdcAvailable: number;
  estimatedBackAmount: number;
  canExecute: boolean;
  reason?: string;
}

/**
 * Dérive l'adresse PDA du buyback state
 */
export async function getBuybackStatePDA(): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [Buffer.from('buyback_state')],
    BUYBACK_PROGRAM_ID
  );
}

/**
 * Dérive l'adresse PDA du USDC vault
 */
export async function getUsdcVaultPDA(): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [Buffer.from('usdc_vault')],
    BUYBACK_PROGRAM_ID
  );
}

/**
 * Lit les statistiques du buyback depuis la blockchain
 * 
 * @param connection - Connexion Solana RPC
 * @returns État complet du buyback
 */
export async function getBuybackStats(
  connection: Connection
): Promise<BuybackState | null> {
  try {
    const [buybackStatePDA] = await getBuybackStatePDA();
    
    const accountInfo = await connection.getAccountInfo(buybackStatePDA);
    if (!accountInfo) {
      console.warn('Buyback state account not found');
      return null;
    }

    // Decode account data (Anchor format: 8 bytes discriminator + data)
    const data = accountInfo.data;
    
    // Validate minimum data length to prevent BN assertion errors
    const minLength = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1; // 137 bytes
    if (data.length < minLength) {
      console.error(`Invalid buyback state data: expected at least ${minLength} bytes, got ${data.length}`);
      return null;
    }
    
    // Simple deserialization (adjust offsets based on actual struct)
    let offset = 8; // Skip discriminator
    
    const authority = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    const backMint = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    const usdcVault = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    // Use readBigUInt64LE() instead of BN(slice) to avoid BN assertion errors
    const minBuybackAmount = new BN(data.readBigUInt64LE(offset).toString());
    offset += 8;
    
    const totalUsdcSpent = new BN(data.readBigUInt64LE(offset).toString());
    offset += 8;
    
    const totalBackBurned = new BN(data.readBigUInt64LE(offset).toString());
    offset += 8;
    
    const buybackCount = new BN(data.readBigUInt64LE(offset).toString());
    offset += 8;
    
    const bump = data[offset];

    return {
      authority,
      backMint,
      usdcVault,
      minBuybackAmount,
      totalUsdcSpent,
      totalBackBurned,
      buybackCount,
      bump,
    };
  } catch (error) {
    console.error('Error fetching buyback stats:', error);
    return null;
  }
}

/**
 * Estime le montant de $BACK qui serait reçu pour un buyback
 * 
 * @param connection - Connexion Solana RPC
 * @returns Estimation du prochain buyback
 */
export async function estimateNextBuyback(
  connection: Connection
): Promise<BuybackEstimation> {
  try {
    const stats = await getBuybackStats(connection);
    if (!stats) {
      return {
        usdcAvailable: 0,
        estimatedBackAmount: 0,
        canExecute: false,
        reason: 'Buyback not initialized',
      };
    }

    // Get USDC vault balance
    const [usdcVaultPDA] = await getUsdcVaultPDA();
    const vaultInfo = await connection.getTokenAccountBalance(usdcVaultPDA);
    const usdcAvailable = vaultInfo.value.uiAmount || 0;

    // Check if can execute
    const minBuybackUSDC = stats.minBuybackAmount.toNumber() / 1e6;
    const canExecute = usdcAvailable >= minBuybackUSDC;

    if (!canExecute) {
      return {
        usdcAvailable,
        estimatedBackAmount: 0,
        canExecute: false,
        reason: `Need ${minBuybackUSDC} USDC minimum (current: ${usdcAvailable})`,
      };
    }

    // Estimate $BACK amount using Jupiter Quote API
    const estimatedBackAmount = await estimateBuybackWithJupiter(usdcAvailable);

    return {
      usdcAvailable,
      estimatedBackAmount,
      canExecute: true,
    };
  } catch (error) {
    console.error('Error estimating buyback:', error);
    return {
      usdcAvailable: 0,
      estimatedBackAmount: 0,
      canExecute: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Estime le montant de $BACK via Jupiter Quote API
 * 
 * @param usdcAmount - Montant USDC (en unités UI)
 * @returns Montant estimé de $BACK
 */
async function estimateBuybackWithJupiter(usdcAmount: number): Promise<number> {
  try {
    const response = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${USDC_MINT.toBase58()}&outputMint=${BACK_MINT.toBase58()}&amount=${Math.floor(usdcAmount * 1e6)}&slippageBps=50`
    );
    
    if (!response.ok) {
      throw new Error('Jupiter API error');
    }

    const quote = await response.json();
    return parseInt(quote.outAmount) / 1e9; // Convert to $BACK UI amount
  } catch (error) {
    console.warn('Jupiter quote failed, using fallback estimate:', error);
    // Fallback: assume 1 USDC = 250 $BACK (adjust based on real market price)
    return usdcAmount * 250;
  }
}

/**
 * Exécute un buyback USDC → $BACK
 * 
 * @param connection - Connexion Solana RPC
 * @param authority - Keypair de l'autorité du buyback
 * @param maxUsdcAmount - Montant maximum USDC à utiliser (en lamports)
 * @param minBackAmount - Montant minimum $BACK attendu (en lamports)
 * @returns Signature de la transaction
 */
export async function executeBuyback(
  connection: Connection,
  authority: Keypair,
  maxUsdcAmount: number,
  minBackAmount: number
): Promise<string> {
  try {
    // Get PDAs
    const [buybackStatePDA] = await getBuybackStatePDA();
    const [usdcVaultPDA] = await getUsdcVaultPDA();

    // Get $BACK vault (owned by buyback program)
    const backVault = await getAssociatedTokenAddress(
      BACK_MINT,
      buybackStatePDA,
      true // allowOwnerOffCurve
    );

    // Get Jupiter quote
    const jupiterQuote = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${USDC_MINT.toBase58()}&outputMint=${BACK_MINT.toBase58()}&amount=${maxUsdcAmount}&slippageBps=50`
    ).then(res => res.json());

    if (!jupiterQuote) {
      throw new Error('Failed to get Jupiter quote');
    }

    // Build instruction data
    const discriminator = Buffer.from([0x23, 0x5c, 0x4f, 0x8e, 0x5a, 0x9c, 0x7d, 0x1a]); // execute_buyback
    const maxUsdcBuffer = Buffer.alloc(8);
    maxUsdcBuffer.writeBigUInt64LE(BigInt(maxUsdcAmount));
    const minBackBuffer = Buffer.alloc(8);
    minBackBuffer.writeBigUInt64LE(BigInt(minBackAmount));
    
    const instructionData = Buffer.concat([discriminator, maxUsdcBuffer, minBackBuffer]);

    // Build accounts
    const keys = [
      { pubkey: buybackStatePDA, isSigner: false, isWritable: true },
      { pubkey: usdcVaultPDA, isSigner: false, isWritable: true },
      { pubkey: backVault, isSigner: false, isWritable: true },
      { pubkey: JUPITER_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: authority.publicKey, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      // Jupiter remaining accounts would go here in production
    ];

    const instruction = new TransactionInstruction({
      keys,
      programId: BUYBACK_PROGRAM_ID,
      data: instructionData,
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = authority.publicKey;
    transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;

    const signature = await connection.sendTransaction(transaction, [authority], {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(signature, 'confirmed');

    console.log('✅ Buyback executed:', signature);
    return signature;
  } catch (error) {
    console.error('Error executing buyback:', error);
    throw error;
  }
}

/**
 * Initialise le programme de buyback (admin uniquement)
 * 
 * @param connection - Connexion Solana RPC
 * @param authority - Keypair de l'autorité
 * @param minBuybackAmount - Montant minimum pour déclencher un buyback (en lamports USDC)
 * @returns Signature de la transaction
 */
export async function initializeBuyback(
  connection: Connection,
  authority: Keypair,
  minBuybackAmount: number = 100_000_000 // 100 USDC par défaut
): Promise<string> {
  try {
    const [buybackStatePDA] = await getBuybackStatePDA();
    const [usdcVaultPDA] = await getUsdcVaultPDA();

    // Build instruction data
    const discriminator = Buffer.from([0xaf, 0xaf, 0x6d, 0x1f, 0x0d, 0x98, 0x9b, 0xed]); // initialize
    const minAmountBuffer = Buffer.alloc(8);
    minAmountBuffer.writeBigUInt64LE(BigInt(minBuybackAmount));
    const instructionData = Buffer.concat([discriminator, minAmountBuffer]);

    // Build accounts
    const keys = [
      { pubkey: buybackStatePDA, isSigner: false, isWritable: true },
      { pubkey: BACK_MINT, isSigner: false, isWritable: false },
      { pubkey: usdcVaultPDA, isSigner: false, isWritable: true },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({
      keys,
      programId: BUYBACK_PROGRAM_ID,
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = authority.publicKey;
    transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;

    const signature = await connection.sendTransaction(transaction, [authority]);
    await connection.confirmTransaction(signature);

    console.log('✅ Buyback initialized:', signature);
    return signature;
  } catch (error) {
    console.error('Error initializing buyback:', error);
    throw error;
  }
}

/**
 * Formate les stats buyback pour affichage
 */
export function formatBuybackStats(stats: BuybackState | null) {
  if (!stats) {
    return {
      totalUsdcSpent: '0',
      totalBackBurned: '0',
      buybackCount: '0',
      minBuybackAmount: '0',
    };
  }

  return {
    totalUsdcSpent: (stats.totalUsdcSpent.toNumber() / 1e6).toFixed(2),
    totalBackBurned: (stats.totalBackBurned.toNumber() / 1e9).toFixed(2),
    buybackCount: stats.buybackCount.toString(),
    minBuybackAmount: (stats.minBuybackAmount.toNumber() / 1e6).toFixed(2),
  };
}

/**
 * Dépose des USDC dans le vault de buyback
 * Utilisé pour accumuler des fonds pour les futurs buybacks
 * 
 * @param connection - Connexion Solana RPC
 * @param payer - Wallet qui paie la transaction
 * @param amount - Montant USDC à déposer (en lamports, 6 decimals)
 * @returns Signature de la transaction
 */
export async function depositUsdc(
  connection: Connection,
  payer: Keypair | { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> },
  amount: number
): Promise<string> {
  try {
    const [buybackStatePDA] = await getBuybackStatePDA();
    const [usdcVaultPDA] = await getUsdcVaultPDA();

    // Get user's USDC token account
    const userUsdcAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      payer.publicKey
    );

    // Create deposit_usdc instruction
    // Discriminator for deposit_usdc: [242, 35, 198, 137, 82, 225, 242, 182]
    const discriminator = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(amount));
    
    const instructionData = Buffer.concat([discriminator, amountBuffer]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: buybackStatePDA, isSigner: false, isWritable: false },
        { pubkey: userUsdcAccount, isSigner: false, isWritable: true },
        { pubkey: usdcVaultPDA, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: BUYBACK_PROGRAM_ID,
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = payer.publicKey;
    transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;

    // Sign and send
    let signature: string;
    if ('secretKey' in payer) {
      // Keypair case
      signature = await connection.sendTransaction(transaction, [payer as Keypair]);
    } else {
      // Wallet adapter case
      const signedTx = await payer.signTransaction(transaction);
      signature = await connection.sendRawTransaction(signedTx.serialize());
    }

    console.log(`✅ USDC deposited to buyback vault: ${signature}`);
    console.log(`   Amount: ${(amount / 1e6).toFixed(2)} USDC`);

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
  } catch (error) {
    console.error('Error depositing USDC to buyback vault:', error);
    throw error;
  }
}

