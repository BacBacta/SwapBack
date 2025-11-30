import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import axios from "axios";

/**
 * Export du tracer blockchain
 */
export * from "./blockchain-tracer";

/**
 * Export Buyback & Burn Module
 */
export * from "./buyback";

/**
 * Export Smart Router Services (Phase 6)
 */
export { SwapExecutor } from "./services/SwapExecutor";
export { JupiterService } from "./services/JupiterService";
export type {
  JupiterQuote,
  JupiterSwapResponse,
  RouteInfo,
} from "./services/JupiterService";
export type {
  SwapParams,
  SwapResult as SwapExecutorResult,
  SwapMetrics,
  RoutePreferences,
} from "./services/SwapExecutor";
export { LiquidityDataCollector } from "./services/LiquidityDataCollector";
export { RouteOptimizationEngine } from "./services/RouteOptimizationEngine";
export { OraclePriceService } from "./services/OraclePriceService";
export { JitoBundleService } from "./services/JitoBundleService";
export { IntelligentOrderRouter } from "./services/IntelligentOrderRouter";
export { RouterClient } from "./services/RouterClient";
export { JupiterRealIntegration } from "./integrations/JupiterRealIntegration";

/**
 * Types pour les routes de swap
 */
export enum RouteType {
  Direct = "Direct",
  Aggregator = "Aggregator",
  RFQ = "RFQ",
  Bundle = "Bundle",
}

export interface RouteSimulation {
  type: RouteType;
  inputAmount: number;
  estimatedOutput: number;
  npi: number;
  rebateAmount: number;
  burnAmount: number;
  fees: number;
  priceImpact: number;
}

export interface SwapResult {
  signature: string;
  actualOutput: number;
  npiRealized: number;
  rebateEarned: number;
  burnExecuted?: number; // Optional for backward compatibility
  burnAmount?: number; // Optional alias
  route?: RouteSimulation; // Optional route details
}

export interface UserStats {
  totalSwaps: number;
  totalVolume: number;
  totalNPI: number;
  totalRebates: number;
  pendingRebates: number;
  lockedAmount: number;
  rebateBoost: number;
}

/**
 * Types pour Dollar-Cost Averaging (DCA)
 */
export interface DCAOrderParams {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amountPerSwap: number;
  intervalSeconds: number;
  totalSwaps: number;
  minOutPerSwap?: number;
}

export interface DCAOrder {
  planPda: PublicKey;
  planId: number[];
  user: PublicKey;
  tokenIn: PublicKey;
  tokenOut: PublicKey;
  amountPerSwap: number;
  totalSwaps: number;
  executedSwaps: number;
  intervalSeconds: number;
  nextExecution: Date;
  minOutPerSwap: number;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
  totalInvested: number;
  totalReceived: number;
}

export interface SwapBackWallet {
  publicKey: PublicKey | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  sendTransaction: (
    transaction: Transaction,
    connection: Connection
  ) => Promise<string>;
}

/**
 * Configuration du client SwapBack
 */
export interface SwapBackConfig {
  connection: Connection;
  wallet: SwapBackWallet; // Wallet adapter
  routerProgramId: PublicKey;
  buybackProgramId: PublicKey;
  oracleEndpoint?: string;
}

/**
 * Client principal pour interagir avec SwapBack
 */
export class SwapBackClient {
  private connection: Connection;
  private wallet: SwapBackWallet;
  private routerProgramId: PublicKey;
  private buybackProgramId: PublicKey;
  private oracleEndpoint: string;

  constructor(config: SwapBackConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.routerProgramId = config.routerProgramId;
    this.buybackProgramId = config.buybackProgramId;
    this.oracleEndpoint = config.oracleEndpoint || "https://api.swapback.io";
  }

  /**
   * Simule une route de swap et retourne les détails
   */
  async simulateRoute(
    inputMint: PublicKey,
    outputMint: PublicKey,
    inputAmount: number,
    slippage: number = 0.5
  ): Promise<RouteSimulation> {
    if (!this.wallet.publicKey) {
      throw new Error("Wallet non connecté");
    }

    try {
      // Appel à l'oracle/API pour simuler les routes
      const response = await axios.post(`${this.oracleEndpoint}/simulate`, {
        inputMint: inputMint.toString(),
        outputMint: outputMint.toString(),
        inputAmount,
        slippage,
        userPubkey: this.wallet.publicKey.toString(),
      });

      return response.data as RouteSimulation;
    } catch (error) {
      console.error("Erreur lors de la simulation:", error);
      throw error;
    }
  }

