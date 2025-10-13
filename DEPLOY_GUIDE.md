# 🚀 Guide de Déploiement Final - SwapBack cNFT

## État Actuel: 1/3 Programmes Déployés ✅

### ✅ Déjà sur Devnet
- **swapback_router**: `FPK46poe53iX6Bcv3q8cgmc1jm7dJKQ9Qs9oESFxGN55`

### ⏳ À Déployer
- **swapback_buyback**: `75nEwGH4cpRq13PG2eEioQE1wBqSvxvK9bhWfvpvZvP7`
- **swapback_cnft**: `FPNibu4RhrTt9yLDxcc8nQuHiVkFCfLVJ7DZUn6yn8K8`

---

## 🎯 Étapes pour Compléter le Déploiement

### Étape 1: Obtenir des SOL

**Option A - Faucet Web (RECOMMANDÉ)**
1. Aller sur: https://faucet.solana.com/
2. Sélectionner: Devnet
3. Entrer l'adresse: `578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf`
4. Demander: 5 SOL
5. Attendre confirmation (~30 secondes)

**Option B - CLI (si rate limit reset)**
```bash
export PATH="/home/codespace/.local/share/solana/install/active_release/bin:$PATH"
solana airdrop 2
sleep 60
solana airdrop 2
solana balance  # Devrait afficher ~6 SOL
```

### Étape 2: Déployer les Programmes

**Méthode Automatique (1 commande)**
```bash
cd /workspaces/SwapBack
./scripts/deploy_remaining.sh
```

**Méthode Manuelle (contrôle total)**
```bash
export PATH="/home/codespace/.local/share/solana/install/active_release/bin:$PATH"
cd /workspaces/SwapBack/target/deploy

# Vérifier le solde
solana balance

# Déployer buyback
echo "Déploiement swapback_buyback..."
solana program deploy \
  --program-id swapback_buyback-keypair.json \
  swapback_buyback.so

# Déployer cnft
echo "Déploiement swapback_cnft..."
solana program deploy \
  --program-id swapback_cnft-keypair.json \
  swapback_cnft.so

# Vérifier
solana program show 75nEwGH4cpRq13PG2eEioQE1wBqSvxvK9bhWfvpvZvP7
solana program show FPNibu4RhrTt9yLDxcc8nQuHiVkFCfLVJ7DZUn6yn8K8
```

### Étape 3: Vérifier sur Explorer

Ouvrir dans le navigateur:
```
https://explorer.solana.com/address/75nEwGH4cpRq13PG2eEioQE1wBqSvxvK9bhWfvpvZvP7?cluster=devnet
https://explorer.solana.com/address/FPNibu4RhrTt9yLDxcc8nQuHiVkFCfLVJ7DZUn6yn8K8?cluster=devnet
```

### Étape 4: Redémarrer Next.js (optionnel)

```bash
cd /workspaces/SwapBack/app
npm run dev
```

Ouvrir: http://localhost:3000

---

## 📋 Checklist Post-Déploiement

- [ ] Les 3 programmes sont visibles sur Solana Explorer
- [ ] Anchor.toml contient les bonnes adresses
- [ ] UI Next.js fonctionne (données mockées)
- [ ] Créer le hook `useCNFT.ts` pour données réelles
- [ ] Tester lock → cNFT mint → unlock
- [ ] Vérifier les calculs de boost
- [ ] Tests Bronze/Silver/Gold

---

## 🆘 Dépannage

### "Insufficient funds"
→ Obtenir plus de SOL (voir Étape 1)

### "Rate limit reached"
→ Attendre 1-2 heures OU utiliser faucet web

### "Program already exists"
→ Normal si re-déploiement, utiliser `--upgrade-authority`

### "Connection refused"
→ Vérifier `solana config get` (devrait être devnet)

---

## 📞 Commandes Utiles

```bash
# Vérifier configuration
solana config get

# Changer vers devnet
solana config set --url devnet

# Voir mon adresse
solana address

# Voir mon solde
solana balance

# Voir un programme
solana program show <PROGRAM_ID>

# Voir les logs d'un programme
solana logs <PROGRAM_ID>
```

---

## 🎉 Après Déploiement Complet

1. **Créer hook React** → `app/src/hooks/useCNFT.ts`
2. **Connecter au SDK** → Utiliser `sdk/src/cnftClient.ts`
3. **Remplacer mock data** → Dashboard.tsx
4. **Tests complets** → Lock, mint, unlock
5. **Documentation utilisateur** → Guide d'utilisation
6. **Bubblegum CPI** → Phase 2 (compression réelle)

---

**Besoin d'aide?** Voir `DEPLOYMENT_STATUS.md` et `SESSION_RECAP.md`
