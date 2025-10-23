import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
} from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import axios from "axios";

/**
 * Export du tracer blockchain
 */
export * from "./blockchain-tracer";

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
  burnExecuted: number;
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
 * Configuration du client SwapBack
 */
export interface SwapBackConfig {
  connection: Connection;
  wallet: any; // Wallet adapter
  routerProgramId: PublicKey;
  buybackProgramId: PublicKey;
  oracleEndpoint?: string;
}

/**
 * Client principal pour interagir avec SwapBack
 */
export class SwapBackClient {
  private connection: Connection;
  private wallet: any;
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

      // Import du IDL pour créer le program
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const idl = require("./idl/swapback_router.json");
      const provider = new AnchorProvider(
        this.connection,
        this.wallet,
        { commitment: "confirmed" }
      );
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
      const [userRebatePDA] = PublicKey.findProgramAddressSync(
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

      // TODO: Désérialiser le compte avec Anchor
      // Pour le MVP, on retourne des données simulées
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

      // Import du IDL
      const idl = await import("./idl/swapback_router.json");
      const provider = new AnchorProvider(
        this.connection,
        this.wallet,
        { commitment: "confirmed" }
      );
      const program = new Program(idl.default || idl, provider);

      // Dériver le PDA user_lock
      const [userLockPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_lock"), this.wallet.publicKey.toBuffer()],
        this.routerProgramId
      );

      const amountBN = new BN(_amount);
      const durationBN = new BN(_durationDays * 86400); // Convertir jours en secondes

      const transaction = new Transaction();

      // Note: L'instruction lock_tokens doit être ajoutée au programme Solana
      // Pour le MVP, on simule avec une transaction de base
      console.log("📝 Creating lock instruction for PDA:", userLockPDA.toBase58());

      // Dans une implémentation complète, utiliser:
      // const lockIx = await program.methods
      //   .lockTokens(amountBN, durationBN)
      //   .accounts({...})
      //   .instruction();
      // transaction.add(lockIx);

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
      const [userLockPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_lock"), this.wallet.publicKey.toBuffer()],
        this.routerProgramId
      );

      const transaction = new Transaction();

      // Note: L'instruction unlock_tokens doit être ajoutée au programme Solana
      // Pour le MVP, on simule
      console.log("📝 Creating unlock instruction for PDA:", userLockPDA.toBase58());
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
      const [userRebatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_rebate"), this.wallet.publicKey.toBuffer()],
        this.routerProgramId
      );

      const transaction = new Transaction();

      // Note: L'instruction claim_rewards doit être ajoutée au programme Solana
      // Pour le MVP, on simule
      console.log("📝 Creating claim instruction for PDA:", userRebatePDA.toBase58());
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
      const [globalStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        this.routerProgramId
      );

      const accountInfo = await this.connection.getAccountInfo(globalStatePDA);

      if (!accountInfo) {
        throw new Error("Global state non initialisé");
      }

      // TODO: Désérialiser le compte avec Anchor
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
}

/**
 * Helpers pour calculer les montants
 */
export class SwapBackUtils {
  /**
   * Calcule le boost de remise basé sur le montant et la durée de lock
   */
  static calculateBoost(amount: number, durationDays: number): number {
    // Thresholds: Gold = 10000+ tokens for 365+ days
    if (amount >= 10000 && durationDays >= 365) {
      return 50; // Gold
    } else if (amount >= 1000 && durationDays >= 180) {
      return 30; // Silver
    } else if (amount >= 100 && durationDays >= 90) {
      return 10; // Bronze
    }
    return 0;
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
