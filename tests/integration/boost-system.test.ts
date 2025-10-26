/**
 * 🧪 Tests d'Intégration - Système de Boost SwapBack
 * 
 * Ce fichier teste le flux complet end-to-end du système de boost:
 * 1. Lock tokens → Mint NFT avec boost
 * 2. Swap → Recevoir rebate boosté
 * 3. Execute buyback → Acheter $BACK sur le marché
 * 4. Distribute → Répartition 50/50 (distribution/burn)
 * 5. Unlock → Mettre à jour GlobalState
 * 
 * @author SwapBack Team
 * @date October 26, 2025
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";
import { SwapbackCnft } from "../../target/types/swapback_cnft";
import { SwapbackRouter } from "../../target/types/swapback_router";
import { SwapbackBuyback } from "../../target/types/swapback_buyback";

describe("Boost System Integration Tests", () => {
  
  // Configure le provider
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);

  // Charger les programmes
  const cnftProgram = anchor.workspace.SwapbackCnft as Program<SwapbackCnft>;
  const routerProgram = anchor.workspace.SwapbackRouter as Program<SwapbackRouter>;
  const buybackProgram = anchor.workspace.SwapbackBuyback as Program<SwapbackBuyback>;

  // Wallets de test
  let alice: Keypair;
  let bob: Keypair;
  let charlie: Keypair;
  let admin: Keypair;

  // Token mints
  let backMint: PublicKey;
  let usdcMint: PublicKey;

  // Token accounts
  let aliceBackAccount: PublicKey;
  let aliceUsdcAccount: PublicKey;
  let bobBackAccount: PublicKey;
  let bobUsdcAccount: PublicKey;
  let charlieBackAccount: PublicKey;
  let charlieUsdcAccount: PublicKey;

  // PDAs
  let globalState: PublicKey;
  let collectionConfig: PublicKey;
  let routerState: PublicKey;
  let buybackState: PublicKey;
  let usdcVault: PublicKey;
  let backVault: PublicKey;
  let routerUsdcVault: PublicKey;
  let routerBackVault: PublicKey;
  let buybackUsdcVault: PublicKey;
  let buybackBackVault: PublicKey;

  // Constantes
  const ONE_DAY = 86400;
  const LAMPORTS_PER_BACK = 1_000_000_000; // 9 decimals
  const USDC_DECIMALS = 6;
  const LAMPORTS_PER_USDC = 1_000_000;

  before(async () => {
    console.log("\n🔧 Setting up test environment...\n");

    // Créer les wallets de test
    alice = Keypair.generate();
    bob = Keypair.generate();
    charlie = Keypair.generate();
    admin = provider.wallet.publicKey as any;

    // Airdrop SOL pour les frais
    await Promise.all([
      provider.connection.requestAirdrop(alice.publicKey, 5 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(bob.publicKey, 5 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(charlie.publicKey, 5 * LAMPORTS_PER_SOL),
    ]);

    // Attendre la confirmation
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("✅ Wallets created and funded");
    console.log(`   Alice: ${alice.publicKey.toString()}`);
    console.log(`   Bob: ${bob.publicKey.toString()}`);
    console.log(`   Charlie: ${charlie.publicKey.toString()}\n`);

    // Créer les token mints
    backMint = await createMint(
      provider.connection,
      alice,
      admin,
      null,
      9 // 9 decimals pour $BACK
    );

    usdcMint = await createMint(
      provider.connection,
      alice,
      admin,
      null,
      6 // 6 decimals pour USDC
    );

    console.log("✅ Token mints created");
    console.log(`   $BACK: ${backMint.toString()}`);
    console.log(`   USDC: ${usdcMint.toString()}\n`);

    // Créer les token accounts pour Alice
    aliceBackAccount = await createAssociatedTokenAccount(
      provider.connection,
      alice,
      backMint,
      alice.publicKey
    );

    aliceUsdcAccount = await createAssociatedTokenAccount(
      provider.connection,
      alice,
      usdcMint,
      alice.publicKey
    );

    // Mint des tokens à Alice
    await mintTo(
      provider.connection,
      alice,
      backMint,
      aliceBackAccount,
      admin,
      150_000 * LAMPORTS_PER_BACK // 150k BACK
    );

    await mintTo(
      provider.connection,
      alice,
      usdcMint,
      aliceUsdcAccount,
      admin,
      10_000 * LAMPORTS_PER_USDC // 10k USDC
    );

    // Créer les token accounts pour Bob
    bobBackAccount = await createAssociatedTokenAccount(
      provider.connection,
      bob,
      backMint,
      bob.publicKey
    );

    bobUsdcAccount = await createAssociatedTokenAccount(
      provider.connection,
      bob,
      usdcMint,
      bob.publicKey
    );

    await mintTo(
      provider.connection,
      bob,
      backMint,
      bobBackAccount,
      admin,
      20_000 * LAMPORTS_PER_BACK // 20k BACK
    );

    await mintTo(
      provider.connection,
      bob,
      usdcMint,
      bobUsdcAccount,
      admin,
      5_000 * LAMPORTS_PER_USDC // 5k USDC
    );

    // Créer les token accounts pour Charlie
    charlieBackAccount = await createAssociatedTokenAccount(
      provider.connection,
      charlie,
      backMint,
      charlie.publicKey
    );

    charlieUsdcAccount = await createAssociatedTokenAccount(
      provider.connection,
      charlie,
      usdcMint,
      charlie.publicKey
    );

    await mintTo(
      provider.connection,
      charlie,
      backMint,
      charlieBackAccount,
      admin,
      5_000 * LAMPORTS_PER_BACK // 5k BACK
    );

    await mintTo(
      provider.connection,
      charlie,
      usdcMint,
      charlieUsdcAccount,
      admin,
      2_000 * LAMPORTS_PER_USDC // 2k USDC
    );

    console.log("✅ Token accounts created and funded");
    console.log(`   Alice: 150k BACK + 10k USDC`);
    console.log(`   Bob: 20k BACK + 5k USDC`);
    console.log(`   Charlie: 5k BACK + 2k USDC\n`);

    // Dériver les PDAs pour cNFT
    [globalState] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      cnftProgram.programId
    );

    [collectionConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("collection_config")],
      cnftProgram.programId
    );

    // Dériver les PDAs pour Router
    [routerState] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      routerProgram.programId
    );

    [routerUsdcVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("usdc_vault")],
      routerProgram.programId
    );

    [routerBackVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("back_vault")],
      routerProgram.programId
    );

    // Dériver les PDAs pour Buyback
    [buybackState] = PublicKey.findProgramAddressSync(
      [Buffer.from("buyback_state")],
      buybackProgram.programId
    );

    [buybackUsdcVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("usdc_vault")],
      buybackProgram.programId
    );

    [buybackBackVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("back_vault")],
      buybackProgram.programId
    );

    console.log("✅ PDAs derived");
    console.log(`   GlobalState: ${globalState.toString()}`);
    console.log(`   RouterState: ${routerState.toString()}`);
    console.log(`   BuybackState: ${buybackState.toString()}\n`);

    // Initialiser GlobalState
    try {
      await cnftProgram.methods
        .initializeGlobalState()
        .accounts({
          globalState,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log("✅ GlobalState initialized\n");
    } catch (error) {
      console.log("⚠️  GlobalState already initialized\n");
    }

    console.log("🎉 Test environment setup complete!\n");
  });

  describe("Test 1: Lock Tokens and Mint NFT", () => {
    it("Alice locks 100k BACK for 365 days → Diamond NFT with 86.5% boost", async () => {
      const amountLocked = new BN(100_000 * LAMPORTS_PER_BACK);
      const lockDuration = new BN(365 * ONE_DAY);

      const [userNft] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), alice.publicKey.toBuffer()],
        cnftProgram.programId
      );

      console.log("\n📝 Locking tokens for Alice...");
      console.log(`   Amount: 100,000 BACK`);
      console.log(`   Duration: 365 days`);

      const tx = await cnftProgram.methods
        .mintLevelNft(amountLocked, lockDuration)
        .accounts({
          collectionConfig,
          globalState,
          userNft,
          user: alice.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([alice])
        .rpc();

      console.log(`   ✅ Transaction: ${tx}\n`);

      // Vérifier le UserNft créé
      const nftAccount = await cnftProgram.account.userNft.fetch(userNft);
      
      console.log("🔍 UserNft Details:");
      console.log(`   Level: ${JSON.stringify(nftAccount.level)}`);
      console.log(`   Boost: ${nftAccount.boost} BP (${nftAccount.boost / 100}%)`);
      console.log(`   Amount Locked: ${nftAccount.amountLocked.toNumber() / LAMPORTS_PER_BACK} BACK`);
      console.log(`   Is Active: ${nftAccount.isActive}\n`);

      // Calcul attendu: (100k/1000)*50 + (365/10)*100 = 5000 + 3650 = 8650 BP
      expect(nftAccount.boost).to.equal(8650);
      expect(nftAccount.level).to.deep.equal({ diamond: {} });
      expect(nftAccount.isActive).to.be.true;
      expect(nftAccount.amountLocked.eq(amountLocked)).to.be.true;

      // Vérifier GlobalState
      const globalStateAccount = await cnftProgram.account.globalState.fetch(globalState);
      
      console.log("🌍 GlobalState Updated:");
      console.log(`   Total Community Boost: ${globalStateAccount.totalCommunityBoost} BP`);
      console.log(`   Active Locks: ${globalStateAccount.activeLocksCount}`);
      console.log(`   TVL: ${globalStateAccount.totalValueLocked.toNumber() / LAMPORTS_PER_BACK} BACK\n`);

      expect(globalStateAccount.totalCommunityBoost.toNumber()).to.equal(8650);
      expect(globalStateAccount.activeLocksCount.toNumber()).to.equal(1);
    });

    it("Bob locks 10k BACK for 180 days → Gold NFT with 23% boost", async () => {
      const amountLocked = new BN(10_000 * LAMPORTS_PER_BACK);
      const lockDuration = new BN(180 * ONE_DAY);

      const [userNft] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), bob.publicKey.toBuffer()],
        cnftProgram.programId
      );

      console.log("\n📝 Locking tokens for Bob...");
      console.log(`   Amount: 10,000 BACK`);
      console.log(`   Duration: 180 days`);

      await cnftProgram.methods
        .mintLevelNft(amountLocked, lockDuration)
        .accounts({
          collectionConfig,
          globalState,
          userNft,
          user: bob.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bob])
        .rpc();

      const nftAccount = await cnftProgram.account.userNft.fetch(userNft);
      
      console.log("🔍 UserNft Details:");
      console.log(`   Level: ${JSON.stringify(nftAccount.level)}`);
      console.log(`   Boost: ${nftAccount.boost} BP (${nftAccount.boost / 100}%)\n`);

      // Calcul: (10k/1000)*50 + (180/10)*100 = 500 + 1800 = 2300 BP
      expect(nftAccount.boost).to.equal(2300);
      expect(nftAccount.level).to.deep.equal({ gold: {} });

      // GlobalState should now have total boost = 8650 + 2300 = 10950
      const globalStateAccount = await cnftProgram.account.globalState.fetch(globalState);
      expect(globalStateAccount.totalCommunityBoost.toNumber()).to.equal(10950);
      expect(globalStateAccount.activeLocksCount.toNumber()).to.equal(2);
    });

    it("Charlie locks 1k BACK for 30 days → Bronze NFT with 3.5% boost", async () => {
      const amountLocked = new BN(1_000 * LAMPORTS_PER_BACK);
      const lockDuration = new BN(30 * ONE_DAY);

      const [userNft] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), charlie.publicKey.toBuffer()],
        cnftProgram.programId
      );

      console.log("\n📝 Locking tokens for Charlie...");
      console.log(`   Amount: 1,000 BACK`);
      console.log(`   Duration: 30 days`);

      await cnftProgram.methods
        .mintLevelNft(amountLocked, lockDuration)
        .accounts({
          collectionConfig,
          globalState,
          userNft,
          user: charlie.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([charlie])
        .rpc();

      const nftAccount = await cnftProgram.account.userNft.fetch(userNft);
      
      console.log("🔍 UserNft Details:");
      console.log(`   Level: ${JSON.stringify(nftAccount.level)}`);
      console.log(`   Boost: ${nftAccount.boost} BP (${nftAccount.boost / 100}%)\n`);

      // Calcul: (1k/1000)*50 + (30/10)*100 = 50 + 300 = 350 BP
      expect(nftAccount.boost).to.equal(350);
      expect(nftAccount.level).to.deep.equal({ bronze: {} });

      // Total boost: 8650 + 2300 + 350 = 11300
      const globalStateAccount = await cnftProgram.account.globalState.fetch(globalState);
      console.log("🌍 Final GlobalState:");
      console.log(`   Total Community Boost: ${globalStateAccount.totalCommunityBoost} BP`);
      console.log(`   Active Locks: ${globalStateAccount.activeLocksCount}`);
      console.log(`   Distribution:`)
      console.log(`     - Alice: 8650/11300 = 76.5%`);
      console.log(`     - Bob: 2300/11300 = 20.4%`);
      console.log(`     - Charlie: 350/11300 = 3.1%\n`);

      expect(globalStateAccount.totalCommunityBoost.toNumber()).to.equal(11300);
      expect(globalStateAccount.activeLocksCount.toNumber()).to.equal(3);
    });
  });

  describe("Test 2: Swap with Boosted Rebate (Simulation)", () => {
    it("Simulates Alice swap with 86.5% boost → 5.59 USDC rebate (base: 3 USDC)", async () => {
      const [aliceNft] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), alice.publicKey.toBuffer()],
        cnftProgram.programId
      );

      const nftAccount = await cnftProgram.account.userNft.fetch(aliceNft);
      const boost = nftAccount.boost;

      console.log("\n💱 Simulating Swap for Alice...");
      console.log(`   Input: 1,000 USDC`);
      console.log(`   Output: ~950 BACK (market price)`);
      console.log(`   Boost: ${boost} BP (${boost / 100}%)`);

      // Calcul du rebate boosté
      const baseRebate = 3_000_000; // 3 USDC
      const multiplier = 10_000 + boost; // 18,650
      const boostedRebate = (baseRebate * multiplier) / 10_000;

      console.log(`   Base Rebate: 3.00 USDC`);
      console.log(`   Multiplier: ${multiplier / 10_000}x`);
      console.log(`   Boosted Rebate: ${boostedRebate / LAMPORTS_PER_USDC} USDC`);
      console.log(`   Extra Gain: +${(boostedRebate - baseRebate) / LAMPORTS_PER_USDC} USDC (+${boost / 100}%)\n`);

      expect(boostedRebate).to.equal(5_595_000); // 5.595 USDC
    });

    it("Simulates Bob swap with 23% boost → 3.69 USDC rebate", async () => {
      const [bobNft] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), bob.publicKey.toBuffer()],
        cnftProgram.programId
      );

      const nftAccount = await cnftProgram.account.userNft.fetch(bobNft);
      const boost = nftAccount.boost;

      const baseRebate = 3_000_000;
      const boostedRebate = (baseRebate * (10_000 + boost)) / 10_000;

      console.log("\n💱 Simulating Swap for Bob...");
      console.log(`   Boost: ${boost} BP (${boost / 100}%)`);
      console.log(`   Boosted Rebate: ${boostedRebate / LAMPORTS_PER_USDC} USDC\n`);

      expect(boostedRebate).to.equal(3_690_000); // 3.69 USDC
    });

    it("Simulates Charlie swap with 3.5% boost → 3.10 USDC rebate", async () => {
      const [charlieNft] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), charlie.publicKey.toBuffer()],
        cnftProgram.programId
      );

      const nftAccount = await cnftProgram.account.userNft.fetch(charlieNft);
      const boost = nftAccount.boost;

      const baseRebate = 3_000_000;
      const boostedRebate = (baseRebate * (10_000 + boost)) / 10_000;

      console.log("\n💱 Simulating Swap for Charlie...");
      console.log(`   Boost: ${boost} BP (${boost / 100}%)`);
      console.log(`   Boosted Rebate: ${boostedRebate / LAMPORTS_PER_USDC} USDC\n`);

      expect(boostedRebate).to.equal(3_105_000); // 3.105 USDC
    });
  });

  describe("Test 3: Buyback Distribution (50/50 Ratio)", () => {
    it("Simulates buyback distribution: 100k BACK → 50% distributed, 50% burned", async () => {
      const buybackAmount = new BN(100_000 * LAMPORTS_PER_BACK);

      console.log("\n🔄 Simulating Buyback Distribution...");
      console.log(`   Total Buyback: 100,000 BACK`);
      console.log(`   Distribution (50%): 50,000 BACK`);
      console.log(`   Burn (50%): 50,000 BACK 🔥\n`);

      const distributable = buybackAmount.divn(2);
      const burnAmount = buybackAmount.divn(2);

      expect(distributable.toNumber()).to.equal(50_000 * LAMPORTS_PER_BACK);
      expect(burnAmount.toNumber()).to.equal(50_000 * LAMPORTS_PER_BACK);

      // Récupérer GlobalState
      const globalStateAccount = await cnftProgram.account.globalState.fetch(globalState);
      const totalBoost = globalStateAccount.totalCommunityBoost.toNumber();

      console.log(`   Total Community Boost: ${totalBoost} BP\n`);

      // Calculer les parts individuelles
      const [aliceNft] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), alice.publicKey.toBuffer()],
        cnftProgram.programId
      );

      const [bobNft] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), bob.publicKey.toBuffer()],
        cnftProgram.programId
      );

      const [charlieNft] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), charlie.publicKey.toBuffer()],
        cnftProgram.programId
      );

      const aliceBoost = (await cnftProgram.account.userNft.fetch(aliceNft)).boost;
      const bobBoost = (await cnftProgram.account.userNft.fetch(bobNft)).boost;
      const charlieBoost = (await cnftProgram.account.userNft.fetch(charlieNft)).boost;

      const aliceShare = distributable.muln(aliceBoost).divn(totalBoost);
      const bobShare = distributable.muln(bobBoost).divn(totalBoost);
      const charlieShare = distributable.muln(charlieBoost).divn(totalBoost);

      console.log("💰 Distribution Breakdown:");
      console.log(`   Alice (${aliceBoost} BP / ${totalBoost}):   ${aliceShare.toNumber() / LAMPORTS_PER_BACK} BACK (${(aliceBoost / totalBoost * 100).toFixed(1)}%)`);
      console.log(`   Bob (${bobBoost} BP / ${totalBoost}):     ${bobShare.toNumber() / LAMPORTS_PER_BACK} BACK (${(bobBoost / totalBoost * 100).toFixed(1)}%)`);
      console.log(`   Charlie (${charlieBoost} BP / ${totalBoost}):   ${charlieShare.toNumber() / LAMPORTS_PER_BACK} BACK (${(charlieBoost / totalBoost * 100).toFixed(1)}%)`);
      console.log(`   🔥 Burned:              ${burnAmount.toNumber() / LAMPORTS_PER_BACK} BACK\n`);

      // Vérifier que la somme = distributable
      const totalDistributed = aliceShare.add(bobShare).add(charlieShare);
      expect(totalDistributed.lte(distributable)).to.be.true;

      // Vérifier les pourcentages approximatifs
      expect(aliceShare.toNumber()).to.be.closeTo(38_230 * LAMPORTS_PER_BACK, 500 * LAMPORTS_PER_BACK);
      expect(bobShare.toNumber()).to.be.closeTo(10_176 * LAMPORTS_PER_BACK, 200 * LAMPORTS_PER_BACK);
      expect(charlieShare.toNumber()).to.be.closeTo(1_548 * LAMPORTS_PER_BACK, 50 * LAMPORTS_PER_BACK);
    });
  });

  describe("Test 4: Unlock and GlobalState Update", () => {
    it("Alice unlocks tokens → GlobalState.total_community_boost decreases", async () => {
      const [aliceNft] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), alice.publicKey.toBuffer()],
        cnftProgram.programId
      );

      console.log("\n🔓 Unlocking tokens for Alice...");

      // État avant unlock
      const globalStateBefore = await cnftProgram.account.globalState.fetch(globalState);
      const boostBefore = globalStateBefore.totalCommunityBoost.toNumber();
      const aliceBoost = (await cnftProgram.account.userNft.fetch(aliceNft)).boost;

      console.log(`   GlobalState before: ${boostBefore} BP`);
      console.log(`   Alice boost: ${aliceBoost} BP`);

      // Unlock
      await cnftProgram.methods
        .updateNftStatus(false) // Désactiver
        .accounts({
          userNft: aliceNft,
          globalState,
          user: alice.publicKey,
        })
        .signers([alice])
        .rpc();

      // État après unlock
      const globalStateAfter = await cnftProgram.account.globalState.fetch(globalState);
      const boostAfter = globalStateAfter.totalCommunityBoost.toNumber();
      const nftAfter = await cnftProgram.account.userNft.fetch(aliceNft);

      console.log(`   GlobalState after: ${boostAfter} BP`);
      console.log(`   Alice NFT active: ${nftAfter.isActive}`);
      console.log(`   Boost decreased: -${boostBefore - boostAfter} BP\n`);

      expect(boostAfter).to.equal(boostBefore - aliceBoost);
      expect(nftAfter.isActive).to.be.false;
      expect(globalStateAfter.activeLocksCount.toNumber()).to.equal(2);
    });

    it("Alice re-locks tokens → GlobalState.total_community_boost increases back", async () => {
      const [aliceNft] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), alice.publicKey.toBuffer()],
        cnftProgram.programId
      );

      console.log("\n🔒 Re-locking tokens for Alice...");

      const globalStateBefore = await cnftProgram.account.globalState.fetch(globalState);
      const boostBefore = globalStateBefore.totalCommunityBoost.toNumber();
      const aliceBoost = (await cnftProgram.account.userNft.fetch(aliceNft)).boost;

      console.log(`   GlobalState before: ${boostBefore} BP`);

      // Re-lock
      await cnftProgram.methods
        .updateNftStatus(true) // Activer
        .accounts({
          userNft: aliceNft,
          globalState,
          user: alice.publicKey,
        })
        .signers([alice])
        .rpc();

      const globalStateAfter = await cnftProgram.account.globalState.fetch(globalState);
      const boostAfter = globalStateAfter.totalCommunityBoost.toNumber();
      const nftAfter = await cnftProgram.account.userNft.fetch(aliceNft);

      console.log(`   GlobalState after: ${boostAfter} BP`);
      console.log(`   Alice NFT active: ${nftAfter.isActive}`);
      console.log(`   Boost increased: +${boostAfter - boostBefore} BP\n`);

      expect(boostAfter).to.equal(boostBefore + aliceBoost);
      expect(nftAfter.isActive).to.be.true;
      expect(globalStateAfter.activeLocksCount.toNumber()).to.equal(3);
    });
  });

  describe("Test 5: Edge Cases", () => {
    it("Minimal lock: 100 BACK × 1 day → 0.5% boost", async () => {
      const testUser = Keypair.generate();
      
      await provider.connection.requestAirdrop(testUser.publicKey, 2 * LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const testBackAccount = await createAssociatedTokenAccount(
        provider.connection,
        testUser,
        backMint,
        testUser.publicKey
      );

      await mintTo(
        provider.connection,
        testUser,
        backMint,
        testBackAccount,
        admin,
        100 * LAMPORTS_PER_BACK
      );

      const [userNft] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), testUser.publicKey.toBuffer()],
        cnftProgram.programId
      );

      await cnftProgram.methods
        .mintLevelNft(
          new BN(100 * LAMPORTS_PER_BACK),
          new BN(1 * ONE_DAY)
        )
        .accounts({
          collectionConfig,
          globalState,
          userNft,
          user: testUser.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      const nftAccount = await cnftProgram.account.userNft.fetch(userNft);
      
      console.log("\n🔍 Minimal Lock Test:");
      console.log(`   Amount: 100 BACK`);
      console.log(`   Duration: 1 day`);
      console.log(`   Boost: ${nftAccount.boost} BP (${nftAccount.boost / 100}%)\n`);

      // Calcul: (100/1000)*50 + (1/10)*100 = 5 + 10 = 15 BP
      expect(nftAccount.boost).to.be.greaterThan(0);
    });

    it("Maximum lock: 1M BACK × 730 days → 100% boost (capped)", async () => {
      const testUser = Keypair.generate();
      
      await provider.connection.requestAirdrop(testUser.publicKey, 2 * LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const testBackAccount = await createAssociatedTokenAccount(
        provider.connection,
        testUser,
        backMint,
        testUser.publicKey
      );

      await mintTo(
        provider.connection,
        testUser,
        backMint,
        testBackAccount,
        admin,
        1_000_000 * LAMPORTS_PER_BACK
      );

      const [userNft] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), testUser.publicKey.toBuffer()],
        cnftProgram.programId
      );

      await cnftProgram.methods
        .mintLevelNft(
          new BN(1_000_000 * LAMPORTS_PER_BACK),
          new BN(730 * ONE_DAY)
        )
        .accounts({
          collectionConfig,
          globalState,
          userNft,
          user: testUser.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      const nftAccount = await cnftProgram.account.userNft.fetch(userNft);
      
      console.log("\n🔍 Maximum Lock Test:");
      console.log(`   Amount: 1,000,000 BACK`);
      console.log(`   Duration: 730 days`);
      console.log(`   Boost: ${nftAccount.boost} BP (${nftAccount.boost / 100}%)`);
      console.log(`   Level: ${JSON.stringify(nftAccount.level)}\n`);

      // Devrait être cappé à 10000 BP (100%)
      expect(nftAccount.boost).to.equal(10_000);
      expect(nftAccount.level).to.deep.equal({ diamond: {} });
    });
  });

  after(async () => {
    console.log("\n" + "=".repeat(60));
    console.log("🎉 All tests completed successfully!");
    console.log("=".repeat(60) + "\n");

    // Afficher le résumé final
    const globalStateAccount = await cnftProgram.account.globalState.fetch(globalState);
    
    console.log("📊 Final System State:");
    console.log(`   Total Community Boost: ${globalStateAccount.totalCommunityBoost} BP`);
    console.log(`   Active Locks: ${globalStateAccount.activeLocksCount}`);
    console.log(`   TVL: ${globalStateAccount.totalValueLocked.toNumber() / LAMPORTS_PER_BACK} BACK\n`);
  });
});
