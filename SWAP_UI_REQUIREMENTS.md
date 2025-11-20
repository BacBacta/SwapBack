# 🎯 Exigences pour Fonctionnalité Swap Complètement Opérationnelle

## ✅ Corrections UI Déjà Appliquées (Déployées)

1. **Protocol Statistics** - Affichage correct des montants (9 décimales)
2. **Calcul Boost** - Formule correcte (max 20% au lieu de 100%)
3. **Buyback Allocation** - Section retirée
4. **CNFTCard** - Composant retiré du Dashboard
5. **Penalties Burned** - Affichage correct

**MAIS ces corrections sont sur `/dashboard`, pas sur la page d'accueil `/`**

---

## 🚨 Problèmes à Résoudre

### 1. **Routage et Navigation**

**Problème actuel:**
- Page d'accueil `/` → `Option3Scrollytelling` (demo/marketing)
- Dashboard `/dashboard` → `Dashboard.tsx` (avec les corrections)
- Les utilisateurs ne voient pas les corrections car ils restent sur `/`

**Solutions possibles:**

#### Option A: Rediriger `/` vers `/dashboard`
```tsx
// app/src/app/page.tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
```

#### Option B: Intégrer Dashboard dans la page d'accueil
```tsx
// app/src/app/page.tsx
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return <Dashboard />;
}
```

#### Option C: Navbar avec liens clairs
- Ajouter une navbar permanente avec:
  - Home (marketing)
  - Dashboard (app fonctionnelle)
  - Swap (/swap)
  - Lock (/lock)

---

### 2. **Interface Swap Non Intégrée au Dashboard**

**Problème actuel:**
- `EnhancedSwapInterface` existe sur `/swap`
- Dashboard a un onglet "DCA" qui affiche `SwapBackDashboard`
- Les deux ne sont pas connectés

**Ce qui manque:**
```tsx
// Dashboard.tsx ligne 323
{activeTab === "dca" && (
  <div className="space-y-6">
    <SwapBackDashboard />  // ← Devrait être EnhancedSwapInterface
  </div>
)}
```

**Solution:**
```tsx
// Dashboard.tsx
import { EnhancedSwapInterface } from "./EnhancedSwapInterface";

// Dans le render:
{activeTab === "dca" && (
  <div className="space-y-6">
    <EnhancedSwapInterface />
  </div>
)}
```

---

### 3. **Données en Temps Réel**

**Fonctionnalités requises:**

#### A. WebSocket pour Prix en Temps Réel
```typescript
// hooks/useSwapWebSocket.ts existe déjà
// Vérifier qu'il est bien activé dans EnhancedSwapInterface
```

#### B. Refresh Global State
```typescript
// Dashboard.tsx ligne 34
const { globalState, isLoading, refresh: refreshGlobalState } = useGlobalState();

// Auto-refresh toutes les 5 minutes (déjà implémenté)
useEffect(() => {
  const interval = setInterval(() => {
    refreshGlobalState();
  }, 5 * 60 * 1000); // 5 min
  return () => clearInterval(interval);
}, [refreshGlobalState]);
```

#### C. Rafraîchissement après Actions
```typescript
// Après lock/unlock/swap:
refreshGlobalState();
refresh(); // useRealtimeStats
refreshNpiBalance();
```

---

### 4. **État du Wallet et Connexion**

**Requis:**
- Solana Wallet Adapter configuré ✅ (déjà fait)
- Connection Provider ✅ (déjà fait)
- Gestion des erreurs de connexion ✅ (déjà fait)

---

### 5. **Programme Solana Déployé**

**Vérifications:**
```bash
# Program ID correct dans env vars
NEXT_PUBLIC_CNFT_PROGRAM_ID=DGDipfpHGVAnWXj7yPEBc3JYFWghQN76tEBzuK2Nojw3

# BACK Token correct
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux

# Collection Config initialisé
NEXT_PUBLIC_COLLECTION_CONFIG=8EoDB3TGsTytD4AFz5GyRYwvqoP8NB6tWpa2cVJQGtM7
```

**Programme déployé:** ✅
- Program: DGDipfpHGVAnWXj7yPEBc3JYFWghQN76tEBzuK2Nojw3
- back_mint writable: ✅ (commit cc6e259)
- GlobalState initialisé: ✅
- collection_config: ✅
- vault_token_account: ✅
- buyback_wallet: ✅

---

### 6. **IDL Synchronisé**

**Status:** ✅ Synchronisé
- `target/idl/swapback_cnft.json` (source)
- `app/src/idl/swapback_cnft.json` (frontend)
- `app/public/idl/swapback_cnft.json` (fallback)

