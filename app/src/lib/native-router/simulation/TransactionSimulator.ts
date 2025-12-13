/**
 * 🔍 Transaction Simulation Service
 * 
 * Simule les transactions avant envoi pour:
 * - Détecter les erreurs avant signature
 * - Estimer le coût en compute units
 * - Vérifier les balances suffisantes
 * - Valider les comptes oracles
 * - Prédire le résultat du swap
 * 
 * @author SwapBack Team
 * @date January 2025
 */

import {
  Connection,
  VersionedTransaction,
  PublicKey,
  TransactionMessage,
  SimulatedTransactionResponse,
} from "@solana/web3.js";

// ============================================================================
// TYPES
// ============================================================================

export interface SimulationResult {
  success: boolean;
  /** Erreur détectée (null si success) */
  error: SimulationError | null;
  /** Logs de la simulation */
  logs: string[];
  /** Compute units consommées */
  unitsConsumed: number;
  /** Slots utilisés */
  slot: number;
  /** Changements de balance prédits */
  balanceChanges: BalanceChange[];
  /** Avertissements non-bloquants */
  warnings: string[];
  /** Métadonnées de timing */
  timing: {
    simulationMs: number;
    timestamp: number;
  };
}

export interface SimulationError {
  code: string;
  message: string;
  instructionIndex?: number;
  /** Erreur connue avec solution */
  knownError?: KnownErrorInfo;
}

export interface KnownErrorInfo {
  errorType: 'ORACLE' | 'SLIPPAGE' | 'BALANCE' | 'ACCOUNT' | 'PROGRAM' | 'UNKNOWN';
  friendlyMessage: string;
  suggestedAction: string;
  isRecoverable: boolean;
}

export interface BalanceChange {
  account: string;
  mint: string;
  before: number;
  after: number;
  delta: number;
}

// Codes d'erreur connus du router SwapBack
const KNOWN_ERROR_CODES: Record<string, KnownErrorInfo> = {
  '0x1771': {
    errorType: 'ORACLE',
    friendlyMessage: 'Prix oracle invalide',
    suggestedAction: 'Vérifiez que l\'oracle est correctement configuré pour cette paire',
    isRecoverable: false,
  },
  '0x1772': {
    errorType: 'ORACLE',
    friendlyMessage: 'Données oracle périmées',
    suggestedAction: 'Réessayez dans quelques secondes ou utilisez Jupiter comme fallback',
    isRecoverable: true,
  },
  '0x1773': {
    errorType: 'ORACLE',
    friendlyMessage: 'Intervalle de confiance oracle trop large',
    suggestedAction: 'Le marché est trop volatile, attendez quelques minutes',
    isRecoverable: true,
  },
  '0x1774': {
    errorType: 'SLIPPAGE',
    friendlyMessage: 'Slippage dépassé',
    suggestedAction: 'Augmentez la tolérance au slippage ou réduisez le montant',
    isRecoverable: true,
  },
  '0x1775': {
    errorType: 'BALANCE',
    friendlyMessage: 'Solde insuffisant',
    suggestedAction: 'Vérifiez votre solde et réduisez le montant du swap',
    isRecoverable: true,
  },
  '0x1776': {
    errorType: 'ACCOUNT',
    friendlyMessage: 'Compte non initialisé',
    suggestedAction: 'Créez d\'abord le compte token associé',
    isRecoverable: true,
  },
};

// ============================================================================
// SIMULATION SERVICE
// ============================================================================

export class TransactionSimulator {
  private connection: Connection;
  private simulationCache: Map<string, { result: SimulationResult; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5000; // 5 secondes
  
  constructor(connection: Connection) {
    this.connection = connection;
  }
  
  /**
   * Simule une transaction et retourne un résultat détaillé
   */
  async simulate(
    transaction: VersionedTransaction,
    options: {
      skipCache?: boolean;
      replaceRecentBlockhash?: boolean;
      includeAccounts?: PublicKey[];
    } = {}
  ): Promise<SimulationResult> {
    const startTime = Date.now();
    
    try {
      // Vérifier le cache
      if (!options.skipCache) {
        const cacheKey = this.getCacheKey(transaction);
        const cached = this.simulationCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
          return { ...cached.result, timing: { ...cached.result.timing, simulationMs: 0 } };
        }
      }
      
      // Remplacer le blockhash si nécessaire (pour éviter erreur blockhash expiré)
      let txToSimulate = transaction;
      if (options.replaceRecentBlockhash) {
        const { blockhash } = await this.connection.getLatestBlockhash();
        const message = TransactionMessage.decompile(transaction.message);
        message.recentBlockhash = blockhash;
        txToSimulate = new VersionedTransaction(message.compileToV0Message());
      }
      
      // Simuler
      const simulationResponse = await this.connection.simulateTransaction(txToSimulate, {
        sigVerify: false,
        replaceRecentBlockhash: options.replaceRecentBlockhash ?? true,
        commitment: 'processed',
      });
      
      const simulationMs = Date.now() - startTime;
      
      // Parser le résultat
      const result = this.parseSimulationResponse(simulationResponse.value, simulationMs);
      
      // Mettre en cache si succès
      if (result.success && !options.skipCache) {
        const cacheKey = this.getCacheKey(transaction);
        this.simulationCache.set(cacheKey, { result, timestamp: Date.now() });
      }
      
      return result;
      
    } catch (error) {
      const simulationMs = Date.now() - startTime;
      return this.createErrorResult(error, simulationMs);
    }
  }
  
