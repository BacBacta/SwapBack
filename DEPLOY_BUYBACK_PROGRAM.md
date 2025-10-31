# 🚀 DÉPLOIEMENT PROGRAMME BUYBACK - GUIDE RAPIDE

## ❌ Problème Résolu
Le conteneur dev bloque l'installation de Solana CLI. Solution : déploiement manuel sur votre machine.

## ✅ Solution : Copiez et Exécutez

### Étape 1 : Copiez les fichiers
```bash
# Sur votre machine locale, créez un dossier :
mkdir ~/swapback-deployment
cd ~/swapback-deployment

# Copiez depuis le workspace GitHub :
# - target/deploy/swapback_buyback-keypair.json
# - target/deploy/swapback_buyback.so
```

### Étape 2 : Exécutez ce script complet
```bash
#!/bin/bash
# Script complet à copier-coller sur votre machine

echo "🚀 Déploiement programme buyback Token-2022"
echo "=========================================="

# 1. Installer Solana CLI
echo "📦 Installation Solana CLI..."
if ! command -v solana &> /dev/null; then
    sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi

# 2. Configuration devnet
echo "🌐 Configuration Solana devnet..."
solana config set --url https://api.devnet.solana.com
solana config set --commitment confirmed

# 3. Wallet
echo "👛 Configuration wallet..."
if [ ! -f ~/.config/solana/id.json ]; then
    solana-keygen new --no-passphrase
fi
echo "Adresse: $(solana address)"
echo "Solde: $(solana balance)"

# 4. Airdrop si nécessaire
BALANCE=$(solana balance | awk '{print $1}' | sed 's/SOL//')
if (( $(echo "$BALANCE < 5" | bc -l 2>/dev/null || echo "5") )); then
    echo "💰 Airdrop 5 SOL..."
    solana airdrop 5
fi

# 5. Déploiement
echo "📦 Déploiement..."
solana program deploy \\
    --program-id "swapback_buyback-keypair.json" \\
    "swapback_buyback.so"

if [ $? -eq 0 ]; then
    echo "✅ SUCCÈS! Programme ID: 9KTkQyjDYHF4vemLZjYQM1XE74peviEi1tSXaYMSyZHT"
else
    echo "❌ ÉCHEC - Vérifiez les logs"
fi
```

## 📊 Informations Clés
- **Programme ID** : `9KTkQyjDYHF4vemLZjYQM1XE74peviEi1tSXaYMSyZHT`
- **Token $BACK** : `3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE`
- **Devnet RPC** : `https://api.devnet.solana.com`
- **SOL requis** : Minimum 5 SOL

## 🎯 Après Déploiement
```bash
# Vérifier
solana program show 9KTkQyjDYHF4vemLZjYQM1XE74peviEi1tSXaYMSyZHT

# Tester compatibilité Token-2022
# (revenez dans le workspace pour exécuter)
node test-buyback-compatibility.js
```

---
**💡 Conseil** : Copiez-collez le script bash complet dans un terminal sur votre machine locale.