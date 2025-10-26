# 🚀 Guide de Déploiement - Système de Boost SwapBack

**Date:** 26 Octobre 2025  
**Version:** 1.0.0  
**Auteur:** SwapBack Team

---

## 📋 Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Architecture du Système](#architecture-du-système)
4. [Déploiement Devnet](#déploiement-devnet)
5. [Initialisation des Programmes](#initialisation-des-programmes)
6. [Tests d'Intégration](#tests-dintégration)
7. [Scénarios de Test](#scénarios-de-test)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Vue d'Ensemble

Le système de boost SwapBack comprend **4 programmes Solana interconnectés** :

| Programme                | ID Devnet                                      | Fonctionnalité                                |
| ------------------------ | ---------------------------------------------- | --------------------------------------------- |
| `swapback_cnft`          | `CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH` | Gestion des NFTs de niveau et calcul du boost |
| `swapback_router`        | `3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap` | Routing des swaps avec rebates boostés        |
| `swapback_buyback`       | `71vALqj3cmQWDmq9bi9GYYDPQqpoRstej3snUbikpCHW` | Buyback et distribution proportionnelle       |
| `swapback_transfer_hook` | À définir                                      | Token extension avec hooks (optionnel)        |

### Flux Complet

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUX UTILISATEUR                              │
└─────────────────────────────────────────────────────────────────────┘

1. LOCK 💎
   User → lock_tokens(100k BACK, 365 days)
   ├─ swapback_cnft::mint_level_nft()
   │  ├─ Calcule boost: 8600 BP (86%)
   │  ├─ Détermine niveau: Diamond
   │  └─ Incrémente GlobalState.total_community_boost
   │
   └─ Résultat: UserNft créé avec boost 86%

2. SWAP 💱
   User → swap_with_rebate(1000 USDC → BACK)
   ├─ swapback_router::swap_toc()
   │  ├─ Execute swap via DEX
   │  ├─ Lit UserNft.boost (86%)
   │  ├─ Calcule rebate: 3 USDC × 1.86 = 5.58 USDC
   │  └─ Transfert rebate boosté à l'utilisateur
   │
   └─ Résultat: User reçoit +85.8% de rebate

3. BUYBACK 🔄
   Admin → execute_buyback(10k USDC)
   ├─ swapback_buyback::execute_buyback()
   │  ├─ Achète $BACK sur le marché: 10k USDC → 50k BACK
   │  └─ Stocke dans back_vault
   │
   └─ Résultat: 50k $BACK prêts pour distribution

4. DISTRIBUTION 🎁
   User → claim_buyback()
   ├─ swapback_buyback::distribute_buyback()
   │  ├─ Lit GlobalState.total_community_boost
   │  ├─ Distributable: 50k × 50% = 25k BACK
   │  ├─ User share: (8600/11250) × 25k = 19,111 BACK
   │  ├─ Transfert 19,111 BACK à l'utilisateur
   │  └─ Burn restant: 25k BACK 🔥
   │
   └─ Résultat: User reçoit 76.4% de la distribution

5. UNLOCK 🔓
   User → unlock_tokens()
   ├─ swapback_cnft::update_nft_status(false)
   │  ├─ Décrémenter GlobalState.total_community_boost
   │  └─ Marque UserNft.is_active = false
   │
   └─ Résultat: Tokens débloqués, boost désactivé
```

---

## ⚙️ Prérequis

### Outils Requis

```bash
# Solana CLI (v1.18+)
solana --version

# Anchor Framework (v0.30.1)
anchor --version

# Node.js (v20+)
node --version

# Yarn
yarn --version
```

### Configuration Devnet

```bash
# Configurer le réseau
solana config set --url https://api.devnet.solana.com

# Vérifier la configuration
solana config get

# Créer/Charger le wallet de déploiement
solana-keygen new --outfile ~/.config/solana/devnet-deployer.json

# Airdrop pour frais de déploiement
solana airdrop 5 --keypair ~/.config/solana/devnet-deployer.json

# Vérifier le solde
solana balance
```

---

## 🏗️ Architecture du Système

### Structures de Données Clés

#### 1. GlobalState (swapback_cnft)

```rust
pub struct GlobalState {
    pub authority: Pubkey,              // Admin du programme
    pub total_community_boost: u64,     // Somme de tous les boosts actifs
    pub active_locks_count: u64,        // Nombre de locks actifs
    pub total_value_locked: u64,        // TVL en lamports
}
```

#### 2. UserNft (swapback_cnft)

```rust
pub struct UserNft {
    pub user: Pubkey,                   // Propriétaire
    pub level: LockLevel,               // Bronze → Diamond
    pub amount_locked: u64,             // Montant locké
    pub lock_duration: i64,             // Durée en secondes
    pub boost: u16,                     // Boost en basis points (0-10000)
    pub mint_time: i64,                 // Timestamp du lock
    pub is_active: bool,                // Statut actif/inactif
    pub bump: u8,                       // PDA bump
}
```

#### 3. BuybackState (swapback_buyback)

```rust
pub struct BuybackState {
    pub authority: Pubkey,              // Admin du buyback
    pub back_mint: Pubkey,              // Mint du token $BACK
    pub usdc_vault: Pubkey,             // Vault USDC pour buyback
    pub min_buyback_amount: u64,        // Montant minimum pour buyback
    pub total_usdc_spent: u64,          // Total USDC dépensé
    pub total_back_burned: u64,         // Total $BACK brûlé
    pub buyback_count: u64,             // Nombre de buybacks
    pub bump: u8,                       // PDA bump
}
```

### Formules de Calcul

#### Calcul du Boost

```rust
fn calculate_boost(amount: u64, duration: i64) -> u16 {
    let days = (duration / 86400) as u64;
    let amount_tokens = amount / 1_000_000_000; // Lamports → Tokens

    // Score montant: max 50%
    let amount_score = min((amount_tokens / 1000) * 50, 5000);

    // Score durée: max 50%
    let duration_score = min((days / 10) * 100, 5000);

    // Total: max 100%
    min(amount_score + duration_score, 10000) as u16
}
```

**Exemples:**

- 1k BACK × 30j = 350 BP (3.5%)
- 10k BACK × 180j = 2300 BP (23%)
- 100k BACK × 365j = 8600 BP (86%)
- 100k BACK × 730j = 10000 BP (100% max)

#### Calcul du Rebate Boosté

```rust
fn calculate_boosted_rebate(base_rebate: u64, boost_bp: u16) -> u64 {
    let multiplier = 10_000 + boost_bp; // Ex: 10000 + 2300 = 12300 (123%)
    (base_rebate * multiplier) / 10_000
}
```

**Exemples:**

- Base 3 USDC, boost 0% = 3.00 USDC
- Base 3 USDC, boost 23% = 3.69 USDC
- Base 3 USDC, boost 86% = 5.58 USDC
- Base 3 USDC, boost 100% = 6.00 USDC

#### Distribution Buyback (50/50)

```rust
fn calculate_user_share(
    buyback_tokens: u64,
    user_boost: u16,
    total_community_boost: u64
) -> (u64, u64) {
    // 50% distribution, 50% burn
    let distributable = buyback_tokens / 2;
    let burn_amount = buyback_tokens / 2;

    // Part utilisateur proportionnelle
    let user_share = (distributable * user_boost as u64) / total_community_boost;

    (user_share, burn_amount)
}
```

**Exemple: 100k BACK buyback**

- Distributable: 50k BACK
- Burn: 50k BACK
- Alice (8600 BP / 11250 total): 38,222 BACK
- Bob (2300 BP / 11250 total): 10,222 BACK
- Charlie (350 BP / 11250 total): 1,555 BACK

---

## 🚀 Déploiement Devnet

### Étape 1: Build des Programmes

```bash
# Build tous les programmes en mode release
cd /workspaces/SwapBack

echo "📦 Building swapback_cnft..."
anchor build -p swapback_cnft

echo "📦 Building swapback_router..."
anchor build -p swapback_router

echo "📦 Building swapback_buyback..."
anchor build -p swapback_buyback

# Vérifier les binaires
ls -lh target/deploy/*.so
```

### Étape 2: Déploiement

```bash
# Déployer swapback_cnft
echo "🚀 Deploying swapback_cnft..."
anchor deploy -p swapback_cnft --provider.cluster devnet

# Déployer swapback_router
echo "🚀 Deploying swapback_router..."
anchor deploy -p swapback_router --provider.cluster devnet

# Déployer swapback_buyback
echo "🚀 Deploying swapback_buyback..."
anchor deploy -p swapback_buyback --provider.cluster devnet

# Vérifier les déploiements
solana program show CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH
solana program show 3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap
solana program show 71vALqj3cmQWDmq9bi9GYYDPQqpoRstej3snUbikpCHW
```

---

## 🔧 Initialisation des Programmes

### 1. Initialiser GlobalState (cNFT)

```bash
# Via Anchor CLI
anchor run initialize-global-state --provider.cluster devnet
```

**Ou via TypeScript:**

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SwapbackCnft } from "../target/types/swapback_cnft";

const provider = anchor.AnchorProvider.env();
const program = anchor.workspace.SwapbackCnft as Program<SwapbackCnft>;

const [globalState] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("global_state")],
  program.programId
);

await program.methods
  .initializeGlobalState()
  .accounts({
    globalState,
    authority: provider.wallet.publicKey,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .rpc();

console.log("✅ GlobalState initialized:", globalState.toString());
```

### 2. Initialiser BuybackState

```typescript
const backMint = new anchor.web3.PublicKey("YOUR_BACK_MINT_ADDRESS");
const usdcMint = new anchor.web3.PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
); // USDC devnet

const [buybackState] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("buyback_state")],
  buybackProgram.programId
);

const [usdcVault] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("usdc_vault")],
  buybackProgram.programId
);

const minBuybackAmount = new anchor.BN(1_000_000); // 1 USDC minimum

await buybackProgram.methods
  .initialize(minBuybackAmount)
  .accounts({
    buybackState,
    backMint,
    usdcVault,
    usdcMint,
    authority: provider.wallet.publicKey,
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .rpc();

console.log("✅ BuybackState initialized:", buybackState.toString());
```

### 3. Initialiser RouterState

```typescript
const [routerState] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("router_state")],
  routerProgram.programId
);

await routerProgram.methods
  .initialize()
  .accounts({
    state: routerState,
    authority: provider.wallet.publicKey,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .rpc();

console.log("✅ RouterState initialized:", routerState.toString());
```

---

## 🧪 Tests d'Intégration

### Script de Test Complet

```typescript
// tests/integration/boost-system.test.ts

import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";

describe("Boost System Integration Tests", () => {
  let alice: anchor.web3.Keypair;
  let bob: anchor.web3.Keypair;
  let charlie: anchor.web3.Keypair;

  before(async () => {
    // Setup test users
    alice = anchor.web3.Keypair.generate();
    bob = anchor.web3.Keypair.generate();
    charlie = anchor.web3.Keypair.generate();

    // Airdrop SOL
    await Promise.all([
      provider.connection.requestAirdrop(
        alice.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      provider.connection.requestAirdrop(
        bob.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      provider.connection.requestAirdrop(
        charlie.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
    ]);
  });

  it("Test 1: Lock tokens and mint NFT", async () => {
    const amountLocked = new anchor.BN(100_000 * 1e9); // 100k BACK
    const lockDuration = new anchor.BN(365 * 86400); // 365 days

    const [userNft] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_nft"), alice.publicKey.toBuffer()],
      cnftProgram.programId
    );

    await cnftProgram.methods
      .mintLevelNft(amountLocked, lockDuration)
      .accounts({
        collectionConfig,
        globalState,
        userNft,
        user: alice.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([alice])
      .rpc();

    const nftAccount = await cnftProgram.account.userNft.fetch(userNft);

    expect(nftAccount.boost).to.equal(8600); // 86% boost
    expect(nftAccount.level).to.deep.equal({ diamond: {} });
    expect(nftAccount.isActive).to.be.true;

    console.log("✅ Alice locked 100k BACK × 365 days → Boost: 86%");
  });

  it("Test 2: Execute swap with boosted rebate", async () => {
    const amountIn = new anchor.BN(1000 * 1e6); // 1000 USDC

    const [userNft] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_nft"), alice.publicKey.toBuffer()],
      cnftProgram.programId
    );

    const tx = await routerProgram.methods
      .swapToc({
        amountIn,
        minOut: new anchor.BN(950 * 1e9),
        slippageTolerance: 50,
        twapSlices: null,
        useDynamicPlan: false,
        planAccount: null,
        useBundle: false,
        oracleAccount: oracleAddress,
      })
      .accounts({
        state: routerState,
        user: alice.publicKey,
        oracle: oracleAddress,
        userTokenAccountA: aliceUsdcAccount,
        userTokenAccountB: aliceBackAccount,
        vaultTokenAccountA: routerUsdcVault,
        vaultTokenAccountB: routerBackVault,
        plan: null,
        userNft, // ← Compte UserNft pour lire le boost
        buybackProgram: null,
        buybackUsdcVault: null,
        buybackState: null,
        userRebateAccount: aliceUsdcAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([alice])
      .rpc();

    // Vérifier l'événement RebatePaid
    const events = await routerProgram.account.events();
    const rebatePaid = events.find((e) => e.name === "RebatePaid");

    expect(rebatePaid.data.baseRebate).to.equal(3_000_000); // 3 USDC
    expect(rebatePaid.data.boost).to.equal(8600); // 86%
    expect(rebatePaid.data.totalRebate).to.equal(5_580_000); // 5.58 USDC

    console.log("✅ Alice swap → Rebate: 5.58 USDC (base 3 USDC × 1.86)");
  });

  it("Test 3: Execute buyback and verify distribution", async () => {
    // Bob et Charlie lockent aussi
    // Bob: 10k × 180j = 23% boost
    // Charlie: 1k × 30j = 3.5% boost
    // Total boost: 8600 + 2300 + 350 = 11,250 BP

    // Execute buyback
    const maxUsdcAmount = new anchor.BN(10_000 * 1e6); // 10k USDC
    const minBackAmount = new anchor.BN(45_000 * 1e9); // Min 45k BACK

    await buybackProgram.methods
      .executeBuyback(maxUsdcAmount, minBackAmount)
      .accounts({
        buybackState,
        usdcVault,
        backVault: null,
        jupiterProgram: null,
        authority: provider.wallet.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Vérifier l'état
    const buybackStateAccount =
      await buybackProgram.account.buybackState.fetch(buybackState);
    expect(buybackStateAccount.buybackCount).to.equal(1);

    console.log("✅ Buyback executed: 10k USDC → 50k BACK");
  });

  it("Test 4: Alice claims buyback distribution", async () => {
    const maxTokens = new anchor.BN(50_000 * 1e9); // 50k BACK available

    const [userNft] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_nft"), alice.publicKey.toBuffer()],
      cnftProgram.programId
    );

    const tx = await buybackProgram.methods
      .distributeBuyback(maxTokens)
      .accounts({
        buybackState,
        globalState,
        userNft,
        backVault: buybackBackVault,
        userBackAccount: aliceBackAccount,
        user: alice.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([alice])
      .rpc();

    // Vérifier la distribution
    const events = await buybackProgram.account.events();
    const distributed = events.find((e) => e.name === "BuybackDistributed");

    expect(distributed.data.userBoost).to.equal(8600);
    expect(distributed.data.totalBoost).to.equal(11250);
    expect(distributed.data.distributableAmount).to.equal(25_000 * 1e9); // 50% de 50k
    expect(distributed.data.tokensReceived).to.equal(19_111 * 1e9); // 76.4% de 25k

    console.log("✅ Alice received: 19,111 BACK (76.4% of distribution)");
  });

  it("Test 5: Unlock and verify GlobalState update", async () => {
    const [userNft] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_nft"), alice.publicKey.toBuffer()],
      cnftProgram.programId
    );

    const globalStateBefore =
      await cnftProgram.account.globalState.fetch(globalState);
    const boostBefore = globalStateBefore.totalCommunityBoost;

    await cnftProgram.methods
      .updateNftStatus(false) // Désactiver
      .accounts({
        userNft,
        globalState,
        user: alice.publicKey,
      })
      .signers([alice])
      .rpc();

    const globalStateAfter =
      await cnftProgram.account.globalState.fetch(globalState);
    const boostAfter = globalStateAfter.totalCommunityBoost;

    expect(boostAfter).to.equal(boostBefore - 8600);

    console.log(
      "✅ Alice unlocked → GlobalState.total_community_boost decreased"
    );
  });
});
```

---

## 📊 Scénarios de Test

### Scénario 1: Utilisateur Unique (Whale)

```typescript
// Alice: 100k BACK × 730 days = 100% boost max
{
  amountLocked: 100_000 * 1e9,
  lockDuration: 730 * 86400,
  expectedBoost: 10_000, // 100%
  expectedLevel: "Diamond",
  rebateMultiplier: 2.0, // Double rebate
  distributionShare: 1.0 // 100% si seul locker
}
```

### Scénario 2: Trois Utilisateurs (Diversifié)

```typescript
const scenarios = [
  {
    user: "Alice",
    amount: 100_000 * 1e9,
    duration: 365 * 86400,
    expectedBoost: 8600,
    expectedShare: 0.764, // 76.4%
  },
  {
    user: "Bob",
    amount: 10_000 * 1e9,
    duration: 180 * 86400,
    expectedBoost: 2300,
    expectedShare: 0.204, // 20.4%
  },
  {
    user: "Charlie",
    amount: 1_000 * 1e9,
    duration: 30 * 86400,
    expectedBoost: 350,
    expectedShare: 0.031, // 3.1%
  },
];

// Total boost: 11,250 BP
// Buyback: 100k BACK
// Distribution (50%): 50k BACK
// Burn (50%): 50k BACK

// Alice: 38,222 BACK
// Bob: 10,222 BACK
// Charlie: 1,555 BACK
```

### Scénario 3: Stress Test (100 Utilisateurs)

```typescript
const users = Array.from({ length: 100 }, (_, i) => ({
  amount: (1000 + i * 500) * 1e9,
  duration: (30 + i * 3) * 86400,
}));

// Vérifier:
// - Pas de dépassement arithmétique
// - Somme des distributions ≤ distributable
// - Cohérence du GlobalState
```

---

## 📈 Monitoring

### Événements à Surveiller

```typescript
// cNFT Events
interface LevelNftMinted {
  user: PublicKey;
  level: LockLevel;
  amount_locked: BN;
  lock_duration: BN;
  boost: number;
  timestamp: BN;
}

interface NftStatusUpdated {
  user: PublicKey;
  level: LockLevel;
  is_active: boolean;
  timestamp: BN;
}

// Router Events
interface RebatePaid {
  user: PublicKey;
  base_rebate: BN;
  boost: number;
  total_rebate: BN;
  timestamp: BN;
}

interface SwapCompleted {
  user: PublicKey;
  amount_in: BN;
  amount_out: BN;
  platform_fee: BN;
  routing_profit: BN;
  buyback_deposit: BN;
  user_boost: number;
  rebate_amount: BN;
}

// Buyback Events
interface BuybackExecuted {
  usdc_amount: BN;
  back_amount: BN;
  timestamp: BN;
}

interface BuybackDistributed {
  user: PublicKey;
  user_boost: number;
  total_boost: BN;
  distributable_amount: BN;
  tokens_received: BN;
  timestamp: BN;
}

interface BackBurned {
  amount: BN;
  total_burned: BN;
  timestamp: BN;
}
```

### Métriques Clés

```typescript
// Dashboard Metrics
interface SystemMetrics {
  // GlobalState
  totalCommunityBoost: number;
  activeLocksCount: number;
  totalValueLocked: BN;

  // Buyback
  totalUsdcSpent: BN;
  totalBackBurned: BN;
  buybackCount: number;

  // Distribution
  totalDistributed: BN;
  uniqueClaimers: number;
  averageUserShare: number;

  // APY estimé
  estimatedAPY: number; // Basé sur distributions historiques
}
```

---

## 🐛 Troubleshooting

### Erreur: "InsufficientFunds"

```
Cause: Pas assez de tokens dans le vault
Solution: Vérifier les soldes avant distribution
```

### Erreur: "InactiveNft"

```
Cause: NFT désactivé (après unlock)
Solution: Re-lock les tokens pour réactiver
```

### Erreur: "NoBoostInCommunity"

```
Cause: Aucun lock actif dans le système
Solution: Au moins un utilisateur doit avoir un lock actif
```

### Erreur: "ShareTooSmall"

```
Cause: Part calculée = 0 (boost trop faible)
Solution: Augmenter le montant ou la durée du lock
```

### Erreur: "MathOverflow"

```
Cause: Dépassement arithmétique dans les calculs
Solution: Vérifier les montants max (ne devrait pas arriver)
```

---

## ✅ Checklist de Déploiement

- [ ] Build tous les programmes sans erreur
- [ ] Déployer sur devnet
- [ ] Initialiser GlobalState
- [ ] Initialiser BuybackState
- [ ] Initialiser RouterState
- [ ] Tester lock → mint NFT
- [ ] Tester swap → rebate boosté
- [ ] Tester buyback → distribution
- [ ] Tester unlock → GlobalState update
- [ ] Vérifier les événements
- [ ] Monitorer les métriques
- [ ] Documentation utilisateur finale
- [ ] Préparation mainnet

---

## 📚 Ressources

- [Anchor Framework](https://www.anchor-lang.com/)
- [Solana Program Library](https://spl.solana.com/)
- [Devnet Explorer](https://explorer.solana.com/?cluster=devnet)
- [Documentation SwapBack](./README.md)

---

**Date de dernière mise à jour:** 26 Octobre 2025  
**Version:** 1.0.0  
**Contact:** support@swapback.io
