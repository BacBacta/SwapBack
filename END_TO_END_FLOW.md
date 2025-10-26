# 🔄 Flux End-to-End - Système de Boost SwapBack

**Date:** 26 Octobre 2025  
**Version:** 1.0.0

---

## 📋 Vue d'Ensemble

Ce document décrit le **parcours complet d'un utilisateur** dans le système de boost SwapBack, de l'onboarding jusqu'à la réception des rewards de buyback.

---

## 🎬 Parcours Utilisateur Complet

### **Persona: Alice - Utilisatrice Early Adopter**

```
👤 Alice
💰 Portfolio: 150k $BACK tokens
🎯 Objectif: Maximiser les rewards et obtenir des rebates
⏱️ Horizon: Long terme (1 an)
```

---

## 📅 Timeline du Parcours

```
┌─────────────────────────────────────────────────────────────────────┐
│                      JOUR 1 - ONBOARDING                             │
└─────────────────────────────────────────────────────────────────────┘

09:00 │ Alice découvre SwapBack
      │ → Connecte son wallet Phantom
      │ → Voit l'interface de boost avec les niveaux
      │
09:15 │ Alice lit les avantages:
      │   ✓ Rebates boostés sur les swaps
      │   ✓ Distribution proportionnelle des buybacks
      │   ✓ Pas de frais de lock/unlock
      │
09:30 │ Alice décide de locker 100k $BACK × 365 jours
      │
      └─── INTERACTION 1: LOCK TOKENS ───┐
                                          │
                                          ▼

      📝 Transaction Details:
      ┌─────────────────────────────────────────┐
      │ Instruction: mint_level_nft             │
      │ Amount: 100,000 BACK                    │
      │ Duration: 365 days (31,536,000 seconds) │
      │                                         │
      │ Accounts:                               │
      │ - user: Alice.publicKey                 │
      │ - user_nft: [PDA from seeds]            │
      │ - global_state: [PDA]                   │
      │ - collection_config: [PDA]              │
      └─────────────────────────────────────────┘

      ⚙️ Backend Processing:

      1. swapback_cnft::mint_level_nft()
         ├─ Validate inputs
         ├─ Calculate boost:
         │  ├─ Amount score: (100,000/1000) × 50 = 5,000 BP
         │  ├─ Duration score: (365/10) × 100 = 3,650 BP
         │  └─ Total: min(8,650, 10,000) = 8,650 BP ≈ 86.5%
         │
         ├─ Determine level:
         │  └─ 100k BACK → DIAMOND 💎
         │
         ├─ Create UserNft account:
         │  ├─ user: Alice
         │  ├─ level: Diamond
         │  ├─ amount_locked: 100,000,000,000,000 lamports
         │  ├─ lock_duration: 31,536,000 seconds
         │  ├─ boost: 8650 BP
         │  ├─ mint_time: 1729900000 (current timestamp)
         │  └─ is_active: true
         │
         └─ Update GlobalState:
            ├─ total_community_boost += 8650
            ├─ active_locks_count += 1
            └─ total_value_locked += 100,000,000,000,000

      🎉 Result:
      ├─ Alice reçoit un NFT Diamond avec 86.5% boost
      ├─ Toast: "Lock réussi ! Boost: 86.5% 🚀"
      └─ Dashboard mis à jour avec les stats

09:35 │ Alice voit son dashboard:
      │ ┌─────────────────────────────────────┐
      │ │ 💎 DIAMOND NFT                      │
      │ │ Boost: 86.5%                        │
      │ │ Locked: 100,000 BACK                │
      │ │ Duration: 365 days                  │
      │ │ Unlock Date: 26 Oct 2026            │
      │ │                                     │
      │ │ Your Impact:                        │
      │ │ - Community Boost: 8,650/10,450 BP │
      │ │ - Your Share: 82.8%                 │
      │ └─────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                    JOUR 3 - PREMIER SWAP                             │
└─────────────────────────────────────────────────────────────────────┘

10:00 │ Alice veut acheter plus de $BACK
      │ → Navigate to Swap interface
      │ → Input: 1,000 USDC
      │ → Output: ~950 BACK (selon prix marché)
      │
10:05 │ Alice voit le rebate prévu:
      │   Base rebate: 3 USDC
      │   Your boost: 86.5%
      │   Boosted rebate: 5.59 USDC (+86.5%) ✨
      │
10:10 │ Alice clique sur "Swap"
      │
      └─── INTERACTION 2: SWAP WITH REBATE ───┐
                                               │
                                               ▼

      📝 Transaction Details:
      ┌──────────────────────────────────────────────┐
      │ Instruction: swap_toc                        │
      │ Amount In: 1,000 USDC                        │
      │ Min Out: 950 BACK                            │
      │ Slippage: 0.5%                               │
      │                                              │
      │ Accounts:                                    │
      │ - user: Alice.publicKey                      │
      │ - user_nft: Alice's NFT PDA ← READ BOOST    │
      │ - user_token_a: Alice USDC account           │
      │ - user_token_b: Alice BACK account           │
      │ - user_rebate_account: Alice USDC account    │
      │ - router_state: [PDA]                        │
      └──────────────────────────────────────────────┘

      ⚙️ Backend Processing:

      1. swapback_router::swap_toc()
         ├─ Read UserNft.boost (if provided):
         │  └─ boost = 8650 BP
         │
         ├─ Execute swap via DEX aggregator:
         │  ├─ 1,000 USDC → 952.3 BACK (actual output)
         │  └─ Transfer 952.3 BACK to Alice
         │
         ├─ Calculate fees:
         │  ├─ Platform fee (0.3%): 3 USDC
         │  ├─ Routing profit: 0.5 USDC
         │  └─ Buyback deposit (10%): 0.3 USDC
         │
         ├─ Calculate boosted rebate:
         │  ├─ Base rebate: 3 USDC (3,000,000 with 6 decimals)
         │  ├─ Multiplier: 10,000 + 8,650 = 18,650
         │  ├─ Boosted: (3,000,000 × 18,650) / 10,000
         │  └─ Result: 5,595,000 = 5.595 USDC
         │
         ├─ Transfer rebate to Alice:
         │  └─ 5.595 USDC → Alice's USDC account
         │
         └─ Emit events:
            ├─ RebatePaid {
            │    user: Alice,
            │    base_rebate: 3 USDC,
            │    boost: 8650,
            │    total_rebate: 5.595 USDC
            │  }
            └─ SwapCompleted {
                 amount_in: 1000 USDC,
                 amount_out: 952.3 BACK,
                 user_boost: 8650,
                 rebate_amount: 5.595 USDC
               }

      🎉 Result:
      ├─ Alice reçoit 952.3 BACK
      ├─ Alice reçoit 5.595 USDC de rebate (au lieu de 3 USDC)
      ├─ Économies: +2.595 USDC (+86.5%) 💰
      └─ Toast: "Swap réussi ! Rebate boosté: 5.59 USDC"

10:15 │ Alice voit son historique:
      │ ┌────────────────────────────────────────────┐
      │ │ Recent Swaps                               │
      │ │ ─────────────────────────────────────────  │
      │ │ Oct 28, 10:10                              │
      │ │ 1,000 USDC → 952.3 BACK                    │
      │ │ Rebate: 5.59 USDC (86.5% boost) 🚀        │
      │ └────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                  JOUR 7 - PREMIER BUYBACK                            │
└─────────────────────────────────────────────────────────────────────┘

14:00 │ Le protocole SwapBack a accumulé 10k USDC de fees
      │ → Admin déclenche le buyback hebdomadaire
      │
      └─── ADMIN ACTION: EXECUTE BUYBACK ───┐
                                             │
                                             ▼

      📝 Transaction Details:
      ┌──────────────────────────────────────────────┐
      │ Instruction: execute_buyback                 │
      │ Max USDC: 10,000 USDC                        │
      │ Min BACK: 45,000 BACK (slippage protection)  │
      │                                              │
      │ Accounts:                                    │
      │ - authority: Admin.publicKey                 │
      │ - buyback_state: [PDA]                       │
      │ - usdc_vault: Protocol USDC vault            │
      │ - back_vault: Protocol BACK vault            │
      │ - jupiter_program: Jupiter aggregator        │
      └──────────────────────────────────────────────┘

      ⚙️ Backend Processing:

      1. swapback_buyback::execute_buyback()
         ├─ Validate amount: 10,000 USDC ≥ min_buyback_amount ✓
         │
         ├─ Execute market buy via Jupiter:
         │  ├─ 10,000 USDC → 48,500 BACK (current market price)
         │  └─ Transfer 48,500 BACK to back_vault
         │
         ├─ Update BuybackState:
         │  ├─ total_usdc_spent += 10,000 USDC
         │  ├─ buyback_count += 1
         │  └─ last_buyback_time = now
         │
         └─ Emit event:
            └─ BuybackExecuted {
                 usdc_amount: 10,000 USDC,
                 back_amount: 48,500 BACK,
                 timestamp: 1730041200
               }

      🎉 Result:
      ├─ 48,500 $BACK achetés sur le marché
      ├─ Pression acheteuse créée (price impact positif)
      └─ Tokens prêts pour distribution + burn

14:30 │ Alice voit la notification:
      │ ┌────────────────────────────────────────────┐
      │ │ 🔔 New Buyback Available!                  │
      │ │                                            │
      │ │ Amount: 48,500 BACK                        │
      │ │ Your Share: ~40,121 BACK (82.8%)          │
      │ │ Claim before: Nov 7, 2025                  │
      │ │                                            │
      │ │ [Claim Distribution]                       │
      │ └────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                JOUR 7 (suite) - CLAIM DISTRIBUTION                   │
└─────────────────────────────────────────────────────────────────────┘

14:35 │ Alice clique sur "Claim Distribution"
      │
      └─── INTERACTION 3: CLAIM BUYBACK ───┐
                                            │
                                            ▼

      📝 Transaction Details:
      ┌──────────────────────────────────────────────┐
      │ Instruction: distribute_buyback              │
      │ Max Tokens: 48,500 BACK                      │
      │                                              │
      │ Accounts (CROSS-PROGRAM):                    │
      │ - user: Alice.publicKey                      │
      │ - user_nft: Alice's NFT PDA                  │
      │   └─ Program: swapback_cnft (CPI read)       │
      │ - global_state: Global State PDA             │
      │   └─ Program: swapback_cnft (CPI read)       │
      │ - buyback_state: [PDA]                       │
      │ - back_vault: Protocol BACK vault            │
      │ - user_back_account: Alice BACK account      │
      └──────────────────────────────────────────────┘

      ⚙️ Backend Processing:

      1. swapback_buyback::distribute_buyback()
         ├─ Read user_nft (from swapback_cnft program):
         │  ├─ Validate is_active = true ✓
         │  └─ user_boost = 8650 BP
         │
         ├─ Read global_state (from swapback_cnft program):
         │  └─ total_community_boost = 10,450 BP
         │     (Alice: 8650 + Bob: 1800 = 10,450)
         │
         ├─ Calculate distribution (50/50 ratio):
         │  ├─ Total buyback: 48,500 BACK
         │  ├─ Distributable (50%): 24,250 BACK
         │  ├─ Burn amount (50%): 24,250 BACK
         │  │
         │  ├─ Alice's share calculation:
         │  │  └─ (8650 / 10,450) × 24,250 = 20,070 BACK
         │  │
         │  └─ Remaining for Bob:
         │     └─ (1800 / 10,450) × 24,250 = 4,180 BACK
         │
         ├─ Transfer to Alice:
         │  └─ 20,070 BACK → Alice's account
         │
         ├─ Burn 50%:
         │  └─ 24,250 BACK → Burned 🔥
         │
         ├─ Update BuybackState:
         │  └─ total_back_burned += 24,250
         │
         └─ Emit events:
            ├─ BuybackDistributed {
            │    user: Alice,
            │    user_boost: 8650,
            │    total_boost: 10,450,
            │    distributable_amount: 24,250 BACK,
            │    tokens_received: 20,070 BACK,
            │    timestamp: now
            │  }
            └─ BackBurned {
                 amount: 24,250 BACK,
                 total_burned: 24,250 BACK,
                 timestamp: now
               }

      🎉 Result:
      ├─ Alice reçoit 20,070 $BACK (82.8% de la distribution)
      ├─ 24,250 $BACK brûlés (réduction supply)
      ├─ Toast: "Distribution claimed! +20,070 BACK 🎉"
      └─ Portfolio Alice: 120,070 BACK (100k locked + 20,070 gained)

14:40 │ Alice voit ses stats mises à jour:
      │ ┌────────────────────────────────────────────┐
      │ │ 💰 Your Earnings                           │
      │ │ ─────────────────────────────────────────  │
      │ │ Boosted Rebates: 5.59 USDC                 │
      │ │ Buyback Distributions: 20,070 BACK         │
      │ │ Total Value: ~$425 (estimated)             │
      │ │                                            │
      │ │ 🔥 Your Impact                             │
      │ │ BACK Burned (your share): 20,070 BACK      │
      │ │ Deflation Contribution: 0.02%              │
      │ └────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│              JOUR 30 - STATISTIQUES CUMULATIVES                      │
└─────────────────────────────────────────────────────────────────────┘

      📊 Alice's Activity Summary (30 days):

      LOCKS:
      ├─ Initial: 100k BACK × 365 days
      ├─ Boost: 86.5%
      └─ Status: Active 💎

      SWAPS:
      ├─ Total volume: 15,000 USDC → ~14,250 BACK
      ├─ Transactions: 15 swaps
      ├─ Rebates earned:
      │  ├─ Without boost: 45 USDC (3 × 15)
      │  ├─ With boost: 83.92 USDC (5.59 × 15)
      │  └─ Extra gain: +38.92 USDC (+86.5%)
      │
      └─ Average rebate: 5.59 USDC per swap

      BUYBACKS (4 weekly distributions):
      ├─ Week 1: 20,070 BACK (from 48,500)
      ├─ Week 2: 18,945 BACK (from 45,800)
      ├─ Week 3: 22,156 BACK (from 53,200)
      ├─ Week 4: 19,823 BACK (from 47,900)
      │
      └─ Total received: 80,994 BACK

      TOTAL EARNINGS (30 days):
      ├─ Rebates: 83.92 USDC
      ├─ Distributions: 80,994 BACK (~$1,700 @ $0.021/BACK)
      ├─ Total value: ~$1,783.92
      │
      └─ Monthly ROI: ~1.78% on 100k locked
          Annualized: ~21.4% APY 📈

      DEFLATION IMPACT:
      └─ Total burned (50% of distributions): 80,994 BACK 🔥


┌─────────────────────────────────────────────────────────────────────┐
│              JOUR 365 - FIN DE LOCK PERIOD                           │
└─────────────────────────────────────────────────────────────────────┘

09:00 │ Alice's lock period expires
      │ → Notification: "Your lock is now unlockable"
      │
09:15 │ Alice décide de prolonger (relock)
      │ → Option 1: Unlock and withdraw
      │ → Option 2: Extend lock duration ✓
      │
09:20 │ Alice clique sur "Extend Lock" → +365 days
      │
      └─── INTERACTION 4: RELOCK TOKENS ───┐
                                            │
                                            ▼

      📝 Transaction Details:
      ┌──────────────────────────────────────────────┐
      │ Instruction: update_nft_status               │
      │ New Duration: +365 days                      │
      │                                              │
      │ Accounts:                                    │
      │ - user: Alice.publicKey                      │
      │ - user_nft: Alice's NFT PDA                  │
      │ - global_state: [PDA]                        │
      └──────────────────────────────────────────────┘

      ⚙️ Backend Processing:

      1. swapback_cnft::update_nft_status()
         ├─ Validate user owns NFT ✓
         │
         ├─ Recalculate boost with new duration:
         │  ├─ Amount: Still 100k BACK
         │  ├─ Duration: 365 days (renewed)
         │  └─ Boost: 8650 BP (maintained)
         │
         ├─ Update UserNft:
         │  ├─ lock_duration = 365 × 86400
         │  ├─ mint_time = now (reset)
         │  └─ is_active = true (remains active)
         │
         └─ GlobalState unchanged (boost already counted)

      🎉 Result:
      ├─ Lock extended for 365 more days
      ├─ Boost maintained: 86.5%
      └─ Toast: "Lock extended! Unlock date: Oct 26, 2027"


      📊 Alice's Year-End Stats:

      TOTAL EARNINGS (365 days):
      ├─ Boosted rebates: ~1,100 USDC
      ├─ Buyback distributions: ~1,050,000 BACK
      ├─ Total value: ~$23,150 (@ $0.021/BACK)
      │
      └─ Annual ROI: 23.15% 🎉

      COMMUNITY IMPACT:
      ├─ Total BACK burned: ~525,000 BACK 🔥
      ├─ Supply reduction: ~0.525%
      └─ Protocol health: Excellent ✅

09:30 │ Alice's decision:
      │ "The boost system works perfectly!
      │  I'll keep my lock active and continue
      │  earning boosted rewards. 💎🙌"


┌─────────────────────────────────────────────────────────────────────┐
│                   ALTERNATIVE: UNLOCK PATH                           │
└─────────────────────────────────────────────────────────────────────┘

      Si Alice avait choisi d'unlock:

      09:20 │ Alice clique sur "Unlock Tokens"
            │
            └─── ALTERNATIVE: UNLOCK ───┐
                                         │
                                         ▼

            📝 Transaction Details:
            ┌──────────────────────────────────────────────┐
            │ Instruction: update_nft_status               │
            │ New Status: Inactive                         │
            │                                              │
            │ Accounts:                                    │
            │ - user: Alice.publicKey                      │
            │ - user_nft: Alice's NFT PDA                  │
            │ - global_state: [PDA]                        │
            │ - user_back_account: Alice BACK account      │
            └──────────────────────────────────────────────┘

            ⚙️ Backend Processing:

            1. swapback_cnft::update_nft_status(false)
               ├─ Validate unlock period passed ✓
               │
               ├─ Update UserNft:
               │  └─ is_active = false
               │
               ├─ Update GlobalState:
               │  ├─ total_community_boost -= 8650
               │  ├─ active_locks_count -= 1
               │  └─ total_value_locked -= 100k BACK
               │
               └─ Transfer locked tokens:
                  └─ 100,000 BACK → Alice's account

            🎉 Result:
            ├─ Alice récupère 100k BACK
            ├─ NFT désactivé (boost = 0)
            ├─ Plus de rebates boostés
            └─ Plus de distributions de buyback
```

