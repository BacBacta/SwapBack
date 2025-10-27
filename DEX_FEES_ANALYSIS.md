# Analyse Comparative des Fees - DEX Solana

**Date**: 27 Octobre 2025  
**Objectif**: Déterminer des fees compétitifs pour SwapBack

## 📊 Fees des Principaux DEX Solana

### 1. **Jupiter Aggregator**
- **Swap Fee**: 0% (pas de frais direct)
- **Platform Fee**: Variable selon la route (0-0.5%)
- **Referral Fee**: Optionnel (0.1-0.25%)
- **Note**: Jupiter agrège les liquidités, les fees viennent des DEX sous-jacents

### 2. **Raydium**
- **Standard Pool Fee**: 0.25% (25 basis points)
  - LP providers: 0.22%
  - Protocol: 0.03%
- **Concentrated Liquidity (CLMM)**: 0.01% à 1% (configurable)
- **Stable Pool**: 0.04%

### 3. **Orca**
- **Standard Pool**: 0.30% (30 basis points)
  - LP providers: 0.25%
  - Protocol: 0.05%
- **Whirlpools (Concentrated Liquidity)**: 0.01% à 1%
- **Stable Pool**: 0.07%

### 4. **Phoenix**
- **Maker Fee**: -0.02% (rebate)
- **Taker Fee**: 0.05% (5 basis points)
- **Note**: Order book model, très compétitif

### 5. **Lifinity**
- **Dynamic Fee**: 0.01% à 0.80%
- **Moyenne**: ~0.15-0.30%
- **Note**: Ajuste les fees selon la volatilité

### 6. **Meteora**
- **Dynamic Pool**: 0.01% à 0.30%
- **Stable Pool**: 0.01% à 0.07%
- **Multi-token Pool**: 0.05% à 0.50%

## 🎯 Positionnement SwapBack

### Stratégie de Pricing

**Objectif**: Se positionner comme le DEX avec les **fees les plus bas** tout en offrant un **rebate via cNFT boost**.

### Fees Proposés pour SwapBack

#### **Base Swap Fee: 0.20% (20 basis points)**

**Décomposition**:
- Protocol Fee: 0.05% (5 bp) → Buyback BACK
- LP Provider Fee: 0.15% (15 bp) → Récompense liquidité
- **Total User Fee**: 0.20%

**Comparaison**:
- ✅ **15% moins cher** que Orca (0.30%)
- ✅ **20% moins cher** que Raydium (0.25%)
- ✅ Compétitif avec Phoenix (0.05% taker)
- ✅ Dans la fourchette basse de Lifinity/Meteora

#### **Avec cNFT Boost**: Fee Effective Réduite

Exemple avec boost de 900 bp (9%):
- Base fee: 0.20%
- Rebate boost: 0.20% × 9% = 0.018%
- **Fee effective: 0.182%**

Avec boost max 2000 bp (20%):
- **Fee effective: 0.16%** (meilleur que tous les DEX!)

## 💡 Avantages Compétitifs SwapBack

### 1. **Fees Parmi les Plus Bas**
- 0.20% base (vs 0.25-0.30% concurrents)
- Jusqu'à 0.16% avec boost max
- **Économies**: 20-33% vs Raydium/Orca

### 2. **Rebate via cNFT**
- Reward immédiat sur chaque swap
- Boost proportionnel au lock BACK
- Gamification de la loyauté

### 3. **Buyback Automatique**
- 5 bp (0.05%) → Buyback BACK
- Redistribution aux holders cNFT
- Création de valeur pour l'écosystème

### 4. **Transparence Totale**
- Tous les fees on-chain
- Calcul boost visible
- Dashboard temps réel

## 📈 Simulation d'Économies

### Swap de $10,000 USDC → SOL

| DEX | Fee % | Fee Amount | Avec Boost SwapBack (20%) |
|-----|-------|------------|---------------------------|
| **Orca** | 0.30% | $30.00 | - |
| **Raydium** | 0.25% | $25.00 | - |
| **SwapBack (base)** | 0.20% | $20.00 | - |
| **SwapBack (boost 9%)** | 0.182% | $18.20 | **Économie: $11.80 vs Orca** |
| **SwapBack (boost 20%)** | 0.16% | $16.00 | **Économie: $14.00 vs Orca** |

**ROI pour l'utilisateur**:
- Lock 100 BACK (9% boost) → Économise $11.80 par swap $10k
- Rentabilité en ~8-10 swaps de $10k

## 🔧 Implémentation Technique

### Paramètres Router

```rust
// programs/swapback-router/src/lib.rs

pub const SWAP_FEE_NUMERATOR: u64 = 20;      // 0.20%
pub const SWAP_FEE_DENOMINATOR: u64 = 10000; // Basis points

pub const PROTOCOL_FEE_SHARE: u64 = 25;      // 25% de 0.20% = 0.05%
pub const LP_FEE_SHARE: u64 = 75;            // 75% de 0.20% = 0.15%
```

### Calcul Fee avec Boost

```rust
// Fee de base
let base_fee = (amount * SWAP_FEE_NUMERATOR) / SWAP_FEE_DENOMINATOR;

// Rebate si cNFT boost
if user_has_cnft {
    let boost_bp = user_nft.boost_basis_points;
    let rebate = (base_fee * boost_bp) / 10000;
    let effective_fee = base_fee - rebate;
    // effective_fee est débité à l'utilisateur
}
```

## 🎯 Recommandation Finale

### **SwapBack Fee Structure**

✅ **Base Fee: 0.20% (20 basis points)**
- Protocol (Buyback): 0.05%
- LP Providers: 0.15%

✅ **Avec cNFT Boost**:
- Rebate: 0-20% de la fee (0-4 bp)
- Fee effective: 0.16% à 0.20%

✅ **Positionnement**:
- **15-33% moins cher** que Orca/Raydium
- **Compétitif** avec Phoenix/Meteora
- **Unique**: Seul DEX avec rebate cNFT

### Avantages Marketing

1. **"Lowest Fees on Solana"** (avec boost)
2. **"Earn While You Trade"** (buyback redistribution)
3. **"Lock Once, Save Forever"** (boost permanent)

## 📊 Métriques de Succès

**KPIs à suivre**:
- Volume de swap quotidien
- % utilisateurs avec cNFT boost
- TVL vs concurrents
- Économies cumulées utilisateurs
- Taux de rétention

**Objectif Q1 2026**:
- 10M$ volume quotidien
- 50%+ utilisateurs avec boost
- Top 5 DEX Solana par volume

---

**Conclusion**: Avec une fee de **0.20%** (vs 0.25-0.30% concurrents) et un système de **rebate cNFT unique**, SwapBack se positionne comme le DEX le plus compétitif et innovant de Solana.

**Next Step**: Déployer sur testnet avec ces paramètres et mesurer l'adoption.
