# 🏦 Les Swaps SwapBack : Quels DEX ?

## Réponse Rapide

Les swaps SwapBack sont effectués sur **3 DEX principaux** de Solana :

### 1. 🪐 Jupiter Aggregator
**Rôle** : Routes directes (1 étape)  
**Exemple** : SOL → USDC  
**Frais** : ~0.5%

### 2. 🌊 Raydium
**Rôle** : 1ère étape des routes multi-étapes  
**Exemple** : SOL → USDC (intermédiaire)  
**Frais** : ~0.2%

### 3. 🐋 Orca
**Rôle** : 2ème étape des routes multi-étapes  
**Exemple** : USDC → USDT (final)  
**Frais** : ~0.3%

## 🛣️ Deux Types de Routes

### Route "Direct" (50%)
```
SOL → [Jupiter] → USDC
└─ 1 transaction
└─ Frais: 0.5%
```

### Route "Aggregator" (50%)
```
SOL → [Raydium] → USDC → [Orca] → USDT
└─ 2 transactions (atomiques)
└─ Frais: 0.2% + 0.3% = 0.5%
└─ Meilleur prix !
```

## ⚙️ Comment ça marche ?

1. **Vous entrez** un montant (ex: 10 SOL → USDT)
2. **SwapBack simule** les 2 types de routes
3. **L'algorithme choisit** la route avec le meilleur prix
4. **Vous voyez** les étapes détaillées dans l'interface
5. **Le swap s'exécute** sur les DEX sélectionnés

## 🎯 Avantages

✅ **Meilleur prix** : Comparaison automatique  
✅ **Transparence** : Vous voyez chaque étape  
✅ **NPI (Net Price Improvement)** : Vous gardez 75% du profit  
✅ **Sécurisé** : DEX décentralisés réputés

## 📊 Exemple Réel

**Swap** : 3 SOL → USDT

```
🛣️ Chemin de Route (Aggregator)

┌─────────────────────────────┐
│ Étape 1 - Raydium           │
│ 3.0000 SOL → 449.40 USDC    │
│ Frais: 0.60 USDC            │
└─────────────────────────────┘
           ↓
┌─────────────────────────────┐
│ Étape 2 - Orca              │
│ 449.40 USDC → 449.05 USDT   │
│ Frais: 0.35 USDT            │
└─────────────────────────────┘

💰 Total: 449.05 USDT
📊 Impact prix: 0.37%
```

## ⚠️ État Actuel

**Développement** : Données simulées (mockées)  
**Production** : Intégration APIs réelles en cours

## 🔗 Plus d'infos

Voir `DEX_INTEGRATION.md` pour la documentation complète.

---

**Testez maintenant** : http://localhost:3000 🚀