  /**
   * Exécute un swap avec le smart router
   */
  async executeSwap(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: number,
    minimumOutput: number,
    route: RouteSimulation
  ): Promise<SwapResult> {
    if (!this.wallet.publicKey) {
      throw new Error("Wallet non connecté");
    }

    try {
      console.log("🔄 Executing swap:", {
        input: inputMint.toBase58(),
        output: outputMint.toBase58(),
        amount,
        minimumOutput,
      });

      // NOTE: Swaps are executed via Jupiter API (see app/src/lib/jupiter.ts)
      // This SDK method returns mock data for testing purposes
      // Production swaps use useSwapWithBoost hook -> JupiterService

      // NOTE: Return mock data until programs are deployed
      console.warn(
        "⚠️ SwapBack Router program not yet deployed - returning mock swap result"
      );

      return {
        signature: "MockSwapSignature" + Date.now(),
        actualOutput: minimumOutput,
        npiRealized: route.npi,
        rebateEarned: route.rebateAmount || 0,
        burnAmount: route.burnAmount || 0,
        route: route,
      };

      /*
      // CODE DISABLED UNTIL IDL IS AVAILABLE AND PROGRAMS ARE DEPLOYED
      
      const provider = new AnchorProvider(
        this.connection,
        this.wallet,
        { commitment: "confirmed" }
      );
      
      const idl = require("./idl/swapback_router.json");
      const program = new Program(idl as any, provider);

      // Dériver les PDAs
      const [globalStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        this.routerProgramId
      );

      const [userRebatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_rebate"), this.wallet.publicKey.toBuffer()],
        this.routerProgramId
      );

      // Construire la transaction execute_swap
      const amountBN = new BN(amount);
      const minimumOutputBN = new BN(minimumOutput);
      const npiAmountBN = new BN(route.npi);

      const transaction = new Transaction();

      // Vérifier si le compte user_rebate existe, sinon créer une instruction init
      const userRebateAccount = await this.connection.getAccountInfo(
        userRebatePDA
      );

      if (!userRebateAccount) {
        console.log("📝 Creating user rebate account...");
        // Note: Dans une implémentation complète, ajouter l'instruction init_user_rebate
        // Pour le MVP, on continue avec execute_swap qui peut initialiser si nécessaire
      }

      // Créer l'instruction execute_swap
      const executeSwapIx = await program.methods
        .executeSwap(amountBN, minimumOutputBN, npiAmountBN)
        .accounts({
          globalState: globalStatePDA,
          userRebate: userRebatePDA,
          userAuthority: this.wallet.publicKey,
          systemProgram: PublicKey.default,
        })
        .instruction();

      transaction.add(executeSwapIx);

      // Signature et envoi
      console.log("✍️ Signing and sending transaction...");
      const signature = await this.wallet.sendTransaction(
        transaction,
        this.connection
      );

      console.log("⏳ Confirming transaction:", signature);
      await this.connection.confirmTransaction(signature, "confirmed");

      console.log("✅ Swap executed successfully:", signature);

      return {
        signature,
        actualOutput: minimumOutput,
        npiRealized: route.npi,
        rebateEarned: route.rebateAmount,
        burnExecuted: route.burnAmount,
      };
      */
    } catch (error) {
      console.error("❌ Erreur lors du swap:", error);
      throw error;
    }
  }

  /**
   * Récupère les statistiques d'un utilisateur
   */
  async getUserStats(userPubkey?: PublicKey): Promise<UserStats> {
    const pubkey = userPubkey || this.wallet.publicKey;
    if (!pubkey) {
      throw new Error("Clé publique requise");
    }

    try {
      // Dérivation du PDA pour UserRebate
      const [userRebatePDA] = await PublicKey.findProgramAddress(
        [Buffer.from("user_rebate"), pubkey.toBuffer()],
        this.routerProgramId
      );

      // Lecture du compte
      const accountInfo = await this.connection.getAccountInfo(userRebatePDA);

      if (!accountInfo) {
        // Utilisateur n'a jamais swappé
        return {
          totalSwaps: 0,
          totalVolume: 0,
          totalNPI: 0,
          totalRebates: 0,
          pendingRebates: 0,
          lockedAmount: 0,
          rebateBoost: 0,
        };
      }

      // NOTE: Account deserialization via Anchor is deferred
      // Real stats are fetched via useBoostSystem hook on-chain
      // This returns simulated data for SDK testing
      return {
        totalSwaps: 10,
        totalVolume: 5000,
        totalNPI: 100,
        totalRebates: 75,
        pendingRebates: 10,
        lockedAmount: 500,
        rebateBoost: 10,
      };
    } catch (error) {
      console.error("Erreur lors de la récupération des stats:", error);
      throw error;
    }
  }

