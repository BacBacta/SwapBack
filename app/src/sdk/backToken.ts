import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";

/**
 * Configuration du token $BACK
 */
export interface BackTokenConfig {
  mintAddress: PublicKey;
  treasuryAddress: PublicKey;
  transferHookProgramId: PublicKey;
  decimals: number;
  totalSupply: number;
  burnPercentage: number; // En pourcentage (0.1 = 0.1%)
}

/**
 * Client pour interagir avec le token $BACK
 */
export class BackTokenClient {
  private readonly connection: Connection;
  private readonly config: BackTokenConfig;

  constructor(connection: Connection, config: BackTokenConfig) {
    this.connection = connection;
    this.config = config;
  }

  /**
   * Crée un compte ATA pour le token $BACK
   */
  async createAssociatedTokenAccount(owner: PublicKey): Promise<PublicKey> {
    const ata = await getOrCreateAssociatedTokenAccount(
      this.connection,
      Keypair.generate(), // Payer temporaire
      this.config.mintAddress,
      owner
    );

    return ata.address;
  }

  /**
   * Transfert des tokens $BACK avec burn automatique
   */
  async transfer(
    from: Keypair,
    to: PublicKey,
    amount: number
  ): Promise<string> {
    const fromAta = await this.createAssociatedTokenAccount(from.publicKey);
    const toAta = await this.createAssociatedTokenAccount(to);

    // Calculer le montant après burn (le burn est automatique via Transfer Hook)
    const transferAmount = Math.floor(amount * 10 ** this.config.decimals);

    const signature = await transfer(
      this.connection,
      from,
      fromAta,
      toAta,
      from.publicKey,
      transferAmount
    );

    // Le burn automatique (0.1%) est effectué par le Transfer Hook
    const burnAmount = Math.floor(
      transferAmount * (this.config.burnPercentage / 100)
    );

    console.log(
      `Transfer: ${amount} $BACK (burn: ${burnAmount / 10 ** this.config.decimals} $BACK)`
    );

    return signature;
  }

  /**
   * Distribution initiale depuis la trésorerie
   */
  async distributeFromTreasury(
    treasuryAuthority: Keypair,
    recipient: PublicKey,
    amount: number
  ): Promise<string> {
    const treasuryAta = await this.createAssociatedTokenAccount(
      this.config.treasuryAddress
    );
    const recipientAta = await this.createAssociatedTokenAccount(recipient);

    const transferAmount = Math.floor(amount * 10 ** this.config.decimals);

    const signature = await transfer(
      this.connection,
      treasuryAuthority,
      treasuryAta,
      recipientAta,
      treasuryAuthority.publicKey,
      transferAmount
    );

    return signature;
  }

  /**
   * Vérifie le solde d'un compte
   */
  async getBalance(owner: PublicKey): Promise<number> {
    const ata = await this.createAssociatedTokenAccount(owner);
    const balance = await this.connection.getTokenAccountBalance(ata);

    return parseFloat(balance.value.uiAmountString || "0");
  }

  /**
   * Récupère les statistiques du token
   */
  async getTokenStats(): Promise<{
    supply: number;
    burned: number;
    circulating: number;
  }> {
    // Pour le moment, on simule les stats (à remplacer par données réelles)
    const totalSupply = this.config.totalSupply;
    const burned = 0; // À récupérer depuis le Transfer Hook program
    const circulating = totalSupply - burned;

    return {
      supply: totalSupply,
      burned,
      circulating,
    };
  }

  /**
   * Calcule le montant après burn pour un transfert
   */
  calculateAmountAfterBurn(amount: number): number {
    const burnAmount = amount * (this.config.burnPercentage / 100);
    return amount - burnAmount;
  }

  /**
   * Estime le burn pour un montant donné
   */
  estimateBurn(amount: number): number {
    return amount * (this.config.burnPercentage / 100);
  }
}

/**
 * Fonction utilitaire pour créer un client $BACK
 */
export async function createBackTokenClient(
  connection: Connection,
  config: BackTokenConfig
): Promise<BackTokenClient> {
  return new BackTokenClient(connection, config);
}
