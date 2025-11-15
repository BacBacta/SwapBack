import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SwapbackCnft } from "../target/types/swapback_cnft";
import { 
  PublicKey, 
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

/**
 * Script de test complet du système lock/unlock
 */
async function testLockUnlock() {
  console.log("🧪 TEST DU SYSTÈME LOCK/UNLOCK");
  console.log("================================\n");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SwapbackCnft as Program<SwapbackCnft>;
  const wallet = provider.wallet as anchor.Wallet;

  console.log("📋 Configuration:");
  console.log(`   Program: ${program.programId.toBase58()}`);
  console.log(`   Wallet: ${wallet.publicKey.toBase58()}\n`);

  // Adresse du token BACK (Token-2022)
  // ⚠️ REMPLACER par votre adresse de token BACK réelle
  const BACK_MINT = new PublicKey("VOTRE_BACK_TOKEN_MINT_ADDRESS");
  
  console.log(`   Token BACK: ${BACK_MINT.toBase58()}\n`);

  // Dériver les PDAs
  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    program.programId
  );

  const [collectionConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    program.programId
  );

  const [userLock] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_lock"), wallet.publicKey.toBuffer()],
    program.programId
  );

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    program.programId
  );

  // Token accounts
  const userTokenAccount = getAssociatedTokenAddressSync(
    BACK_MINT,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const vaultTokenAccount = getAssociatedTokenAddressSync(
    BACK_MINT,
    vaultAuthority,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  console.log("📍 PDAs:");
  console.log(`   GlobalState: ${globalState.toBase58()}`);
  console.log(`   CollectionConfig: ${collectionConfig.toBase58()}`);
  console.log(`   UserLock: ${userLock.toBase58()}`);
  console.log(`   VaultAuthority: ${vaultAuthority.toBase58()}`);
  console.log(`   UserTokenAccount: ${userTokenAccount.toBase58()}`);
  console.log(`   VaultTokenAccount: ${vaultTokenAccount.toBase58()}\n`);

  // Vérifier les comptes existants
  console.log("🔍 Vérification des comptes...");
  
  try {
    const globalStateAccount = await program.account.globalState.fetch(globalState);
    console.log("   ✅ GlobalState existe");
    console.log(`      Boost total: ${globalStateAccount.totalCommunityBoost}`);
    console.log(`      Locks actifs: ${globalStateAccount.activeLocksCount}`);
    console.log(`      TVL: ${globalStateAccount.totalValueLocked / 1e9} BACK\n`);
  } catch {
    console.log("   ❌ GlobalState n'existe pas - Exécuter init-cnft.ts d'abord\n");
    process.exit(1);
  }

  try {
    const collectionConfigAccount = await program.account.collectionConfig.fetch(collectionConfig);
    console.log("   ✅ CollectionConfig existe");
    console.log(`      Total minted: ${collectionConfigAccount.totalMinted}\n`);
  } catch {
    console.log("   ❌ CollectionConfig n'existe pas - Exécuter init-cnft.ts d'abord\n");
    process.exit(1);
  }

  // Vérifier le solde de tokens BACK
  try {
    const tokenBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
    const balance = parseFloat(tokenBalance.value.amount) / 1e9;
    console.log(`💰 Solde BACK: ${balance} tokens`);
    
    if (balance < 100) {
      console.log("   ⚠️  Solde insuffisant pour tester (min 100 BACK recommandé)\n");
    }
  } catch (error) {
    console.log("   ⚠️  Token account non trouvé - Vérifier BACK_MINT\n");
  }

  // TEST 1: Lock de tokens
  console.log("\n═══════════════════════════════════════════════════");
  console.log("📝 TEST 1: LOCK DE TOKENS");
  console.log("═══════════════════════════════════════════════════\n");

  const lockAmount = 1000 * 1e9; // 1000 BACK
  const lockDuration = 30 * 86400; // 30 jours

  console.log(`Montant: ${lockAmount / 1e9} BACK`);
  console.log(`Durée: ${lockDuration / 86400} jours\n`);

  try {
    const txLock = await program.methods
      .lockTokens(new anchor.BN(lockAmount), new anchor.BN(lockDuration))
      .accounts({
        collectionConfig,
        globalState,
        userLock,
        userTokenAccount,
        vaultTokenAccount,
        vaultAuthority,
        backMint: BACK_MINT,
        user: wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Lock réussi!");
    console.log(`   Tx: ${txLock}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${txLock}?cluster=devnet\n`);

    // Vérifier le UserLock créé
    const userLockAccount = await program.account.userLock.fetch(userLock);
    console.log("📊 État du lock:");
    console.log(`   Utilisateur: ${userLockAccount.user.toBase58()}`);
    console.log(`   Niveau: ${JSON.stringify(userLockAccount.level)}`);
    console.log(`   Montant verrouillé: ${userLockAccount.amountLocked / 1e9} BACK`);
    console.log(`   Boost: ${userLockAccount.boost} BP (${userLockAccount.boost / 100}%)`);
    console.log(`   Actif: ${userLockAccount.isActive}\n`);

  } catch (error) {
    console.error("❌ Erreur lors du lock:");
    console.error(error);
    console.log("\n💡 Vérifications:");
    console.log("   - Avez-vous assez de tokens BACK?");
    console.log("   - Le vault token account existe-t-il?");
    console.log("   - Le BACK_MINT est-il correct?\n");
  }

  // Attendre quelques secondes
  console.log("⏳ Attente de 5 secondes avant l'unlock...\n");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // TEST 2: Unlock de tokens
  console.log("═══════════════════════════════════════════════════");
  console.log("📝 TEST 2: UNLOCK DE TOKENS (ANTICIPÉ)");
  console.log("═══════════════════════════════════════════════════\n");

  try {
    const txUnlock = await program.methods
      .unlockTokens()
      .accounts({
        userLock,
        globalState,
        userTokenAccount,
        vaultTokenAccount,
        vaultAuthority,
        backMint: BACK_MINT,
        user: wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ Unlock réussi!");
    console.log(`   Tx: ${txUnlock}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${txUnlock}?cluster=devnet\n`);

    // Vérifier que le lock est désactivé
    const userLockAccountAfter = await program.account.userLock.fetch(userLock);
    console.log("📊 État après unlock:");
    console.log(`   Actif: ${userLockAccountAfter.isActive}`);
    console.log(`   Montant verrouillé: ${userLockAccountAfter.amountLocked / 1e9} BACK`);
    console.log("\n   ✅ Le lock a été correctement désactivé\n");

  } catch (error) {
    console.error("❌ Erreur lors de l'unlock:");
    console.error(error);
  }

  // Récapitulatif final
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║              🎉 TESTS TERMINÉS 🎉                       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\n✅ Si tous les tests sont passés, le système est opérationnel!");
  console.log("\n📋 Prochaines étapes:");
  console.log("   1. Tester sur le frontend");
  console.log("   2. Vérifier les events dans l'explorer");
  console.log("   3. Tester avec différents montants et durées");
}

// Exécution
testLockUnlock()
  .then(() => {
    console.log("\n✅ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur:");
    console.error(error);
    process.exit(1);
  });
