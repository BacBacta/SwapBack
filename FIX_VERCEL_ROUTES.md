# 🔧 CORRECTION : Routes non détectées par Vercel

## ❌ Problème

L'application déployée sur Vercel ne trouve pas les routes Next.js.

**Cause** : Le projet Vercel pointe vers la racine du repo (`/`) au lieu de `/app`.

## ✅ Solutions

### Solution 1 : Configurer le Root Directory (RECOMMANDÉ)

#### Via Vercel Dashboard :

1. **Ouvrir** : https://vercel.com/bactas-projects/app/settings/general

2. **Chercher** : Section "Root Directory"

3. **Configurer** :
   - Root Directory: `app`
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install --ignore-scripts`

4. **Sauvegarder** et **Redéployer**

#### Ou via `vercel.json` à la racine du repo :

Créer `/workspaces/SwapBack/vercel.json` :

```json
{
  "buildCommand": "cd app && npm run build",
  "installCommand": "cd app && npm install --ignore-scripts",
  "outputDirectory": "app/.next",
  "framework": "nextjs"
}
```

### Solution 2 : Créer un nouveau projet Vercel (ALTERNATIVE)

Si le projet actuel a des problèmes :

1. **Supprimer** le lien actuel :
   ```bash
   cd /workspaces/SwapBack/app
   rm -rf .vercel
   ```

2. **Relancer** depuis la racine du repo :
   ```bash
   cd /workspaces/SwapBack
   vercel
   ```

3. **Répondre** aux questions :
   - Set up and deploy? → **Yes**
   - Which scope? → **bacta's projects**
   - Link to existing project? → **No** (créer nouveau)
   - What's your project's name? → **swapback**
   - In which directory is your code located? → **app**
   
4. **Configurer** :
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install --ignore-scripts`

### Solution 3 : Déployer avec configuration explicite

```bash
cd /workspaces/SwapBack
vercel --prod \
  --cwd app \
  --build-env NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta \
  --yes
```

## 🎯 Action Immédiate (RECOMMANDÉ)

### Étape 1 : Configurer Root Directory

1. **Ouvrir** : https://vercel.com/bactas-projects/app/settings/general

2. **Scroller jusqu'à** : "Root Directory"

3. **Entrer** : `app`

4. **Sauvegarder**

### Étape 2 : Forcer un redéploiement

**Option A** : Via Dashboard
- Aller sur : https://vercel.com/bactas-projects/app
- Cliquer : "Redeploy"

**Option B** : Via CLI
```bash
cd /workspaces/SwapBack/app
vercel --prod --force --yes
```

### Étape 3 : Vérifier les routes

Une fois redéployé, tester :

```bash
# Route principale
curl -I https://app-[hash]-bactas-projects.vercel.app/

# Route /api/health
curl https://app-[hash]-bactas-projects.vercel.app/api/health

# Route /swap-enhanced
curl -I https://app-[hash]-bactas-projects.vercel.app/swap-enhanced
```

## 📋 Vérification de la structure Next.js

Les routes existent bien dans `app/src/app/` :

```
app/src/app/
├── page.tsx              → Route: /
├── layout.tsx            → Layout global
├── globals.css           → Styles globaux
├── api/                  → Routes API: /api/*
├── buyback/             → Route: /buyback
├── dashboard/           → Route: /dashboard
├── dca/                 → Route: /dca
├── lock/                → Route: /lock
└── swap-enhanced/       → Route: /swap-enhanced
```

## 🔍 Diagnostic actuel

**Projet Vercel** : `app` (ID: prj_4T5WKyofamxdl35cbJUaAJSgWgCB)

**Problème probable** :
- ❌ Root Directory = `/` (racine du repo)
- ✅ Devrait être = `/app`

**Configuration actuelle** :
```json
{
  "projectId": "prj_4T5WKyofamxdl35cbJUaAJSgWgCB",
  "orgId": "team_yvcPXxh5OyD9bGT9ogPgtNEw",
  "projectName": "app"
}
```

## 💡 Script de correction rapide

```bash
#!/bin/bash

# 1. Aller dans le bon dossier
cd /workspaces/SwapBack/app

# 2. Forcer un redéploiement avec la bonne config
vercel --prod --yes --force

# 3. Attendre le déploiement
echo "⏳ Déploiement en cours..."
sleep 30

# 4. Tester les routes
DEPLOY_URL=$(vercel ls --prod | grep "app" | head -1 | awk '{print $2}')
echo "🧪 Test de l'URL: https://$DEPLOY_URL"

# Test route principale
curl -I "https://$DEPLOY_URL/" | grep "HTTP"

# Test route API
curl -s "https://$DEPLOY_URL/api/health" | jq .

echo "✅ Déploiement terminé!"
```

## 🚨 Si le problème persiste

### Option : Recréer le projet Vercel

```bash
# 1. Supprimer le lien actuel
cd /workspaces/SwapBack/app
rm -rf .vercel

# 2. Se connecter à Vercel
vercel login

# 3. Créer un nouveau projet depuis la racine
cd /workspaces/SwapBack
vercel --prod

# Répondre:
# - Directory: app
# - Build Command: npm run build
# - Output Directory: .next
```

---

## ✅ Résumé

**Problème** : Root Directory mal configuré  
**Solution** : Configurer Root Directory = `app` sur Vercel Dashboard  
**URL Settings** : https://vercel.com/bactas-projects/app/settings/general  

**Après correction** : Les routes `/`, `/swap-enhanced`, `/dashboard`, `/dca`, `/buyback`, `/api/*` fonctionneront ! 🎉
