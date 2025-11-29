import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, type Idl } from "@coral-xyz/anchor";
import { createProgramWithProvider } from "./utils/program";

// Note: L'IDL sera généré après le build du programme
// Pour l'instant, on utilise une interface basique

export interface CnftConfig {
  programId: PublicKey;
  collectionConfig: PublicKey;
}

export class CnftClient {
  private program: Program | null = null;
  private readonly connection: Connection;
  private readonly wallet: Wallet;
  private readonly config: CnftConfig;

  constructor(connection: Connection, wallet: Wallet, config: CnftConfig) {
    this.connection = connection;
    this.wallet = wallet;
    this.config = config;
    // Le programme sera initialisé après génération de l'IDL
  }

  /**
   * Initialise le programme (à appeler après génération de l'IDL)
   */
  setProgram(idl: Idl) {
    const provider = new AnchorProvider(this.connection, this.wallet, {});
    this.program = createProgramWithProvider(idl, this.config.programId, provider);
  }

  /**
   * Initialise la collection cNFT
   */
  async initializeCollection(
    authority: Keypair,
    treeConfig: PublicKey
  ): Promise<string> {
    if (!this.program) throw new Error("Programme non initialisé");

    const tx = await this.program.methods
      .initializeCollection()
      .accounts({
        collectionConfig: this.config.collectionConfig,
        treeConfig,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    console.log(`Collection cNFT initialisée: ${tx}`);
    return tx;
  }

  /**
   * Mint un cNFT de niveau pour un utilisateur
   * Note: Cette méthode nécessite l'implémentation complète des comptes Bubblegum
   */
  async mintLevelNft(
    _user: Keypair,
    _level: "Bronze" | "Silver" | "Gold",
    _amountLocked: number,
    _lockDuration: number
  ): Promise<string> {
    // Not implemented - swapback_cnft uses PDA-based locks, not Bubblegum cNFTs
    // Use lock_tokens instruction instead for token locking with boost
    throw new Error(
      "mintLevelNft non utilisé - utilisez lock_tokens du programme swapback_cnft"
    );
  }

  /**
   * Met à jour le statut d'un NFT
   */
  async updateNftStatus(user: Keypair, isActive: boolean): Promise<string> {
    if (!this.program) throw new Error("Programme non initialisé");

    const userNftPDA = this.getUserNftPDA(user.publicKey);

    const tx = await this.program.methods
      .updateNftStatus(isActive)
      .accounts({
        userNft: userNftPDA,
        user: user.publicKey,
      })
      .signers([user])
      .rpc();

    console.log(`Statut NFT mis à jour: ${tx}`);
    return tx;
  }

  // Méthodes utilitaires
  private async getUserNftPDA(user: PublicKey): Promise<PublicKey> {
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from("user_nft"), user.toBuffer()],
      this.config.programId
    );
    return pda;
  }
}

// Configuration par défaut - Note: PDA sera calculé de manière asynchrone
export const DEFAULT_CNFT_CONFIG: CnftConfig = {
  programId: new PublicKey("HCsNTpvkUGV7XMAw5VsBSR4Kxvt5x59iFDAeucvY4cre"),
  collectionConfig: (() => {
    // Using a placeholder - should be calculated async in production
    const pda = new PublicKey("11111111111111111111111111111111");
    return pda;
  })(),
};
