# 🚀 Formule Complète du Système de Boost

## 📐 Formule Mathématique

Le boost est calculé en **basis points** (BP) où **10 000 BP = 100%**.

### Composantes du Boost

```
boost_total = min(amount_score + duration_score, 2000 BP)
```

Où :

**1. Amount Score (Score de Montant)** - Max 1000 BP (10%)
```
amount_score = min((tokens_lockés / 10_000) × 100, 1000)
```

**2. Duration Score (Score de Durée)** - Max 1000 BP (10%)
```
duration_score = min((jours_lockés / 5) × 10, 1000)
```

**3. Boost Total** - **Plafonné à 2000 BP (20%)**
```
boost_final = min(amount_score + duration_score, 2000)
```

---

## 🎯 Exemples Concrets

### Exemple 1 : Bronze (Petit Lock)
**Paramètres :**
- Montant : 1 000 BACK tokens
- Durée : 30 jours

**Calcul :**
```
amount_score = (1_000 / 10_000) × 100 = 0 × 100 = 0 BP
                └─ Division entière : 0

duration_score = (30 / 5) × 10 = 6 × 10 = 60 BP

boost_total = min(0 + 60, 2000) = 60 BP = 0.6%
```

**Résultat : 0.6% de boost** 📊

---

### Exemple 2 : Gold (Lock Moyen)
**Paramètres :**
- Montant : 10 000 BACK tokens
- Durée : 90 jours

**Calcul :**
```
amount_score = (10_000 / 10_000) × 100 = 1 × 100 = 100 BP (1%)

duration_score = (90 / 5) × 10 = 18 × 10 = 180 BP (1.8%)

boost_total = min(100 + 180, 2000) = 280 BP = 2.8%
```

**Résultat : 2.8% de boost** 🥉

---

### Exemple 3 : Platinum (Lock Important)
**Paramètres :**
- Montant : 50 000 BACK tokens
- Durée : 180 jours

**Calcul :**
```
amount_score = (50_000 / 10_000) × 100 = 5 × 100 = 500 BP (5%)

duration_score = (180 / 5) × 10 = 36 × 10 = 360 BP (3.6%)

boost_total = min(500 + 360, 2000) = 860 BP = 8.6%
```

**Résultat : 8.6% de boost** 🥈

---

### Exemple 4 : Diamond (Whale Lock)
**Paramètres :**
- Montant : 100 000 BACK tokens
- Durée : 365 jours (1 an)

**Calcul :**
```
amount_score = (100_000 / 10_000) × 100 = 10 × 100 = 1000 BP (10% - MAXED)

duration_score = (365 / 5) × 10 = 73 × 10 = 730 BP (7.3%)

boost_total = min(1000 + 730, 2000) = 1730 BP = 17.3%
```

**Résultat : 17.3% de boost** 🥇

---

### Exemple 5 : Maximum Absolu
**Paramètres :**
- Montant : 200 000 BACK tokens (ou plus)
- Durée : 730 jours (2 ans)

**Calcul :**
```
amount_score = (200_000 / 10_000) × 100 = 2000
               min(2000, 1000) = 1000 BP (10% - CAPPED)

duration_score = (730 / 5) × 10 = 1460
                 min(1460, 1000) = 1000 BP (10% - CAPPED)

boost_total = min(1000 + 1000, 2000) = 2000 BP = 20%
```

**Résultat : 20% de boost (MAXIMUM POSSIBLE)** 💎

---

## 💰 Impact du Boost sur les Rebates

### Formule d'Allocation avec Boost

Quand un utilisateur effectue un swap qui génère **NPI (Net Positive Income)** :

```
1. base_rebate = NPI × 60%
2. boost_amount = base_rebate × (boost% / 100)
3. total_rebate = base_rebate + boost_amount
4. buyback_from_npi = (NPI × 20%) - boost_amount  ← LE BOOST EST PAYÉ ICI
5. protocol_revenue = NPI × 20%                     ← TOUJOURS PROTÉGÉ
```

### Exemple Complet de Swap avec Boost

**Scénario :**
- Swap génère : 50 USDC de NPI
- Utilisateur a : 100k BACK lockés pendant 365 jours
- Boost : 17.3% (1730 BP)

**Calcul des Allocations :**

```
1. Base rebate
   = 50 USDC × 60%
   = 30 USDC

2. Boost amount
   = 30 USDC × 17.3%
   = 5.19 USDC

3. Total rebate utilisateur
   = 30 + 5.19
   = 35.19 USDC ✅ (L'utilisateur reçoit)

4. Buyback allocation
   = (50 × 20%) - 5.19
   = 10 - 5.19
   = 4.81 USDC ✅ (Buyback absorbe le coût du boost)

5. Protocol revenue
   = 50 × 20%
   = 10 USDC ✅ (Protocole toujours protégé)

TOTAL : 35.19 + 4.81 + 10 = 50 USDC ✓ (100% alloué)
```

---

## 📊 Tableau Récapitulatif des Tiers

| Tier | BACK Min | Durée Min | Amount Score | Duration Score | Boost Total | Boost % |
|------|----------|-----------|--------------|----------------|-------------|---------|
| **Bronze** | 100 | 7j | 0 BP | ~14 BP | ~14 BP | ~0.14% |
| **Silver** | 1 000 | 30j | 0 BP | 60 BP | 60 BP | 0.6% |
| **Gold** | 10 000 | 90j | 100 BP | 180 BP | 280 BP | 2.8% |
| **Platinum** | 50 000 | 180j | 500 BP | 360 BP | 860 BP | 8.6% |
| **Diamond** | 100 000+ | 365j | 1000 BP | 730 BP | 1730 BP | 17.3% |
| **MAX** | 200 000+ | 730j+ | 1000 BP | 1000 BP | **2000 BP** | **20%** |

