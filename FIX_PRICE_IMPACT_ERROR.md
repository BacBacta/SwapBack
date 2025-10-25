# Fix: priceImpactPct.toFixed is not a function ✅

## Problème

Erreur runtime dans le navigateur :
```
TypeError: routeInfo.priceImpactPct.toFixed is not a function
Source: src/components/EnhancedSwapInterface.tsx (690:61)
```

## Cause

La fonction `generateMockQuote` retournait `priceImpactPct` comme **string** (ligne 191) :

```typescript
// ❌ AVANT
priceImpactPct: priceImpact.toFixed(4),  // String: "0.0100"
```

L'interface TypeScript définissait `priceImpactPct` comme **number** :

```typescript
interface RouteInfo {
  priceImpactPct: number;  // ← Type attendu
  ...
}
```

Mais l'API retournait une string, causant l'erreur `.toFixed()` sur une string.

## Solutions appliquées

### 1. Conversion dans parseRouteInfo (API)

```typescript
// ✅ APRÈS (/app/src/app/api/swap/quote/route.ts)
function parseRouteInfo(quote: any) {
  // Convert priceImpactPct to number if it's a string
  const priceImpact = typeof quote.priceImpactPct === 'string' 
    ? parseFloat(quote.priceImpactPct) 
    : (quote.priceImpactPct || 0);

  return {
    ...
    priceImpactPct: priceImpact,  // ← Toujours un number
    ...
  };
}
```

### 2. Helper function dans le composant (Frontend)

```typescript
// ✅ AJOUTÉ (/app/src/components/EnhancedSwapInterface.tsx)
const getPriceImpact = (routeInfo: RouteInfo | null): number => {
  if (!routeInfo) return 0;
  const impact = routeInfo.priceImpactPct;
  return typeof impact === 'string' ? parseFloat(impact) : (impact || 0);
};
```

### 3. Utilisation sécurisée

```typescript
// ❌ AVANT
{routeInfo.priceImpactPct.toFixed(3)}%

// ✅ APRÈS
{getPriceImpact(routeInfo).toFixed(3)}%
```

## Fichiers modifiés

1. `/app/src/app/api/swap/quote/route.ts` (lignes 141-169)
   - Conversion string → number dans `parseRouteInfo()`

2. `/app/src/components/EnhancedSwapInterface.tsx`
   - Ligne 111-115 : Helper `getPriceImpact()`
   - Ligne 690 : Utilisation dans affichage Price Impact
   - Ligne 713 : Utilisation dans condition warning
   - Ligne 879 : Utilisation dans stats

## Test

```bash
# API retourne maintenant un nombre
curl -X POST http://localhost:3001/api/swap/quote \
  -d '{"inputMint": "So11...", "outputMint": "EPjF...", "amount": 1000000000}' \
  | grep priceImpactPct

# Résultat
"priceImpactPct": 0.01  ✅ (number, pas string)
```

## Résultat

- ✅ Plus d'erreur `toFixed is not a function`
- ✅ Type safety améliorée (string → number conversion)
- ✅ Interface affiche correctement le price impact
- ✅ Warnings (high impact) fonctionnent
- ✅ Double protection (API + Frontend)

## Date

25 octobre 2025
