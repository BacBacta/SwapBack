# 🔒 Système Lock/Unlock avec Boost Dynamique

## 📊 Vue d'ensemble du système

Le système Lock/Unlock de SwapBack permet aux utilisateurs de verrouiller leurs tokens $BACK pour obtenir:
1. **Un boost sur leurs rebates** (proportionnel au montant et à la durée)
2. **Une allocation prioritaire** du buyback & burn

---

## 💎 Formule de Calcul du Boost

### Nouvelle Formule Dynamique

Le boost est calculé en fonction de **deux facteurs** :
- **Montant locké** (amount_score)
- **Durée du lock** (duration_score)

```typescript
boost = min(
  (amount_score * duration_score) / 100,
  100  // Maximum 100% de boost
)

// Score basé sur le montant
amount_score = min(
  (locked_amount / 1000) * 0.5,  // 0.5% par 1000 $BACK
  50  // Maximum 50 points pour le montant
)

// Score basé sur la durée
duration_score = min(
  (lock_days / 10) * 1,  // 1% par 10 jours
  50  // Maximum 50 points pour la durée
)
```

### Exemples de Calcul

| Montant Locké | Durée    | Amount Score | Duration Score | **Boost Total** |
|---------------|----------|--------------|----------------|-----------------|
| 1,000 $BACK   | 30 jours | 0.5%         | 3%             | **3.5%**        |
| 5,000 $BACK   | 90 jours | 2.5%         | 9%             | **11.5%**       |
| 10,000 $BACK  | 180 jours| 5%           | 18%            | **23%**         |
| 50,000 $BACK  | 180 jours| 25%          | 18%            | **43%**         |
| 100,000 $BACK | 365 jours| 50% (max)    | 36.5%          | **86.5%**       |
| 200,000 $BACK | 365 jours| 50% (max)    | 36.5%          | **86.5%**       |
| 100,000 $BACK | 730 jours| 50% (max)    | 50% (max)      | **100% (max)**  |

---

## 🎯 Niveaux de cNFT (Visuels)

Les niveaux sont maintenant **indicatifs visuels** uniquement. Le boost est calculé dynamiquement.

| Niveau   | Montant Min | Durée Min | Badge       |
|----------|-------------|-----------|-------------|
| Bronze   | 100 $BACK   | 7 jours   | 🥉          |
| Silver   | 1,000 $BACK | 30 jours  | 🥈          |
| Gold     | 10,000 $BACK| 90 jours  | 🥇          |
| Platinum | 50,000 $BACK| 180 jours | 💎          |
| Diamond  | 100,000 $BACK| 365 jours| 💠          |

---

## 🔥 Allocation Buyback & Burn

### Principe

Le pourcentage de tokens alloués au buyback & burn est **proportionnel au boost de l'utilisateur**.

```typescript
// Allocation de buyback pour un utilisateur
user_buyback_share = (user_boost / total_community_boost) * 100

// Exemple:
// User A: 50% boost, User B: 30% boost, User C: 20% boost
// Total: 100% boost
// 
// Allocation User A: 50/100 = 50% des tokens buyback
// Allocation User B: 30/100 = 30% des tokens buyback
// Allocation User C: 20/100 = 20% des tokens buyback
```

### Mécanisme de Buyback

1. **Collecte des frais** : 0.3% de frais sur chaque swap
   - 40% → Buyback Pool (0.12% du volume)
   - 30% → Rebates Pool (0.09% du volume)
   - 30% → Protocol Treasury (0.09% du volume)

2. **Exécution du Buyback** (quotidien ou hebdomadaire)
   - Swap USDC → $BACK via Jupiter
   - Distribution proportionnelle selon les boosts

3. **Burn des tokens**
   - 100% des tokens buyback sont brûlés
   - Impact déflationniste sur la supply

---

## 📈 Impact sur les Rebates

### Formule de Rebate Boosté

```typescript
base_rebate = swap_volume * rebate_rate  // Rebate de base (0.3% du volume)

boosted_rebate = base_rebate * (1 + user_boost / 100)

// Exemple:
// Swap de 1000 USDC
// Rebate de base: 1000 * 0.003 = 3 USDC
// 
// Avec 50% de boost:
// Boosted rebate: 3 * (1 + 50/100) = 3 * 1.5 = 4.5 USDC
// 
// Avec 100% de boost:
// Boosted rebate: 3 * (1 + 100/100) = 3 * 2 = 6 USDC
```

### Tableau Comparatif

| Swap Volume | Rebate Base | Boost 0% | Boost 25% | Boost 50% | Boost 100% |
|-------------|-------------|----------|-----------|-----------|------------|
| 100 USDC    | 0.30 USDC   | 0.30     | 0.375     | 0.45      | 0.60       |
| 1,000 USDC  | 3.00 USDC   | 3.00     | 3.75      | 4.50      | 6.00       |
| 10,000 USDC | 30.00 USDC  | 30.00    | 37.50     | 45.00     | 60.00      |
| 100,000 USDC| 300.00 USDC | 300.00   | 375.00    | 450.00    | 600.00     |

---

## 🔄 Cycle de Vie du Lock

### 1. Lock des Tokens

```typescript
// User lock 10,000 $BACK pour 180 jours
lock_amount = 10,000
lock_duration = 180 days

// Calcul du boost
amount_score = (10,000 / 1000) * 0.5 = 5%
duration_score = (180 / 10) * 1 = 18%
boost = 5 + 18 = 23%

// NFT Level (visuel)
level = "Gold" // 10k+ et 90+ jours

// Tokens transférés vers vault
// cNFT minté avec metadata
```

