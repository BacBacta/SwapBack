# 🔧 Guide de Diagnostic et Résolution - Solde $BACK Token à 0

## 🎯 Problème
Le solde de vos $BACK tokens affiche toujours **0** dans l'interface Lock/Unlock, empêchant les tests.

## 🔍 Diagnostic - 3 Causes Possibles

### Cause 1: Le compte token $BACK n'existe pas encore ❌
**Symptôme**: Le compte token associé (ATA) n'a jamais été créé pour votre wallet.

**Vérification**:
```bash
# Remplacez <VOTRE_WALLET> par votre adresse
node scripts/check-back-balance.js <VOTRE_WALLET>
```

**Solution**:
```bash
# Méthode automatique (recommandée)
./scripts/create-back-token-account.sh

# OU méthode manuelle
solana config set --url devnet
spl-token create-account 3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
```

---

### Cause 2: Le compte existe mais ne contient aucun token ⚠️
**Symptôme**: Le compte ATA existe, mais le solde est à 0.

**Vérification**:
```bash
node scripts/check-back-balance.js <VOTRE_WALLET>
# Vous verrez: "✅ Le compte token existe!" mais "Solde: 0.000000000 $BACK"
```

**Solution**: Vous devez recevoir des tokens $BACK via un faucet ou un transfert.

#### Option A: Utiliser le Faucet (si vous avez l'autorité de mint)
```bash
# Si vous êtes l'autorité du token $BACK sur devnet
spl-token mint 3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn 1000 \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
```

#### Option B: Recevoir via Transfert
```bash
# Demander à quelqu'un qui a des $BACK de vous en envoyer
spl-token transfer 3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn \
  100 <VOTRE_WALLET> \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
```

#### Option C: Créer un Faucet Local (pour tests)
Utilisez le script fourni:
```bash
node scripts/faucet-back-tokens.js
```

---

### Cause 3: Problème avec l'adresse du token mint 🔄
**Symptôme**: Le code utilise une mauvaise adresse de mint.

**Vérification**:
```bash
# Vérifier la configuration actuelle
grep -r "NEXT_PUBLIC_BACK_MINT" app/.env.local
```

**Solution**: Assurez-vous que votre `.env.local` contient:
```env
NEXT_PUBLIC_BACK_MINT=3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
```

---

## 🚀 Procédure de Résolution Complète

### Étape 1: Diagnostic
```bash
# 1. Obtenir votre adresse wallet
solana address

# 2. Vérifier votre solde $BACK
node scripts/check-back-balance.js $(solana address)
```

### Étape 2: Créer le Compte Token (si nécessaire)
```bash
# Script interactif qui fait tout
./scripts/create-back-token-account.sh
```

### Étape 3: Obtenir des Tokens $BACK

#### Si vous êtes le développeur/propriétaire du token:
```bash
# Vérifier si vous êtes l'autorité
spl-token display 3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

# Mint des tokens pour vous
spl-token mint 3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn 10000 \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
```

#### Si vous n'êtes PAS l'autorité:
1. Contactez l'équipe SwapBack pour accéder au faucet
2. Ou demandez un transfert à quelqu'un qui possède des $BACK

### Étape 4: Vérification Finale
```bash
# Re-vérifier le solde
node scripts/check-back-balance.js $(solana address)

# Vous devriez voir:
# ✅ TOUT EST OK!
# 🎯 SOLDE $BACK: 10000.000000000 $BACK
```

### Étape 5: Test dans l'Interface
1. Lancez l'application: `npm run app:dev`
2. Allez sur `/lock`
3. Connectez votre wallet
4. **Le solde devrait maintenant s'afficher correctement**
5. Testez le lock avec un petit montant (ex: 100 $BACK)

---

## 🔧 Scripts de Diagnostic Disponibles

### 1. `check-back-balance.js` - Diagnostic Complet
```bash
node scripts/check-back-balance.js <WALLET_ADDRESS>
```
**Affiche**:
- ✅ Solde SOL
- 📦 Adresse du compte token associé (ATA)
- 📊 Détails du compte Token-2022
- 🎯 Solde $BACK actuel
- 📋 Actions recommandées

### 2. `create-back-token-account.sh` - Création Interactive
```bash
./scripts/create-back-token-account.sh
```
**Fonctionnalités**:
- Vérification automatique de la configuration Solana CLI
- Bascule automatique vers devnet si nécessaire
- Airdrop de SOL si solde insuffisant
- Création du compte Token-2022
- Vérification post-création

### 3. `faucet-back-tokens.js` - Distribution de Tokens (dev)
```bash
node scripts/faucet-back-tokens.js
```
**Note**: Nécessite d'être l'autorité du token mint.

---

## 📋 Checklist de Vérification

Avant de tester dans l'interface, assurez-vous que:

- [ ] Solana CLI est installé (`solana --version`)
- [ ] Configuration sur devnet (`solana config get`)
- [ ] Solde SOL > 0.1 SOL (`solana balance`)
- [ ] Compte token $BACK existe
- [ ] Solde $BACK > 0
- [ ] `.env.local` contient les bonnes variables
- [ ] Application redémarrée après modification de `.env.local`

---

## 🐛 Problèmes Courants

### "Transfer: insufficient lamports"
**Cause**: Pas assez de SOL pour payer les frais de transaction.
**Solution**:
```bash
solana airdrop 2
```

### "Error: Account does not exist"
**Cause**: Le compte token n'a pas été créé.
**Solution**: Exécutez `./scripts/create-back-token-account.sh`

### "Invalid program ID"
**Cause**: Mauvais ID de programme (utilise SPL Token au lieu de Token-2022).
**Solution**: Utilisez toujours `--program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`

### "You have tried to read publicKey on a WalletContext"
**Cause**: Wallet non connecté dans l'interface web.
**Solution**: Cliquez sur "Connect Wallet" dans l'interface.

---

## 📞 Support

Si le problème persiste après avoir suivi ce guide:

1. **Capturez les logs de diagnostic**:
   ```bash
   node scripts/check-back-balance.js $(solana address) > diagnosis.txt 2>&1
   ```

2. **Vérifiez les logs de l'application**:
   ```bash
   # Dans la console du navigateur (F12)
   # Cherchez "Error fetching balance"
   ```

3. **Informations à fournir**:
   - Sortie de `check-back-balance.js`
   - Version de Solana CLI (`solana --version`)
   - Configuration RPC (`solana config get`)
   - Logs de la console navigateur

---

## 🎯 Résumé Rapide

**Pour créer le compte et obtenir des tokens en une seule fois**:

```bash
# 1. Créer le compte token
./scripts/create-back-token-account.sh

# 2. Mint des tokens (si vous êtes l'autorité)
spl-token mint 3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn 10000 \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

# 3. Vérifier
node scripts/check-back-balance.js $(solana address)

# 4. Tester l'interface
npm run app:dev
# Ouvrir http://localhost:3000/lock
```

---

**🔗 Liens Utiles**:
- [Solana Token-2022 Documentation](https://spl.solana.com/token-2022)
- [SPL Token CLI Guide](https://spl.solana.com/token)
- [Devnet Faucet](https://faucet.solana.com/)
