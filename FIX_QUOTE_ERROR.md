# Fix: Failed to fetch quote ✅

## Problème
L'interface swap affichait l'erreur : `[ERROR] Failed to fetch quote`

## Cause
L'API `/api/swap/quote` en mode MOCK retournait directement l'objet quote sans la structure attendue par le frontend :
```typescript
// ❌ AVANT (ligne 67)
if (USE_MOCK_DATA) {
  const mockQuote = generateMockQuote(...);
  return NextResponse.json(mockQuote);  // Manque success: true
}
```

Le frontend attendait :
```typescript
interface QuoteResponse {
  success: boolean;  // ← Manquant !
  quote?: QuoteData;
  routeInfo?: RouteInfo;
  error?: string;
}
```

## Solution
Wrapper la réponse MOCK avec la même structure que Jupiter V6 :
```typescript
// ✅ APRÈS (ligne 67)
if (USE_MOCK_DATA) {
  const mockQuote = generateMockQuote(...);
  const mockRouteInfo = parseRouteInfo(mockQuote);
  
  return NextResponse.json({
    success: true,      // ← Ajouté
    quote: mockQuote,   // ← Wrapped
    routeInfo: mockRouteInfo,  // ← Ajouté
    timestamp: Date.now(),
  });
}
```

## Test
```bash
# Test API
curl -X POST http://localhost:3001/api/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": 1000000000,
    "slippageBps": 50
  }'

# Résultat attendu
{
  "success": true,  ✅
  "quote": {
    "outAmount": "150000000000",
    ...
  },
  "routeInfo": { ... },
  "timestamp": 1729890123456
}
```

## Résultat
- ✅ API quote retourne `success: true`
- ✅ Frontend peut parser la réponse
- ✅ Interface swap affiche les montants correctement
- ✅ Serveur démarré sur http://localhost:3001

## Fichier modifié
- `/app/src/app/api/swap/quote/route.ts` (lignes 64-73)

## Date
25 octobre 2025
