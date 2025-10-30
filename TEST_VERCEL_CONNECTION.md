# 🔍 Test de Connexion Vercel - Frontend ↔ Backend

## Problème Identifié

L'application est déployée sur Vercel, les variables sont configurées, mais la recherche de routes ne s'active pas.

## ✅ Vérifications Effectuées (Code)

### 1. **Frontend → Store Connection** ✅
- `EnhancedSwapInterface.tsx` utilise `useSwapStore()` correctement (ligne 30)
- `fetchRoutes` est bien extrait du store (ligne 37)
- `handleSearchRoute()` appelle bien `fetchRoutes()` (ligne 118)

### 2. **Input → Store Connection** ✅
- Input HTML lie `swap.inputAmount` (ligne 265)
- `onChange` appelle `handleInputChange()` (ligne 266)
- `handleInputChange()` appelle `setInputAmount()` du store (ligne 81-82)

### 3. **Button Connection** ✅
- Button `onClick={handleSearchRoute}` (ligne 449)
- Texte changé: "🔍 Search Route" (ligne 470)
- Conditions: `connected && inputToken && outputToken && inputAmount > 0` (ligne 450)

### 4. **Store → API Connection** ✅
- `fetchRoutes()` fait un `fetch("/api/swap/quote")` (ligne 207 swapStore.ts)
- Logs ajoutés pour debug (lignes 183-290 swapStore.ts)

## 🧪 Tests à Faire sur Vercel

### Test 1: Vérifier que l'API existe

```bash
# Remplacer VOTRE-APP par votre URL Vercel
curl -X POST https://VOTRE-APP.vercel.app/api/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR",
    "amount": 1000000000,
    "slippageBps": 50
  }'
```

**Résultat attendu**: JSON avec `"success": true` et `"quote": {...}`

**Si erreur 404**: L'API route n'existe pas ou n'est pas déployée
**Si erreur 500**: Problème de variables d'environnement ou code

### Test 2: Vérifier les logs dans la console du navigateur

1. Ouvrir l'app Vercel dans le navigateur
2. Ouvrir la console (F12 > Console)
3. Sélectionner SOL et USDC
4. Entrer un montant (ex: 1)
5. Cliquer sur "🔍 Search Route"

**Logs attendus**:
```
🔘 handleSearchRoute clicked { inputToken: "SOL", outputToken: "USDC", ... }
✅ Conditions met - calling fetchRoutes()
🔄 fetchRoutes: Starting route search
📤 fetchRoutes: Sending request to /api/swap/quote
✅ fetchRoutes: Received data from API
🎯 fetchRoutes: Route created
💰 fetchRoutes: Setting output amount
✅ fetchRoutes: State updated successfully
```

**Si vous voyez**:
- `⚠️ Conditions NOT met`: Le bouton ne peut pas lancer la recherche
- `❌ fetchRoutes: API error`: L'API retourne une erreur
- Pas de logs du tout: Le bouton n'est pas cliqué (problème UI/UX)

### Test 3: Vérifier les variables d'environnement sur Vercel

Dashboard Vercel > Settings > Environment Variables

**Variables REQUISES**:
```bash
# API
JUPITER_API_URL=https://quote-api.jup.ag/v6
USE_MOCK_QUOTES=false  # ⚠️ Important!

# Network
NEXT_PUBLIC_SOLANA_NETWORK=testnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.testnet.solana.com

# Program IDs
NEXT_PUBLIC_ROUTER_PROGRAM_ID=GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
NEXT_PUBLIC_CNFT_PROGRAM_ID=9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw

# Tokens
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR
```

⚠️ **APRÈS avoir ajouté/modifié des variables, REDÉPLOYER** !

### Test 4: Vérifier les logs Vercel Functions

1. Dashboard Vercel > Deployments
2. Cliquer sur le dernier déploiement
3. Onglet "Functions"
4. Chercher `/api/swap/quote`
5. Voir les logs d'exécution

**Chercher**:
- Erreurs de timeout
- Erreurs "Cannot read property..."
- Erreurs Jupiter API
- Variables undefined

## 🐛 Problèmes Possibles et Solutions

### Problème 1: Le bouton est grisé (disabled)

**Causes**:
- ❌ Wallet non connecté
- ❌ Token input non sélectionné
- ❌ Token output non sélectionné
- ❌ Montant = 0 ou vide
- ❌ Chargement en cours

