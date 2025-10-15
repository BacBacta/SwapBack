# 🔑 Guide de Connexion Wallet Devnet

## Informations du Wallet

**Adresse Publique:** `578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf`

**Clé Privée (à importer):**
```json
[106,156,133,200,59,206,133,72,44,65,87,139,114,235,212,232,37,176,32,241,141,11,159,53,238,113,230,51,45,252,237,184,61,0,98,247,102,242,220,30,191,61,203,144,200,142,66,3,52,251,235,27,250,154,222,152,77,118,254,185,26,68,1]
```

---

## 🦊 Méthode 1: Phantom Wallet (Recommandé)

### Étape 1: Installer Phantom
- Chrome/Brave: https://phantom.app/download
- Créer ou ouvrir ton wallet Phantom existant

### Étape 2: Importer le Wallet Devnet
1. Cliquer sur l'**icône en haut à gauche** (nom du wallet)
2. Sélectionner **"Add / Connect Wallet"**
3. Choisir **"Import Private Key"**
4. **Coller le tableau de nombres** ci-dessus dans le champ
5. Donner un nom: "SwapBack Devnet Test"
6. Cliquer **"Import"**

### Étape 3: Basculer vers Devnet
1. Cliquer sur **Settings** (⚙️ en bas à droite)
2. Aller dans **"Developer Settings"**
3. Activer **"Testnet Mode"**
4. Retourner à l'écran principal
5. Cliquer sur le nom du réseau en haut (**"Mainnet"**)
6. Sélectionner **"Devnet"**

### Étape 4: Ajouter les Tokens Custom
1. Dans l'écran principal, cliquer sur **"Manage Token List"**
2. Cliquer sur **"Add Custom Token"**
3. Ajouter **$BACK**:
   - Token Mint: `BH8thpWca6kpN2pKwWTaKv2F5s4MEkbML18LtJ8eFypU`
   - Confirmer
4. Ajouter **USDC**:
   - Token Mint: `3y4dCqwWuYx1B97YEDmgq9qjuNE1eyEwGx2eLgz6Rc6G`
   - Confirmer

### Étape 5: Vérifier les Balances
Tu devrais maintenant voir:
- ✅ ~6 SOL
- ✅ 1,000,000 BACK
- ✅ 10,000 USDC

---

## 🌐 Méthode 2: Solflare Wallet

### Étape 1: Installer Solflare
- Extension: https://solflare.com
- Ou application mobile

### Étape 2: Importer le Wallet
1. Ouvrir Solflare
2. Cliquer sur **Settings** (⚙️)
3. Sélectionner **"Import Wallet"**
4. Choisir **"Private Key"**
5. **Coller le tableau de nombres** (clé privée)
6. Confirmer l'import

### Étape 3: Changer le Réseau
1. En haut à droite, cliquer sur le **sélecteur de réseau**
2. Choisir **"Devnet"**

### Étape 4: Ajouter les Tokens
Même procédure que Phantom (voir ci-dessus)

---

## 🔗 Connecter à l'Application SwapBack

### Une fois le wallet configuré:

1. **Ouvrir l'app:** http://localhost:3000
2. **Cliquer sur "Connect Wallet"** en haut à droite
3. **Sélectionner Phantom** (ou Solflare)
4. **Approuver la connexion** dans la popup du wallet
5. **Vérifier** que l'adresse affichée est: `578DGN...wQf`

### Checklist de Connexion:
- [ ] Wallet installé (Phantom ou Solflare)
- [ ] Clé privée importée
- [ ] Réseau changé vers **Devnet**
- [ ] Tokens custom ajoutés ($BACK + USDC)
- [ ] Balances visibles dans le wallet
- [ ] Connecté à l'app SwapBack
- [ ] Adresse correcte affichée

---

## 🧪 Test de Connexion

### Vérification rapide:
```bash
# Vérifier les balances depuis la CLI
solana balance 578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf --url devnet

# Balance $BACK
spl-token balance BH8thpWca6kpN2pKwWTaKv2F5s4MEkbML18LtJ8eFypU --url devnet

# Balance USDC
spl-token balance 3y4dCqwWuYx1B97YEDmgq9qjuNE1eyEwGx2eLgz6Rc6G --url devnet
```

**Résultats attendus:**
- SOL: ~6
- BACK: 1000000
- USDC: 10000

---

## ⚠️ Sécurité

**IMPORTANT:**
- ⚠️ Cette clé privée est **UNIQUEMENT pour le devnet de test**
- ⚠️ **NE JAMAIS** envoyer de vrais fonds (mainnet) à cette adresse
- ⚠️ La clé est visible dans ce repo → Pour tests seulement
- ✅ Utilise toujours un wallet différent pour mainnet
- ✅ Ce wallet devnet peut être partagé pour les tests

---

## 🆘 Problèmes Courants

### "Wallet not connecting"
- Rafraîchir la page de l'app
- Vérifier que le wallet est bien sur **Devnet**
- Réinitialiser la connexion dans les settings du wallet

### "Token balances showing 0"
- Attendre 10-20 secondes (indexation devnet)
- Rafraîchir le wallet
- Vérifier que les tokens custom sont bien ajoutés

### "Network mismatch error"
- S'assurer que le wallet ET l'app sont sur Devnet
- Déconnecter puis reconnecter le wallet

### "Insufficient SOL for transaction"
- Demander un airdrop:
  ```bash
  solana airdrop 2 578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf --url devnet
  ```

---

## ✅ Une fois connecté

Tu es prêt pour tester ! Va sur **TEST_GUIDE.md** pour les scénarios de test.

**Premier test recommandé:**
1. Toggle: 🪐 Jupiter V6
2. Input: USDC (10)
3. Output: SOL
4. "Find Best Route"
5. "Execute Swap"

Bonne chance ! 🚀