**Dernière mise à jour:** Commit 38c10c6 (corrections UI)

---

### 7. **Variables d'Environnement Vercel**

**À vérifier sur Vercel Dashboard:**

```bash
# Production Environment Variables
NEXT_PUBLIC_CNFT_PROGRAM_ID=DGDipfpHGVAnWXj7yPEBc3JYFWghQN76tEBzuK2Nojw3
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_COLLECTION_CONFIG=8EoDB3TGsTytD4AFz5GyRYwvqoP8NB6tWpa2cVJQGtM7
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
```

**ATTENTION:** L'utilisateur a mentionné que `NEXT_PUBLIC_CNFT_PROGRAM_ID` était défini à `862PQyz...` (BACK mint) au lieu de `DGDipf...` (program). **Ceci DOIT être corrigé sur Vercel!**

---

## 📋 PLAN D'ACTION POUR RENDRE TOUT OPÉRATIONNEL

### Phase 1: Navigation et Routage (Immédiat)

1. **Décider de l'architecture de navigation:**
   - Rediriger `/` vers `/dashboard` ?
   - OU créer une vraie navbar avec liens clairs ?

2. **Intégrer EnhancedSwapInterface dans Dashboard:**
   ```tsx
   // Dashboard.tsx - remplacer SwapBackDashboard par EnhancedSwapInterface
   ```

### Phase 2: Variables d'Environnement (Critique)

3. **Corriger les env vars sur Vercel:**
   ```bash
   # Sur Vercel Dashboard → Settings → Environment Variables
   NEXT_PUBLIC_CNFT_PROGRAM_ID=DGDipfpHGVAnWXj7yPEBc3JYFWghQN76tEBzuK2Nojw3
   # PAS 862PQyz... (c'est le MINT, pas le PROGRAM!)
   ```

4. **Redéployer après modification env vars**

### Phase 3: Tests Fonctionnels (Validation)

5. **Tester Lock:**
   - Montant affiché correctement (pas × 1000)
   - Boost calculé correctement (max 20%)
   - Transaction réussie

6. **Tester Unlock:**
   - Pénalité 2% correcte si early unlock
   - Tokens brûlés correctement
   - Montant reçu correct

7. **Tester Swap:**
   - Routes trouvées
   - Prix corrects
   - Transaction exécutée

8. **Vérifier Analytics:**
   - Protocol Statistics (TVL correct)
   - Penalties Burned (valeur correcte)
   - No Buyback Allocation section
   - No CNFTCard

### Phase 4: Documentation Utilisateur (Optionnel)

9. **Créer guide utilisateur:**
   - Comment accéder au Dashboard
   - Comment lock/unlock
   - Comment swap
   - Explication du boost

---

## 🎯 CHECKLIST FINALE

### Backend (Solana)
- [x] Programme CNFT déployé avec back_mint writable
- [x] GlobalState initialisé
- [x] collection_config créé
- [x] vault_token_account créé
- [x] buyback_wallet configuré (Token-2022 ATA)
- [x] BACK Token (Token-2022) avec 9 decimals

### Frontend (Next.js)
- [x] IDL synchronisé (target → src/idl → public/idl)
- [x] LAMPORTS_PER_BACK = 1_000_000_000 (9 decimals)
- [x] Boost formula correcte (max 20%)
- [x] Buyback Allocation section retirée
- [x] CNFTCard retiré du Dashboard
- [x] Penalties burned affichage correct
- [ ] **EnhancedSwapInterface intégré dans Dashboard**
- [ ] **Navigation claire (/ → /dashboard ou navbar)**

### Déploiement
- [x] Build réussi (commit 38c10c6)
- [x] Déployé sur Vercel
- [ ] **Variables d'environnement Vercel CORRECTES**
  - ⚠️ NEXT_PUBLIC_CNFT_PROGRAM_ID incorrecte (mint au lieu de program)
- [ ] **Test end-to-end sur production**

---

## 🚀 PROCHAINE ÉTAPE IMMÉDIATE

**Action prioritaire:**
1. Corriger `NEXT_PUBLIC_CNFT_PROGRAM_ID` sur Vercel
2. Intégrer `EnhancedSwapInterface` dans l'onglet DCA du Dashboard
3. Décider si `/` doit rediriger vers `/dashboard` ou afficher le Dashboard directement

**Commande pour tester localement:**
```bash
cd /workspaces/SwapBack/app
npm run dev
# Ouvrir http://localhost:3000/dashboard
# Vérifier que toutes les corrections sont visibles
```
