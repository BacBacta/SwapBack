# 🔑 Devnet Keypair

Ce fichier contient la clé privée du wallet de test Devnet pour SwapBack.

## 📋 Informations

**Fichier:** `devnet-keypair.json`  
**Adresse Publique:** `578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf`

**Balances:**

- 💎 6.15 SOL
- 🪙 1,000,000 $BACK
- 💵 10,000 USDC

## 🔐 Utilisation

### Importer dans Phantom Wallet

**Option 1: Importer directement le fichier**

1. Ouvrir Phantom
2. Settings → Add Wallet → Import Private Key
3. Sélectionner "Import from file"
4. Choisir `devnet-keypair.json`

**Option 2: Copier-coller la clé**

1. Ouvrir le fichier `devnet-keypair.json`
2. Copier le tableau de nombres `[106,156,133,...]`
3. Dans Phantom: Settings → Add Wallet → Import Private Key
4. Coller le tableau
5. Donner un nom: "SwapBack Devnet"

### Importer dans Solflare

1. Ouvrir Solflare
2. Settings → Import Wallet
3. Choisir "Private Key"
4. Coller le contenu du fichier
5. Confirmer

### Utiliser avec la CLI Solana

```bash
# Définir ce wallet comme default
solana config set --keypair /workspaces/SwapBack/devnet-keypair.json

# Ou l'utiliser pour une commande spécifique
solana balance --keypair /workspaces/SwapBack/devnet-keypair.json --url devnet

# Vérifier l'adresse
solana-keygen pubkey /workspaces/SwapBack/devnet-keypair.json
```

## ⚠️ Sécurité

**IMPORTANT:**

- ⚠️ Cette clé est **UNIQUEMENT pour le devnet de test**
- ⚠️ **NE JAMAIS** utiliser ce wallet sur mainnet
- ⚠️ La clé est publique dans ce repo → Pour tests seulement
- ✅ Utilisez toujours un wallet différent et sécurisé pour mainnet
- ✅ Ce wallet peut être partagé pour les tests collaboratifs

## 🔄 Régénérer si Nécessaire

Si tu veux créer un nouveau wallet de test:

```bash
# Créer un nouveau keypair
solana-keygen new --outfile new-devnet-keypair.json

# Obtenir l'adresse
solana-keygen pubkey new-devnet-keypair.json

# Demander un airdrop
solana airdrop 2 $(solana-keygen pubkey new-devnet-keypair.json) --url devnet
```

## 📊 Tokens Disponibles

| Token     | Mint Address                                   | Balance   |
| --------- | ---------------------------------------------- | --------- |
| **SOL**   | `So11111111111111111111111111111111111111112`  | 6.15      |
| **$BACK** | `BH8thpWca6kpN2pKwWTaKv2F5s4MEkbML18LtJ8eFypU` | 1,000,000 |
| **USDC**  | `3y4dCqwWuYx1B97YEDmgq9qjuNE1eyEwGx2eLgz6Rc6G` | 10,000    |

## 🔗 Liens Utiles

- **Solscan:** https://solscan.io/account/578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf?cluster=devnet
- **Solana Explorer:** https://explorer.solana.com/address/578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf?cluster=devnet
- **Token $BACK:** https://solscan.io/token/BH8thpWca6kpN2pKwWTaKv2F5s4MEkbML18LtJ8eFypU?cluster=devnet
- **Token USDC:** https://solscan.io/token/3y4dCqwWuYx1B97YEDmgq9qjuNE1eyEwGx2eLgz6Rc6G?cluster=devnet

## ✅ Prêt à Utiliser

Une fois le wallet importé:

1. Change le réseau vers **Devnet** dans ton wallet
2. Ajoute les tokens custom ($BACK et USDC)
3. Connecte-toi à l'app: http://localhost:3000
4. Commence à tester les swaps !

Consulte **WALLET_CONNECTION_GUIDE.md** pour plus de détails.