---

## 📊 Métriques de Performance

### Vue Système (après 1 mois)

```typescript
interface SystemMetrics {
  // Locks
  activeLocks: 487,
  totalValueLocked: 15_234_000 BACK, // ~$320k
  averageLockDuration: 243 days,

  // Boosts
  totalCommunityBoost: 245_780 BP,
  averageUserBoost: 504 BP (5.04%),
  diamondUsers: 23 (4.7%),
  goldUsers: 87 (17.8%),
  silverUsers: 156 (32.0%),
  bronzeUsers: 221 (45.5%),

  // Swaps
  totalSwapVolume: 2_450_000 USDC,
  rebatesPaid: 87_450 USDC,
  averageBoostMultiplier: 1.23x,

  // Buybacks
  buybacksExecuted: 4,
  totalBackBought: 195_400 BACK,
  totalDistributed: 97_700 BACK,
  totalBurned: 97_700 BACK, // 🔥 -0.097% supply

  // APY
  estimatedAPY: 21.4%,
  topUserAPY: 28.9%, // Diamond avec lock max
  averageUserAPY: 15.2%
}
```

---

## 🔍 Points Clés du Système

### ✅ Avantages pour l'Utilisateur

1. **Rebates Boostés**: Jusqu'à 2x le rebate de base
2. **Distribution Passive**: Recevoir des $BACK sans action
3. **Flexibilité**: Unlock disponible après période
4. **Transparence**: Tous les calculs on-chain vérifiables
5. **Pas de Frais**: Lock/unlock gratuits (sauf gas)

