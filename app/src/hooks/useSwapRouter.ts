"use client";

import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN, Idl, Program } from "@coral-xyz/anchor";
import {
  AccountMeta,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import routerIdl from "@/idl/swapback_router.json";
import { PROGRAM_IDS } from "@/constants/programIds";
import { createProgramWithProvider } from "@/lib/program";
import { getOracleFeedsForPair, type OracleFeedConfig } from "@/config/oracles";
import { USDC_MINT } from "@/config/constants";
import toast from "react-hot-toast";
import { monitor } from "@/lib/protocolMonitor";

const ROUTER_PROGRAM_ID = PROGRAM_IDS.routerProgram;

function createReadonlyWallet(keypair: Keypair) {
  return {
    publicKey: keypair.publicKey,
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T) {
      return tx;
    },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]) {
      return txs;
    },
  };
}

function buildReadOnlyProgram(connection: Connection) {
  const dummy = Keypair.generate();
  const provider = new AnchorProvider(connection, createReadonlyWallet(dummy), {
    commitment: "confirmed",
  });
  return createProgramWithProvider(routerIdl as Idl, ROUTER_PROGRAM_ID, provider);
}

export type ExecutionChannel = "public" | "jito" | "private-rpc";

export interface SwapRequest {
  tokenIn: PublicKey;
  tokenOut: PublicKey;
  amountIn: BN;
  minOut: BN;
  slippageBps?: number;
  twapSlices?: number | null;
  useDynamicPlan?: boolean;
  useBundle?: boolean;
  planAccount?: PublicKey | null;
  oracleFeeds?: OracleFeedConfig;
  remainingAccounts?: Array<{
    pubkey: PublicKey;
    isWritable?: boolean;
    isSigner?: boolean;
  }>;
  buildRemainingAccounts?: (params: {
    derived: DerivedSwapAccounts;
    request: SwapRequest;
  }) => Promise<AccountMeta[]> | AccountMeta[];
  preInstructions?: TransactionInstruction[];
  postInstructions?: TransactionInstruction[];
  signers?: Keypair[];
  jupiterRoute?: JupiterRouteParams | null;
  executionChannel?: ExecutionChannel;
}

export interface JupiterRouteParams {
  expectedInputAmount: BN;
  swapInstruction: Uint8Array | number[];
}

