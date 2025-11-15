# 🚀 DÉPLOIEMENT DEVNET - GUIDE SIMPLIFIÉ

## ⚠️ IMPORTANT

Ce déploiement **DOIT être exécuté sur votre MACHINE LOCALE**, pas dans ce codespace.

Les outils Solana/Anchor ne sont pas disponibles dans le codespace.

---

## ✅ PRÉREQUIS (Machine locale)

### 1. Solana CLI (v1.18.26)
```bash
# Vérifier si installé
solana --version

# Sinon, installer
sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
```

### 2. Anchor CLI (v0.30.1)
```bash
# Vérifier si installé
anchor --version

# Sinon, installer
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1
avm use 0.30.1
```

### 3. Rust
```bash
# Vérifier si installé
rustc --version

# Sinon, installer
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 4. Node.js (v18+)
```bash
node --version
npm --version
```

---

## 🚀 3 ÉTAPES DE DÉPLOIEMENT

### Étape 1: Configurer Solana devnet
```bash
# Sur votre machine locale
solana config set --url https://api.devnet.solana.com

# Vérifier la config
solana config get

# Obtenir des SOL devnet (si nécessaire)
solana airdrop 2

# Vérifier le solde
solana balance
```

### Étape 2: Cloner et déployer
```bash
# Cloner le projet (si pas déjà fait)
git clone https://github.com/BacBacta/SwapBack.git
cd SwapBack

# Ou pull les derniers changements
git pull origin main

# Lancer le déploiement automatique
./rebuild-lock-unlock.sh
```

**Le script va faire automatiquement:**
- ✅ Générer nouvelle keypair
- ✅ Build le programme
- ✅ Déployer sur devnet
- ✅ Afficher le nouveau Program ID

**Durée: ~5 minutes**

### Étape 3: Mettre à jour et initialiser
```bash
# Copier le Program ID affiché par le script précédent
# (ex: ABC123...XYZ456)

# Mettre à jour le frontend
./update-frontend-program-id.sh ABC123...XYZ456

# Initialiser les comptes
ts-node scripts/init-cnft.ts
```

---

## ✅ VÉRIFICATION DU DÉPLOIEMENT

### Voir le programme déployé
```bash
# Remplacer PROGRAM_ID par le vôtre
solana program show PROGRAM_ID --url devnet
```

### Monitorer les logs en temps réel
```bash
solana logs --url devnet PROGRAM_ID
```

### Voir dans l'explorer
```
https://explorer.solana.com/address/PROGRAM_ID?cluster=devnet
```

---

## 🧪 TESTER APRÈS LE DÉPLOIEMENT

### Test automatique
```bash
ts-node scripts/test-lock-unlock.ts
```

### Test frontend
```bash
cd app
npm run dev
# Ouvrir http://localhost:3000
```

---

## 🆘 TROUBLESHOOTING

### Erreur: "solana-keygen command not found"
**Cause:** Solana CLI pas installé  
**Solution:** Installer Solana CLI (voir Prérequis)

### Erreur: "insufficient funds"
**Cause:** Pas assez de SOL devnet  
**Solution:** 
```bash
solana airdrop 2 --url devnet
```

### Erreur: "account already exists"
**Cause:** Normal avec nouveau Program ID  
**Solution:** C'est bon, les comptes seront recréés

### Build très lent ou erreur mémoire
**Solution:** Utiliser les optimisations
```bash
export TMPDIR=/tmp
export CARGO_TARGET_DIR=/tmp/cargo-target
export RUSTFLAGS='-C target-cpu=generic -C opt-level=1'
```

---

## 📋 CHECKLIST

Avant de commencer:

- [ ] Solana CLI installé (`solana --version`)
- [ ] Anchor CLI installé (`anchor --version`)
- [ ] Rust installé (`rustc --version`)
- [ ] Node.js v18+ (`node --version`)
- [ ] Configuré sur devnet (`solana config get`)
- [ ] Solde suffisant (`solana balance` > 1 SOL)
- [ ] Projet cloné ou pull (`git pull origin main`)

Une fois tout prêt:

- [ ] `./rebuild-lock-unlock.sh` exécuté ✅
- [ ] Program ID noté
- [ ] Frontend mis à jour ✅
- [ ] Comptes initialisés ✅
- [ ] Tests passés ✅

---

## 🎉 C'EST FAIT !

Votre programme cNFT est maintenant déployé sur devnet !

**Prochaines étapes:**
1. Tester avec utilisateurs beta
2. Monitorer performances
3. Préparer mainnet

---

**Besoin d'aide? Consultez:**
- `SYNTHESE_FINALE.md` - Résumé complet
- `RECONSTRUCTION_LOCK_UNLOCK_GUIDE.md` - Détails techniques
- `COMMANDES_RAPIDES.md` - Aide-mémoire des commandes
