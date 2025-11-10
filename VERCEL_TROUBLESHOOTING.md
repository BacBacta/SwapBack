# 🔴 DÉPANNAGE : Erreur "client-side exception" sur Vercel

## Symptôme
```
Application error: a client-side exception has occurred
(see the browser console for more information)
```

## Causes possibles

### 1. ✅ Variables d'environnement manquantes ou incorrectes
Vous avez déjà ajouté les principales variables. Vérifiez qu'elles sont **exactement** comme ci-dessous :

```bash
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_CNFT_PROGRAM_ID=9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
NEXT_PUBLIC_ROUTER_PROGRAM_ID=BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom
```

### 2. ⚠️ Variables manquantes additionnelles
Ajoutez aussi ces variables **optionnelles mais recommandées** :

```bash
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR
NEXT_PUBLIC_MERKLE_TREE=93Tzc7btocwzDSbscW9EfL9dBzWLx85FHE6zeWrwHbNT
```

### 3. 🔄 Build non à jour
**Le problème le plus probable** : Vercel n'a pas encore rebuild avec les nouvelles variables.

## 🔧 Solution : Forcer un Redéploiement

### Option A : Via le Dashboard Vercel (RECOMMANDÉ)
1. Allez sur https://vercel.com/dashboard
2. Sélectionnez votre projet SwapBack
3. Cliquez sur **"Deployments"** dans le menu
4. Trouvez le **dernier deployment** (le plus récent)
5. Cliquez sur les **3 points** (⋮) à droite
6. Sélectionnez **"Redeploy"**
7. ✅ **IMPORTANT** : Cochez **"Use existing Build Cache"** → **DÉCOCHER** cette option
8. Cliquez sur **"Redeploy"**

### Option B : Via Git Push (Alternative)
Si l'option A ne fonctionne pas :

```bash
# Dans votre terminal local
git commit --allow-empty -m "chore: trigger Vercel rebuild"
git push origin main
```

### Option C : Via Vercel CLI
```bash
vercel --prod --force
```

## 📊 Vérification après redéploiement

### 1. Attendre la fin du build
- Le build prend environ **2-5 minutes**
- Vercel vous montrera la progression en temps réel

### 2. Tester l'application
1. Ouvrez votre URL Vercel : `https://swap-back-app-4ewf.vercel.app`
2. **Ouvrez la Console du navigateur** (F12)
3. Connectez votre wallet
4. Regardez les logs dans la console :
   ```
   ✅ Devrait afficher : "Environment validation passed"
   ✅ Devrait afficher : "CNFT Program: 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq"
   ❌ Si erreur : Noter le message exact
   ```

### 3. Ouvrir le Dashboard
- Cliquez sur "Dashboard" dans le menu
- Si l'erreur persiste, regardez la console

## 🐛 Debugging avancé

### Vérifier les variables sur Vercel
1. Dashboard → Settings → Environment Variables
2. Vérifiez que **TOUTES** les variables sont définies pour :
   - ✅ **Production**
   - ✅ **Preview**
   - ✅ **Development**

### Logs Vercel
1. Dashboard → Deployments → Cliquez sur le dernier deployment
2. Onglet **"Function Logs"** ou **"Build Logs"**
3. Cherchez les erreurs liées aux variables d'environnement

### Tester localement avec les mêmes variables
```bash
# Dans votre projet local
cd app

# Créer .env.local avec les MÊMES variables que Vercel
cat > .env.local << 'EOF'
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_CNFT_PROGRAM_ID=9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
NEXT_PUBLIC_ROUTER_PROGRAM_ID=BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR
NEXT_PUBLIC_MERKLE_TREE=93Tzc7btocwzDSbscW9EfL9dBzWLx85FHE6zeWrwHbNT
NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom
EOF

# Lancer le dev server
npm run dev

# Tester sur http://localhost:3000
```

Si ça marche localement mais pas sur Vercel → Problème de build Vercel

## 📝 Checklist finale

- [ ] Toutes les variables définies sur Vercel
- [ ] Variables définies pour **Production, Preview, ET Development**
- [ ] Redéploiement forcé (sans cache)
- [ ] Attendu 2-5 minutes pour le build complet
- [ ] Testé avec la console ouverte
- [ ] Vérifié les logs Vercel pour erreurs

## 🆘 Si le problème persiste

### Récupérer l'erreur exacte
1. Ouvrez l'application sur Vercel
2. Ouvrez la Console (F12)
3. Essayez de connecter le wallet et d'ouvrir le Dashboard
4. **Copiez l'erreur COMPLÈTE** de la console
5. Cherchez dans l'onglet "Console" ET "Network"

### Erreurs courantes à chercher

#### Erreur : "PublicKey is not a constructor"
→ Variable d'environnement est une chaîne vide ou invalide

#### Erreur : "Cannot read properties of undefined"
→ Variable manquante ou module qui n'a pas chargé

#### Erreur : "Failed to fetch"
→ RPC URL incorrect ou réseau inaccessible

#### Erreur : "AccountNotFound"
→ Program ID incorrect ou compte n'existe pas sur devnet

## 💡 Notes importantes

### Build Cache
Vercel garde un cache du build précédent. Si vous changez les variables d'environnement, vous DEVEZ forcer un rebuild **sans cache**.

### Variables côté serveur vs client
- Variables **NEXT_PUBLIC_*** : Accessible côté client (navigateur)
- Variables sans ce préfixe : Seulement côté serveur

### Propagation
Les variables peuvent prendre **quelques secondes** pour se propager après modification. Attendez ~30 secondes avant de redéployer.

---

**Date** : 10 novembre 2025  
**Status** : Guide de dépannage  
**Prochaine étape** : Forcer un redéploiement Vercel sans cache
