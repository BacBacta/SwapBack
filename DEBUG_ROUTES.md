# 🔍 Guide de Débogage - Détection des Routes

**Date**: 29 octobre 2025  
**Problème**: L'option de détection des routes ne fonctionne pas sur Vercel

## 📋 Checklist de Vérification

### 1. **Vérifier les Variables d'Environnement sur Vercel**

Dans le Dashboard Vercel (Settings > Environment Variables), assurez-vous d'avoir :

```bash
# REQUIS - API Configuration
JUPITER_API_URL=https://quote-api.jup.ag/v6
USE_MOCK_QUOTES=false  # Important: false pour production!

# REQUIS - Network
NEXT_PUBLIC_SOLANA_NETWORK=testnet  # ou mainnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.testnet.solana.com

# REQUIS - Program IDs
NEXT_PUBLIC_ROUTER_PROGRAM_ID=GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
NEXT_PUBLIC_CNFT_PROGRAM_ID=9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw

# REQUIS - Tokens
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR
```

⚠️ **ATTENTION**: Après avoir ajouté/modifié des variables, vous DEVEZ redéployer !

```bash
vercel --prod  # Redéployer en production
```

### 2. **Vérifier les Logs dans la Console du Navigateur**

Ouvrez la console (F12 > Console) et cherchez ces messages :

#### ✅ Logs Attendus (Succès)
```
🔄 fetchRoutes: Starting route search { inputToken: "SOL", outputToken: "USDC", ... }
📤 fetchRoutes: Sending request to /api/swap/quote { inputMint: "So111...", ... }
✅ fetchRoutes: Received data from API { hasQuote: true, isMock: false, ... }
🎯 fetchRoutes: Route created { id: "route_...", venues: ["Orca"], ... }
💰 fetchRoutes: Setting output amount { rawAmount: "...", formattedAmount: 150.5 }
✅ fetchRoutes: State updated successfully
```

#### ❌ Logs d'Erreur Possibles

**Erreur 1: Variables manquantes**
```
⚠️ fetchRoutes: Missing required fields
```
→ **Solution**: Vérifier que vous avez sélectionné les tokens et entré un montant

**Erreur 2: API endpoint introuvable**
```
❌ fetchRoutes: API error { status: 404, ... }
```
→ **Solution**: Vérifier que le fichier `/app/src/app/api/swap/quote/route.ts` existe

**Erreur 3: CORS ou Network error**
```
❌ fetchRoutes: Error occurred { error: "Failed to fetch" }
```
→ **Solution**: Problème réseau ou CORS. Vérifier l'URL de déploiement.

**Erreur 4: Jupiter API bloquée**
```
❌ Error calling Jupiter API { error: "Could not resolve host" }
```
→ **Solution**: Mettre `USE_MOCK_QUOTES=true` temporairement

### 3. **Tester l'API Directement**

#### Test Local (Codespaces)
```bash
curl -X POST http://localhost:3000/api/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR",
    "amount": 1000000000,
    "slippageBps": 50
  }'
```

**Résultat attendu**: JSON avec `"success": true` et `"quote": { ... }`

#### Test Vercel (Production)
```bash
curl -X POST https://VOTRE-APP.vercel.app/api/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR",
    "amount": 1000000000,
    "slippageBps": 50
  }'
```

### 4. **Vérifier les Logs Vercel**

1. Aller sur https://vercel.com/dashboard
2. Sélectionner votre projet
3. Onglet **Deployments** > Cliquer sur le dernier déploiement
4. Onglet **Functions** > Cliquer sur `/api/swap/quote`
5. Voir les logs d'exécution

**Chercher**:
- Erreurs de timeout
- Erreurs Jupiter API
- Variables d'environnement manquantes

### 5. **Problèmes Courants et Solutions**

#### Problème: "No routes found"
**Causes possibles**:
1. `USE_MOCK_QUOTES` est sur `true` mais le code MOCK a un bug
2. Jupiter API ne retourne rien (paire de tokens invalide)
3. Montant trop petit ou trop grand

**Solutions**:
```bash
# Option 1: Activer MOCK temporairement
USE_MOCK_QUOTES=true

# Option 2: Tester avec des tokens standards
SOL → USDC (paire très liquide)

# Option 3: Vérifier le montant (en lamports)
# 1 SOL = 1,000,000,000 lamports
```

#### Problème: Routes trouvées mais pas affichées
**Cause**: State Zustand pas mis à jour

**Vérifier dans la console**:
```javascript
// Dans la console du navigateur
window.__ZUSTAND_STORE__?.getState()?.routes
```

**Solution**: Vérifier que `selectedRoute` et `routes` sont bien dans le state

#### Problème: Button "Rechercher Route" grisé
**Cause**: Conditions non remplies

**Vérifier**:
1. Token input sélectionné ✓
2. Token output sélectionné ✓
3. Montant > 0 ✓
4. Pas de chargement en cours ✓

### 6. **Test Complet - Procédure Pas à Pas**

1. **Ouvrir l'application** (Vercel ou local)
2. **Ouvrir la console** (F12)
3. **Sélectionner SOL** comme token input
4. **Sélectionner USDC** comme token output
5. **Entrer 1** dans le montant
6. **Attendre 800ms** (debounce automatique)
7. **Vérifier les logs** dans la console

**Résultat attendu**: Routes affichées après ~1-2 secondes

### 7. **Configuration Recommandée**

#### Pour Testnet (Preview)
```bash
JUPITER_API_URL=https://quote-api.jup.ag/v6
USE_MOCK_QUOTES=false  # Utiliser vraie API Jupiter
NEXT_PUBLIC_SOLANA_NETWORK=testnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.testnet.solana.com
```

#### Pour Développement (Codespaces)
```bash
USE_MOCK_QUOTES=true  # DNS restriction dans Codespaces
NEXT_PUBLIC_SOLANA_NETWORK=testnet
```

#### Pour Production (Mainnet)
```bash
JUPITER_API_URL=https://quote-api.jup.ag/v6
USE_MOCK_QUOTES=false
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_URL=https://VOTRE-RPC-PREMIUM.com
```

## 🚀 Actions Immédiates

1. ✅ **Logs ajoutés** dans `swapStore.ts` (ligne 183-280)
2. ⏳ **Recharger l'application** sur Vercel
3. ⏳ **Ouvrir la console** du navigateur
4. ⏳ **Faire un test** de recherche de route
5. ⏳ **Copier les logs** et me les partager

## 📞 Prochaines Étapes

Si les routes ne fonctionnent toujours pas :

1. **Partager les logs** de la console du navigateur
2. **Partager l'URL** de votre déploiement Vercel
3. **Confirmer les variables** d'environnement configurées
4. **Tester l'API** directement avec curl

---

**Dernier update**: Logs détaillés ajoutés pour diagnostic complet
