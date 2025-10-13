/**
 * Blockchain Tracer - Système de traçabilité des opérations SwapBack
 * Enregistre toutes les opérations (swap, lock, unlock) sur la blockchain Solana
 */

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  TransactionInstruction,
  Keypair,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

/**
 * Types d'opérations traçables
 */
export enum OperationType {
  SWAP = 'SWAP',
  LOCK = 'LOCK',
  UNLOCK = 'UNLOCK',
  STAKE = 'STAKE',
  UNSTAKE = 'UNSTAKE',
  CLAIM_REWARD = 'CLAIM_REWARD',
  BURN = 'BURN'
}

/**
 * Statut d'une opération
 */
export enum OperationStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

/**
 * Structure d'une opération tracée
 */
export interface TracedOperation {
  id: string; // Hash de la transaction
  type: OperationType;
  status: OperationStatus;
  timestamp: number;
  user: string; // PublicKey de l'utilisateur
  
  // Détails selon le type d'opération
  details: SwapDetails | LockDetails | UnlockDetails | StakeDetails | BurnDetails;
  
  // Informations blockchain
  signature: string;
  slot: number;
  blockTime?: number;
  
  // Métadonnées
  npi?: number; // Net Price Improvement
  rebate?: number; // Remise utilisateur
  burn?: number; // Montant brûlé
  fees?: number; // Frais de transaction
}

/**
 * Détails d'un swap
 */
export interface SwapDetails {
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  route: string[]; // Liste des DEX utilisés
  priceImpact: number;
  slippage: number;
}

/**
 * Détails d'un lock
 */
export interface LockDetails {
  token: string;
  amount: number;
  duration: number; // en secondes
  unlockDate: number; // timestamp
  lockType: 'LIQUIDITY' | 'GOVERNANCE' | 'STAKING';
}

/**
 * Détails d'un unlock
 */
export interface UnlockDetails {
  token: string;
  amount: number;
  lockId: string;
  penalty?: number; // Pénalité si unlock anticipé
}

/**
 * Détails d'un stake
 */
export interface StakeDetails {
  token: string;
  amount: number;
  apy: number;
  duration?: number;
}

/**
 * Détails d'un burn
 */
export interface BurnDetails {
  token: string;
  amount: number;
  reason: 'OPTIMIZATION' | 'GOVERNANCE' | 'PENALTY';
}

/**
 * Configuration du tracer
 */
export interface TracerConfig {
  connection: Connection;
  programId: PublicKey;
  tracerAccountPubkey?: PublicKey; // Compte PDA pour stocker l'historique
  maxHistorySize?: number; // Nombre max d'opérations à garder
}

/**
 * Classe principale pour tracer les opérations blockchain
 */
export class BlockchainTracer {
  private connection: Connection;
  private programId: PublicKey;
  private tracerAccountPubkey?: PublicKey;
  private maxHistorySize: number;
  
  constructor(config: TracerConfig) {
    this.connection = config.connection;
    this.programId = config.programId;
    this.tracerAccountPubkey = config.tracerAccountPubkey;
    this.maxHistorySize = config.maxHistorySize || 1000;
  }

  /**
   * Enregistre une opération de swap sur la blockchain
   */
  async traceSwap(
    userPubkey: PublicKey,
    swapDetails: SwapDetails,
    metadata?: {
      npi?: number;
      rebate?: number;
      burn?: number;
      fees?: number;
    }
  ): Promise<TracedOperation> {
    console.log('📝 Traçage du swap sur la blockchain...');
    
    try {
      // Créer l'instruction de traçage
      const instruction = await this.createTraceInstruction(
        OperationType.SWAP,
        userPubkey,
        swapDetails
      );

      // Créer et envoyer la transaction
      const transaction = new Transaction().add(instruction);
      const signature = await this.connection.sendTransaction(
        transaction,
        [/* signers */],
        { skipPreflight: false }
      );

      // Attendre la confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');

      // Récupérer les détails de la transaction
      const txDetails = await this.connection.getTransaction(signature, {
        commitment: 'confirmed'
      });

      const operation: TracedOperation = {
        id: signature,
        type: OperationType.SWAP,
        status: OperationStatus.SUCCESS,
        timestamp: Date.now(),
        user: userPubkey.toBase58(),
        details: swapDetails,
        signature,
        slot: txDetails?.slot || 0,
        blockTime: txDetails?.blockTime || undefined,
        ...metadata
      };

      console.log('✅ Swap tracé avec succès:', signature);
      return operation;
      
    } catch (error) {
      console.error('❌ Erreur lors du traçage du swap:', error);
      throw error;
    }
  }

