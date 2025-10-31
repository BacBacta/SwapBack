# 🚀 GUIDE DE DÉPLOIEMENT - Programme Buyback Token-2022
# ====================================================

## 🎯 OBJECTIF
Redéployer le programme buyback avec support Token-2022 pour résoudre l'incompatibilité avec $BACK

## 📋 PRÉREQUIS
- Solana CLI installé et configuré
- Au moins 5 SOL sur le wallet
- Accès au code source modifié

## 🔧 ÉTAPES DE DÉPLOIEMENT

### 1. Configuration Solana
```bash
# Configurer pour devnet
solana config set --url https://api.devnet.solana.com

# Vérifier la configuration
solana config get

# Vérifier le solde
solana balance
```

### 2. Airdrop si nécessaire
```bash
# Si solde < 5 SOL
solana airdrop 5
```

### 3. Déploiement du programme
```bash
# Depuis le répertoire racine du projet
cd /workspaces/SwapBack

# Déployer le programme buyback
solana program deploy \
  --program-id target/deploy/swapback_buyback-keypair.json \
  target/deploy/swapback_buyback.so
```

### 4. Vérification du déploiement
```bash
# Vérifier que le programme est déployé
solana program show EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf

# Doit afficher:
# Program Id: EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
# Owner: BPFLoaderUpgradeab1e11111111111111111111111
# Executable: true
# Balance: X.XXX SOL
```

## 🧪 TEST APRÈS DÉPLOIEMENT

### 1. Initialisation Buyback States
```bash
cd /workspaces/SwapBack
node scripts/init-buyback-states.js
```

### 2. Vérification des states
```bash
# Vérifier que GlobalState est créé
solana account 3wP9RYc2hQrzMv7dbbAxJMy9sd1ErjXz7qG2wgUG76Kg
```

## 📊 RÉSULTATS ATTENDUS

✅ **Avant déploiement:**
- Erreur: AccountOwnedByWrongProgram (0xbbf)
- Programme attend Token standard pour $BACK

✅ **Après déploiement:**
- Programme accepte Token-2022 pour $BACK
- Initialisation buyback réussit
- Tests E2E complets possibles

## 🔍 DIAGNOSTIC

**Problème identifié:**
- Programme buyback déployé utilise `Account<'info, Mint>` pour `back_mint`
- Cela impose automatiquement owner = TOKEN_PROGRAM_ID
- Notre $BACK utilise TOKEN_2022_PROGRAM_ID

**Solution implémentée:**
- Modifié `back_mint` vers `AccountInfo<'info>` avec validation manuelle
- Ajouté logique conditionnelle Token vs Token-2022 dans `burn_back` et `distribute_buyback`
- Programme maintenant compatible avec les deux standards

## 🎯 PROCHAINES ÉTAPES

1. ✅ Redéployer programme buyback
2. ✅ Initialiser buyback states
3. ✅ Tester lock/unlock complet avec buyback
4. ✅ Tests E2E finaux
5. ✅ Documentation finale

---
**Programme ID:** EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
**Token $BACK:** 3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE (Token-2022)
**Status:** Prêt pour redéploiement