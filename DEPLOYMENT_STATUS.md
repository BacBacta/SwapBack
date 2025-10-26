# 📊 SwapBack - Statut du Déploiement Devnet

**Date**: 26 Octobre 2025  
**Réseau**: Solana Devnet  
**Wallet**: `3PiZ1xdHbPbj1UaPS8pfzKnHpmQQLfR8zrhy5RcksqAt`

---

## ✅ Programmes Déployés

### 1. swapback_cnft ✅ DÉPLOYÉ

**Program ID**: `9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw`

- **Signature de déploiement**: `5EbyAELiTK1pP6Adom3vkymCN4VRzmCUTyLk8Bk9uPgKuR7NVvNQkQHneWUutwaJ4qUxxtyJ5cpyhhiU2YK634Vj`
- **Taille**: 255 KB
- **Statut**: ✅ Actif sur devnet
- **Explorer**: https://explorer.solana.com/address/9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw?cluster=devnet
- **Fonctionnalités**:
  - Mint de cNFT avec Merkle tree
  - Lock de tokens $BACK pour boost
  - Calcul dynamique de boost: amount_score (50%) + duration_score (50%)
  - Boost maximum: 100% (10,000 BP)

---

## ⏳ Programmes en Attente

### 2. swapback_router ⏳ EN ATTENTE

**Program ID Cible**: `3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap` (configuré dans Anchor.toml)

- **Taille**: 296 KB
- **Coût estimé**: ~2.1 SOL
- **Statut**: ⏳ Compilé, en attente de déploiement
- **Fichier**: `target/deploy/swapback_router.so`
- **Fonctionnalités**:
  - Routing Jupiter V6 intégré
  - Comparaison de routes automatique
  - Allocation 40% fees → buyback vault
  - Intégration oracle prix (Pyth/Switchboard)

**Commande de déploiement**:
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana program deploy target/deploy/swapback_router.so
```

---

### 3. swapback_buyback ⏳ EN ATTENTE

**Program ID Cible**: `46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU` (configuré dans Anchor.toml)

- **Taille**: 356 KB
- **Coût estimé**: ~2.4 SOL
- **Statut**: ⏳ Compilé, en attente de déploiement
- **Fichier**: `target/deploy/swapback_buyback.so`
- **Fonctionnalités**:
  - Réception USDC du router
  - Exécution buyback via Jupiter
  - Distribution 50% aux utilisateurs (proportionnel au boost)
  - Burn 50% des tokens $BACK achetés

**Commande de déploiement**:
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana program deploy target/deploy/swapback_buyback.so
```

---

## 📋 Procédure de Finalisation

### Étape 1: Obtenir Plus de SOL (REQUIS)

Le wallet actuel a **0.18 SOL** - insuffisant pour déployer les 2 programmes restants.

**Options**:

1. **Faucet Web Solana** (RECOMMANDÉ):
   - https://faucet.solana.com/
   - Entrer l'adresse: `3PiZ1xdHbPbj1UaPS8pfzKnHpmQQLfR8zrhy5RcksqAt`
   - Demander 5 SOL

2. **Attendre Rate Limit** (lent):
   - Le rate limit du CLI airdrop se réinitialise toutes les ~1-2 heures
   - Puis: `solana airdrop 2` (répéter 3x)

3. **Nouveau Wallet** (alternative):
   - Créer nouveau wallet: `solana-keygen new --outfile ~/.config/solana/deploy2.json`
   - Demander airdrops sur le nouveau wallet
   - Transférer les SOL au wallet principal

### Étape 2: Déployer Router

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd /workspaces/SwapBack
solana balance  # Vérifier >= 2.5 SOL
solana program deploy target/deploy/swapback_router.so
```

**Résultat attendu**:
```
Program Id: <NEW_PROGRAM_ID>
Signature: <SIGNATURE_HASH>
```

### Étape 3: Déployer Buyback

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd /workspaces/SwapBack
solana balance  # Vérifier >= 2.5 SOL
solana program deploy target/deploy/swapback_buyback.so
```

### Étape 4: Mettre à Jour les Configurations

Une fois tous les programmes déployés, mettre à jour:

1. **Anchor.toml** - section `[programs.devnet]`:
   ```toml
   [programs.devnet]
   swapback_cnft = "9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw"
   swapback_router = "<ROUTER_PROGRAM_ID>"
   swapback_buyback = "<BUYBACK_PROGRAM_ID>"
   ```

2. **app/config/programIds.ts**:
   ```typescript
   export const PROGRAM_IDS = {
     devnet: {
       cnft: new PublicKey("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw"),
       router: new PublicKey("<ROUTER_PROGRAM_ID>"),
       buyback: new PublicKey("<BUYBACK_PROGRAM_ID>"),
     }
   };
   ```

