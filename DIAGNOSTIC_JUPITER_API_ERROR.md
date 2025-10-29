# 🔍 Diagnostic - Erreur "Jupiter API error" persistante

**Date**: 29 octobre 2025  
**Statut**: ❌ EN COURS

## Résumé du problème

L'application déployée sur Vercel retourne systématiquement l'erreur **"Jupiter API error"** malgré :
1. ✅ L'API Jupiter Ultra fonctionnant parfaitement en direct
2. ✅ Le code backend corrigé (paramètres invalides supprimés)
3. ✅ Plusieurs commits et redéploiements effectués

## Tests effectués

### Test 1: API Jupiter Ultra en direct ✅
```bash
curl "https://lite-api.jup.ag/ultra/v1/order?inputMint=So11111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000&slippageBps=50"
```
**Résultat**: `{"outAmount": "195346828", ...}` → **195.35 USDC** ✅

### Test 2: API Vercel ❌
```bash
curl -X POST "https://swapback-teal.vercel.app/api/swap/quote" \
  -H "Content-Type: application/json" \
  -d '{"inputMint":"So11111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","amount":1000000000,"slippageBps":50}'
```
**Résultat**: `{"error": "Jupiter API error"}` ❌

## Commits déployés

1. **d0e75c2** - chore: force frontend rebuild with timestamp
2. **1693e26** - fix: remove unsupported Jupiter Ultra API parameters
   - ✅ Suppression de `onlyDirectRoutes` (non supporté)
   - ✅ Suppression de `swapMode` (non nécessaire)
   - ✅ Garde seulement: `inputMint`, `outputMint`, `amount`, `slippageBps`

## Code actuel

### `/app/src/app/api/swap/quote/route.ts` (lignes 78-84)
```typescript
// Build Jupiter Ultra API URL
// Supported params: inputMint, outputMint, amount, slippageBps, taker, referralAccount, excludeRouters, excludeDexes
const params = new URLSearchParams({
  inputMint,
  outputMint,
  amount: Math.floor(parsedAmount).toString(),
  slippageBps: slippageBps.toString(),
});
```

### Configuration Vercel (`/vercel.json`)
```json
{
  "env": {
    "JUPITER_API_URL": "https://lite-api.jup.ag/ultra/v1",
    "USE_CORS_PROXY": "false",
    "USE_MOCK_QUOTES": "false"
  }
}
```

## Hypothèses

### Hypothèse 1: Vercel n'a pas déployé le dernier commit ⏳
- **Probabilité**: MOYENNE
- **Test**: Attendre 2-3 minutes après le push
- **Solution**: Force redeploy via Vercel Dashboard

### Hypothèse 2: Cache Edge de Vercel ⚠️
- **Probabilité**: ÉLEVÉE
- **Description**: Les routes API peuvent être cachées par le CDN de Vercel
- **Solution**: Purger le cache via Vercel Dashboard ou CLI

### Hypothèse 3: Problème de build sur Vercel ❓
- **Probabilité**: FAIBLE
- **Test**: Vérifier les logs de build Vercel
- **Solution**: Redéployer en forçant un nouveau build

### Hypothèse 4: Variable d'environnement non propagée 🔧
- **Probabilité**: FAIBLE
- **Description**: `JUPITER_API_URL` pourrait ne pas être défini correctement
- **Solution**: Vérifier dans Vercel Dashboard → Settings → Environment Variables

## Prochaines étapes

1. **URGENT**: Vérifier le déploiement actuel sur Vercel Dashboard
   - Commit hash déployé
   - Logs de build
   - Variables d'environnement

2. **Si nécessaire**: Purger le cache Edge Vercel
   ```bash
   vercel --force  # Forcer un nouveau build
   ```

3. **Alternative**: Ajouter des logs détaillés dans le backend pour diagnostiquer
   ```typescript
   console.log("🔗 Jupiter URL:", quoteUrl);
   console.log("📦 Response status:", response.status);
   console.log("📄 Response body:", errorText);
   ```

4. **Tester** après chaque action avec:
   ```bash
   curl -X POST "https://swapback-teal.vercel.app/api/swap/quote" \
     -H "Content-Type: application/json" \
     -d '{"inputMint":"So11111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","amount":1000000000,"slippageBps":50}' \
     | jq '.'
   ```

## Conclusion temporaire

Le problème persiste malgré les corrections apportées au code. **L'origine semble être liée au déploiement Vercel plutôt qu'au code lui-même**, car :
- ✅ L'API Jupiter fonctionne en direct
- ✅ Le code a été corrigé et commité
- ❌ Vercel continue de retourner l'erreur

**ACTION IMMÉDIATE**: Vérifier le statut du déploiement Vercel et forcer un nouveau build si nécessaire.