**Solution**: Vérifier que toutes les conditions sont remplies

**Debug**:
```javascript
// Dans la console du navigateur
const store = window.__ZUSTAND_STORE__?.getState();
console.log({
  inputToken: store?.swap?.inputToken,
  outputToken: store?.swap?.outputToken,
  inputAmount: store?.swap?.inputAmount,
});
```

### Problème 2: Le bouton est cliquable mais rien ne se passe

**Causes possibles**:
- ❌ `fetchRoutes` non défini
- ❌ CORS bloque la requête
- ❌ API endpoint n'existe pas (404)
- ❌ Erreur silencieuse (catch sans log)

**Solution**: Vérifier les logs de la console

**Debug**: Les logs ajoutés montreront exactement où ça bloque

### Problème 3: API retourne une erreur

**Erreurs possibles**:

#### A. `USE_MOCK_QUOTES` non défini
```
Error: Cannot read property 'USE_MOCK_QUOTES' of undefined
```
**Solution**: Ajouter `USE_MOCK_QUOTES=false` sur Vercel et redéployer

#### B. Jupiter API timeout
```
Error: Request timeout
```
**Solution**: 
- Vérifier que Vercel peut accéder à `quote-api.jup.ag`
- Temporairement mettre `USE_MOCK_QUOTES=true`

#### C. RPC endpoint invalide
```
Error: Failed to connect to RPC
```
**Solution**: Vérifier `NEXT_PUBLIC_SOLANA_RPC_URL`

### Problème 4: Routes trouvées mais pas affichées

**Cause**: State Zustand pas synchronisé avec UI

**Debug**:
```javascript
// Console du navigateur
window.__ZUSTAND_STORE__?.getState()?.routes
```

**Solution**: Vérifier que `routes.selectedRoute` est bien défini

## 🚀 Modifications Appliquées (Dernier commit)

### 1. Logs de Debug Ajoutés

**Fichier**: `app/src/components/EnhancedSwapInterface.tsx` (ligne 111-127)
```typescript
const handleSearchRoute = () => {
  console.log("🔘 handleSearchRoute clicked", { ... });
  // ... logs détaillés
};
```

**Fichier**: `app/src/store/swapStore.ts` (ligne 183-290)
```typescript
fetchRoutes: async () => {
  console.log("🔄 fetchRoutes: Starting route search", { ... });
  console.log("📤 fetchRoutes: Sending request", { ... });
  console.log("✅ fetchRoutes: Received data", { ... });
  // ... logs détaillés
};
```

### 2. Bouton Texte Amélioré

**Avant**: "Review Swap"
**Après**: "🔍 Search Route" (plus clair)

### 3. Auto-fetch Désactivé

Pour éviter les boucles infinies, l'utilisateur doit **cliquer manuellement** sur le bouton.

## 📋 Checklist Action Immédiate

1. [ ] **Ouvrir l'app Vercel** dans le navigateur
2. [ ] **Ouvrir la console** (F12)
3. [ ] **Connecter le wallet**
4. [ ] **Sélectionner SOL** comme input
5. [ ] **Sélectionner USDC** comme output
6. [ ] **Entrer 1** comme montant
7. [ ] **Cliquer** sur "🔍 Search Route"
8. [ ] **Copier les logs** de la console
9. [ ] **Me les partager**

## 📞 Informations Nécessaires

Pour diagnostiquer, j'ai besoin de :

1. **URL de votre déploiement Vercel** (ex: `https://swap-back-xyz.vercel.app`)
2. **Screenshot des variables d'environnement** (Settings > Environment Variables)
3. **Logs de la console du navigateur** après avoir cliqué sur "Search Route"
4. **Comportement observé**:
   - Le bouton est-il cliquable ?
   - Change-t-il de texte au clic ?
   - Y a-t-il un spinner de chargement ?
   - Des erreurs apparaissent-elles ?

## 🔧 Si Tout Échoue - Solution de Secours

Tester avec MOCK data pour isoler le problème :

```bash
# Sur Vercel, changer temporairement:
USE_MOCK_QUOTES=true
```

Puis redéployer. Si ça fonctionne avec MOCK:
- ✅ Frontend ↔ Backend connecté
- ❌ Problème avec Jupiter API ou RPC

Si ça ne fonctionne pas même avec MOCK:
- ❌ Problème de code ou de déploiement