### 2. Période de Lock

```typescript
// Pendant le lock:
- Tokens non accessibles
- Boost actif sur tous les swaps
- Part dans le buyback proportionnelle au boost
- cNFT visible dans le wallet

// Countdown
unlock_date = lock_timestamp + lock_duration
time_remaining = unlock_date - current_time
```

### 3. Unlock des Tokens

```typescript
// Après expiration:
if (current_time >= unlock_date) {
  // Tokens débloqués
  // cNFT désactivé
  // Boost retiré
  // Part de buyback annulée
}

// Unlock anticipé (pénalité):
penalty = 10% // 10% des tokens lockés
unlocked_amount = lock_amount * 0.9
penalty_amount = lock_amount * 0.1 // Brûlé
```

---

## 💡 Stratégies Recommandées

### Pour Maximiser le Boost

1. **Long Terme** : Lock 100,000 $BACK pour 730 jours = **100% boost**
2. **Équilibré** : Lock 50,000 $BACK pour 180 jours = **43% boost**
3. **Court Terme** : Lock 10,000 $BACK pour 90 jours = **14% boost**

### Pour le Buyback

- **Plus grand boost** = **Plus grande part** du buyback
- Les tokens buyback sont **brûlés**, réduisant la supply
- Effet cumulatif sur le prix du $BACK

### ROI Estimé

| Lock Setup           | Boost  | Rebate Multiplier | Buyback Share | APY Estimé |
|---------------------|--------|-------------------|---------------|------------|
| 1k × 30j            | 3.5%   | 1.035x            | ~2%           | 5-8%       |
| 10k × 180j          | 23%    | 1.23x             | ~15%          | 15-25%     |
| 100k × 365j         | 86.5%  | 1.865x            | ~50%          | 40-60%     |
| 100k × 730j         | 100%   | 2.0x              | ~60%          | 50-80%     |

---

## 🛠️ Implémentation Technique

### Frontend (TypeScript)

```typescript
// Calcul du boost dynamique
function calculateDynamicBoost(amount: number, durationDays: number): number {
  // Score du montant (max 50)
  const amountScore = Math.min(
    (amount / 1000) * 0.5,
    50
  );
  
  // Score de la durée (max 50)
  const durationScore = Math.min(
    (durationDays / 10) * 1,
    50
  );
  
  // Boost total (max 100%)
  const totalBoost = Math.min(
    amountScore + durationScore,
    100
  );
  
  return totalBoost;
}

// Niveau visuel (badge)
function getVisualLevel(amount: number, durationDays: number): string {
  if (amount >= 100000 && durationDays >= 365) return "Diamond";
  if (amount >= 50000 && durationDays >= 180) return "Platinum";
  if (amount >= 10000 && durationDays >= 90) return "Gold";
  if (amount >= 1000 && durationDays >= 30) return "Silver";
  if (amount >= 100 && durationDays >= 7) return "Bronze";
  return "None";
}
```

### Backend (Rust)

```rust
// Dans swapback_cnft program
pub fn calculate_boost(amount: u64, duration_days: u64) -> u8 {
    // Amount score (max 50)
    let amount_f = amount as f64 / 1_000_000_000.0; // Convert to tokens
    let amount_score = ((amount_f / 1000.0) * 0.5).min(50.0);
    
    // Duration score (max 50)
    let duration_score = ((duration_days as f64 / 10.0) * 1.0).min(50.0);
    
    // Total boost (max 100)
    let total_boost = (amount_score + duration_score).min(100.0);
    
    total_boost as u8
}

// Allocation du buyback
pub fn calculate_buyback_share(
    user_boost: u8,
    total_community_boost: u64
) -> u64 {
    if total_community_boost == 0 {
        return 0;
    }
    
    (user_boost as u64 * 10000) / total_community_boost
}
```

---

## 📊 Dashboard Utilisateur

### Informations Affichées

```
┌─────────────────────────────────────────┐
│ 💎 YOUR LOCK STATUS                     │
├─────────────────────────────────────────┤
│ Locked Amount:     10,000 $BACK         │
│ Lock Duration:     180 days             │
│ Unlock Date:       2025-04-25           │
│ Time Remaining:    120 days             │
├─────────────────────────────────────────┤
│ 📈 YOUR BOOST                           │
├─────────────────────────────────────────┤
│ Amount Score:      5.0%                 │
│ Duration Score:    18.0%                │
│ Total Boost:       23.0%                │
│ Visual Level:      🥇 Gold              │
├─────────────────────────────────────────┤
│ 🔥 BUYBACK ALLOCATION                   │
├─────────────────────────────────────────┤
│ Your Share:        15.2%                │
│ Community Total:   151.3% (all users)   │
│ Next Buyback:      ~500 $BACK           │
│ Your Allocation:   ~76 $BACK (burned)   │
└─────────────────────────────────────────┘
```

---

## 🎯 Prochaines Étapes

1. ✅ **Implémenter la formule dynamique** dans le frontend
2. ✅ **Mettre à jour les interfaces Lock/Unlock**
3. ⏳ **Intégrer avec le programme Rust**
4. ⏳ **Tester sur devnet**
5. ⏳ **Déployer sur mainnet**

---

**Créé le:** 26 Octobre 2025  
**Auteur:** SwapBack Development Team  
**Version:** 2.0 - Boost Dynamique