### ✅ Avantages pour le Protocole

1. **TVL Stable**: Tokens lockés = moins de volatilité
2. **Engagement**: Utilisateurs actifs avec boost
3. **Déflation**: 50% des buybacks brûlés
4. **Volume**: Incitation aux swaps via rebates
5. **Communauté**: Système équitable et proportionnel

### ⚠️ Considérations

1. **Lock Period**: Tokens inaccessibles pendant durée
2. **Market Risk**: Prix du $BACK peut varier
3. **Gas Fees**: Coûts Solana (minimes mais existants)
4. **Competition**: Plus de lockers = part individuelle plus petite
5. **Slippage**: Buybacks peuvent impacter le prix

---

## 🎯 Cas d'Usage Optimaux

### Pour Maximiser les Rewards

```typescript
// Stratégie "Diamond Hand"
{
  amount: 100k+ BACK,
  duration: 730 days (2 ans),
  boost: 100% (max),
  benefits: [
    "2x rebates sur tous les swaps",
    "Part maximale des distributions",
    "Statut Diamond prestigieux"
  ]
}

// Stratégie "Balanced"
{
  amount: 10k BACK,
  duration: 180 days (6 mois),
  boost: ~23%,
  benefits: [
    "1.23x rebates",
    "Bonne part des distributions",
    "Flexibilité moyenne terme"
  ]
}

// Stratégie "Starter"
{
  amount: 1k BACK,
  duration: 30 days,
  boost: ~3.5%,
  benefits: [
    "Découvrir le système",
    "Petits rewards sans grand risque",
    "Unlock rapide si besoin"
  ]
}
```

---

## 📚 Documentation Complémentaire

- [Guide de Déploiement](./BOOST_SYSTEM_DEPLOYMENT_GUIDE.md)
- [Tests d'Intégration](./tests/integration/boost-system.test.ts)
- [Frontend Integration](./FRONTEND_BOOST_INTEGRATION.md)
- [API Documentation](./API_DOCUMENTATION.md)

---

**Dernière mise à jour:** 26 Octobre 2025  
**Version:** 1.0.0