  /**
   * Vérifie si une transaction passera avant signature
   */
  async willSucceed(transaction: VersionedTransaction): Promise<{
    willSucceed: boolean;
    reason?: string;
    details?: SimulationResult;
  }> {
    const result = await this.simulate(transaction, { replaceRecentBlockhash: true });
    
    if (result.success) {
      return { willSucceed: true, details: result };
    }
    
    return {
      willSucceed: false,
      reason: result.error?.knownError?.friendlyMessage ?? result.error?.message ?? 'Erreur inconnue',
      details: result,
    };
  }
  
  /**
   * Estime les changements de balance après exécution
   */
  async estimateBalanceChanges(
    transaction: VersionedTransaction,
    userPublicKey: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey
  ): Promise<{
    inputChange: number;
    outputChange: number;
    solChange: number;
    success: boolean;
  }> {
    try {
      const result = await this.simulate(transaction, {
        replaceRecentBlockhash: true,
      });
      
      if (!result.success) {
        return { inputChange: 0, outputChange: 0, solChange: 0, success: false };
      }
      
      // Extraire les changements de balance depuis les logs
      const changes = this.parseBalanceChangesFromLogs(result.logs, userPublicKey.toBase58());
      
      return {
        inputChange: changes.input,
        outputChange: changes.output,
        solChange: changes.sol,
        success: true,
      };
    } catch {
      return { inputChange: 0, outputChange: 0, solChange: 0, success: false };
    }
  }
  
  /**
   * Vérifie les prérequis avant swap
   */
  async checkSwapPrerequisites(
    userPublicKey: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number
  ): Promise<{
    canSwap: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];
    
    try {
      // 1. Vérifier le solde SOL (pour frais)
      const solBalance = await this.connection.getBalance(userPublicKey);
      const minSolRequired = 10_000_000; // 0.01 SOL min pour frais
      
      if (solBalance < minSolRequired) {
        issues.push(`Solde SOL insuffisant pour les frais (${solBalance / 1e9} SOL < 0.01 SOL)`);
      }
      
      // 2. Vérifier le compte token d'entrée
      const { getAssociatedTokenAddress } = await import("@solana/spl-token");
      const inputAta = await getAssociatedTokenAddress(inputMint, userPublicKey);
      const inputAccountInfo = await this.connection.getAccountInfo(inputAta);
      
      if (!inputAccountInfo) {
        issues.push(`Compte token d'entrée non initialisé (${inputMint.toBase58().slice(0, 8)}...)`);
      } else {
        // Vérifier le solde token
        const { AccountLayout } = await import("@solana/spl-token");
        const data = AccountLayout.decode(inputAccountInfo.data);
        const balance = Number(data.amount);
        
        if (balance < amountIn) {
          issues.push(`Solde token insuffisant: ${balance} < ${amountIn}`);
        }
      }
      
      // 3. Vérifier si le compte de sortie existe
      const outputAta = await getAssociatedTokenAddress(outputMint, userPublicKey);
      const outputAccountInfo = await this.connection.getAccountInfo(outputAta);
      
      if (!outputAccountInfo) {
        warnings.push(`Le compte de sortie sera créé automatiquement (coût: ~0.002 SOL)`);
      }
      
      // 4. Vérifier la santé du RPC
      const slot = await this.connection.getSlot();
      if (slot === 0) {
        issues.push('Problème de connexion au RPC');
      }
      
    } catch (error) {
      issues.push(`Erreur lors de la vérification: ${error instanceof Error ? error.message : 'Inconnue'}`);
    }
    