  /**
   * Enregistre une opération de lock
   */
  async traceLock(
    userPubkey: PublicKey,
    lockDetails: LockDetails
  ): Promise<TracedOperation> {
    console.log('📝 Traçage du lock sur la blockchain...');
    
    try {
      const instruction = await this.createTraceInstruction(
        OperationType.LOCK,
        userPubkey,
        lockDetails
      );

      const transaction = new Transaction().add(instruction);
      const signature = await this.connection.sendTransaction(
        transaction,
        [],
        { skipPreflight: false }
      );

      await this.connection.confirmTransaction(signature, 'confirmed');
      const txDetails = await this.connection.getTransaction(signature, {
        commitment: 'confirmed'
      });

      const operation: TracedOperation = {
        id: signature,
        type: OperationType.LOCK,
        status: OperationStatus.SUCCESS,
        timestamp: Date.now(),
        user: userPubkey.toBase58(),
        details: lockDetails,
        signature,
        slot: txDetails?.slot || 0,
        blockTime: txDetails?.blockTime || undefined
      };

      console.log('✅ Lock tracé avec succès:', signature);
      return operation;
      
    } catch (error) {
      console.error('❌ Erreur lors du traçage du lock:', error);
      throw error;
    }
  }

  /**
   * Enregistre une opération d'unlock
   */
  async traceUnlock(
    userPubkey: PublicKey,
    unlockDetails: UnlockDetails
  ): Promise<TracedOperation> {
    console.log('📝 Traçage du unlock sur la blockchain...');
    
    try {
      const instruction = await this.createTraceInstruction(
        OperationType.UNLOCK,
        userPubkey,
        unlockDetails
      );

      const transaction = new Transaction().add(instruction);
      const signature = await this.connection.sendTransaction(
        transaction,
        [],
        { skipPreflight: false }
      );

      await this.connection.confirmTransaction(signature, 'confirmed');
      const txDetails = await this.connection.getTransaction(signature, {
        commitment: 'confirmed'
      });

      const operation: TracedOperation = {
        id: signature,
        type: OperationType.UNLOCK,
        status: OperationStatus.SUCCESS,
        timestamp: Date.now(),
        user: userPubkey.toBase58(),
        details: unlockDetails,
        signature,
        slot: txDetails?.slot || 0,
        blockTime: txDetails?.blockTime || undefined
      };

      console.log('✅ Unlock tracé avec succès:', signature);
      return operation;
      
    } catch (error) {
      console.error('❌ Erreur lors du traçage du unlock:', error);
      throw error;
    }
  }

  /**
   * Enregistre une opération de burn
   */
  async traceBurn(
    userPubkey: PublicKey,
    burnDetails: BurnDetails
  ): Promise<TracedOperation> {
    console.log('📝 Traçage du burn sur la blockchain...');
    
    try {
      const instruction = await this.createTraceInstruction(
        OperationType.BURN,
        userPubkey,
        burnDetails
      );

      const transaction = new Transaction().add(instruction);
      const signature = await this.connection.sendTransaction(
        transaction,
        [],
        { skipPreflight: false }
      );

      await this.connection.confirmTransaction(signature, 'confirmed');
      const txDetails = await this.connection.getTransaction(signature, {
        commitment: 'confirmed'
      });

      const operation: TracedOperation = {
        id: signature,
        type: OperationType.BURN,
        status: OperationStatus.SUCCESS,
        timestamp: Date.now(),
        user: userPubkey.toBase58(),
        details: burnDetails,
        signature,
        slot: txDetails?.slot || 0,
        blockTime: txDetails?.blockTime || undefined
      };

      console.log('✅ Burn tracé avec succès:', signature);
      return operation;
      
    } catch (error) {
      console.error('❌ Erreur lors du traçage du burn:', error);
      throw error;
    }
  }

