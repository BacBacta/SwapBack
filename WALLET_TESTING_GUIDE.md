# 🔐 Guide de Test avec Wallet

## Problème actuel

Le dev container Codespaces a un problème de résolution DNS qui empêche :
- ❌ Connexion à l'API Jupiter réelle (quote-api.jup.ag)
- ❌ Exécution de transactions on-chain réelles
- ❌ Test complet du flow swap avec wallet

**Solution temporaire active** : Mode MOCK (USE_MOCK_QUOTES=true)

## Solutions pour tester avec un vrai wallet

### Option 1 : Déploiement Vercel (RECOMMANDÉ)

Le DNS fonctionne normalement en production sur Vercel.

#### Étapes :

1. **Préparer le déploiement**
```bash
cd /workspaces/SwapBack

# Désactiver le mode MOCK pour production
echo "# Mode MOCK désactivé pour production" > app/.env.production
echo "USE_MOCK_QUOTES=false" >> app/.env.production

# Commit les changements
git add .
git commit -m "feat: Complete swap interface with all features"
git push
```

2. **Déployer sur Vercel**
```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter
vercel login

# Déployer
cd app
vercel --prod
```

3. **Configurer les variables d'environnement sur Vercel**
   - Dashboard Vercel → Votre projet → Settings → Environment Variables
   - Ajouter :
     ```
     NEXT_PUBLIC_NETWORK=devnet
     NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
     USE_MOCK_QUOTES=false
     ```

4. **Tester avec wallet**
   - Ouvrir l'URL Vercel (ex: https://swapback.vercel.app)
   - Connecter Phantom/Solflare
   - Tester un swap réel sur devnet

### Option 2 : Local hors Container

Si vous avez accès à votre machine locale :

1. **Cloner le repo localement**
```bash
git clone https://github.com/BacBacta/SwapBack.git
cd SwapBack/app
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer .env.local**
```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
USE_MOCK_QUOTES=false
EOF
```

4. **Lancer le serveur**
```bash
PORT=3001 npm run dev
```

5. **Tester avec wallet**
   - Ouvrir http://localhost:3001
   - Connecter Phantom/Solflare
   - Tester swap avec devnet SOL

### Option 3 : Forward Port avec Tunnel

Utiliser un tunnel pour contourner le problème DNS :

1. **Installer cloudflared**
```bash
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

2. **Créer un tunnel**
```bash
cloudflared tunnel --url http://localhost:3001
```

3. **Utiliser l'URL publique**
   - Copier l'URL (ex: https://xxx.trycloudflare.com)
   - Tester avec wallet sur cette URL

## Plan de Test avec Wallet

Une fois l'une des solutions ci-dessus implémentée :

### 1. Préparation

✅ **Installer Phantom ou Solflare**
- Chrome extension : https://phantom.app
- Ou Solflare : https://solflare.com

✅ **Configurer pour Devnet**
- Phantom : Settings → Developer Settings → Testnet Mode → Devnet
- Solflare : Settings → Network → Devnet

✅ **Obtenir des SOL de test**
```bash
# Airdrop 2 SOL sur votre wallet
solana airdrop 2 <VOTRE_ADRESSE> --url https://api.devnet.solana.com
```

### 2. Tests Fonctionnels

#### Test 1 : Connexion Wallet
```
1. Ouvrir l'interface
2. Cliquer sur "Connect Wallet"
3. Sélectionner Phantom/Solflare
4. Approuver la connexion
5. ✅ Vérifier que l'adresse s'affiche
```

#### Test 2 : Quote Automatique
```
1. Sélectionner SOL → USDC
2. Entrer montant : 0.1 SOL
3. Attendre 500ms (debounce)
4. ✅ Vérifier que le quote s'affiche
5. ✅ Vérifier le prix (devrait être ~15 USDC si SOL=150)
6. ✅ Vérifier la route visualization sidebar
```

#### Test 3 : Settings Panel
```
1. Cliquer sur ⚙️ Settings
2. Changer slippage : 0.5% → 1.0%
3. ✅ Vérifier que le quote se met à jour
4. Activer MEV Protection
5. ✅ Vérifier le toggle
6. Changer Priority : MEDIUM → HIGH
7. ✅ Vérifier la sélection
```

#### Test 4 : Token Selector
```
1. Cliquer sur "SOL" (input token)
2. ✅ Vérifier que 13 tokens s'affichent
3. Sélectionner "USDT"
4. ✅ Vérifier le changement
5. ✅ Vérifier que le quote se recalcule
```

#### Test 5 : Swap Direction Toggle
```
1. Cliquer sur le bouton ⇅
2. ✅ Vérifier l'animation rotation 180°
3. ✅ Vérifier que FROM et TO sont inversés
4. ✅ Vérifier que le quote se recalcule
```

#### Test 6 : Exécution Swap (CRITIQUE)
```
1. Configurer : 0.1 SOL → USDC
2. Vérifier le quote (ex: 15 USDC)
3. Cliquer sur "Execute Swap"
4. ✅ Status → "preparing"
5. ✅ Wallet demande signature
6. Approuver dans le wallet
7. ✅ Status → "signing" → "sending" → "confirming"
8. Attendre confirmation (10-30s)
9. ✅ Status → "confirmed"
10. ✅ Banner de succès avec lien Explorer
11. ✅ Cliquer sur le lien Explorer
12. ✅ Vérifier la transaction sur Solana Explorer
```

