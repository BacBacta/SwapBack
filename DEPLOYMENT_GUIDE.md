# 🚀 Guide de Déploiement Programme Buyback Token-2022

## Contexte
Le programme buyback a été modifié pour supporter Token-2022. Le déploiement est bloqué par les limitations du conteneur dev.

## 📋 État Actuel
- ✅ Code modifié et compilé
- ✅ Binaire prêt: `target/deploy/swapback_buyback.so`
- ✅ Keypair prête: `target/deploy/swapback_buyback-keypair.json`
- ❌ Déploiement bloqué par l'environnement

## 🎯 Options de Déploiement

### Option 1: Déploiement Manuel (Recommandé)
Utilisez le script bash sur votre machine locale:

```bash
# 1. Copiez les fichiers sur votre machine
scp target/deploy/swapback_buyback* user@local-machine:~/swapback-deploy/

# 2. Installez Solana CLI si nécessaire
sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)"

# 3. Configurez pour devnet
solana config set --url https://api.devnet.solana.com

# 4. Créez/obtenez un wallet
solana-keygen new  # ou importez un wallet existant

# 5. Obtenez des SOL pour devnet
solana airdrop 5

# 6. Exécutez le déploiement
chmod +x deploy-buyback-manual.sh
./deploy-buyback-manual.sh
```

### Option 2: Script Node.js (Alternative)
Si Solana CLI n'est pas disponible, utilisez le script Node.js:

```bash
# Assurez-vous que @solana/web3.js est installé
npm install @solana/web3.js

# Créez un wallet Solana
# Le script créera automatiquement un wallet si nécessaire

# Exécutez le déploiement
node deploy-buyback-program.js
```

### Option 3: Interface Web Solana
1. Allez sur https://www.quicknode.com/solana-devnet-faucet
2. Obtenez des SOL pour devnet
3. Utilisez Solana Explorer pour déployer manuellement

## 🔧 Prérequis

### Solana CLI
```bash
# Installation
sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)"

# Vérification
solana --version
```

### Wallet Solana
```bash
# Créer un nouveau wallet
solana-keygen new

# Ou importer un wallet existant
solana-keygen recover

# Vérifier l'adresse
solana address
```

### SOL pour Devnet
```bash
# Obtenir un airdrop
solana airdrop 5

# Vérifier le solde
solana balance
```

## 📊 Vérification Post-Déploiement

Après le déploiement réussi:

```bash
# Vérifier le programme
solana program show EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf

# Tester la compatibilité Token-2022
node test-buyback-compatibility.js

# Initialiser les états buyback
node scripts/init-buyback-states.js
```

## 🎯 Programme ID
- **Buyback Program**: `EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf`
- **Token $BACK**: `3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE`

## ⚠️ Points d'Attention

1. **Solde Minimum**: 5 SOL requis pour le déploiement
2. **Devnet Only**: Tout se passe sur devnet pour les tests
3. **Token-2022**: Le programme supporte maintenant les tokens Token-2022
4. **Upgrade Authority**: Conservez la clé privée du wallet utilisé

## 🔄 Prochaines Étapes

Après déploiement:
1. ✅ Tester compatibilité Token-2022
2. 🔄 Initialiser états buyback
3. 🔄 Tester flow E2E: lock → buyback → claim
4. 🔄 Finaliser intégration frontend
5. 🔄 Documentation complète

## 🆘 Dépannage

### Erreur: "insufficient funds"
```bash
solana airdrop 5
# ou visitez https://faucet.solana.com
```

### Erreur: "program not found"
- Vérifiez que vous êtes sur devnet
- Vérifiez l'adresse du programme

### Erreur: "permission denied"
- Vérifiez que Solana CLI est installé correctement
- Vérifiez les permissions des fichiers

---

**📞 Support**: Si vous rencontrez des problèmes, vérifiez les logs et consultez la documentation Solana.