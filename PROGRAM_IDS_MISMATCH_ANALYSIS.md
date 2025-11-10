# 🔴 CRITIQUES: Program IDs Mismatch Entre Rust et Frontend

## Tableau Comparatif

| Programme | Rust declare_id | IDL address | Frontend Fallback | Status |
|-----------|-----------------|-------------|------------------|--------|
| **CNFT** | `FsD6D5yakUipRtFXXbgBf5YaE1ABVEocFDTLB3z2MxnB` | `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq` | `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq` | ❌ MISMATCH |
| **Router** | `opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx` | `BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz` | `GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt` | ❌ TRIPLE MISMATCH |

## Problème

Lorsque le Dashboard essaie d'interagir avec ces programmes:
1. Il envoie les transactions avec l'ID `GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt` pour Router
2. Mais le **programme réellement déployé** a l'ID `opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx`
3. Solana rejette la transaction avec une erreur comme:
   - `ProgramNotFound`
   - `AccountOwnedByWrongProgram`
   - Ou un crash silencieux côté client

Même issue pour le CNFT.

## Fichiers Frontend à Corriger

### 1. `app/src/components/SwapBackDashboard.tsx` (ligne 19)
```typescript
// ❌ AVANT
"GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt"

// ✅ APRÈS
"opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx"
```

### 2. `app/src/components/SwapBackInterface.tsx` (ligne 18)
```typescript
// ❌ AVANT
process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt"

// ✅ APRÈS
process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx"
```

### 3. `app/src/config/constants.ts` (ligne 13)
```typescript
// ❌ AVANT
'GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt'

// ✅ APRÈS
'opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx'
```

### 4. `app/src/config/tokens.ts` (ligne 16)
```typescript
// ❌ AVANT
router: "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt",

// ✅ APRÈS
router: "opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx",
```

### 5. `app/src/config/testnet.ts` (ligne 43)
```typescript
// ❌ AVANT
process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt"

// ✅ APRÈS
process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx"
```

### 6. `app/src/lib/lockTokens.ts`
Vérifier que la fonction `getCnftProgramId()` retourne le bon ID

### 7. `app/src/lib/cnft.ts`
Vérifier que les appels utilisent le bon ID

## Fichiers IDL à Corriger

### `app/src/idl/swapback_router.json`
```json
// ❌ AVANT
"address": "BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz",

// ✅ APRÈS
"address": "opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx",
```

### `app/src/idl/swapback_cnft.json`
```json
// ❌ AVANT
"address": "9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq",

// ✅ APRÈS  
"address": "FsD6D5yakUipRtFXXbgBf5YaE1ABVEocFDTLB3z2MxnB",
```

## Variable d'Environnement Vercel

À mettre à jour dans les secrets Vercel:

```env
NEXT_PUBLIC_ROUTER_PROGRAM_ID=opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx
NEXT_PUBLIC_CNFT_PROGRAM_ID=FsD6D5yakUipRtFXXbgBf5YaE1ABVEocFDTLB3z2MxnB
```

## Vérification des Déploiements Réels

Pour confirmer les vraies adresses déployées sur devnet:

```bash
# CNFT Program
solana program show FsD6D5yakUipRtFXXbgBf5YaE1ABVEocFDTLB3z2MxnB -um devnet

# Router Program
solana program show opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx -um devnet
```

## Impact

Cette correction devrait résoudre:
- ✅ L'erreur client-side exception
- ✅ Les transactions rejetées par Solana
- ✅ Le Dashboard ne chargeant pas

---
**Créé**: 10 Nov 2025  
**Criticalité**: 🔴 CRITIQUE - Sans correction, aucune interaction on-chain ne fonctionne