3. **Générer les IDL files**:
   ```bash
   anchor idl init --filepath target/idl/swapback_cnft.json 9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw
   anchor idl init --filepath target/idl/swapback_router.json <ROUTER_PROGRAM_ID>
   anchor idl init --filepath target/idl/swapback_buyback.json <BUYBACK_PROGRAM_ID>
   ```

### Étape 5: Initialiser les États

```bash
# Initialiser le programme CNFT
anchor run init-cnft

# Initialiser le programme Router
anchor run init-router

# Initialiser le programme Buyback
anchor run init-buyback
```

### Étape 6: Tests d'Intégration

```bash
npm test -- --grep "devnet"
```

---

## 📊 Compilation - Détails Techniques

### Environnement

- **Solana CLI**: 2.3.13 (Agave)
- **Anchor Version**: 0.32.1
- **Rust Version**: 1.82.0
- **Platform**: Ubuntu 24.04.3 LTS (Codespaces)

### Commandes de Compilation

```bash
# Ajout de Solana CLI au PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Compilation avec cargo-build-sbf (contourne les conflits de versions)
cargo build-sbf --manifest-path programs/swapback_cnft/Cargo.toml
cargo build-sbf --manifest-path programs/swapback_router/Cargo.toml
cargo build-sbf --manifest-path programs/swapback_buyback/Cargo.toml
```

**Note**: Nous utilisons `cargo build-sbf` au lieu de `anchor build` pour éviter les conflits de versions dans les dépendances transitives (notamment `spl-type-length-value` et `spl-token-2022`).

### Warnings de Compilation

Les warnings suivants sont normaux et n'affectent pas le déploiement:

- `unexpected cfg condition value: 'anchor-debug'` - Feature de debug Anchor
- `unexpected cfg condition value: 'custom-heap'` - Heap customization
- `unused imports` - Imports non utilisés à nettoyer

---

## 🔧 Dépannage

### Problème: "Insufficient funds for spend"

**Solution**: Voir "Étape 1: Obtenir Plus de SOL" ci-dessus.

### Problème: "airdrop request failed. Rate limit is reached"

**Solutions**:
1. Attendre 1-2 heures
2. Utiliser le faucet web: https://faucet.solana.com/
3. Créer un nouveau wallet temporaire

### Problème: "Unable to find the account"

Le buffer account a été automatiquement fermé. Pas de problème, continuez le déploiement normalement.

### Problème: Compilation échoue avec "anchor build"

**Solution**: Utiliser `cargo build-sbf` directement:
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
cargo build-sbf --manifest-path programs/<PROGRAM_NAME>/Cargo.toml
```

---

## 📈 Prochaines Étapes

### Court Terme (Immédiat)

- [ ] Obtenir 5+ SOL sur le wallet de déploiement
- [ ] Déployer `swapback_router` sur devnet
- [ ] Déployer `swapback_buyback` sur devnet
- [ ] Mettre à jour Anchor.toml avec les vrais Program IDs
- [ ] Mettre à jour app/config/programIds.ts
- [ ] Upload des IDL files sur chain

### Moyen Terme (Cette Semaine)

- [ ] Initialiser les états des 3 programmes
- [ ] Tests d'intégration end-to-end sur devnet
- [ ] Tests de l'UI avec les vrais programmes
- [ ] Correction des 15 tests API failing
- [ ] Documentation utilisateur finale

### Long Terme (Semaine Prochaine)

- [ ] Security audit des smart contracts
- [ ] Déploiement testnet-beta
- [ ] User acceptance testing (UAT)
- [ ] Déploiement mainnet-beta
- [ ] Annonce publique et onboarding beta users

---

## 🎯 Métriques de Succès

### Phase 8 (Déploiement Devnet)

- ✅ **1/3 programmes déployés** (CNFT)
- ⏳ **2/3 programmes compilés** (Router, Buyback)
- 🎯 **Objectif**: 3/3 programmes déployés et fonctionnels

### Performances Attendues

- **RPC Cache**: 70%+ réduction des requêtes blockchain
- **UI Performance**: <100ms temps de réponse (interactions locales)
- **Swap Latency**: <3s (incluant confirmations blockchain)
- **Boost Calculation**: <50ms (calcul local)

---

## 📞 Contact & Support

**Repo**: https://github.com/BacBacta/SwapBack  
**Network**: Solana Devnet  
**Cluster URL**: https://api.devnet.solana.com

---

_Document généré le 26 Octobre 2025 - Mise à jour automatique après chaque déploiement_