  /**
   * Verrouille des tokens $BACK pour obtenir un boost
   */
  async lockTokens(_amount: number, _durationDays: number): Promise<string> {
    if (!this.wallet.publicKey) {
      throw new Error("Wallet non connecté");
    }

    try {
      console.log("🔒 Locking tokens:", {
        amount: _amount,
        duration: _durationDays,
      });

      // Dériver le PDA user_lock
      const [userLockPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("user_lock"), this.wallet.publicKey.toBuffer()],
        this.routerProgramId
      );

      const transaction = new Transaction();

      // Note: L'instruction lock_tokens doit être ajoutée au programme Solana
      // Pour le MVP, on simule avec une transaction de base
      console.log(
        "📝 Creating lock instruction for PDA:",
        userLockPDA.toBase58()
      );

      // Pour le MVP, on retourne une signature simulée
      console.log("⚠️ Lock tokens not fully implemented in program yet");
      console.log("   Amount:", _amount, "Duration:", _durationDays, "days");

      const signature = await this.wallet.sendTransaction(
        transaction,
        this.connection
      );
      await this.connection.confirmTransaction(signature, "confirmed");

      console.log("✅ Lock transaction sent:", signature);
      return signature;
    } catch (error) {
      console.error("❌ Erreur lors du lock:", error);
      throw error;
    }
  }

  /**
   * Déverrouille les tokens $BACK
   */
  async unlockTokens(): Promise<string> {
    if (!this.wallet.publicKey) {
      throw new Error("Wallet non connecté");
    }

    try {
      console.log("🔓 Unlocking tokens for:", this.wallet.publicKey.toBase58());

      // Dériver le PDA user_lock
      const [userLockPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("user_lock"), this.wallet.publicKey.toBuffer()],
        this.routerProgramId
      );

      const transaction = new Transaction();

      // Note: L'instruction unlock_tokens doit être ajoutée au programme Solana
      // Pour le MVP, on simule
      console.log(
        "📝 Creating unlock instruction for PDA:",
        userLockPDA.toBase58()
      );
      console.log("⚠️ Unlock tokens not fully implemented in program yet");

      const signature = await this.wallet.sendTransaction(
        transaction,
        this.connection
      );
      await this.connection.confirmTransaction(signature, "confirmed");

      console.log("✅ Unlock transaction sent:", signature);
      return signature;
    } catch (error) {
      console.error("❌ Erreur lors du unlock:", error);
      throw error;
    }
  }

  /**
   * Récupère les remises en attente
   */
  async claimRewards(): Promise<string> {
    if (!this.wallet.publicKey) {
      throw new Error("Wallet non connecté");
    }

    try {
      console.log("💰 Claiming rewards for:", this.wallet.publicKey.toBase58());

      // Dériver les PDAs
      const [userRebatePDA] = await PublicKey.findProgramAddress(
        [Buffer.from("user_rebate"), this.wallet.publicKey.toBuffer()],
        this.routerProgramId
      );

      const transaction = new Transaction();

      // Note: L'instruction claim_rewards doit être ajoutée au programme Solana
      // Pour le MVP, on simule
      console.log(
        "📝 Creating claim instruction for PDA:",
        userRebatePDA.toBase58()
      );
      console.log("⚠️ Claim rewards not fully implemented in program yet");

      const signature = await this.wallet.sendTransaction(
        transaction,
        this.connection
      );
      await this.connection.confirmTransaction(signature, "confirmed");

      console.log("✅ Claim transaction sent:", signature);
      return signature;
    } catch (error) {
      console.error("❌ Erreur lors du claim:", error);
      throw error;
    }
  }

  /**
   * Récupère les statistiques globales du protocole
   */
  async getGlobalStats() {
    try {
      const [globalStatePDA] = await PublicKey.findProgramAddress(
        [Buffer.from("global_state")],
        this.routerProgramId
      );

      const accountInfo = await this.connection.getAccountInfo(globalStatePDA);

      if (!accountInfo) {
        throw new Error("Global state non initialisé");
      }

      // NOTE: Global stats deserialization deferred - use on-chain hooks for real data
      return {
        totalVolume: 1000000,
        totalNPI: 20000,
        totalRebates: 15000,
        totalBurned: 5000,
      };
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des stats globales:",
        error
      );
      throw error;
    }
  }

  /**
   * Crée un ordre DCA (Dollar-Cost Averaging)
   * 
   * @param params - Paramètres de l'ordre DCA
   * @returns PDA de l'ordre DCA créé
   * 
   * @example
   * ```typescript
   * // Créer un ordre DCA : acheter 10 USDC de SOL toutes les 24h pendant 30 jours
   * const orderPda = await client.createDCAOrder({
   *   inputMint: USDC_MINT,
   *   outputMint: SOL_MINT,
   *   amountPerSwap: 10,
   *   intervalSeconds: 86400, // 24 heures
   *   totalSwaps: 30,
   *   minOutPerSwap: 0.05 // Minimum 0.05 SOL par swap
   * });
   * ```
   */
  async createDCAOrder(params: DCAOrderParams): Promise<PublicKey> {
    if (!this.wallet.publicKey) {
      throw new Error("Wallet non connecté");
    }

    try {
      console.log("📋 Creating DCA order:", {
        inputMint: params.inputMint.toBase58(),
        outputMint: params.outputMint.toBase58(),
        amountPerSwap: params.amountPerSwap,
        intervalSeconds: params.intervalSeconds,
        totalSwaps: params.totalSwaps,
      });

      // Générer un ID unique pour le plan DCA
      const planId = Array.from(crypto.getRandomValues(new Uint8Array(8)));

      // Dériver le PDA pour le plan DCA
      const [dcaPlanPDA] = await PublicKey.findProgramAddress(
        [
          Buffer.from("dca_plan"),
          this.wallet.publicKey.toBuffer(),
          Buffer.from(planId),
        ],
        this.routerProgramId
      );

      // NOTE: Return mock PDA until programs are deployed
      console.warn(
        "⚠️ SwapBack DCA program not yet deployed - returning mock PDA"
      );
      console.log("   Plan PDA:", dcaPlanPDA.toBase58());
      console.log("   Plan will execute", params.totalSwaps, "swaps");
      console.log(
        "   Interval:",
        params.intervalSeconds,
        "seconds (",
        params.intervalSeconds / 3600,
        "hours)"
      );

      return dcaPlanPDA;

      /*
      // CODE DISABLED UNTIL IDL IS AVAILABLE AND PROGRAMS ARE DEPLOYED
      
      const provider = new AnchorProvider(
        this.connection,
        this.wallet,
        { commitment: "confirmed" }
      );
      
      const idl = require("./idl/swapback_router.json");
      const program = new Program(idl as any, provider);

      // Calculer le montant minimum de sortie si non fourni
      const minOutPerSwap = params.minOutPerSwap || 0;

      // Créer l'instruction create_dca_plan
      const amountPerSwapBN = new BN(params.amountPerSwap * 1e9);
      const intervalSecondsBN = new BN(params.intervalSeconds);
      const minOutPerSwapBN = new BN(minOutPerSwap * 1e9);

      const transaction = new Transaction();

      const createDcaPlanIx = await program.methods
        .createDcaPlan(
          Buffer.from(planId),
          amountPerSwapBN,
          params.totalSwaps,
          intervalSecondsBN,
          minOutPerSwapBN
        )
        .accounts({
          dcaPlan: dcaPlanPDA,
          user: this.wallet.publicKey,
          tokenIn: params.inputMint,
          tokenOut: params.outputMint,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      transaction.add(createDcaPlanIx);

      // Signature et envoi
      console.log("✍️ Signing and sending transaction...");
      const signature = await this.wallet.sendTransaction(
        transaction,
        this.connection
      );

      console.log("⏳ Confirming transaction:", signature);
      await this.connection.confirmTransaction(signature, "confirmed");

      console.log("✅ DCA order created:", dcaPlanPDA.toBase58());

      return dcaPlanPDA;
      */
    } catch (error) {
      console.error("❌ Erreur lors de la création de l'ordre DCA:", error);
      throw error;
    }
  }

  /**
   * Annule un ordre DCA existant
   * 
   * @param dcaPlanPda - PDA de l'ordre DCA à annuler
   * @returns Signature de la transaction
   * 
   * @example
   * ```typescript
   * const signature = await client.cancelDCAOrder(orderPda);
   * console.log('DCA order cancelled:', signature);
   * ```
   */
  async cancelDCAOrder(dcaPlanPda: PublicKey): Promise<string> {
    if (!this.wallet.publicKey) {
      throw new Error("Wallet non connecté");
    }

    try {
      console.log("❌ Cancelling DCA order:", dcaPlanPda.toBase58());

      // NOTE: Return mock signature until programs are deployed
      console.warn(
        "⚠️ SwapBack DCA program not yet deployed - returning mock signature"
      );
      const mockSignature = "MockDCACancelSignature" + Date.now();
      console.log("   Signature:", mockSignature);

      return mockSignature;

      /*
      // CODE DISABLED UNTIL IDL IS AVAILABLE AND PROGRAMS ARE DEPLOYED
      
      const provider = new AnchorProvider(
        this.connection,
        this.wallet,
        { commitment: "confirmed" }
      );
      
      const idl = require("./idl/swapback_router.json");
      const program = new Program(idl as any, provider);

      // Créer l'instruction cancel_dca_plan
      const transaction = new Transaction();

      const cancelDcaPlanIx = await program.methods
        .cancelDcaPlan()
        .accounts({
          dcaPlan: dcaPlanPda,
          user: this.wallet.publicKey,
        })
        .instruction();

      transaction.add(cancelDcaPlanIx);

      // Signature et envoi
      console.log("✍️ Signing and sending transaction...");
      const signature = await this.wallet.sendTransaction(
        transaction,
        this.connection
      );

      console.log("⏳ Confirming transaction:", signature);
      await this.connection.confirmTransaction(signature, "confirmed");

      console.log("✅ DCA order cancelled:", signature);

      return signature;
      */
    } catch (error) {
      console.error("❌ Erreur lors de l'annulation de l'ordre DCA:", error);
      throw error;
    }
  }

  /**
   * Récupère tous les ordres DCA d'un utilisateur
   * 
   * @param userPubkey - Clé publique de l'utilisateur (optionnel, utilise le wallet connecté par défaut)
   * @returns Liste des ordres DCA
   * 
   * @example
   * ```typescript
   * const orders = await client.getDCAOrders();
   * for (const order of orders) {
   *   console.log(`Order ${order.planPda.toBase58()}:`);
   *   console.log(`  Progress: ${order.executedSwaps}/${order.totalSwaps}`);
   *   console.log(`  Next execution: ${order.nextExecution}`);
   *   console.log(`  Active: ${order.isActive}`);
   * }
   * ```
   */
  async getDCAOrders(userPubkey?: PublicKey): Promise<DCAOrder[]> {
    const pubkey = userPubkey || this.wallet.publicKey;
    if (!pubkey) {
      throw new Error("Clé publique requise");
    }

    try {
      console.log("📋 Fetching DCA orders for:", pubkey.toBase58());

      // NOTE: Return empty array until programs are deployed
      console.warn(
        "⚠️ SwapBack DCA program not yet deployed - returning empty array"
      );
      return [];

      /*
      // CODE DISABLED UNTIL IDL IS AVAILABLE AND PROGRAMS ARE DEPLOYED
      
      // Discriminateur pour les comptes DCA plan
      const DCA_DISCRIMINATOR = Buffer.from([231, 97, 112, 227, 171, 241, 52, 84]);

      // Fetch tous les comptes DCA appartenant à l'utilisateur
      const accounts = await this.connection.getProgramAccounts(
        this.routerProgramId,
        {
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: bs58.encode(DCA_DISCRIMINATOR),
              },
            },
            {
              memcmp: {
                offset: 8, // Après le discriminateur
                bytes: pubkey.toBase58(),
              },
            },
          ],
        }
      );

      // Désérialiser les comptes
      const orders: DCAOrder[] = [];

      for (const { pubkey: planPda, account } of accounts) {
        try {
          // Désérialiser le compte avec Anchor
          const data = account.data;
          
          // Structure du compte DCA plan (basé sur le programme Rust)
          // discriminator (8) + plan_id (8) + user (32) + token_in (32) + token_out (32)
          // + amount_per_swap (8) + total_swaps (2) + executed_swaps (2) + interval_seconds (8)
          // + next_execution (8) + min_out_per_swap (8) + created_at (8) + expires_at (8)
          // + is_active (1) + total_invested (8) + total_received (8) + bump (1)
          
          let offset = 8; // Skip discriminator
          
          const planId = Array.from(data.slice(offset, offset + 8));
          offset += 8;
          
          const user = new PublicKey(data.slice(offset, offset + 32));
          offset += 32;
          
          const tokenIn = new PublicKey(data.slice(offset, offset + 32));
          offset += 32;
          
          const tokenOut = new PublicKey(data.slice(offset, offset + 32));
          offset += 32;
          
          const amountPerSwap = Number(new BN(data.slice(offset, offset + 8), 'le')) / 1e9;
          offset += 8;
          
          const totalSwaps = data.readUInt16LE(offset);
          offset += 2;
          
          const executedSwaps = data.readUInt16LE(offset);
          offset += 2;
          
          const intervalSeconds = Number(new BN(data.slice(offset, offset + 8), 'le'));
          offset += 8;
          
          const nextExecutionTimestamp = Number(new BN(data.slice(offset, offset + 8), 'le'));
          const nextExecution = new Date(nextExecutionTimestamp * 1000);
          offset += 8;
          
          const minOutPerSwap = Number(new BN(data.slice(offset, offset + 8), 'le')) / 1e9;
          offset += 8;
          
          const createdAtTimestamp = Number(new BN(data.slice(offset, offset + 8), 'le'));
          const createdAt = new Date(createdAtTimestamp * 1000);
          offset += 8;
          
          const expiresAtTimestamp = Number(new BN(data.slice(offset, offset + 8), 'le'));
          const expiresAt = new Date(expiresAtTimestamp * 1000);
          offset += 8;
          
          const isActive = data[offset] === 1;
          offset += 1;
          
          const totalInvested = Number(new BN(data.slice(offset, offset + 8), 'le')) / 1e9;
          offset += 8;
          
          const totalReceived = Number(new BN(data.slice(offset, offset + 8), 'le')) / 1e9;

          orders.push({
            planPda,
            planId,
            user,
            tokenIn,
            tokenOut,
            amountPerSwap,
            totalSwaps,
            executedSwaps,
            intervalSeconds,
            nextExecution,
            minOutPerSwap,
            createdAt,
            expiresAt,
            isActive,
            totalInvested,
            totalReceived,
          });
        } catch (err) {
          console.error("Error parsing DCA plan:", err);
          continue;
        }
      }

      console.log(`✅ Found ${orders.length} DCA orders`);
      return orders;
      */
    } catch (error) {
      console.error(
        "❌ Erreur lors de la récupération des ordres DCA:",
        error
      );
      throw error;
    }
  }
}

