import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';

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
  setProgram(idl: any) {
    const provider = new AnchorProvider(this.connection, this.wallet, {});
    this.program = new Program(idl as any, provider);
  }

  /**
   * Initialise la collection cNFT
   */
  async initializeCollection(
    authority: Keypair,
    treeConfig: PublicKey
  ): Promise<string> {
    if (!this.program) throw new Error('Programme non initialisé');

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
    user: Keypair,
    level: 'Bronze' | 'Silver' | 'Gold',
    amountLocked: number,
    lockDuration: number
  ): Promise<string> {
    // TODO: Implémenter avec les vraies instructions Bubblegum
    throw new Error('mintLevelNft nécessite l\'implémentation complète des comptes Bubblegum');
  }

  /**
   * Met à jour le statut d'un NFT
   */
  async updateNftStatus(
    user: Keypair,
    isActive: boolean
  ): Promise<string> {
    if (!this.program) throw new Error('Programme non initialisé');

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
  private getUserNftPDA(user: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_nft'), user.toBuffer()],
      this.config.programId
    );
    return pda;
  }
}

// Configuration par défaut
export const DEFAULT_CNFT_CONFIG: CnftConfig = {
  programId: new PublicKey('HCsNTpvkUGV7XMAw5VsBSR4Kxvt5x59iFDAeucvY4cre'),
  collectionConfig: (() => {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_config')],
      new PublicKey('HCsNTpvkUGV7XMAw5VsBSR4Kxvt5x59iFDAeucvY4cre')
    );
    return pda;
  })(),
};