  /**
   * Récupère l'historique des opérations d'un utilisateur
   */
  async getOperationHistory(
    userPubkey: PublicKey,
    options?: {
      type?: OperationType;
      limit?: number;
      beforeSignature?: string;
    }
  ): Promise<TracedOperation[]> {
    console.log('📖 Récupération de l\'historique des opérations...');
    
    try {
      // Récupérer les signatures de transactions
      const signatures = await this.connection.getSignaturesForAddress(
        userPubkey,
        {
          limit: options?.limit || 100,
          before: options?.beforeSignature
        }
      );

      // Récupérer les détails de chaque transaction
      const operations: TracedOperation[] = [];
      
      for (const sig of signatures) {
        try {
          const tx = await this.connection.getTransaction(sig.signature, {
            commitment: 'confirmed'
          });

          if (!tx) continue;

          // Parser les détails de la transaction
          const operation = await this.parseTransactionToOperation(tx, sig.signature);
          
          if (operation && (!options?.type || operation.type === options.type)) {
            operations.push(operation);
          }
        } catch (error) {
          console.warn('⚠️ Erreur lors du parsing de la tx:', sig.signature, error);
        }
      }

      console.log(`✅ ${operations.length} opérations récupérées`);
      return operations;
      
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de l\'historique:', error);
      throw error;
    }
  }

  /**
   * Récupère une opération spécifique par sa signature
   */
  async getOperation(signature: string): Promise<TracedOperation | null> {
    console.log('🔍 Recherche de l\'opération:', signature);
    
    try {
      const tx = await this.connection.getTransaction(signature, {
        commitment: 'confirmed'
      });

      if (!tx) {
        console.log('❌ Transaction non trouvée');
        return null;
      }

      const operation = await this.parseTransactionToOperation(tx, signature);
      console.log('✅ Opération trouvée:', operation?.type);
      return operation;
      
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de l\'opération:', error);
      return null;
    }
  }

  /**
   * Récupère les statistiques d'un utilisateur
   */
  async getUserStatistics(userPubkey: PublicKey): Promise<{
    totalSwaps: number;
    totalLocks: number;
    totalUnlocks: number;
    totalBurns: number;
    totalVolume: number;
    totalSavings: number; // Économies via NPI
    firstOperation?: number;
    lastOperation?: number;
  }> {
    console.log('📊 Calcul des statistiques utilisateur...');
    
    const operations = await this.getOperationHistory(userPubkey, { limit: 1000 });
    
    const stats = {
      totalSwaps: 0,
      totalLocks: 0,
      totalUnlocks: 0,
      totalBurns: 0,
      totalVolume: 0,
      totalSavings: 0,
      firstOperation: undefined as number | undefined,
      lastOperation: undefined as number | undefined
    };

    for (const op of operations) {
      // Compter par type
      switch (op.type) {
        case OperationType.SWAP:
          stats.totalSwaps++;
          const swapDetails = op.details as SwapDetails;
          stats.totalVolume += swapDetails.inputAmount;
          if (op.npi) stats.totalSavings += op.npi;
          break;
        case OperationType.LOCK:
          stats.totalLocks++;
          break;
        case OperationType.UNLOCK:
          stats.totalUnlocks++;
          break;
        case OperationType.BURN:
          stats.totalBurns++;
          break;
      }

      // Timestamps
      if (!stats.firstOperation || op.timestamp < stats.firstOperation) {
        stats.firstOperation = op.timestamp;
      }
      if (!stats.lastOperation || op.timestamp > stats.lastOperation) {
        stats.lastOperation = op.timestamp;
      }
    }

    console.log('✅ Statistiques calculées:', stats);
    return stats;
  }

  /**
   * Crée une instruction de traçage personnalisée
   */
  private async createTraceInstruction(
    operationType: OperationType,
    userPubkey: PublicKey,
    details: any
  ): Promise<TransactionInstruction> {
    // Sérialiser les détails de l'opération
    const data = Buffer.from(
      JSON.stringify({
        type: operationType,
        details,
        timestamp: Date.now()
      })
    );

    // Créer l'instruction
    return new TransactionInstruction({
      keys: [
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: this.programId, isSigner: false, isWritable: false }
      ],
      programId: this.programId,
      data
    });
  }

  /**
   * Parse une transaction pour extraire l'opération
   */
  private async parseTransactionToOperation(
    tx: any,
    signature: string
  ): Promise<TracedOperation | null> {
    try {
      // Parser les instructions de la transaction
      // Ceci est une version simplifiée - à adapter selon le format réel
      const instruction = tx.transaction.message.instructions[0];
      
      if (!instruction) return null;

      // Décoder les données
      const decodedData = JSON.parse(instruction.data.toString());
      
      return {
        id: signature,
        type: decodedData.type,
        status: tx.meta?.err ? OperationStatus.FAILED : OperationStatus.SUCCESS,
        timestamp: decodedData.timestamp || tx.blockTime! * 1000,
        user: tx.transaction.message.accountKeys[0].toBase58(),
        details: decodedData.details,
        signature,
        slot: tx.slot,
        blockTime: tx.blockTime || undefined
      };
      
    } catch (error) {
      console.error('Erreur lors du parsing:', error);
      return null;
    }
  }

  /**
   * Exporte l'historique au format CSV
   */
  async exportHistoryToCSV(
    userPubkey: PublicKey,
    filePath?: string
  ): Promise<string> {
    const operations = await this.getOperationHistory(userPubkey);
    
    const headers = [
      'Signature',
      'Type',
      'Status',
      'Date',
      'Details',
      'NPI',
      'Rebate',
      'Burn',
      'Fees'
    ].join(',');

    const rows = operations.map(op => {
      const date = new Date(op.timestamp).toISOString();
      const details = JSON.stringify(op.details).replace(/,/g, ';');
      
      return [
        op.signature,
        op.type,
        op.status,
        date,
        details,
        op.npi || 0,
        op.rebate || 0,
        op.burn || 0,
        op.fees || 0
      ].join(',');
    });

    const csv = [headers, ...rows].join('\n');
    
    if (filePath) {
      // Écrire dans un fichier (nécessite fs)
      console.log('💾 Export CSV vers:', filePath);
    }

    return csv;
  }
}