/**
 * Helpers pour calculer les montants
 */
export class SwapBackUtils {
  /**
   * Calcule le boost de remise basé sur le montant et la durée de lock
   * Formule adaptée pour supply de 1 milliard de tokens
   * Boost maximum = 20%
   * - Score montant: (amount / 5,000,000) * 10, max 10%
   * - Score durée: (days / 365) * 10, max 10%
   * - Total: max 20%
   * 
   * Exemples:
   * - 100,000 tokens pour 30 jours = 1.02%
   * - 1,000,000 tokens pour 90 jours = 4.47%
   * - 10,000,000 tokens pour 365 jours = 20% (max)
   */
  static calculateBoost(amount: number, durationDays: number): number {
    // Score du montant (max 10% atteint à 5M tokens = 0.5% du supply)
    const amountScore = Math.min((amount / 5000000) * 10, 10);
    
    // Score de la durée (max 10%)
    const durationScore = Math.min((durationDays / 365) * 10, 10);
    
    // Boost total (max 20%)
    const totalBoost = Math.min(amountScore + durationScore, 20);
    
    // Arrondir à 2 décimales
    return Math.round(totalBoost * 100) / 100;
  }

  /**
   * Calcule la remise pour un NPI donné
   */
  static calculateRebate(
    npi: number,
    rebatePercentage: number,
    boost: number
  ): number {
    const baseRebate = npi * (rebatePercentage / 100);
    return baseRebate * (1 + boost / 100);
  }

  /**
   * Formate un montant pour l'affichage
   */
  static formatAmount(amount: number, decimals: number = 2): string {
    return amount.toFixed(decimals);
  }

  /**
   * Convertit un montant avec décimales
   */
  static toNativeAmount(amount: number, decimals: number): BN {
    return new BN(amount * Math.pow(10, decimals));
  }

  /**
   * Convertit un montant natif vers un nombre
   */
  static fromNativeAmount(amount: BN, decimals: number): number {
    return amount.toNumber() / Math.pow(10, decimals);
  }
}

export default SwapBackClient;

// Export du client $BACK token
export { BackTokenClient, createBackTokenClient } from "./backToken";
export type { BackTokenConfig } from "./backToken";

// Export du client cNFT
export { CnftClient, DEFAULT_CNFT_CONFIG } from "./cnftClient";
export type { CnftConfig } from "./cnftClient";
