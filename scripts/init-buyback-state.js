#!/usr/bin/env node
/**
 * Initialise le buyback state pour le nouveau Program ID (devnet)
 * Utilise Anchor pour appeler l'instruction initialize()
 */

const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const BUYBACK_PROGRAM_ID = new anchor.web3.PublicKey('4cyYvpjwERF67UDpd5euYzZ6xZ5tcDL6XrByBaZbVVjK');
const BACK_MINT = new anchor.web3.PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux');
const USDC_MINT = new anchor.web3.PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

const DEFAULT_MIN_USDC = 100 * 1_000_000; // 100 USDC en lamports

async function main() {
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';
  const walletPath = process.env.ANCHOR_WALLET || path.join(process.cwd(), 'devnet-keypair.json');

  if (!fs.existsSync(walletPath)) {
    throw new Error(`Anchor wallet introuvable: ${walletPath}`);
  }

  const secret = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const walletKeypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new anchor.web3.Connection(rpcUrl, 'confirmed');
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());
  anchor.setProvider(provider);

  const idlPath = path.join(__dirname, '..', 'target', 'idl', 'swapback_buyback.json');
  if (!fs.existsSync(idlPath)) {
    throw new Error('IDL introuvable. Lancez `anchor build` d\'abord.');
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  // Certaines versions d'IDL ne contiennent pas la taille des accounts, ce qui casse l'AccountFactory d'Anchor côté client.
  // On neutralise donc la section accounts pour éviter les accès à account.type.size.
  const sanitizedIdl = {
    ...idl,
    address: BUYBACK_PROGRAM_ID.toString(),
    accounts: [],
  };
  console.log('IDL fields:', Object.keys(sanitizedIdl));
  console.log('Instructions count:', sanitizedIdl.instructions?.length ?? 0);
  // Anchor infers the program ID from idl.address, so we only pass the provider here.
  const program = new anchor.Program(sanitizedIdl, provider);

  const [buybackState] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('buyback_state')],
    BUYBACK_PROGRAM_ID
  );
  const [usdcVault] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('usdc_vault')],
    BUYBACK_PROGRAM_ID
  );

  const minUsdcLamports = parseInt(process.env.MIN_BUYBACK_USDC ?? '100', 10) * 1_000_000 || DEFAULT_MIN_USDC;

  console.log('🚀 Initialisation du buyback state');
  console.log('   Program ID :', BUYBACK_PROGRAM_ID.toString());
  console.log('   Authority  :', wallet.publicKey.toString());
  console.log('   Min buyback:', minUsdcLamports / 1_000_000, 'USDC');
  console.log('   Buyback PDA:', buybackState.toString());
  console.log('   USDC Vault :', usdcVault.toString());

  const txSig = await program.methods
    .initialize(new anchor.BN(minUsdcLamports))
    .accounts({
      buybackState,
      backMint: BACK_MINT,
      usdcVault,
      usdcMint: USDC_MINT,
      authority: wallet.publicKey,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  console.log('✅ Buyback state initialisé');
  console.log('   Transaction:', txSig);
}

main().catch((err) => {
  console.error('❌ Échec de l\'initialisation:', err.message);
  if (err?.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