export function useSwapRouter() {
  const wallet = useWallet();
  const { connection } = useConnection();

  const program = useMemo(() => {
    if (!connection) return null;
    if (wallet?.publicKey && wallet.signTransaction) {
      const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
      });
      return createProgramWithProvider(routerIdl as Idl, ROUTER_PROGRAM_ID, provider);
    }
    return buildReadOnlyProgram(connection);
  }, [connection, wallet]);

  const swapWithRouter = async (request: SwapRequest) => {
    if (!wallet?.publicKey || !wallet.signTransaction) {
      toast.error("Connectez votre wallet pour lancer un swap");
      return null;
    }
    if (!program || !connection) {
      toast.error("Programme router non initialisé");
      return null;
    }

    const executionChannel = request.executionChannel ?? (request.useBundle ? "private-rpc" : "public");

    try {
      const derived = await deriveSwapAccounts({
        connection,
        program,
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        walletPublicKey: wallet.publicKey,
      });

      const oracleFeeds =
        request.oracleFeeds ||
        getOracleFeedsForPair(
          request.tokenIn.toBase58(),
          request.tokenOut.toBase58()
        );

      const normalizedJupiterRoute = request.jupiterRoute
        ? {
            expectedInputAmount: request.jupiterRoute.expectedInputAmount,
            swapInstruction: Array.isArray(
              request.jupiterRoute.swapInstruction
            )
              ? request.jupiterRoute.swapInstruction
              : Array.from(request.jupiterRoute.swapInstruction),
          }
        : null;

      const args = {
        amountIn: request.amountIn,
        minOut: request.minOut,
        slippageTolerance: request.slippageBps ?? 50,
        twapSlices: request.twapSlices ?? null,
        useDynamicPlan: request.useDynamicPlan ?? false,
        planAccount: request.planAccount ?? null,
        useBundle: request.useBundle ?? false,
        primaryOracleAccount: oracleFeeds.primary,
        fallbackOracleAccount: oracleFeeds.fallback ?? null,
        jupiterRoute: normalizedJupiterRoute,
        // New fields required by updated IDL
        jupiterSwapIxData: null, // Will be populated by keeper if needed
        liquidityEstimate: null,
        volatilityBps: null,
        minVenueScore: null,
        slippagePerVenue: null,
        tokenADecimals: null,
        tokenBDecimals: null,
        maxStalenessOverride: null,
        jitoBundle: null,
      } as const;

      const accounts = {
        state: derived.routerState,
        user: wallet.publicKey,
        primaryOracle: oracleFeeds.primary,
        fallbackOracle: oracleFeeds.fallback ?? null,
        userTokenAccountA: derived.userTokenAccountA,
        userTokenAccountB: derived.userTokenAccountB,
        vaultTokenAccountA: derived.vaultTokenAccountA,
        vaultTokenAccountB: derived.vaultTokenAccountB,
        plan: request.planAccount ?? null,
        userNft: derived.userNft,
        buybackProgram: derived.buybackProgram,
        buybackUsdcVault: derived.buybackUsdcVault,
        buybackState: derived.buybackState,
        userRebateAccount: derived.userRebateAccount,
        rebateVault: derived.rebateVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as const;

      let remainingAccounts = request.remainingAccounts ?? [];
      if (!remainingAccounts.length && request.buildRemainingAccounts) {
        const built = await request.buildRemainingAccounts({
          derived,
          request,
        });
        remainingAccounts = built ?? [];
      }

      let builder = program.methods
        .swapToc(args)
        .accounts(accounts)
        .remainingAccounts(remainingAccounts.map(acc => ({
          pubkey: acc.pubkey,
          isSigner: acc.isSigner ?? false,
          isWritable: acc.isWritable ?? false
        })));

      const preInstructions = [
        ...derived.preInstructions,
        ...(request.preInstructions ?? []),
      ];
      if (preInstructions.length) {
        builder = builder.preInstructions(preInstructions);
      }

      if (request.postInstructions?.length) {
        builder = builder.postInstructions(request.postInstructions);
      }

      if (request.signers?.length) {
        builder = builder.signers(request.signers);
      }

      const transaction = await builder.transaction();
      transaction.feePayer = wallet.publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      const signedTx = await wallet.signTransaction(transaction);
      const rawTx = signedTx.serialize();

      const txSig = await sendTransactionWithChannel(rawTx, connection, executionChannel);
      await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, "confirmed");

      // Log successful swap
      monitor.swapSuccess(
        request.amountIn.toString(),
        request.tokenIn.toBase58().slice(0, 8),
        request.tokenOut.toBase58().slice(0, 8),
        txSig
      );

      toast.success(`Swap envoyé: ${txSig}`);
      return txSig;
    } catch (err) {
      console.error("swap_toc error", err);
      
      // Log swap error to protocol monitor
      const errorMessage = err instanceof Error ? err.message : "Unknown swap error";
      monitor.swapError(errorMessage, {
        component: 'useSwapRouter',
        action: 'swapWithRouter',
        amount: request.amountIn.toString(),
        tokenMint: request.tokenIn.toBase58(),
        walletAddress: wallet.publicKey?.toBase58(),
        executionChannel,
        stack: err instanceof Error ? err.stack : undefined,
      });

      toast.error(err instanceof Error ? err.message : "Swap échoué");
      throw err;
    }
  };

  /**
   * Execute a swap directly using Jupiter's serialized transaction
   * This bypasses the router program and uses Jupiter's transaction directly
   */
  const executeJupiterSwap = async (
    swapTransactionBase64: string,
    options?: {
      lastValidBlockHeight?: number;
      skipPreflight?: boolean;
    }
  ): Promise<string | null> => {
    if (!wallet?.publicKey || !wallet.signTransaction) {
      toast.error("Connectez votre wallet pour lancer un swap");
      return null;
    }
    if (!connection) {
      toast.error("Connexion non initialisée");
      return null;
    }

    try {
      // Decode the base64 transaction from Jupiter
      const swapTransactionBuf = Buffer.from(swapTransactionBase64, 'base64');
      
      // Try to deserialize as VersionedTransaction first (Jupiter v6 default)
      let transaction: VersionedTransaction | Transaction;
      try {
        transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      } catch {
        // Fallback to legacy Transaction
        transaction = Transaction.from(swapTransactionBuf);
      }

      // Sign the transaction
      let signedTx: VersionedTransaction | Transaction;
      if (transaction instanceof VersionedTransaction) {
        signedTx = await wallet.signTransaction(transaction);
      } else {
        signedTx = await wallet.signTransaction(transaction);
      }

      // Get blockhash info for confirmation
      const { blockhash, lastValidBlockHeight: currentBlockHeight } = 
        await connection.getLatestBlockhash('confirmed');
      
      const blockHeightForConfirmation = options?.lastValidBlockHeight ?? currentBlockHeight;

      // Send the transaction
      const rawTx = signedTx.serialize();
      const txSig = await connection.sendRawTransaction(rawTx, {
        skipPreflight: options?.skipPreflight ?? false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      console.log("🚀 Jupiter swap sent:", txSig);

      // Confirm the transaction
      await connection.confirmTransaction(
        { 
          signature: txSig, 
          blockhash, 
          lastValidBlockHeight: blockHeightForConfirmation 
        }, 
        'confirmed'
      );

      monitor.swapSuccess(
        "jupiter-direct",
        "unknown",
        "unknown",
        txSig
      );

      toast.success(`Swap exécuté: ${txSig.slice(0, 8)}...`);
      return txSig;
    } catch (err) {
      console.error("Jupiter swap error:", err);
      
      const errorMessage = err instanceof Error ? err.message : "Unknown swap error";
      monitor.swapError(errorMessage, {
        component: 'useSwapRouter',
        action: 'executeJupiterSwap',
        walletAddress: wallet.publicKey?.toBase58(),
        stack: err instanceof Error ? err.stack : undefined,
      });

      toast.error(err instanceof Error ? err.message : "Swap Jupiter échoué");
      throw err;
    }
  };

  return {
    swapWithRouter,
    executeJupiterSwap,
    program,
  };
}

export type DerivedSwapAccounts = {
  routerState: PublicKey;
  rebateVault: PublicKey;
  userTokenAccountA: PublicKey;
  userTokenAccountB: PublicKey;
  userRebateAccount: PublicKey;
  vaultTokenAccountA: PublicKey;
  vaultTokenAccountB: PublicKey;
  userNft: PublicKey | null;
  buybackProgram: PublicKey | null;
  buybackState: PublicKey | null;
  buybackUsdcVault: PublicKey | null;
  preInstructions: TransactionInstruction[];
  walletPublicKey: PublicKey;
};

const EXECUTION_RPC_MAP: Record<ExecutionChannel, string | null> = {
  public: null,
  jito: process.env.NEXT_PUBLIC_JITO_RPC_URL ?? null,
  "private-rpc": process.env.NEXT_PUBLIC_PRIVATE_RPC_URL ?? null,
};

async function sendTransactionWithChannel(
  rawTransaction: Uint8Array,
  fallbackConnection: Connection,
  channel: ExecutionChannel
) {
  const target = EXECUTION_RPC_MAP[channel];
  const connection = target ? new Connection(target, "confirmed") : fallbackConnection;
  return connection.sendRawTransaction(rawTransaction, {
    skipPreflight: false,
  });
}

async function deriveSwapAccounts(params: {
  connection: Connection;
  program: Program<Idl>;
  walletPublicKey: PublicKey;
  tokenIn: PublicKey;
  tokenOut: PublicKey;
}): Promise<DerivedSwapAccounts> {
  const { connection, program, walletPublicKey, tokenIn, tokenOut } = params;

  const [routerState] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    ROUTER_PROGRAM_ID
  );

  const routerStateAccount = await (program.account as any).routerState.fetchNullable(
    routerState
  );
  if (!routerStateAccount) {
    throw new Error(
      "RouterState introuvable. Exécutez les scripts d'initialisation (initialize + init-router-vaults)."
    );
  }

  const [rebateVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("rebate_vault"), routerState.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  await assertAccountExists(
    connection,
    rebateVault,
    "rebate vault",
    "scripts/init-rebate-vault.js"
  );

  const vaultTokenAccountA = getAssociatedTokenAddressSync(
    tokenIn,
    routerState,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const vaultTokenAccountB = getAssociatedTokenAddressSync(
    tokenOut,
    routerState,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  await Promise.all([
    assertAccountExists(
      connection,
      vaultTokenAccountA,
      "router vault (token in)",
      "scripts/init-router-vaults.js"
    ),
    assertAccountExists(
      connection,
      vaultTokenAccountB,
      "router vault (token out)",
      "scripts/init-router-vaults.js"
    ),
  ]);

  const [userTokenAData, userTokenBData, userRebateData] = await Promise.all([
    ensureAta(connection, tokenIn, walletPublicKey, walletPublicKey),
    ensureAta(connection, tokenOut, walletPublicKey, walletPublicKey),
    ensureAta(connection, USDC_MINT, walletPublicKey, walletPublicKey),
  ]);

  const userNft = await deriveUserNft(connection, walletPublicKey);
  const buybackInfo = await deriveBuybackAccounts(connection);

  const preInstructions = [
    userTokenAData.instruction,
    userTokenBData.instruction,
    userRebateData.instruction,
  ].filter((ix): ix is TransactionInstruction => Boolean(ix));

  return {
    routerState,
    rebateVault,
    userTokenAccountA: userTokenAData.address,
    userTokenAccountB: userTokenBData.address,
    userRebateAccount: userRebateData.address,
    vaultTokenAccountA,
    vaultTokenAccountB,
    userNft,
    buybackProgram: buybackInfo ? PROGRAM_IDS.buybackProgram : null,
    buybackState: buybackInfo?.state ?? null,
    buybackUsdcVault: buybackInfo?.vault ?? null,
    preInstructions,
    walletPublicKey,
  };
}

async function assertAccountExists(
  connection: Connection,
  pubkey: PublicKey,
  label: string,
  fixHint?: string
): Promise<void> {
  const info = await connection.getAccountInfo(pubkey);
  if (!info) {
    const hint = fixHint ? ` (exécutez ${fixHint})` : "";
    throw new Error(`Compte ${label} introuvable: ${pubkey.toBase58()}${hint}`);
  }
}

async function ensureAta(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey
): Promise<{ address: PublicKey; instruction: TransactionInstruction | null }> {
  const address = getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const info = await connection.getAccountInfo(address);
  if (!info) {
    const instruction = createAssociatedTokenAccountInstruction(
      payer,
      address,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return { address, instruction };
  }

  return { address, instruction: null };
}

async function deriveUserNft(
  connection: Connection,
  walletPublicKey: PublicKey
): Promise<PublicKey | null> {
  const [userNft] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), walletPublicKey.toBuffer()],
    PROGRAM_IDS.cnftProgram
  );
  const info = await connection.getAccountInfo(userNft);
  return info ? userNft : null;
}

async function deriveBuybackAccounts(connection: Connection): Promise<
  | { state: PublicKey; vault: PublicKey }
  | null
> {
  const [state] = PublicKey.findProgramAddressSync(
    [Buffer.from("buyback_state")],
    PROGRAM_IDS.buybackProgram
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_vault")],
    PROGRAM_IDS.buybackProgram
  );

  const [stateInfo, vaultInfo] = await Promise.all([
    connection.getAccountInfo(state),
    connection.getAccountInfo(vault),
  ]);

  if (!stateInfo || !vaultInfo) {
    return null;
  }

  return { state, vault };
}
