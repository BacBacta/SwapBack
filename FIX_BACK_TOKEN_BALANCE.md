# 🔧 SOLUTION : Solde $BACK Token à 0

## ⚡ Diagnostic Rapide

Exécutez cette commande pour tout vérifier en une fois :

```bash
node scripts/check-both-mints.js $(solana address)
```

Cette commande va :
- ✅ Vérifier votre solde SOL
- ✅ Chercher vos tokens sur les 2 mints $BACK existants
- ✅ Vous donner la solution exacte pour votre situation

---

## 🎯 Problème Identifié

Il existe **DEUX adresses différentes** pour le token $BACK dans votre code :

1. **`3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn`** ← Dans `.env.local` ✅
2. **`862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux`** ← Ancien fallback

**Les deux existent sur devnet**, mais votre solde affiche 0 car :
- ❌ Vos tokens sont peut-être sur l'ancien mint (#2)
- ❌ Ou vous n'avez simplement aucun token encore

---

## 🚀 Solutions

### Solution 1 : Vous avez des tokens sur l'ancien mint (862PQy...)

Si le script `check-both-mints.js` montre des tokens sur le mint #2 :

**Option A - Changer la config (plus rapide)**
```bash
# Mettre à jour .env.local
echo "NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux" >> app/.env.local

# Redémarrer l'app
npm run app:dev
```

**Option B - Transférer les tokens vers le nouveau mint**
```bash
# 1. Créer le compte pour le nouveau mint
spl-token create-account 3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

# 2. Note: Impossible de transférer entre deux mints différents
# Il faudra mint de nouveaux tokens sur le nouveau mint
```

---

### Solution 2 : Vous n'avez aucun token

Si le script montre 0 token sur les deux mints :

#### Étape 1 : Créer le compte token
```bash
# Utiliser le mint configuré dans .env.local
spl-token create-account 3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
```

#### Étape 2 : Obtenir des tokens

**Si vous êtes l'autorité du mint** :
```bash
# Mint 10,000 tokens pour les tests
spl-token mint 3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn 10000 \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
```

**Si vous n'êtes PAS l'autorité** :
1. Vérifier qui est l'autorité :
```bash
spl-token display 3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb | grep "Mint authority"
```

2. Contacter l'autorité pour recevoir des tokens
3. Ou créer VOTRE PROPRE token $BACK pour les tests (voir ci-dessous)

---

### Solution 3 : Créer votre propre token $BACK pour tests

Si vous voulez un contrôle total :

```bash
# 1. Créer un nouveau token
spl-token create-token --decimals 9 \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

# Notez l'adresse du token créé, par exemple: AbC123...xyz

# 2. Créer le compte token pour votre wallet
spl-token create-account AbC123...xyz \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

# 3. Mint des tokens
spl-token mint AbC123...xyz 100000 \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

# 4. Mettre à jour .env.local
echo "NEXT_PUBLIC_BACK_MINT=AbC123...xyz" > app/.env.local
echo "NEXT_PUBLIC_SOLANA_NETWORK=devnet" >> app/.env.local
echo "NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com" >> app/.env.local

# 5. Redémarrer l'app
npm run app:dev
```

---

## 📋 Vérification Complète

Après avoir appliqué une solution, vérifiez que tout fonctionne :

```bash
# 1. Vérifier le solde
node scripts/check-both-mints.js $(solana address)

# 2. Vérifier la config
cat app/.env.local | grep BACK_MINT

# 3. Rebuild l'app (important!)
npm run app:build

# 4. Lancer l'app
npm run app:dev

# 5. Tester dans le navigateur
# - Ouvrir http://localhost:3000/lock
# - Connecter votre wallet
# - Vérifier que le solde s'affiche
# - Tester le lock avec un petit montant
```

---

## 🐛 Troubleshooting

### "Balance still shows 0 in the interface"

**Causes possibles** :
1. **Wallet différent** : Le wallet connecté dans l'interface n'est pas celui de Solana CLI
   - Vérification : Comparer les adresses
   ```bash
   echo "CLI: $(solana address)"
   # Comparer avec l'adresse dans l'interface web
   ```

2. **Cache du navigateur** : L'ancien solde est mis en cache
   - Solution : Ctrl+Shift+R (hard refresh) ou vider le cache

3. **App pas redémarrée** : Les changements de `.env.local` ne sont pas pris en compte
   - Solution : Tuer le serveur et relancer `npm run app:dev`

4. **Network mismatch** : L'interface utilise mainnet au lieu de devnet
   - Vérification : Regarder dans la console navigateur
   - Solution : Vérifier `NEXT_PUBLIC_SOLANA_NETWORK=devnet` dans `.env.local`

### "Error fetching balance: Invalid public key"

Le token mint n'est pas valide ou mal configuré.

```bash
# Vérifier que le mint existe
node scripts/check-mint-addresses.js

# Vérifier .env.local
cat app/.env.local | grep NEXT_PUBLIC_BACK_MINT
```

### "Transfer: insufficient lamports"

Pas assez de SOL pour les frais de transaction.

```bash
# Obtenir du SOL sur devnet
solana airdrop 2

# Vérifier le solde
solana balance
```

---

## 📊 Scripts Disponibles

| Script | Description | Usage |
|--------|-------------|-------|
| `check-both-mints.js` | Vérifie le solde sur les 2 mints | `node scripts/check-both-mints.js $(solana address)` |
| `check-mint-addresses.js` | Vérifie quels mints existent | `node scripts/check-mint-addresses.js` |
| `check-back-balance.js` | Diagnostic complet d'un mint | `node scripts/check-back-balance.js <WALLET>` |
| `create-back-token-account.sh` | Création interactive du compte | `./scripts/create-back-token-account.sh` |

---

## ✅ Checklist Finale

Avant de tester, assurez-vous que :

- [ ] Vous avez exécuté `node scripts/check-both-mints.js $(solana address)`
- [ ] Vous avez un solde $BACK > 0 sur AU MOINS un mint
- [ ] Le mint avec des tokens est celui dans `app/.env.local`
- [ ] Vous avez rebuild l'app : `npm run app:build`
- [ ] Vous avez redémarré l'app : `npm run app:dev`
- [ ] Le wallet dans l'interface = le wallet avec les tokens
- [ ] Vous êtes sur devnet (vérifier dans l'interface)
- [ ] Hard refresh du navigateur (Ctrl+Shift+R)

---

## 🎯 TL;DR - Solution Express

```bash
# 1. Diagnostic
node scripts/check-both-mints.js $(solana address)

# 2a. Si tokens sur mint #2 → Changer la config
echo "NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux" > app/.env.local

# 2b. Si aucun token → Créer et mint
spl-token create-account 3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
spl-token mint 3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn 10000 \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

# 3. Vérifier
node scripts/check-both-mints.js $(solana address)

# 4. Rebuild et test
npm run app:build && npm run app:dev
```

---

**🎉 Après ces étapes, votre solde $BACK devrait s'afficher correctement dans l'interface !**
