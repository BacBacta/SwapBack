# Fix CNFT Program ID - 23 novembre 2025

## 🐛 Problème identifié

L'application produisait l'erreur suivante :
```
AccountNotInitialized - Error Code: 3012
The program expected this account to be already initialized.
Account: collection_config
```

## 🔍 Analyse

1. **Cause racine** : Plusieurs sources de Program ID incohérentes
   - Variable Vercel : `26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru` (ancien)
   - IDL address : `EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP` (nouveau)
   - Fallbacks codés en dur : ancien ID
   - Anchor.toml devnet : nouveau ID

2. **Impact** : Le code utilisait l'ancien Program ID à cause des fallbacks, ce qui pointait vers un `collection_config` PDA non initialisé

## ✅ Solution mise en œuvre

### 1. Initialisation des comptes on-chain

```bash
# Initialisation du collection_config pour le nouveau Program ID
CNFT_PROGRAM_ID="EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP" \
  node scripts/init-collection-config.js
```

**Résultat** :
- ✅ CollectionConfig PDA : `6dehXWPBY8SAZjJ9k12hbY8hVasAZVwq1ZxoqswATsUd`
- ✅ GlobalState PDA : `B7TaucZPmdsJN4Z1LtMtGq8B131gD6kGqwpKNcub1AZe`
- ✅ Transaction : `2Ly7Hd9y5AwW8duztJhfHzNWTF6eSLUYXCQdRXp2SYbWtMWcFvkJTjB6uSXtVe5CJuoaLmVWSHtMFCovL2WmzhHy`

### 2. Mise à jour du code

**Fichiers modifiés** :

#### `app/src/hooks/useBoostSystem.ts`
```typescript
// Ancien fallback
process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || "26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru"

// Nouveau fallback
process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || "EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP"
```

#### `app/config/programIds.ts`
```typescript
// Mis à jour pour DEVNET et TESTNET
cnftProgram: new PublicKey(
  process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || 'EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP'
)
```

#### Templates .env
- `.env.example`
- `.env.production.template`
- `.env.preview.template`

Tous mis à jour avec : `NEXT_PUBLIC_CNFT_PROGRAM_ID=EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP`

### 3. Commits

- `bb343ce` - Fix CNFT Program ID fallback dans useBoostSystem.ts et programIds.ts
- `0fa9770` - Fix CNFT Program ID dans tous les templates .env

## 📋 Checklist Vercel

**Action requise** : Vérifier la variable d'environnement sur Vercel

1. Aller sur **Vercel Dashboard** → Projet SwapBack
2. **Settings** → **Environment Variables**
3. Vérifier `NEXT_PUBLIC_CNFT_PROGRAM_ID`
   - ✅ Doit être : `EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP`
   - ❌ Si ancien : `26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru`
4. **Redéployer** si nécessaire

**Note** : Même si la variable Vercel n'est pas mise à jour, le code utilise maintenant le bon fallback, donc l'application devrait fonctionner.

## 🧪 Vérification

### Vérifier les comptes on-chain

```bash
node -e "
const { Connection, PublicKey } = require('@solana/web3.js');
const CNFT_PROGRAM_ID = new PublicKey('EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

(async () => {
  const [collectionConfig] = PublicKey.findProgramAddressSync([Buffer.from('collection_config')], CNFT_PROGRAM_ID);
  const [globalState] = PublicKey.findProgramAddressSync([Buffer.from('global_state')], CNFT_PROGRAM_ID);
  
  const collInfo = await connection.getAccountInfo(collectionConfig);
  const gsInfo = await connection.getAccountInfo(globalState);
  
  console.log('CollectionConfig:', collInfo ? '✅ INITIALISÉ' : '❌ NON INITIALISÉ');
  console.log('GlobalState:', gsInfo ? '✅ INITIALISÉ' : '❌ NON INITIALISÉ');
})();
"
```

**Résultat attendu** :
```
CollectionConfig: ✅ INITIALISÉ
GlobalState: ✅ INITIALISÉ
```

### Tester le lock de tokens

1. Se connecter sur l'app Vercel
2. Aller sur l'onglet **Lock**
3. Tenter un lock de tokens (ex: 100 BACK pour 30 jours)
4. ✅ La transaction devrait maintenant réussir

## 📊 Program IDs de référence

### Devnet (actuel)

| Programme | Program ID |
|-----------|------------|
| **CNFT** | `EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP` |
| Router | `9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh` |
| Buyback | `746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6` |

### Anchor.toml

```toml
[programs.devnet]
swapback_cnft = "EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP"
swapback_router = "9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh"
swapback_buyback = "746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6"
```

## 🎯 Prochaines étapes

1. ✅ Comptes initialisés on-chain
2. ✅ Code mis à jour avec bon fallback
3. ✅ Templates .env mis à jour
4. ⏳ Attendre le redéploiement automatique Vercel (déclenché par les commits)
5. ⏳ Vérifier que la variable Vercel est à jour
6. ⏳ Tester le lock de tokens en production

## 📝 Notes

- Le nouveau Program ID `EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP` est celui déployé sur devnet le 15 novembre 2025
- L'ancien ID `26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru` était un déploiement précédent qui n'est plus utilisé
- Les PDAs dérivent du Program ID, donc chaque Program ID a son propre ensemble de PDAs
- Il est **critique** que l'IDL address et `NEXT_PUBLIC_CNFT_PROGRAM_ID` correspondent

