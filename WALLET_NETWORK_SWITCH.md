# 🔄 Changer le réseau de votre wallet vers Devnet

## Le problème
Vous voyez ce message : **"⚠️ You're on mainnet-beta. Please switch to devnet."**

## La cause
Votre application est configurée sur **devnet** ✅, mais votre wallet est sur **mainnet** ❌

## La solution : Changer le réseau dans votre wallet

---

### 👻 Pour Phantom Wallet

1. **Ouvrez l'extension Phantom** dans votre navigateur
2. **Cliquez sur l'icône ⚙️** (Paramètres) en bas à gauche
3. **Cliquez sur "Developer Settings"** ou "Paramètres développeur"
4. **Activez "Testnet Mode"** (basculer le switch)
5. **Sélectionnez "Devnet"** dans la liste des réseaux
6. **Fermez les paramètres**
7. **Rafraîchissez votre application** (F5)

**Raccourci visuel :**
```
Phantom → ⚙️ Settings → 🔧 Developer Settings → Toggle "Testnet Mode" → Select "Devnet"
```

---

### 🔥 Pour Solflare Wallet

1. **Ouvrez l'extension Solflare** dans votre navigateur
2. **Cliquez sur le nom du réseau** en haut (affiche "Mainnet")
3. **Sélectionnez "Devnet"** dans le menu déroulant
4. **Rafraîchissez votre application** (F5)

**Raccourci visuel :**
```
Solflare → Click "Mainnet" (top) → Select "Devnet"
```

---

### 🎒 Pour Backpack Wallet

1. **Ouvrez Backpack**
2. **Cliquez sur l'icône hamburger** ☰ (menu)
3. **Allez dans "Settings"**
4. **Sélectionnez "Developer"**
5. **Changez le réseau** vers "Devnet"
6. **Rafraîchissez votre application** (F5)

---

## ✅ Après le changement

Une fois le réseau changé sur **Devnet** :

1. **Reconnectez votre wallet** à l'application
2. Le message d'erreur devrait disparaître
3. **Votre solde devrait afficher : 100,000 $BACK** 🎉

---

## 🔍 Vérifier la configuration

### Configuration de l'application (✅ OK)
```
Network: devnet
RPC URL: https://api.devnet.solana.com
BACK Token: 8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P
```

### Votre balance on-chain (✅ OK)
```
Wallet: 578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf
Balance: 100,000 $BACK
```

---

## 💡 Astuce

Après avoir changé le réseau, vous pouvez aussi :
- **Demander du SOL devnet** pour les frais : https://faucet.solana.com/
- **Vérifier vos tokens** sur Solana Explorer : 
  ```
  https://explorer.solana.com/address/578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf\?cluster\=devnet
  ```

---

## 🐛 Si le problème persiste

1. **Déconnectez complètement le wallet** de l'application
2. **Fermez l'extension du wallet** et réouvrez-la
3. **Vérifiez que le wallet affiche bien "Devnet"**
4. **Reconnectez le wallet** à l'application
5. **Vider le cache du navigateur** : Ctrl+Shift+R (ou Cmd+Shift+R sur Mac)

