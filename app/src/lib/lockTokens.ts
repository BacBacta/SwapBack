/**
 * Utilitaires pour verrouiller des tokens BACK avec transfert on-chain
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { 
  TOKEN_2022_PROGRAM_ID, 
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import cnftIdl from "@/idl/swapback_cnft.json";
import type { Idl } from "@coral-xyz/anchor";
import { validateEnv } from "./validateEnv";

/**
 * Helpers to lazily resolve environment program IDs and mints.
 * These helpers avoid throwing during module initialization in the
 * browser (Client Components). They will perform strict validation
 * server-side (via `validateEnv()`) and return `null` in the browser
 * if the variables are not defined.
 */
function getCnftProgramId(): PublicKey | null {
  const envVar = process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID;
  if (typeof window === 'undefined') {
    // Server-side: perform strict validation (will throw if invalid/missing)
    const cfg = validateEnv();
    return new PublicKey(cfg.cnftProgramId);
  }
  // Client-side: be permissive and return null if not set
  return envVar ? new PublicKey(envVar) : null;
}

function getBackMint(): PublicKey | null {
  const envVar = process.env.NEXT_PUBLIC_BACK_MINT;
  if (typeof window === 'undefined') {
    const cfg = validateEnv();
    return new PublicKey(cfg.backMint);
  }
  return envVar ? new PublicKey(envVar) : null;
}

/**
 * Crée une transaction pour verrouiller des tokens BACK avec transfert on-chain
 */
