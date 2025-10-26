# ⚠️ IDL Upload - Blocage Program ID Mismatch

**Date**: 26 Octobre 2025  
**Status**: ❌ BLOQUÉ - Nécessite re-déploiement ou approche alternative  
**Phase**: 11.4 - Upload IDL Files

---

## 🚨 Problème Identifié

### Program ID Mismatch

Les programmes ont été déployés avec des Program IDs qui ne correspondent pas aux IDs déclarés dans le code source (`declare_id!` macro).

| Programme | declare_id! (code source) | Program ID déployé (devnet) |
|-----------|---------------------------|------------------------------|
| swapback_cnft | `CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH` | `9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw` |
| swapback_router | `3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap` | `GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt` |
| swapback_buyback | `71vALqj3cmQWDmq9bi9GYYDPQqpoRstej3snUbikpCHW` | `EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf` |

### Erreur Anchor

```bash
Error: AnchorError occurred. Error Code: DeclaredProgramIdMismatch. 
Error Number: 4100. 
Error Message: The declared program id does not match the actual program id.
```

**Cause**: Lors du déploiement avec `solana program deploy`, Solana utilise les keypairs dans `target/deploy/*-keypair.json` pour générer les Program IDs. Ces keypairs ne correspondent pas aux IDs hardcodés dans `declare_id!`.

---

## 💡 Solutions Possibles

### Option 1: Re-déploiement avec Program IDs corrects ✅ RECOMMANDÉ

**Étapes**:

1. **Mettre à jour `declare_id!` dans chaque programme** avec les Program IDs déployés actuels
2. **Rebuild** les programmes
3. **Upgrade** les programmes existants sur devnet (même Program ID, nouveau code)

```bash
# Fichiers à modifier:
programs/swapback_cnft/src/lib.rs
programs/swapback_router/src/lib.rs
programs/swapback_buyback/src/lib.rs

# Changements:
# CNFT:
declare_id!("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");

# Router:
declare_id!("GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt");

# Buyback:
declare_id!("EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf");
```

Puis rebuild et upgrade:

```bash
anchor build

# Upgrade chaque programme
solana program deploy target/deploy/swapback_cnft.so \
  --program-id target/deploy/swapback_cnft-keypair.json \
  --upgrade-authority ~/.config/solana/id.json

solana program deploy target/deploy/swapback_router.so \
  --program-id target/deploy/swapback_router-keypair.json \
  --upgrade-authority ~/.config/solana/id.json

solana program deploy target/deploy/swapback_buyback.so \
  --program-id target/deploy/swapback_buyback-keypair.json \
  --upgrade-authority ~/.config/solana/id.json
```

**Coût estimé**: ~5 SOL (upgrade cost similar to initial deploy)

---

### Option 2: Upload IDL manuellement (Workaround) ⚠️ TEMPORAIRE

Créer les accounts IDL manuellement en utilisant les bons Program IDs, sans passer par `anchor idl init`.

**Inconvénient**: Complex, requiert écriture de script custom.

---

### Option 3: Skip IDL upload pour MVP ⏭️ ACCEPTABLE POUR TESTNET

Pour un déploiement testnet/MVP, l'IDL on-chain n'est pas strictement nécessaire. Les IDL files peuvent être:
- Servis via API backend
- Inclus dans le repo frontend
- Distribués via CDN/NPM package

**Avantages**:
- Pas de coût SOL
- Pas de blocage immédiat
- Fonctionnel pour tests

**Inconvénients**:
- Pas de découverte automatique via Anchor
- Moins user-friendly pour explorers/devs externes

---

## 🎯 Recommandation

### Pour TESTNET (court terme):
✅ **Option 3** - Skip IDL upload, distribuer les IDL via repo/API
- Les fichiers IDL existent dans `target/idl/*.json`
- Frontend peut les importer directement
- Économise ~0.003 SOL

### Pour MAINNET (long terme):
✅ **Option 1** - Re-déploiement propre avec Program IDs cohérents
- Permet `anchor idl init` sans problème
- Meilleure expérience développeur
- Standard Anchor best practice

---

## 📋 Actions Immédiates

### Court Terme (Testnet)

1. ✅ Documenter le mismatch (ce fichier)
2. ✅ Copier les IDL dans app/public/ pour accès frontend
3. ⏭️ Continuer avec Phase 11.5 (Initialize Program States)
4. ⏭️ Tester avec IDL locaux

### Moyen Terme (Avant Mainnet)

1. ⏳ Mettre à jour `declare_id!` dans tous les programmes
2. ⏳ Rebuild et upgrade sur devnet
3. ⏳ Upload IDL via `anchor idl init`
4. ⏳ Vérifier avec `anchor idl fetch`

---

## 📁 IDL Files Disponibles

Les fichiers IDL sont générés et disponibles localement :

```bash
target/idl/swapback_cnft.json      # 12KB
target/idl/swapback_buyback.json   # 19KB
target/idl/swapback_router.json    # [à générer]
```

### Utilisation Frontend

```typescript
// app/lib/idl/swapback_cnft.ts
import cnftIdl from '../../../target/idl/swapback_cnft.json';

const program = new Program(
  cnftIdl as Idl,
  new PublicKey("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw"),
  provider
);
```

---

## ✅ Décision

**Pour avancer rapidement sur Phase 11** :
- ⏭️ **SKIP** l'upload IDL on-chain pour le moment
- ✅ Utiliser les IDL locaux dans le frontend
- ⏳ Planifier la correction (Option 1) avant mainnet

**Justification**:
- Testnet/MVP ne nécessite pas IDL on-chain
- Économise temps et SOL (~5 SOL pour re-deploy)
- Permet de continuer Phase 11 (Initialize States, Tests E2E)
- Correction planifiée avant mainnet

---

_Document créé le 26 Octobre 2025 - Phase 11 IDL Upload Blocker_  
_Prochaine étape: Phase 11.5 - Initialize Program States_