    return {
      canSwap: issues.length === 0,
      issues,
      warnings,
    };
  }
  
  /**
   * Parse la réponse de simulation
   */
  private parseSimulationResponse(
    response: SimulatedTransactionResponse,
    simulationMs: number
  ): SimulationResult {
    const logs = response.logs ?? [];
    const unitsConsumed = response.unitsConsumed ?? 0;
    
    // Détecter les avertissements
    const warnings: string[] = [];
    if (unitsConsumed > 300_000) {
      warnings.push(`Haute consommation CU: ${unitsConsumed} (risque d'échec)`);
    }
    
    // Vérifier les erreurs
    if (response.err) {
      const error = this.parseError(response.err, logs);
      return {
        success: false,
        error,
        logs,
        unitsConsumed,
        slot: 0,
        balanceChanges: [],
        warnings,
        timing: { simulationMs, timestamp: Date.now() },
      };
    }
    
    return {
      success: true,
      error: null,
      logs,
      unitsConsumed,
      slot: 0,
      balanceChanges: this.parseBalanceChanges(logs),
      warnings,
      timing: { simulationMs, timestamp: Date.now() },
    };
  }
  
  /**
   * Parse une erreur de simulation
   */
  private parseError(err: unknown, logs: string[]): SimulationError {
    // Extraire le code d'erreur custom
    const errStr = JSON.stringify(err);
    const customErrorMatch = errStr.match(/Custom\((\d+)\)/);
    
    if (customErrorMatch) {
      const errorCode = parseInt(customErrorMatch[1], 10);
      const hexCode = `0x${errorCode.toString(16)}`;
      
      const knownError = KNOWN_ERROR_CODES[hexCode];
      
      return {
        code: hexCode,
        message: knownError?.friendlyMessage ?? `Erreur programme: ${hexCode}`,
        knownError,
      };
    }
    
    // Extraire l'index d'instruction
    const instructionMatch = errStr.match(/InstructionError\[(\d+)/);
    const instructionIndex = instructionMatch ? parseInt(instructionMatch[1], 10) : undefined;
    
    // Chercher une erreur dans les logs
    const errorLog = logs.find(l => l.includes('Error') || l.includes('failed'));
    
    return {
      code: 'UNKNOWN',
      message: errorLog ?? errStr,
      instructionIndex,
      knownError: {
        errorType: 'UNKNOWN',
        friendlyMessage: 'Erreur lors de la simulation',
        suggestedAction: 'Vérifiez les paramètres et réessayez',
        isRecoverable: true,
      },
    };
  }
  
  /**
   * Parse les changements de balance depuis les logs
   */
  private parseBalanceChanges(logs: string[]): BalanceChange[] {
    // Les changements de balance ne sont pas directement dans les logs
    // Cette info vient des accounts retournés par la simulation
    return [];
  }
  
  /**
   * Parse les changements de balance spécifiques
   */
  private parseBalanceChangesFromLogs(
    logs: string[],
    userPubkey: string
  ): { input: number; output: number; sol: number } {
    // Parser les logs pour extraire les montants
    // Format typique: "Program log: Transferred X tokens"
    let input = 0;
    let output = 0;
    
    for (const log of logs) {
      const transferMatch = log.match(/Transfer(?:red)?\s+(\d+)/i);
      if (transferMatch) {
        const amount = parseInt(transferMatch[1], 10);
        if (input === 0) {
          input = -amount; // Premier transfert = sortie
        } else {
          output = amount; // Second transfert = entrée
        }
      }
    }
    
    return { input, output, sol: 0 };
  }
  
  /**
   * Génère une clé de cache pour une transaction
   */
  private getCacheKey(transaction: VersionedTransaction): string {
    // Utiliser les premiers bytes de la transaction sérialisée
    const serialized = transaction.serialize();
    const hash = serialized.slice(0, 32);
    return Buffer.from(hash).toString('hex');
  }
  
  /**
   * Crée un résultat d'erreur
   */
  private createErrorResult(error: unknown, simulationMs: number): SimulationResult {
    return {
      success: false,
      error: {
        code: 'SIMULATION_FAILED',
        message: error instanceof Error ? error.message : 'Erreur de simulation',
        knownError: {
          errorType: 'UNKNOWN',
          friendlyMessage: 'Impossible de simuler la transaction',
          suggestedAction: 'Vérifiez votre connexion et réessayez',
          isRecoverable: true,
        },
      },
      logs: [],
      unitsConsumed: 0,
      slot: 0,
      balanceChanges: [],
      warnings: [],
      timing: { simulationMs, timestamp: Date.now() },
    };
  }
  
  /**
   * Nettoie le cache
   */
  clearCache(): void {
    this.simulationCache.clear();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let simulatorInstance: TransactionSimulator | null = null;

export function getTransactionSimulator(connection: Connection): TransactionSimulator {
  if (!simulatorInstance) {
    simulatorInstance = new TransactionSimulator(connection);
  }
  return simulatorInstance;
}

export default TransactionSimulator;