export async function createLockTokensTransaction(
  connection: Connection,
  wallet: WalletContextState,
  params: {
    amount: number; // Montant en tokens (pas en lamports)
    duration: number; // Durée en secondes
  }
): Promise<Transaction> {
  console.log('🔍 [LOCK TX] Creating lock transaction...');
  console.log('🔍 [LOCK TX] Params:', params);
  
  // Valider la configuration AVANT de construire la transaction
  // Resolve program IDs / mints lazily
  const CNFT_PROGRAM_ID = getCnftProgramId();
  const BACK_MINT = getBackMint();

  console.log('🔍 [LOCK TX] Environment validation:');
  console.log('   CNFT_PROGRAM_ID:', CNFT_PROGRAM_ID?.toString() ?? 'N/A');
  console.log('   IDL address:', cnftIdl.address);
  console.log('   BACK_MINT:', BACK_MINT?.toString() ?? 'N/A');
  console.log('   Network:', process.env.NEXT_PUBLIC_SOLANA_NETWORK);
  
  // Vérification de cohérence (double sécurité)
  if (!CNFT_PROGRAM_ID) {
    throw new Error(
      '❌ NEXT_PUBLIC_CNFT_PROGRAM_ID is not configured. ' +
        'Define it in Vercel or .env and ensure it matches the IDL address: ' +
        cnftIdl.address
    );
  }

  if (CNFT_PROGRAM_ID.toString() !== cnftIdl.address) {
    throw new Error(
      `❌ CRITICAL: Program ID mismatch!\n` +
        `  NEXT_PUBLIC_CNFT_PROGRAM_ID: ${CNFT_PROGRAM_ID.toString()}\n` +
        `  IDL address: ${cnftIdl.address}\n` +
        `This WILL cause AccountOwnedByWrongProgram errors!`
    );
  }
  
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }
  console.log('🔍 [LOCK TX] Wallet:', wallet.publicKey.toString());

  // Créer un wrapper de wallet compatible avec Anchor
  const anchorWallet = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction.bind(wallet),
    signAllTransactions: wallet.signAllTransactions?.bind(wallet) || (async (txs: Transaction[]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!wallet.signTransaction) throw new Error("Wallet cannot sign");
      const signed = [];
      for (const tx of txs) {
        signed.push(await wallet.signTransaction(tx));
      }
      return signed;
    }),
  };

  // Créer le provider Anchor avec le wrapper
  const provider = new AnchorProvider(
    connection,
    anchorWallet as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    { commitment: "confirmed", skipPreflight: false }
  );

  // Charger le programme avec l'ID explicite pour éviter DeclaredProgramIdMismatch
  console.log('🔍 [LOCK TX] Loading program...');
  const program = new Program(cnftIdl as Idl, CNFT_PROGRAM_ID, provider);
  console.log('✅ [LOCK TX] Program loaded:', CNFT_PROGRAM_ID.toString());

  // Convertir le montant en lamports (9 decimals pour BACK)
  const amountLamports = new BN(Math.floor(params.amount * 1_000_000_000));
  const lockDuration = new BN(Math.floor(params.duration));
  console.log('🔍 [LOCK TX] Amount (lamports):', amountLamports.toString());
  console.log('🔍 [LOCK TX] Duration (seconds):', lockDuration.toString());

  console.log('🔍 [LOCK TX] Amount (lamports):', amountLamports.toString());
  console.log('🔍 [LOCK TX] Duration (seconds):', lockDuration.toString());

  // Dériver les PDAs
  console.log('🔍 [LOCK TX] Deriving PDAs...');
  const [collectionConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    CNFT_PROGRAM_ID
  );
  console.log('✅ [LOCK TX] Collection Config:', collectionConfig.toString());

  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    CNFT_PROGRAM_ID
  );
  console.log('✅ [LOCK TX] Global State:', globalState.toString());

  const [userNft] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), wallet.publicKey.toBuffer()],
    CNFT_PROGRAM_ID
  );
  console.log('✅ [LOCK TX] User NFT:', userNft.toString());

  // Note: Permettre plusieurs locks - l'utilisateur peut lock à plusieurs reprises
  // Si un NFT existe déjà, il sera mis à jour ou un nouveau sera créé
  console.log('🔍 [LOCK TX] Multiple locks allowed - proceeding...');

  const vaultAuthority = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    CNFT_PROGRAM_ID
  );
  console.log('✅ [LOCK TX] Vault Authority:', vaultAuthority[0].toString());

  // Obtenir les token accounts
  console.log('🔍 [LOCK TX] Getting token accounts...');
  if (!BACK_MINT) {
    throw new Error('❌ NEXT_PUBLIC_BACK_MINT is not configured. Define it in Vercel or .env');
  }

  const userTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  console.log('✅ [LOCK TX] User Token Account:', userTokenAccount.toString());

  // Le vault token account est dérivé automatiquement par Anchor via l'IDL
  // On peut le calculer pour info mais Anchor le fera aussi
  const vaultTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    vaultAuthority[0],
    true, // allowOwnerOffCurve = true pour PDA
    TOKEN_2022_PROGRAM_ID
  );
  console.log('✅ [LOCK TX] Vault Token Account (calculated):', vaultTokenAccount.toString());
  console.log('✅ [LOCK TX] Vault Token Account (calculated):', vaultTokenAccount.toString());

  // Construire l'instruction via Anchor
  console.log('🔍 [LOCK TX] Building instruction...');
  try {
    // Use mint_level_nft instruction (the actual instruction name in the IDL)
    console.log('✅ [LOCK TX] Using mint_level_nft instruction');
    const instruction = await program.methods
      .mintLevelNft(amountLamports, lockDuration)
      .accounts({
        collectionConfig,
        globalState,
        userNft,
        userTokenAccount,
        vaultTokenAccount,
        vaultAuthority: vaultAuthority[0],
        backMint: BACK_MINT,
        user: wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    
    console.log('✅ [LOCK TX] Instruction created successfully');

    // Ajouter les instructions de compute budget pour éviter les erreurs
    const { ComputeBudgetProgram } = await import('@solana/web3.js');
    
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000, // Augmenter la limite de compute units
    });
    
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1, // Petite priorité pour passage plus rapide
    });

    const transaction = new Transaction()
      .add(modifyComputeUnits)
      .add(addPriorityFee)
      .add(instruction);
    console.log('✅ [LOCK TX] Transaction built successfully with compute budget');

    return transaction;
  } catch (error) {
    console.error('❌ [LOCK TX] Error building instruction:', error);
    if (error instanceof Error) {
      console.error('❌ [LOCK TX] Error message:', error.message);
      console.error('❌ [LOCK TX] Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Crée une transaction pour déverrouiller des tokens BACK
 */
export async function createUnlockTokensTransaction(
  connection: Connection,
  wallet: WalletContextState
): Promise<Transaction> {
  console.log('🔓 [UNLOCK TX] Creating unlock transaction...');
  
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  // Resolve program IDs / mints lazily (same pattern as createLockTokensTransaction)
  const CNFT_PROGRAM_ID = getCnftProgramId();
  const BACK_MINT = getBackMint();

  console.log('🔍 [UNLOCK TX] Environment validation:');
  console.log('   CNFT_PROGRAM_ID:', CNFT_PROGRAM_ID?.toString() ?? 'N/A');
  console.log('   IDL address:', cnftIdl.address);
  console.log('   BACK_MINT:', BACK_MINT?.toString() ?? 'N/A');
  console.log('   Network:', process.env.NEXT_PUBLIC_SOLANA_NETWORK);

  // Guard: ensure CNFT_PROGRAM_ID is configured
  if (!CNFT_PROGRAM_ID) {
    throw new Error(
      '❌ NEXT_PUBLIC_CNFT_PROGRAM_ID is not configured. ' +
        'Define it in Vercel or .env and ensure it matches the IDL address: ' +
        cnftIdl.address
    );
  }

  // Vérification de cohérence (protection contre AccountOwnedByWrongProgram)
  if (CNFT_PROGRAM_ID.toString() !== cnftIdl.address) {
    throw new Error(
      `❌ CRITICAL: Program ID mismatch!\n` +
        `  NEXT_PUBLIC_CNFT_PROGRAM_ID: ${CNFT_PROGRAM_ID.toString()}\n` +
        `  IDL address: ${cnftIdl.address}\n` +
        `This WILL cause AccountOwnedByWrongProgram errors!`
    );
  }

  // Guard: ensure BACK_MINT is configured
  if (!BACK_MINT) {
    throw new Error('❌ NEXT_PUBLIC_BACK_MINT is not configured. Define it in Vercel or .env');
  }

  console.log('✅ [UNLOCK TX] Wallet:', wallet.publicKey.toString());

  // Créer le provider Anchor
  const provider = new AnchorProvider(
    connection,
    wallet as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    { commitment: "confirmed" }
  );

  // Charger le programme avec l'ID explicite pour éviter DeclaredProgramIdMismatch
  console.log('🔍 [UNLOCK TX] Loading program...');
  const program = new Program(cnftIdl as Idl, CNFT_PROGRAM_ID, provider);
  console.log('✅ [UNLOCK TX] Program loaded:', CNFT_PROGRAM_ID.toString());

  // Dériver les PDAs
  console.log('🔍 [UNLOCK TX] Deriving PDAs...');
  const [userNft] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), wallet.publicKey.toBuffer()],
    CNFT_PROGRAM_ID
  );
  console.log('✅ [UNLOCK TX] User NFT:', userNft.toString());

  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    CNFT_PROGRAM_ID
  );
  console.log('✅ [UNLOCK TX] Global State:', globalState.toString());

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    CNFT_PROGRAM_ID
  );
  console.log('✅ [UNLOCK TX] Vault Authority:', vaultAuthority.toString());

  // Obtenir les token accounts
  console.log('🔍 [UNLOCK TX] Getting token accounts...');
  const userTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  console.log('✅ [UNLOCK TX] User Token Account:', userTokenAccount.toString());

  const vaultTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    vaultAuthority,
    true, // allowOwnerOffCurve = true pour PDA
    TOKEN_2022_PROGRAM_ID
  );
  console.log('✅ [UNLOCK TX] Vault Token Account:', vaultTokenAccount.toString());

  // Construire l'instruction
  console.log('🔍 [UNLOCK TX] Building instruction...');
  console.log('📋 [UNLOCK TX] Accounts in order:', {
    '1_userNft': userNft.toString(),
    '2_globalState': globalState.toString(),
    '3_userTokenAccount': userTokenAccount.toString(),
    '4_vaultTokenAccount': vaultTokenAccount.toString(),
    '5_vaultAuthority': vaultAuthority.toString(),
    '6_backMint': BACK_MINT.toString(),
    '7_user': wallet.publicKey.toString(),
    '8_tokenProgram': TOKEN_2022_PROGRAM_ID.toString(),
  });
  
  try {
    // Use update_nft_status instruction (the actual instruction name in the IDL)
    const instruction = await program.methods
      .updateNftStatus()
      .accounts({
        userNft,
        globalState,
        userTokenAccount,
        vaultTokenAccount,
        vaultAuthority,
        backMint: BACK_MINT,
        user: wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();

    console.log('✅ [UNLOCK TX] Instruction created successfully');

    // Créer la transaction et configurer les paramètres requis
    const transaction = new Transaction().add(instruction);
    
    // Définir le fee payer
    transaction.feePayer = wallet.publicKey;
    console.log('✅ [UNLOCK TX] Fee payer set:', wallet.publicKey.toString());
    
    // Obtenir le blockhash récent
    console.log('🔍 [UNLOCK TX] Getting recent blockhash...');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    console.log('✅ [UNLOCK TX] Blockhash set:', blockhash);
    
    console.log('✅ [UNLOCK TX] Transaction built successfully');
    console.log('📋 [UNLOCK TX] Transaction summary:', {
      feePayer: transaction.feePayer?.toString(),
      recentBlockhash: transaction.recentBlockhash,
      instructions: transaction.instructions.length,
      signatures: transaction.signatures.length
    });

    return transaction;
  } catch (instrError) {
    console.error('❌ [UNLOCK TX] ERROR building instruction:', instrError);
    
    // Log détaillé
    if (instrError instanceof Error) {
      console.error('❌ [UNLOCK TX] Instruction error name:', instrError.name);
      console.error('❌ [UNLOCK TX] Instruction error message:', instrError.message);
      console.error('❌ [UNLOCK TX] Instruction error stack:', instrError.stack);
    }
    
    const anyInstrError = instrError as any;
    if (anyInstrError.logs) {
      console.error('❌ [UNLOCK TX] Anchor logs:', anyInstrError.logs);
    }
    if (anyInstrError.error) {
      console.error('❌ [UNLOCK TX] Nested error:', JSON.stringify(anyInstrError.error, null, 2));
    }
    
    throw instrError;
  }
}