### 3. Tests de Route Visualization

Avec un vrai quote Jupiter :

```
1. Entrer : 5 SOL → USDC
2. ✅ Vérifier la route sidebar :
   - Nombre de venues (ex: Orca + Raydium)
   - Input/Output par venue
   - Fees détaillés
   - Price impact (devrait être <1% pour 5 SOL)
```

### 4. Tests Responsive

```
1. Desktop (>1024px)
   ✅ Layout 2 colonnes : swap panel + route sidebar

2. Tablet (768-1024px)
   ✅ Layout adaptatif : sidebar en dessous

3. Mobile (<768px)
   ✅ Layout stacked : tout en colonne
   ✅ Token selector en modal plein écran
```

### 5. Tests d'Erreur

#### Montant insuffisant
```
1. Entrer : 1000 SOL (plus que le wallet)
2. Cliquer "Execute Swap"
3. ✅ Erreur : "Insufficient balance"
```

#### Slippage trop faible
```
1. Entrer : 10 SOL → USDC
2. Settings → Slippage : 0.1%
3. Exécuter le swap
4. ✅ Possible erreur : "Slippage tolerance exceeded"
```

#### Transaction rejetée
```
1. Entrer : 1 SOL → USDC
2. Cliquer "Execute Swap"
3. Rejeter dans le wallet
4. ✅ Status → "idle"
5. ✅ Erreur : "User rejected signature"
```

## Checklist de Validation Complète

### Interface
- [ ] Page charge sans erreur
- [ ] Thème Terminal Hacker s'affiche (vert néon)
- [ ] Scanlines CRT visibles
- [ ] Token selector (13 tokens)
- [ ] Settings panel (slippage/MEV/priority)
- [ ] Route visualization sidebar
- [ ] Swap toggle button (⇅)
- [ ] Transaction status display

### API Backend
- [ ] GET /api/swap/quote → Health check OK
- [ ] POST /api/swap/quote → Quote reçu (vrai Jupiter)
- [ ] POST /api/swap → Transaction construite
- [ ] POST /api/execute → Transaction envoyée

### Wallet Integration
- [ ] Connexion wallet Phantom
- [ ] Connexion wallet Solflare
- [ ] Signature transaction
- [ ] Balance check
- [ ] Transaction confirmation

### Flow Complet
- [ ] Sélection tokens
- [ ] Quote automatique (500ms debounce)
- [ ] Settings modification
- [ ] Swap toggle
- [ ] Transaction execution
- [ ] Confirmation on-chain
- [ ] Lien Explorer fonctionne
- [ ] Success banner s'affiche

## Résultats Attendus

### Quote Jupiter Réel (1 SOL → USDC)

Avec l'API Jupiter réelle, vous devriez voir :

```json
{
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "inAmount": "1000000000",
  "outAmount": "~150000000", // Dépend du prix du marché
  "priceImpactPct": "0.01",
  "routePlan": [
    {
      "swapInfo": {
        "ammKey": "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
        "label": "Whirlpool",
        "inputMint": "So11111...",
        "outputMint": "EPjFWdd5...",
        "inAmount": "1000000000",
        "outAmount": "150000000",
        "feeAmount": "3000000",
        "feeMint": "So11111..."
      },
      "percent": 100
    }
  ]
}
```

### Transaction Confirmée

Après exécution réussie :

```
✅ Transaction Confirmed!

Signature: 2ZE7tx...abc123
Status: Confirmed (32 confirmations)
Block: 245678912
Fee: 0.000005 SOL

View on Explorer:
https://explorer.solana.com/tx/2ZE7tx...abc123?cluster=devnet
```

## Dépannage

### Wallet ne se connecte pas
```bash
# Vérifier que le wallet est sur devnet
# Vérifier que le site est en HTTPS (requis par wallets)
# Vérifier la console browser pour erreurs
```

### Quote ne s'affiche pas
```bash
# Vérifier les logs serveur
tail -f /tmp/nextjs-server.log | grep quote

# Vérifier USE_MOCK_QUOTES=false
cat app/.env.local | grep MOCK

# Tester l'API directement
curl https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000
```

### Transaction échoue
```bash
# Vérifier le balance
solana balance <ADRESSE> --url devnet

# Vérifier le statut devnet
solana cluster-version --url devnet

# Augmenter le slippage à 1%
# Réduire le montant du swap
```

## Prochaines Étapes

Après validation complète avec wallet :

1. **Performance Testing**
   - Tester avec différents montants (0.1, 1, 10, 100 SOL)
   - Mesurer temps de quote (<1s attendu)
   - Mesurer temps de confirmation (<30s attendu)

2. **Edge Cases**
   - Tokens avec faible liquidité
   - Gros montants (slippage élevé)
   - Routes complexes (3+ venues)

3. **Production Deployment**
   - Déployer sur Vercel mainnet-beta
   - Configurer domaine custom
   - Activer analytics

---

**Note** : Tous ces tests nécessitent que le DNS fonctionne (hors dev container ou sur Vercel).