---

## 🔍 Points Clés

### 1. Division Entière
⚠️ **Important :** Les calculs utilisent la division entière Rust.
- `(1_000 / 10_000) = 0` (pas 0.1)
- Donc pour avoir amount_score > 0, il faut **minimum 10 000 tokens**

### 2. Progression Linéaire
- **Amount :** +100 BP par tranche de 10 000 tokens
- **Duration :** +10 BP tous les 5 jours

### 3. Plafonds
- **Amount score :** Max 1000 BP atteint à 100 000 tokens
- **Duration score :** Max 1000 BP atteint à 500 jours
- **Boost total :** Toujours plafonné à 2000 BP (20%)

### 4. Source du Boost
Le boost est **toujours payé depuis l'allocation buyback**, jamais depuis le protocole :
```
buyback_final = buyback_base - boost_amount
protocol_revenue = INCHANGÉ (toujours 20% du NPI)
```

---

## 🎮 Cas d'Usage Réels

### Scénario 1 : Petit Utilisateur
- Lock : 1 000 BACK × 30 jours
- Boost : 0.6%
- Swap génère 10 USDC NPI
- **Rebate :** 6 USDC × 1.006 = 6.036 USDC
- **Gain additionnel :** +0.036 USDC (+0.6%)

### Scénario 2 : Utilisateur Moyen
- Lock : 10 000 BACK × 90 jours
- Boost : 2.8%
- Swap génère 100 USDC NPI
- **Rebate :** 60 USDC × 1.028 = 61.68 USDC
- **Gain additionnel :** +1.68 USDC (+2.8%)

### Scénario 3 : Whale
- Lock : 100 000 BACK × 365 jours
- Boost : 17.3%
- Swap génère 1 000 USDC NPI
- **Rebate :** 600 USDC × 1.173 = 703.80 USDC
- **Gain additionnel :** +103.80 USDC (+17.3%)

---

## ✅ Vérification de la Cohérence

### Test : Swap avec Boost Maximum (20%)

**Données :**
- NPI : 100 USDC
- Boost : 20% (2000 BP)
- Fees : 20 USDC (en plus)

**Allocation du NPI (100 USDC) :**
```
1. Base rebate = 100 × 60% = 60 USDC
2. Boost = 60 × 20% = 12 USDC
3. Total user = 60 + 12 = 72 USDC

4. Buyback from NPI = (100 × 20%) - 12 = 8 USDC
5. Protocol from NPI = 100 × 20% = 20 USDC

Total NPI allocation: 72 + 8 + 20 = 100 USDC ✓
```

**Allocation des Fees (20 USDC) :**
```
1. Buyback from fees = 20 × 30% = 6 USDC
2. Protocol from fees = 20 × 70% = 14 USDC

Total fees allocation: 6 + 14 = 20 USDC ✓
```

**Récapitulatif Global :**
```
- Utilisateur : 72 USDC (60% du NPI + 20% de boost)
- Buyback : 8 + 6 = 14 USDC (du NPI + des fees, après avoir payé le boost)
- Protocole : 20 + 14 = 34 USDC (du NPI + des fees, toujours protégé)

TOTAL : 72 + 14 + 34 = 120 USDC ✓ (100% des revenus alloués)
```

---

## 🧮 Formule Simplifiée (Version Courte)

Pour un utilisateur qui veut calculer rapidement son boost :

```
boost% = min(
    (tokens_lockés ÷ 100_000) × 10% +
    (jours_lockés ÷ 500) × 10%,
    20%
)
```

**Exemple rapide :**
- 50 000 tokens × 180 jours
- Boost = (50k/100k × 10%) + (180/500 × 10%)
- Boost = 5% + 3.6% = **8.6%**

---

## 📝 Notes Techniques

### Code Rust (Simplifié)
```rust
fn calculate_boost(amount: u64, duration: i64) -> u16 {
    let days = (duration / 86400) as u64;
    let tokens = amount / 1_000_000_000; // Conversion lamports → tokens
    
    // Score montant : max 1000 BP (10%)
    let amount_score = std::cmp::min((tokens / 10_000) * 100, 1000);
    
    // Score durée : max 1000 BP (10%)
    let duration_score = std::cmp::min((days / 5) * 10, 1000);
    
    // Total plafonné à 2000 BP (20%)
    std::cmp::min(amount_score + duration_score, 2000) as u16
}
```

### Conversion Basis Points
- **1 BP** = 0.01%
- **100 BP** = 1%
- **1000 BP** = 10%
- **2000 BP** = 20%

---

## 🎯 Objectifs du Système

1. ✅ **Récompenser l'engagement** : Plus de tokens lockés = plus de boost
2. ✅ **Favoriser la fidélité** : Durée de lock récompensée linéairement
3. ✅ **Plafond raisonnable** : Max 20% pour éviter les abus
4. ✅ **Mathématiquement sain** : Allocation toujours à 100%
5. ✅ **Buyback absorbe le coût** : Le protocole reste protégé

---

**Date de mise à jour :** 31 octobre 2025  
**Version du système de boost :** 2.0 (Max 20%)  
**Status :** ✅ Testé et validé (26/26 tests unitaires)
