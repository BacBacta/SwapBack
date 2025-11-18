# 🔧 Solution au problème GlobalState

## 🔍 Diagnostic

**Erreur:** `AccountDidNotDeserialize` - Error Number: 3003

**Cause:** Le compte GlobalState on-chain a l'ancienne structure (64 bytes) mais le programme attend la nouvelle structure avec 4 wallets supplémentaires (272 bytes).

**Structure actuelle (devnet):**
- 64 bytes (ancien format)
- Manque: treasury_wallet, boost_vault_wallet, buyback_wallet, npi_vault_wallet

**Structure attendue (code):**
- 272 bytes (nouveau format)  
- Inclut: authority + 4 wallets + 13 champs u64

## ✅ Solution Automatique

Exécutez simplement:

```bash
./scripts/redeploy-cnft.sh
```

Ce script effectue automatiquement:

1. ✅ Vérification du solde SOL (airdrop si nécessaire)
2. 🔨 Build du programme (`anchor build`)
3. 🗑️ Fermeture de l'ancien IDL
4. 📤 Redéploiement (`anchor deploy --provider.cluster devnet`)
5. 📝 Upload du nouvel IDL
6. 🔧 Initialisation du nouveau GlobalState
7. 🔍 Vérification finale

## 📋 Solution Manuelle

Si vous préférez faire étape par étape:

### 1. Obtenir du SOL devnet

```bash
solana airdrop 1 --url devnet
solana balance --url devnet
```

### 2. Build

```bash
anchor build
```

### 3. Fermer l'ancien IDL (optionnel)

```bash
anchor idl close --provider.cluster devnet --program-id GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E
```

### 4. Redéployer

```bash
anchor deploy --provider.cluster devnet
```

### 5. Initialiser GlobalState

```bash
# Option A: Avec les wallets par défaut (votre wallet)
node scripts/reinit-cnft-globalstate.js

# Option B: Avec des wallets spécifiques
export SWAPBACK_TREASURY_WALLET=<pubkey>
export SWAPBACK_BOOST_WALLET=<pubkey>
export SWAPBACK_BUYBACK_WALLET=<pubkey>
export SWAPBACK_NPI_VAULT_WALLET=<pubkey>
node scripts/reinit-cnft-globalstate.js
```

### 6. Vérifier

```bash
node scripts/diagnose-globalstate.js
```

## 🔍 Vérification

Après le redéploiement, vous devriez voir:

```
✅ GlobalState existe
   Taille: 272 bytes
   
✅ TOUT EST OK!
   Le compte a la bonne taille (nouveau format).

🔐 Wallets configurés:
   Authority:  DAdb3ArBvhJ77trTRUs5wbHARGXdupoAgjSYCHpkt6gP
   Treasury:   [votre_wallet]
   Boost:      [votre_wallet]
   Buyback:    [votre_wallet]
   NPI Vault:  [votre_wallet]
```

## ⚙️ Configuration des Wallets

Par défaut, tous les wallets pointent vers votre wallet principal. Pour utiliser des wallets séparés:

```bash
# Dans votre terminal
export SWAPBACK_TREASURY_WALLET=AbC...123
export SWAPBACK_BOOST_WALLET=DeF...456
export SWAPBACK_BUYBACK_WALLET=GhI...789
export SWAPBACK_NPI_VAULT_WALLET=JkL...012

# Puis réinitialisez
node scripts/reinit-cnft-globalstate.js
```

## 📝 Notes Importantes

### ⚠️ DEVNET uniquement

Cette procédure est pour DEVNET. Toutes les données existantes seront perdues lors du redéploiement.

### 🔄 Si le Program ID change

Si `anchor deploy` génère un nouveau Program ID:

1. Notez le nouveau ID
2. Mettez à jour `app/.env.local`:
   ```
   NEXT_PUBLIC_CNFT_PROGRAM_ID=<nouveau_id>
   ```
3. Mettez à jour Vercel environment variables
4. Rebuild le frontend: `cd app && npm run build`

### 🔐 Wallets requis

Les 4 nouveaux wallets dans GlobalState:

- **treasury_wallet**: Reçoit 20% des NPI distribués
- **boost_vault_wallet**: Reçoit 10% des NPI pour le boost communautaire  
- **buyback_wallet**: Reçoit la pénalité de 2% lors des early unlocks
- **npi_vault_wallet**: Stocke les NPI des utilisateurs avant claim

### 📦 ATAs à créer

Avant d'utiliser les wallets, créez leurs ATAs:

```bash
# Pour le buyback wallet (reçoit BACK tokens)
spl-token create-account 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux --owner <buyback_wallet> --url devnet

# Pour le NPI vault (stocke NPI tokens)
spl-token create-account <npi_mint> --owner <npi_vault_wallet> --url devnet
```

## 🐛 Dépannage

### Erreur: "Solde insuffisant"

```bash
solana airdrop 1 --url devnet
# Ou plusieurs fois si nécessaire
solana airdrop 1 --url devnet
solana airdrop 1 --url devnet
```

### Erreur: "Wallet non trouvé"

Vérifiez que `~/.config/solana/id.json` existe:

```bash
ls -la ~/.config/solana/id.json
```

Ou spécifiez un chemin personnalisé:

```bash
export WALLET_PATH=/path/to/your/keypair.json
```

### Erreur de désérialisation persiste

1. Vérifiez que le code local correspond au programme déployé
2. Rebuild complètement:
   ```bash
   anchor clean
   anchor build
   anchor deploy --provider.cluster devnet
   ```

3. Vérifiez l'IDL:
   ```bash
   anchor idl fetch --provider.cluster devnet GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E
   ```

## 📚 Scripts disponibles

- `scripts/diagnose-globalstate.js` - Diagnostique le problème
- `scripts/reinit-cnft-globalstate.js` - Réinitialise GlobalState
- `scripts/redeploy-cnft.sh` - Fait tout automatiquement
- `scripts/test-early-unlock.js` - Teste le unlock avec 2% penalty

## 🚀 Après le redéploiement

1. Testez le lock via l'interface web
2. Testez le unlock avec vérification de la pénalité 2%
3. Vérifiez que le buyback wallet reçoit les tokens
4. Testez le claim NPI (quand implémenté)

```bash
# Test automatique du unlock
node scripts/test-early-unlock.js
```