/**
 * Factory pour créer une instance du tracer
 */
export function createBlockchainTracer(
  connection: Connection,
  programId: string | PublicKey
): BlockchainTracer {
  const programPubkey = typeof programId === 'string' 
    ? new PublicKey(programId) 
    : programId;

  return new BlockchainTracer({
    connection,
    programId: programPubkey
  });
}

/**
 * Utilitaires pour formater les opérations
 */
export class OperationFormatter {
  /**
   * Formate une opération pour l'affichage
   */
  static format(operation: TracedOperation): string {
    const date = new Date(operation.timestamp).toLocaleString();
    const status = operation.status === OperationStatus.SUCCESS ? '✅' : '❌';
    
    let detailsStr = '';
    switch (operation.type) {
      case OperationType.SWAP:
        const swap = operation.details as SwapDetails;
        detailsStr = `${swap.inputAmount} ${swap.inputToken} → ${swap.outputAmount} ${swap.outputToken}`;
        break;
      case OperationType.LOCK:
        const lock = operation.details as LockDetails;
        detailsStr = `${lock.amount} ${lock.token} (${lock.duration}s)`;
        break;
      case OperationType.UNLOCK:
        const unlock = operation.details as UnlockDetails;
        detailsStr = `${unlock.amount} ${unlock.token}`;
        break;
    }

    return `${status} ${operation.type} | ${date} | ${detailsStr} | Sig: ${operation.signature.substring(0, 8)}...`;
  }

  /**
   * Génère un rapport détaillé
   */
  static generateReport(operations: TracedOperation[]): string {
    const report: string[] = [
      '╔════════════════════════════════════════════╗',
      '║     RAPPORT D\'OPÉRATIONS BLOCKCHAIN       ║',
      '╚════════════════════════════════════════════╝',
      ''
    ];

    // Statistiques globales
    const stats = {
      total: operations.length,
      swaps: operations.filter(op => op.type === OperationType.SWAP).length,
      locks: operations.filter(op => op.type === OperationType.LOCK).length,
      unlocks: operations.filter(op => op.type === OperationType.UNLOCK).length,
      success: operations.filter(op => op.status === OperationStatus.SUCCESS).length,
      failed: operations.filter(op => op.status === OperationStatus.FAILED).length
    };

    report.push(`Total d'opérations: ${stats.total}`);
    report.push(`  - Swaps:   ${stats.swaps}`);
    report.push(`  - Locks:   ${stats.locks}`);
    report.push(`  - Unlocks: ${stats.unlocks}`);
    report.push(`  - Succès:  ${stats.success}`);
    report.push(`  - Échecs:  ${stats.failed}`);
    report.push('');
    report.push('─'.repeat(48));
    report.push('');

    // Liste des opérations
    operations.forEach(op => {
      report.push(this.format(op));
    });

    return report.join('\n');
  }
}
