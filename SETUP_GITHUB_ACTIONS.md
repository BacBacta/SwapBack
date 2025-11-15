# 🚀 Setup Github Actions - Build et Deploy Automatique

## ✅ Fichier Workflow Créé

Le fichier `.github/workflows/build-deploy.yml` a été créé avec:
- ✅ Build job (compile le programme)
- ✅ Deploy job (déploie sur devnet)
- ✅ Test job (exécute les tests)

## 🔐 Configuration Requise (5 min)

### Étape 1: Créer le Secret du Wallet

Sur votre machine locale:
```bash
# Générer une keypair devnet
solana-keygen new -o devnet-keypair.json

# Afficher le contenu
cat devnet-keypair.json
```

### Étape 2: Ajouter le Secret à Github

1. Aller à: `https://github.com/BacBacta/SwapBack/settings/secrets/actions`
2. Cliquer **New repository secret**
3. **Name**: `SOLANA_DEVNET_KEYPAIR`
4. **Value**: Coller le contenu du fichier `devnet-keypair.json`
5. Cliquer **Add secret**

### Étape 3: Financer le Wallet

```bash
# Demander 2 SOL devnet
solana airdrop 2 -k devnet-keypair.json --url https://api.devnet.solana.com

# Vérifier le solde
solana balance -k devnet-keypair.json --url https://api.devnet.solana.com
```

## 🎯 Utilisation

### Option A: Déclencher Automatiquement (RECOMMANDÉ)

```bash
# Depuis votre machine
git add .
git commit -m "Deploy lock/unlock on devnet"
git push origin main
```

Le workflow se déclenche automatiquement! ✅

### Option B: Déclencher Manuellement

1. Aller à: `https://github.com/BacBacta/SwapBack/actions`
2. Sélectionner **Build and Deploy Solana Program**
3. Cliquer **Run workflow**
4. Choisir `main` branch
5. Cliquer **Run workflow**

## 📊 Suivre l'Exécution

1. Aller à **Actions** tab dans Github
2. Cliquer sur le workflow en cours
3. Voir les logs temps réel

### Statuts Possibles
- 🔵 **In Progress** - Le workflow s'exécute
- ✅ **Success** - Tout a réussi
- ❌ **Failed** - Une étape a échoué

## 📦 Récupérer les Artifacts

1. Aller au workflow complété
2. Scroller en bas
3. **Artifacts** section:
   - `swapback_cnft.so` - Binaire compilé
   - `deployment-package` - Fichiers de déploiement
   - `deployment-summary` - Résumé avec Program ID
   - `test-report` - Rapport des tests

### Le Program ID

Trouvez le Program ID dans:
```
deployment-summary/DEPLOYMENT_SUMMARY.txt
```

Contient:
```
Program ID: c5aEUgYctZv5Yh7fiTWN18jr6seP7KThJsRPmxs2kKR
Network: Devnet
RPC: https://api.devnet.solana.com
```

## 🧪 Après le Déploiement

1. **Vérifier le Program ID**:
   ```bash
   solana program show c5aEUgYctZv5Yh7fiTWN18jr6seP7KThJsRPmxs2kKR --url https://api.devnet.solana.com
   ```

2. **Exécuter les tests localement**:
   ```bash
   ts-node scripts/init-cnft.ts
   ts-node scripts/test-lock-unlock.ts
   ```

3. **Mettre à jour le frontend**:
   ```bash
   # Utiliser le nouveau Program ID dans votre app
   VITE_PROGRAM_ID=c5aEUgYctZv5Yh7fiTWN18jr6seP7KThJsRPmxs2kKR
   ```

## ⚠️ Dépannage

### "Build Failed"
- Vérifier que `cargo check` passe localement
- Vérifier les logs du workflow
- S'assurer que `Cargo.toml` est correct

### "Deploy Failed"
- Vérifier que le secret `SOLANA_DEVNET_KEYPAIR` existe
- Vérifier que le wallet a du SOL
- Vérifier que le réseau devnet est accessible

### "Tests Failed"
- Les tests peuvent échouer si le programme n'est pas encore prêt
- C'est OK - le déploiement a réussi
- Exécuter les tests manuellement après quelques secondes

## 🔄 Redéployer

Simplement pusher à nouveau sur main:
```bash
git add .
git commit -m "Update program"
git push origin main
```

Le workflow se réexécute automatiquement! ✅

## 📈 Next Steps

- [ ] Créer le secret `SOLANA_DEVNET_KEYPAIR` dans Github
- [ ] Financer le wallet avec du SOL devnet
- [ ] Pusher le code (ou déclencher manuellement)
- [ ] Suivre le workflow dans l'onglet Actions
- [ ] Récupérer le Program ID
- [ ] Tester le programme

---

**Total Setup Time**: 5 minutes  
**Deployment Time**: 5 minutes  
**Result**: Programme live sur devnet ✅

Pour plus d'aide, voir `DEPLOYMENT_TROUBLESHOOTING.md`
