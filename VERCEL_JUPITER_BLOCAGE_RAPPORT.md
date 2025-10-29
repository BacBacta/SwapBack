# 🚫 Rapport de Blocage : Intégration Jupiter sur Vercel

**Date**: 29 Octobre 2025  
**Statut**: ❌ BLOQUÉ - Impossible d'accéder à Jupiter API depuis Vercel  
**Gravité**: HAUTE - Fonctionnalité critique non disponible

---

## 📊 Résumé Exécutif

L'intégration de Jupiter API pour la recherche de routes de swap est **complètement bloquée** sur Vercel et GitHub Codespaces en raison de multiples restrictions réseau.

**Impact** : Impossible d'obtenir des routes de swap réelles pour les utilisateurs.

---

## 🔍 Tentatives Effectuées

### 1. ❌ Appel Direct depuis Codespaces
**Méthode** : `fetch("https://quote-api.jup.ag/v6/quote?...")`  
**Résultat** : `Error: getaddrinfo ENOTFOUND quote-api.jup.ag`  
**Cause** : GitHub Codespaces bloque l'accès DNS à Jupiter API

### 2. ❌ API Route Vercel (Serverless)
**Méthode** : Next.js API Route `/api/swap/quote` → Jupiter  
**Résultat** : `Error: getaddrinfo ENOTFOUND quote-api.jup.ag`  
**Cause** : Vercel serverless functions bloquent aussi l'accès DNS à Jupiter

### 3. ❌ Appel Direct depuis Navigateur (Client-side)
**Méthode** : `fetch` directement depuis le navigateur  
**Résultat** : `CORS Policy: No 'Access-Control-Allow-Origin' header`  
**Cause** : Jupiter API n'autorise pas les requêtes Cross-Origin depuis les navigateurs

### 4. ❌ Proxy CORS Public (corsproxy.io)
**Méthode** : API Route → CORS Proxy → Jupiter  
**Résultat** : `HTTP 530` (Internal Server Error Vercel)  
**Cause** : Timeout ou erreur de configuration proxy

### 5. ❌ Mode MOCK (Données Simulées)
**Méthode** : `USE_MOCK_QUOTES=true` pour générer des données fictives  
**Résultat** : `HTTP 530` (même en mode MOCK!)  
**Cause** : L'API route elle-même a un problème de build/configuration sur Vercel

---

## 🏗️ Architecture Actuelle

```
┌──────────────┐
│  Navigateur  │
└──────┬───────┘
       │ fetch /api/swap/quote
       ▼
┌──────────────────────┐
│  Vercel (Next.js)    │
│  API Route           │ → ❌ HTTP 530
│  /api/swap/quote     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Jupiter API         │
│  quote-api.jup.ag    │ → ❌ DNS BLOCKED
└──────────────────────┘
```

---

## 💡 Solutions Possibles

### Option A : Déployer sur un autre hébergeur ✅ RECOMMANDÉ
- **Hébergeurs compatibles** : Railway, Render, DigitalOcean, AWS, GCP
- **Avantage** : Pas de restrictions DNS
- **Inconvénient** : Migration nécessaire

### Option B : Serveur Backend Dédié (Node.js/Express)
- **Architecture** : Navigateur → Backend dédié → Jupiter
- **Avantage** : Contrôle total, pas de limitations serverless
- **Inconvénient** : Coût d'hébergement supplémentaire

### Option C : Utiliser un Proxy CORS Personnel
- **Méthode** : Héberger son propre proxy CORS sur un serveur compatible
- **Avantage** : Contourne CORS et DNS
- **Inconvénient** : Maintenance et coûts

### Option D : Mode MOCK Permanent (Temporaire)
- **Méthode** : Générer des données simulées réalistes
- **Avantage** : Application fonctionnelle pour démo
- **Inconvénient** : Pas de vraies données de marché

### Option E : Utiliser Jupiter SDK côté client
- **Méthode** : `@jup-ag/api` ou `@jup-ag/react-hook`
- **Avantage** : Intégration officielle
- **Inconvénient** : Peut avoir les mêmes problèmes CORS

---

## 📝 État Actuel du Code

### Fichiers Modifiés
1. **`app/src/store/swapStore.ts`** - Appelle `/api/swap/quote`
2. **`app/src/app/api/swap/quote/route.ts`** - API route avec support MOCK et CORS proxy
3. **`app/vercel.json`** - Configuration environnement (`USE_MOCK_QUOTES=true`)
4. **`vercel.json`** (root) - Configuration build Vercel

### Configuration Actuelle
```json
{
  "USE_MOCK_QUOTES": "true",
  "USE_CORS_PROXY": "false",
  "JUPITER_API_URL": "https://quote-api.jup.ag/v6"
}
```

---

## 🎯 Recommandations

### Court Terme (Démo/MVP)
1. ✅ **Garder le mode MOCK activé** (si l'API route fonctionne)
2. ✅ **Documenter clairement** que c'est une démo avec données simulées
3. ✅ **Afficher un bandeau** "Mode Démo - Données Simulées"

### Moyen Terme (Production)
1. 🔄 **Migrer vers Railway/Render** pour le backend
2. 🔄 **Implémenter Jupiter SDK** côté client (si CORS résolu)
3. 🔄 **Créer un service backend dédié** pour les appels API externes

### Long Terme (Optimisation)
1. 📈 **Architecture microservices** : Backend séparé pour les intégrations externes
2. 📈 **Cache Redis** : Réduire les appels à Jupiter
3. 📈 **Fallback multi-DEX** : Utiliser Raydium/Orca si Jupiter échoue

---

## 🐛 Debugging Actuel

### Erreur HTTP 530 Persistante
**Même en mode MOCK**, l'API route retourne 530. Causes possibles :
1. **Build Error** : L'API route ne build pas correctement sur Vercel
2. **Timeout** : Dépassement de la limite Vercel (10 sec)
3. **Memory Limit** : Dépassement de la limite mémoire serverless
4. **Import Error** : Dépendances manquantes ou incompatibles

### Prochaine Étape de Debug
1. Vérifier les logs Vercel en détail
2. Simplifier l'API route (retour JSON basique)
3. Tester avec Vercel CLI en local
4. Vérifier les dépendances npm

---

## 📌 Conclusion

**L'intégration Jupiter API est BLOQUÉE sur Vercel** en raison de restrictions réseau multiples.

**Action immédiate** : 
- Maintenir le mode MOCK pour la démo
- Résoudre l'erreur HTTP 530 de l'API route
- Planifier une migration vers un hébergeur compatible

**Contact** : Pour questions techniques, voir `GUIDE_DEPLOIEMENT_VERCEL.md`

---

**Dernière mise à jour** : 29 Oct 2025 18:00 UTC
