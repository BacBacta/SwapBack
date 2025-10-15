# 🦊 Import Wallet dans Phantom - GUIDE CORRIGÉ

## ✅ CLÉ PRIVÉE (Format Base58 - Compatible Phantom)

```
38dNwvVFzAyxKNojqRwQ5yKSpMc7Mp18kBENyS69km5xT5xRDwbRQQNzh4pv31Wf9ik9dmvGpNayBXoWra9V3Beb
```

**⚠️ COPIE CETTE CLÉ CI-DESSUS** (tout sur une ligne, sans espaces)

---

## 📱 Procédure d'Import dans Phantom

### Étape 1: Ouvrir Phantom
- Si tu n'as pas Phantom: https://phantom.app/download
- Installer l'extension Chrome/Brave

### Étape 2: Importer le Wallet
1. Cliquer sur l'**icône du wallet** en haut à gauche
2. Sélectionner **"Add / Connect Wallet"**
3. Choisir **"Import Private Key"**
4. **Coller la clé base58** ci-dessus
5. Donner un nom: **"SwapBack Devnet Test"**
6. Cliquer **"Import"**

### Étape 3: Basculer vers Devnet
1. Cliquer sur **Settings** (⚙️ en bas)
2. Aller dans **"Developer Settings"**
3. **Activer "Testnet Mode"**
4. Retourner à l'écran principal
5. Cliquer sur **"Mainnet"** en haut
6. Sélectionner **"Devnet"**

### Étape 4: Vérifier l'Adresse
Tu devrais voir:
```
578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf
```

### Étape 5: Ajouter les Tokens Custom

**Token $BACK:**
1. Cliquer sur "Manage Token List"
2. "Add Custom Token"
3. Coller: `BH8thpWca6kpN2pKwWTaKv2F5s4MEkbML18LtJ8eFypU`
4. Confirmer

**Token USDC:**
1. "Add Custom Token"
2. Coller: `3y4dCqwWuYx1B97YEDmgq9qjuNE1eyEwGx2eLgz6Rc6G`
3. Confirmer

### Étape 6: Vérifier les Balances
Tu devrais maintenant voir:
- ✅ **~6 SOL**
- ✅ **1,000,000 BACK**
- ✅ **10,000 USDC**

---

## 🎯 Formats de Clés Disponibles

### Format Base58 (Pour Phantom/Solflare) ⭐ RECOMMANDÉ
**Fichier:** `devnet-keypair-base58.txt`
```
38dNwvVFzAyxKNojqRwQ5yKSpMc7Mp18kBENyS69km5xT5xRDwbRQQNzh4pv31Wf9ik9dmvGpNayBXoWra9V3Beb
```
→ **Utilise celui-ci pour Phantom !**

### Format JSON Array (Pour CLI Solana)
**Fichier:** `devnet-keypair.json`
```json
[106,156,133,200,59,206,133,72,44,65,87,139,...]
```
→ Pour `solana-keygen` et commandes CLI

---

## ⚠️ Problèmes Fréquents

### "Invalid private key format"
❌ **Erreur:** Tu as utilisé le format JSON array `[106,156,...]`  
✅ **Solution:** Utilise le format base58 ci-dessus (une longue chaîne)

### "Private key must be 64 bytes"
❌ **Erreur:** Tu n'as pas copié toute la clé  
✅ **Solution:** Copie toute la ligne base58 (commence par `38dN...`)

### "Network mismatch"
❌ **Erreur:** Le wallet est sur Mainnet  
✅ **Solution:** Change vers Devnet (Settings → Developer → Testnet Mode)

---

## 🚀 Connexion à l'Application

Une fois le wallet importé et sur Devnet:

1. Ouvrir http://localhost:3000
2. Cliquer **"Connect Wallet"**
3. Sélectionner **Phantom**
4. Approuver la connexion
5. ✅ L'adresse `578DGN...wQf` devrait apparaître

---

## 📝 Checklist Complète

- [ ] Extension Phantom installée
- [ ] Clé base58 copiée (commence par `38dN...`)
- [ ] Wallet importé dans Phantom
- [ ] Testnet Mode activé
- [ ] Réseau changé vers Devnet
- [ ] Adresse `578DGN...wQf` visible
- [ ] Token $BACK ajouté (`BH8th...eFypU`)
- [ ] Token USDC ajouté (`3y4dC...z6Rc6G`)
- [ ] Balances visibles (6 SOL, 1M BACK, 10K USDC)
- [ ] Connecté à http://localhost:3000
- [ ] Prêt à tester un swap ! 🎉

---

**Bon test ! Si ça marche, essaie un swap USDC → SOL avec Jupiter !** 🚀
