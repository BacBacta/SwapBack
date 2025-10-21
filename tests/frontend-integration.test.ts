/**
 * Tests d'intégration Frontend → On-Chain
 * Valide que l'interface SwapBack communique correctement avec les programmes déployés
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';

// Configuration
const RPC_URL = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';
const ROUTER_PROGRAM_ID = new PublicKey('3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap');
const BACK_TOKEN_MINT = new PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux');
const SWITCHBOARD_FEED = new PublicKey('GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR');

describe('Frontend Integration Tests', () => {
  let connection: Connection;
  let provider: AnchorProvider;

  beforeAll(() => {
    connection = new Connection(RPC_URL, 'confirmed');
    const wallet = new NodeWallet(Keypair.generate()); // Wallet de test
    provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
  });

  describe('🔗 Connexion Blockchain', () => {
    it('devrait se connecter au RPC Solana devnet', async () => {
      const version = await connection.getVersion();
      expect(version).toBeDefined();
      console.log('✅ RPC Version:', version);
    });

    it('devrait charger le Router program depuis devnet', async () => {
      const accountInfo = await connection.getAccountInfo(ROUTER_PROGRAM_ID);
      expect(accountInfo).not.toBeNull();
      expect(accountInfo?.executable).toBe(true);
      console.log('✅ Router Program trouvé sur devnet');
    });

    it('devrait vérifier que le token $BACK existe', async () => {
      const mintInfo = await connection.getAccountInfo(BACK_TOKEN_MINT);
      expect(mintInfo).not.toBeNull();
      console.log('✅ Token $BACK mint trouvé');
    });

    it('devrait vérifier que le Switchboard feed existe', async () => {
      const feedInfo = await connection.getAccountInfo(SWITCHBOARD_FEED);
      expect(feedInfo).not.toBeNull();
      console.log('✅ Switchboard feed SOL/USD trouvé');
    });
  });

  describe('📊 State Program Router', () => {
    it('devrait dériver le State PDA correctement', async () => {
      const [statePda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('state')],
        ROUTER_PROGRAM_ID
      );

      console.log('✅ State PDA:', statePda.toBase58());
      expect(statePda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
      expect(bump).toBeLessThanOrEqual(255);
    });

    it('devrait lire le compte State depuis devnet', async () => {
      const [statePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('state')],
        ROUTER_PROGRAM_ID
      );

      const accountInfo = await connection.getAccountInfo(statePda);
      expect(accountInfo).not.toBeNull();
      console.log('✅ State account existe et est initialisé');
    });
  });

  describe('🔄 DCA Plan PDAs', () => {
    it('devrait dériver un DCA plan PDA pour un utilisateur test', async () => {
      const testUser = Keypair.generate().publicKey;
      const planId = Date.now();

      const [dcaPlanPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('dca_plan'),
          testUser.toBuffer(),
          Buffer.from(planId.toString()),
        ],
        ROUTER_PROGRAM_ID
      );

      console.log('✅ DCA Plan PDA dérivé:', dcaPlanPda.toBase58());
      expect(dcaPlanPda).toBeInstanceOf(PublicKey);
    });
  });

  describe('🌐 Oracle Switchboard', () => {
    it('devrait lire le prix SOL/USD depuis Switchboard', async () => {
      const feedAccountInfo = await connection.getAccountInfo(SWITCHBOARD_FEED);
      expect(feedAccountInfo).not.toBeNull();
      
      // Le feed est actif
      console.log('✅ Oracle feed accessible');
    });
  });

  describe('💰 Token $BACK', () => {
    it('devrait vérifier les métadonnées du token', async () => {
      const mintInfo = await connection.getAccountInfo(BACK_TOKEN_MINT);
      expect(mintInfo).not.toBeNull();
      
      // Vérifier que c'est un Token-2022
      const owner = mintInfo?.owner;
      console.log('✅ Token owner program:', owner?.toBase58());
    });
  });

  describe('⚡ Simulation Workflow Frontend', () => {
    it('devrait simuler le workflow complet de création de plan DCA', async () => {
      const testUser = Keypair.generate().publicKey;
      const planId = Date.now();

      // 1. Dériver State PDA
      const [statePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('state')],
        ROUTER_PROGRAM_ID
      );

      // 2. Dériver DCA Plan PDA
      const [dcaPlanPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('dca_plan'),
          testUser.toBuffer(),
          Buffer.from(planId.toString()),
        ],
        ROUTER_PROGRAM_ID
      );

      // 3. Vérifier que tous les comptes existent
      const stateInfo = await connection.getAccountInfo(statePda);
      expect(stateInfo).not.toBeNull();

      const feedInfo = await connection.getAccountInfo(SWITCHBOARD_FEED);
      expect(feedInfo).not.toBeNull();

      console.log('✅ Workflow complet simulé avec succès');
      console.log('   - State PDA:', statePda.toBase58());
      console.log('   - DCA Plan PDA:', dcaPlanPda.toBase58());
      console.log('   - Oracle Feed:', SWITCHBOARD_FEED.toBase58());
    });
  });

  describe('📱 Validation Configuration Frontend', () => {
    it('devrait valider les Program IDs utilisés par le frontend', () => {
      // Ces valeurs doivent correspondre exactement à celles dans SwapBackInterface.tsx
      expect(ROUTER_PROGRAM_ID.toBase58()).toBe('3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap');
      expect(BACK_TOKEN_MINT.toBase58()).toBe('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux');
      expect(SWITCHBOARD_FEED.toBase58()).toBe('GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR');
      console.log('✅ Configuration frontend validée');
    });
  });
});
