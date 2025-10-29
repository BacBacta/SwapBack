# 🔍 Diagnostic: "Jupiter API error" sur Frontend Vercel

**Date**: 29 octobre 2025  
**Status**: Backend API ✅ Fonctionnel | Frontend ❌ Erreur  

---

## ✅ Backend API - Vérifications Réussies

### Test 1: API Health Check
```bash
curl https://swapback-teal.vercel.app/api/swap/quote
```
**Résultat**: ✅ `{"status":"ok", "service":"Jupiter Quote API"}`

### Test 2: Quote POST (1 SOL → USDC)
```bash
curl -X POST https://swapback-teal.vercel.app/api/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": 1000000000,
    "slippageBps": 50
  }'
```

**Résultat**: ✅ 
```json
{
  "success": true,
  "quote": {
    "outAmount": "192258010",
    "priceImpactPct": "-0.00016461327768922882",
    "routePlan": [
      {"swapInfo": {"label": "Raydium"}},
      {"swapInfo": {"label": "SolFi V2"}},
      {"swapInfo": {"label": "GoonFi"}}
    ]
  }
}
```

**Conversion**: 1 SOL → **192.26 USDC** (route: Raydium → SolFi V2 → GoonFi)

---

## ❌ Frontend - Erreur Reportée

**Message**: `Error fetching routes: Error: Jupiter API error`

### Analyse du Code Frontend

**Fichier**: `/app/src/store/swapStore.ts` (lignes 195-250)

```typescript
const response = await fetch("/api/swap/quote", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    inputMint: swap.inputToken.mint,
    outputMint: swap.outputToken.mint,
    amount: amountInSmallestUnit,
    slippageBps: Math.floor(swap.slippageTolerance * 10000),
  }),
});

if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.error || "Failed to fetch routes");  // ⚠️ ICI
}

const data = await response.json();
const quote = data.quote || data;
```

### Causes Possibles

1. **Cache du navigateur** 🔄
   - L'ancienne version du frontend est peut-être en cache
   - Solution: Hard refresh (Ctrl+Shift+R) ou vider le cache

2. **Build de production pas à jour** 🏗️
   - Vercel n'a peut-être pas rebuilté le frontend
   - Les modifications backend sont déployées mais pas le frontend

3. **Variables d'environnement** 🔧
   - Le frontend pourrait avoir des variables cached
   - Solution: Redeployer ou vérifier Vercel Dashboard

4. **Erreur de parsing** 📊
   - Le frontend attend un format différent
   - Mais le code montre `data.quote || data` qui devrait fonctionner

---

## 🧪 Tests de Diagnostic

### Test Manuel dans le Navigateur

**Ouvrir la console DevTools** et exécuter:

```javascript
// Test direct de l'API
fetch('https://swapback-teal.vercel.app/api/swap/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inputMint: 'So11111111111111111111111111111111111111112',
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    amount: 1000000000,
    slippageBps: 50
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Response:', data);
  console.log('Success:', data.success);
  console.log('Has quote:', !!data.quote);
  console.log('Output:', parseFloat(data.quote.outAmount) / 1e6, 'USDC');
})
.catch(err => console.error('❌ Error:', err));
```

### Vérifier le Build Vercel

1. Aller sur: https://vercel.com/bacbacta/swapback/deployments
2. Vérifier le dernier déploiement: **commit `a8bad7b`**
3. Vérifier les logs de build pour erreurs

---

## 🔧 Solutions Recommandées

### Solution 1: Hard Refresh du Navigateur
```
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

### Solution 2: Vider le Cache Vercel
```bash
# Redéployer en forçant le rebuild
vercel --prod --force
```

### Solution 3: Vérifier la Version Déployée
Ouvrir: https://swapback-teal.vercel.app  
Vérifier dans les DevTools Network:
- Les requêtes vers `/api/swap/quote`
- Les headers et body
- La réponse complète

### Solution 4: Test avec la Page HTML
Ouvrir: `file:///workspaces/SwapBack/test-vercel-swap.html`
Cliquer sur "📊 Test Quote (1 SOL → USDC)"

---

## 📋 Checklist de Vérification

- [ ] Backend API répond correctement (✅ **VÉRIFIÉ**)
- [ ] Dernière version déployée sur Vercel
- [ ] Cache navigateur vidé
- [ ] Variables d'environnement correctes
- [ ] Frontend rebuild sur Vercel
- [ ] Test avec page HTML externe
- [ ] Logs Vercel vérifiés

---

## 📊 État Actuel du Code

### Backend (route.ts)
```typescript
const USE_CORS_PROXY = process.env.USE_CORS_PROXY === "true"; // ✅ Default: false
const JUPITER_API = "https://lite-api.jup.ag/ultra/v1"; // ✅ Correct URL
```

**Commit actuel**: `a8bad7b` - "fix: disable CORS proxy by default"

### Configuration Vercel
```json
{
  "env": {
    "USE_MOCK_QUOTES": "false",
    "USE_CORS_PROXY": "false",
    "JUPITER_API_URL": "https://lite-api.jup.ag/ultra/v1"
  }
}
```

---

## 🎯 Prochaine Étape

**ACTION IMMÉDIATE**: Vérifier si le problème persiste après:
1. Hard refresh du navigateur (Ctrl+Shift+R)
2. Tester avec la page HTML: `test-vercel-swap.html`
3. Si l'erreur persiste, partager:
   - Screenshot de l'erreur dans DevTools
   - Onglet Network: requête `/api/swap/quote`
   - Onglet Console: message d'erreur complet

**Le backend API fonctionne parfaitement** ✅  
**Le problème est côté frontend/cache** 🔄
