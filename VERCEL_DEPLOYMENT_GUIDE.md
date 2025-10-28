# 🚀 Guide de déploiement Vercel - SwapBack Testnet

Date: 28 octobre 2025  
Objectif: Déployer le frontend SwapBack sur Vercel avec la configuration testnet

---

## 📋 Prérequis

- ✅ Compte GitHub avec accès au repo `SwapBack`
- ✅ `vercel.json` commité (commit `94c4a74`)
- ✅ Variables testnet définies dans `app/.env.testnet`
- ✅ Compte Vercel (gratuit) - https://vercel.com

---

## 🎯 Méthode 1 : Déploiement via GitHub (Recommandé - 5 min)

### Étape 1 : Push vers GitHub

```bash
cd /workspaces/SwapBack
git push origin main
```

**Note**: Si votre repo est privé, assurez-vous d'avoir push access.

### Étape 2 : Connecter GitHub à Vercel

1. **Allez sur** : https://vercel.com
2. **Connectez-vous** avec votre compte GitHub
3. **Cliquez** : "Add New" → "Project"
4. **Importez** : Sélectionnez votre repo `BacBacta/SwapBack`

### Étape 3 : Configuration du projet

Vercel détecte automatiquement Next.js, mais vérifiez :

**Framework Preset**: Next.js  
**Root Directory**: `app/`  
**Build Command**: `npm run build`  
**Output Directory**: `.next`  
**Install Command**: `npm install`

### Étape 4 : Variables d'environnement

**IMPORTANT** : Ajoutez toutes les variables testnet :

```
NEXT_PUBLIC_SOLANA_NETWORK=testnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.testnet.solana.com
NEXT_PUBLIC_ROUTER_PROGRAM_ID=yeKoCvFPTmgn5oCejqFVU5mUNdVbZSxwETCXDuBpfxn
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=DkaELUiGtTcFniZvHRicHn3RK11CsemDRW7h8qVQaiJi
NEXT_PUBLIC_CNFT_PROGRAM_ID=GFnJ59QDC4ANdMhsvDZaFoBTNUiq3cY3rQfHCoDYAQ3B
NEXT_PUBLIC_BACK_MINT=5UpRMH1xbHYsZdrYwjVab8cVN3QXJpFubCB5WXeB8i27
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR
NEXT_PUBLIC_MERKLE_TREE=93Tzc7btocwzDSbscW9EfL9dBzWLx85FHE6zeWrwHbNT
NEXT_PUBLIC_COLLECTION_CONFIG=4zhpvzBMqvGoM7j9RAaAF5ZizwDUAtgYr5Pnzn8uRh5s
NEXT_PUBLIC_PLATFORM_FEE_BPS=20
```

**Astuce** : Copiez directement depuis `app/.env.testnet`

### Étape 5 : Déployer

1. **Cliquez** : "Deploy"
2. **Attendez** : Build prend ~2-3 minutes
3. **Récupérez l'URL** : `https://swapback-xxx.vercel.app`

### Étape 6 : Vérifier le déploiement

1. **Ouvrez l'URL** Vercel dans votre navigateur
2. **Vérifiez** :
   - Network indicator affiche "**Testnet**"
   - Connect Wallet fonctionne
   - RPC URL: `https://api.testnet.solana.com`
3. **Connectez** votre wallet et vérifiez les BACK tokens

---

## 🎯 Méthode 2 : Déploiement via CLI (Alternatif)

Si vous préférez le CLI (nécessite authentification fonctionnelle) :

### Étape 1 : Authentification

```bash
cd /workspaces/SwapBack/app
vercel login
# Suivre les instructions d'authentification
```

### Étape 2 : Déploiement

```bash
# Premier déploiement (setup)
vercel

# Déploiement production
vercel --prod
```

### Étape 3 : Configurer les variables

```bash
# Ajouter chaque variable
vercel env add NEXT_PUBLIC_SOLANA_NETWORK
# Entrer: testnet

vercel env add NEXT_PUBLIC_SOLANA_RPC_URL
# Entrer: https://api.testnet.solana.com

# Répéter pour toutes les variables...
```

**Alternative** : Utilisez le dashboard Vercel (plus simple)

---

## 🔧 Configuration avancée

### Custom Domain (Optionnel)

Si vous voulez utiliser `testnet.swapback.io` :

1. **Vercel Dashboard** → Votre projet → "Settings" → "Domains"
2. **Ajouter** : `testnet.swapback.io`
3. **Configurer DNS** :
   ```
   Type: CNAME
   Name: testnet
   Value: cname.vercel-dns.com
   ```

### Automatic Deployments

Vercel déploie automatiquement à chaque push sur `main` :

- **Production** : `main` branch → `https://swapback.vercel.app`
- **Preview** : Autres branches → URLs temporaires

### Build Optimization

Pour réduire le temps de build :

1. **Vercel Dashboard** → Settings → General
2. **Enable** : "Incremental Static Regeneration"
3. **Set** : Build cache duration = 7 days

---

## ✅ Checklist post-déploiement

- [ ] URL Vercel accessible
- [ ] Network indicator affiche "Testnet"
- [ ] Wallet connection fonctionne
- [ ] Program IDs corrects dans les requêtes réseau
- [ ] BACK tokens visibles (si wallet a des tokens testnet)
- [ ] Pas d'erreurs dans la console navigateur
- [ ] Build status : "Ready" dans Vercel dashboard

---

## 🐛 Troubleshooting

### Build échoue

**Erreur** : `Module not found`
- **Solution** : Vérifiez que Root Directory = `app/`

**Erreur** : `npm ERR! missing script: build`
- **Solution** : Vérifiez Build Command = `npm run build`

### Variables d'environnement non prises

**Symptôme** : App montre devnet au lieu de testnet
- **Solution** : 
  1. Vérifiez que toutes les variables commencent par `NEXT_PUBLIC_`
  2. Redéployez après avoir ajouté les variables
  3. Hard refresh dans le navigateur (Ctrl+Shift+R)

### Performance lente

**Symptôme** : Page charge lentement
- **Solution** :
  1. Activez Edge Functions dans Settings
  2. Vérifiez que RPC testnet est accessible
  3. Utilisez un RPC alternatif si nécessaire

---

## 📊 Monitoring

### Vercel Analytics

Activez pour suivre les performances :

1. **Dashboard** → Your Project → "Analytics"
2. **Enable** : "Web Analytics"
3. **Suivez** : Page load times, erreurs, visiteurs

### Logs en temps réel

```bash
# Via CLI
vercel logs
vercel logs --follow  # Stream en temps réel
```

Ou dans le dashboard : **Deployments** → Votre déploiement → "View Function Logs"

---

## 🚀 Prochaines étapes

Une fois le déploiement vérifié :

1. ✅ **Mettre à jour** `PHASE_11_UAT_GUIDE.md` avec l'URL réelle
2. ✅ **Tester** tous les scénarios UAT sur l'URL Vercel
3. ✅ **Partager** l'URL avec les beta testers
4. ✅ **Monitorer** les performances et erreurs

---

## 📞 Support

- **Vercel Docs** : https://vercel.com/docs
- **Next.js on Vercel** : https://nextjs.org/docs/deployment
- **Vercel Discord** : https://vercel.com/discord

---

**Créé le** : 28 octobre 2025  
**Dernière mise à jour** : 28 octobre 2025  
**Auteur** : SwapBack Team
