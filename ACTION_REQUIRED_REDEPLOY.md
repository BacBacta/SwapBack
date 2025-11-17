# ⚠️ Action Requise: Redéploiement Bloqué

## 🔴 Problème Actuel

```
❌ Error: AccountDidNotDeserialize (0xbbb)
   GlobalState: 64 bytes (ancien format)
   Attendu: 240 bytes (nouveau format avec 4 wallets)
```

## 💰 Blocage Immédiat

**Solde actuel:** 0.0357 SOL  
**Requis:** ~0.5-1 SOL minimum

**Airdrop devnet:** Rate limit atteint (réessayez dans 1-2 heures)

## 🚀 Solutions Rapides

### Option 1: Attendre l'airdrop (Recommandé pour devnet)

```bash
# Dans 1-2 heures, réessayez:
solana airdrop 1 --url devnet

# Vérifiez le solde:
solana balance --url devnet

# Puis lancez le redéploiement:
./scripts/redeploy-cnft.sh
```

### Option 2: Utiliser un autre wallet devnet

Si vous avez un autre keypair avec du SOL:

```bash
# Copiez votre autre keypair
cp /path/to/other-devnet-wallet.json ~/.config/solana/id.json

# Vérifiez le solde
solana balance --url devnet

# Lancez le redéploiement
./scripts/redeploy-cnft.sh
```

### Option 3: Obtenir SOL via un faucet tiers

Essayez ces faucets devnet:

- https://faucet.solana.com/
- https://solfaucet.com/
- https://faucet.quicknode.com/solana/devnet

Adresse du wallet:
```
DAdb3ArBvhJ77trTRUs5wbHARGXdupoAgjSYCHpkt6gP
```

### Option 4: Workaround temporaire (Tests locaux uniquement)

Pour tester le code localement sans redéployer:

1. **Démarrer un validateur local:**
   ```bash
   solana-test-validator
   ```

2. **Déployer sur localhost:**
   ```bash
   anchor build
   anchor deploy --provider.cluster localnet
   node scripts/reinit-cnft-globalstate.js
   ```

3. **Configurer le frontend pour localhost:**
   ```bash
   # app/.env.local
   NEXT_PUBLIC_SOLANA_RPC_URL=http://localhost:8899
   NEXT_PUBLIC_CNFT_PROGRAM_ID=<nouveau_program_id_local>
   ```

4. **Lancer le frontend:**
   ```bash
   cd app && npm run dev
   ```

## 📋 Étapes Complètes (une fois le SOL obtenu)

### 1. Vérifier le solde

```bash
solana balance --url devnet
# Doit afficher >= 0.5 SOL
```

### 2. Build le programme

```bash
anchor build --program-name swapback_cnft
```

### 3. Fermer l'ancien IDL (optionnel)

```bash
anchor idl close \
  --provider.cluster devnet \
  --program-id GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E
```

### 4. Déployer le nouveau programme

```bash
anchor deploy --provider.cluster devnet --program-name swapback_cnft
```

**Important:** Notez le Program ID affiché. S'il a changé, mettez à jour:
- `app/.env.local` → `NEXT_PUBLIC_CNFT_PROGRAM_ID`
- Vercel environment variables

### 5. Upload l'IDL

```bash
anchor idl init \
  --filepath target/idl/swapback_cnft.json \
  --provider.cluster devnet \
  GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E
```

Ou si déjà existant:

```bash
anchor idl upgrade \
  --filepath target/idl/swapback_cnft.json \
  --provider.cluster devnet \
  GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E
```

### 6. Initialiser le nouveau GlobalState

```bash
node scripts/reinit-cnft-globalstate.js
```

### 7. Vérifier

```bash
node scripts/diagnose-globalstate.js
```

Vous devriez voir:
```
✅ GlobalState existe
   Taille: 240 bytes
   
✅ TOUT EST OK!
```

### 8. Tester

```bash
# Tester le unlock avec pénalité 2%
node scripts/test-early-unlock.js

# Ou via l'interface web
cd app && npm run dev
# Puis http://localhost:3000/dashboard
```

## 🔧 Configuration des Wallets

Par défaut, tous les 4 wallets pointent vers votre wallet principal.

Pour définir des wallets séparés:

```bash
# Avant de lancer reinit-cnft-globalstate.js:
export SWAPBACK_TREASURY_WALLET=<pubkey_treasury>
export SWAPBACK_BOOST_WALLET=<pubkey_boost>
export SWAPBACK_BUYBACK_WALLET=<pubkey_buyback>
export SWAPBACK_NPI_VAULT_WALLET=<pubkey_npi_vault>

node scripts/reinit-cnft-globalstate.js
```

### Créer les ATAs nécessaires

Une fois GlobalState initialisé, créez les ATAs pour:

```bash
# Buyback wallet (reçoit BACK tokens - pénalité 2%)
spl-token create-account \
  862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux \
  --owner <buyback_wallet_pubkey> \
  --url devnet

# NPI vault (stocke NPI pour les users)
spl-token create-account \
  <npi_mint_pubkey> \
  --owner <npi_vault_wallet_pubkey> \
  --url devnet
```

## 📊 Résumé de la Situation

### ✅ Code prêt

- ✅ Smart contract: Pénalité 2% vers buyback (au lieu de burn 1.5%)
- ✅ GlobalState: 4 nouveaux wallets (treasury, boost, buyback, npi_vault)
- ✅ NPI claim mechanics: UserNpiBalance + claim_npi instruction
- ✅ Frontend: Hooks, transaction builders, UI mis à jour
- ✅ Scripts: Diagnostic, réinitialisation, tests automatisés

### ⏸️ Blocage devnet

- ❌ Solde insuffisant: 0.0357 SOL (besoin de 0.5+ SOL)
- ❌ Airdrop: Rate limit temporaire
- ⏸️ GlobalState: Format obsolète (64 bytes au lieu de 240)

### 🎯 Prochaine Action

**Quand vous aurez du SOL devnet (dans 1-2h):**

```bash
# Tout-en-un:
./scripts/redeploy-cnft.sh

# Ou étape par étape:
anchor build --program-name swapback_cnft
anchor deploy --provider.cluster devnet --program-name swapback_cnft
node scripts/reinit-cnft-globalstate.js
node scripts/diagnose-globalstate.js
```

## 🐛 Support

Si problème après redéploiement:

1. Vérifiez que `diagnose-globalstate.js` montre 240 bytes
2. Vérifiez que le Program ID n'a pas changé
3. Rebuild le frontend: `cd app && npm run build`
4. Vérifiez les ATAs sont créés pour buyback_wallet
5. Testez avec `scripts/test-early-unlock.js`

## 📚 Documentation

- `GLOBALSTATE_FIX.md` - Guide complet de la solution
- `scripts/diagnose-globalstate.js` - Diagnostic automatique
- `scripts/reinit-cnft-globalstate.js` - Réinitialisation
- `scripts/redeploy-cnft.sh` - Redéploiement automatique
- `scripts/test-early-unlock.js` - Test du unlock 2%
