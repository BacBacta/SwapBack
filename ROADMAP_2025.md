# 🚀 SwapBack - Roadmap Stratégique 2025
**Status:** ✅ Tests E2E 12/12 | Buyback System Validé  
**Dernière mise à jour:** 31 Octobre 2025

---

## 📊 Vue d'Ensemble

```
PHASE 1          PHASE 2           PHASE 3          PHASE 4
[ACTUEL]         [1-2 SEM]         [2-3 SEM]        [1 SEM]
   │                │                 │               │
   ├─ Tests OK     ├─ Dashboard      ├─ Audit        ├─ Mainnet
   ├─ Devnet ✅    ├─ UX Polish      ├─ Load Tests   ├─ Liquidité
   └─ E2E Pass     └─ Analytics      └─ Monitoring   └─ Launch
```

---

## 🎯 PHASE 1 : Intégration Buyback (URGENT - 3-5 jours)

### 🔴 **Tâche #1 : Auto-Deposit 25% Fees USDC**
**Priority:** P0 - Critique  
**Estimation:** 1-2 jours  
**Assigné à:** Core Team

#### Objectif
Après chaque swap réussi, déposer automatiquement 25% des fees USDC collectées dans le buyback vault.

#### Implémentation

**1. Modifier SwapExecutor (`app/src/lib/swapExecutor.ts`)**
```typescript
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';

async function executeSwapWithBuyback(params: SwapParams) {
  // 1. Exécuter le swap
  const swapResult = await executeSwap(params);
  
  // 2. Calculer 25% des fees
  const feeAmount = Math.floor(swapResult.fee * 0.25);
  
  // 3. Si montant suffisant, déposer dans buyback vault
  if (feeAmount >= 1_000_000) { // Min 1 USDC
    try {
      const buybackSig = await depositToBuybackVault(
        params.wallet,
        new BN(feeAmount)
      );
      console.log(`✅ Buyback deposit: ${buybackSig}`);
    } catch (error) {
      console.error('⚠️ Buyback deposit failed:', error);
      // Non-bloquant : le swap a réussi quand même
    }
  }
  
  return {
    ...swapResult,
    buybackDeposit: feeAmount >= 1_000_000 ? feeAmount : null,
  };
}

async function depositToBuybackVault(wallet, amount: BN) {
  const program = await loadBuybackProgram();
  
  return await program.methods
    .depositUsdc(amount)
    .accounts({
      buybackState: BUYBACK_STATE_PDA,
      userUsdcAccount: await getAssociatedTokenAddress(
        USDC_MINT,
        wallet.publicKey
      ),
      usdcVault: USDC_VAULT_PDA,
      user: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}
```

**2. Mettre à jour l'API Route (`app/src/app/api/execute/route.ts`)**
```typescript
export async function POST(request: Request) {
  const { serializedTransaction, wallet } = await request.json();
  
  // Exécuter swap avec buyback
  const result = await executeSwapWithBuyback({
    transaction: deserializeTransaction(serializedTransaction),
    wallet,
  });
  
  return Response.json({
    signature: result.signature,
    fee: result.fee,
    buybackDeposit: result.buybackDeposit, // Nouveau champ
  });
}
```

**3. Afficher dans l'UI (`app/src/components/SwapInterface.tsx`)**
```typescript
{result.buybackDeposit && (
  <div className="mt-2 p-2 bg-green-50 rounded">
    <p className="text-sm text-green-700">
      ✅ {(result.buybackDeposit / 1e6).toFixed(2)} USDC déposés pour le buyback
    </p>
  </div>
)}
```

#### Tests
**Créer:** `tests/e2e/swap-with-buyback.test.ts`
```typescript
it('should deposit 25% fees to buyback vault after swap', async () => {
  const swapAmount = 100 * 1e6; // 100 USDC
  const expectedFee = swapAmount * 0.003; // 0.3 USDC (0.3% fee)
  const expectedDeposit = expectedFee * 0.25; // 0.075 USDC
  
  const vaultBefore = await getVaultBalance();
  await executeSwap({ amount: swapAmount });
  const vaultAfter = await getVaultBalance();
  
  expect(vaultAfter - vaultBefore).toBeCloseTo(expectedDeposit, 0.01);
});
```

#### Critères d'Acceptation
- [ ] 25% des fees automatiquement déposées
- [ ] Transaction non-bloquante (échec buyback n'affecte pas le swap)
- [ ] Logs clairs dans console & UI
- [ ] Tests E2E passent
- [ ] Documentation mise à jour

---

### 🟡 **Tâche #2 : Dashboard Buyback Temps Réel**
**Priority:** P1 - Important  
**Estimation:** 2-3 jours  
**Assigné à:** Frontend Team

#### Objectif
Créer une page `/buyback` avec statistiques live du système de buyback.

#### Structure de Fichiers
```bash
app/src/app/buyback/
├── page.tsx                      # Page principale
├── layout.tsx                    # Layout avec navigation
├── components/
│   ├── BuybackStats.tsx          # Cartes statistiques
│   ├── BuybackProgressBar.tsx    # Barre de progression vers seuil
│   ├── BuybackChart.tsx          # Graphique historique
│   ├── ExecuteBuybackButton.tsx  # Bouton exécution manuelle
│   └── RecentBuybacks.tsx        # Liste derniers buybacks
├── hooks/
│   ├── useBuybackState.ts        # Hook lecture on-chain state
│   ├── useBuybackHistory.ts      # Hook historique transactions
│   └── useExecuteBuyback.ts      # Hook exécution buyback
└── utils/
    └── buybackFormatters.ts      # Formatters (USDC, $BACK, etc.)
```

#### Composant Principal (`page.tsx`)
```typescript
export default function BuybackPage() {
  const { buybackState, isLoading } = useBuybackState();
  const { history } = useBuybackHistory();
  
  if (isLoading) return <BuybackSkeleton />;
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        💰 Buyback Dashboard
      </h1>
      
      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <BuybackStats
          totalUsdcSpent={buybackState.totalUsdcSpent}
          totalBackBurned={buybackState.totalBackBurned}
          buybackCount={buybackState.buybackCount}
        />
      </div>
      
      {/* Progression vers prochain buyback */}
      <BuybackProgressBar
        currentBalance={buybackState.vaultBalance}
        threshold={buybackState.minBuybackAmount}
      />
      
      {/* Bouton exécution si seuil atteint */}
      {buybackState.canExecute && (
        <ExecuteBuybackButton />
      )}
      
      {/* Graphique historique */}
      <BuybackChart data={history} />
      
      {/* Liste derniers buybacks */}
      <RecentBuybacks buybacks={history.slice(0, 10)} />
    </div>
  );
}
```

#### Hook `useBuybackState.ts`
```typescript
import { useConnection } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';

const BUYBACK_STATE_PDA = new PublicKey('74N3kmNZiRSJCFaYBFjmiQGMwv8vx3aJvMMKJECLNUNM');

export function useBuybackState() {
  const { connection } = useConnection();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['buyback-state'],
    queryFn: async () => {
      const accountInfo = await connection.getAccountInfo(BUYBACK_STATE_PDA);
      if (!accountInfo) throw new Error('Buyback state not found');
      
      const data = accountInfo.data;
      return {
        authority: new PublicKey(data.slice(8, 40)),
        backMint: new PublicKey(data.slice(40, 72)),
        usdcVault: new PublicKey(data.slice(72, 104)),
        minBuybackAmount: new BN(data.slice(104, 112), 'le').toNumber() / 1e6,
        totalUsdcSpent: new BN(data.slice(112, 120), 'le').toNumber() / 1e6,
        totalBackBurned: new BN(data.slice(120, 128), 'le').toNumber() / 1e9,
        buybackCount: new BN(data.slice(128, 136), 'le').toNumber(),
      };
    },
    refetchInterval: 10_000, // Refresh toutes les 10s
  });
  
  // Fetch vault balance séparément
  const { data: vaultBalance } = useQuery({
    queryKey: ['vault-balance'],
    queryFn: async () => {
      const balance = await connection.getTokenAccountBalance(USDC_VAULT_PDA);
      return balance.value.uiAmount || 0;
    },
    refetchInterval: 10_000,
  });
  
  return {
    buybackState: data ? { ...data, vaultBalance, canExecute: vaultBalance >= data.minBuybackAmount } : null,
    isLoading,
    error,
  };
}
```

#### Composant `ExecuteBuybackButton.tsx`
```typescript
export function ExecuteBuybackButton() {
  const wallet = useWallet();
  const { executeBuyback, isPending } = useExecuteBuyback();
  
  return (
    <button
      onClick={() => executeBuyback({ usdcAmount: 5_000_000 })}
      disabled={isPending || !wallet.connected}
      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg"
    >
      {isPending ? 'Exécution...' : '🔥 Execute Buyback'}
    </button>
  );
}
```

#### Critères d'Acceptation
- [ ] Page `/buyback` accessible et responsive
- [ ] Stats rafraîchies toutes les 10s
- [ ] Graphique évolution sur 30 jours
- [ ] Bouton "Execute Buyback" fonctionnel
- [ ] Animations & skeleton loaders
- [ ] Tests unitaires composants

---

## 🟢 PHASE 2 : Optimisations & UX (1-2 semaines)

### **Tâche #3 : Price Impact Calculator**
Afficher l'impact estimé du buyback sur le prix $BACK.

**Formule:**
```
Price Impact (%) = (buyback_usdc / total_liquidity) * 100
New Price = current_price * (1 + price_impact)
```

### **Tâche #4 : Notification System**
Toast notifications pour:
- ✅ Swap réussi
- ✅ Buyback deposit effectué
- ✅ Seuil buyback atteint
- ❌ Erreur transaction
- ⚠️ Wallet déconnecté

**Stack:** `react-hot-toast` + `@radix-ui/react-alert-dialog`

### **Tâche #5 : Analytics Dashboard**
Tableau de bord admin avec:
- Volume swap 24h / 7j / 30j
- Total fees collectées
- Taux de succès transactions
- Distribution tokens par wallet

**Technologies:** 
- `recharts` pour graphiques
- `@tanstack/react-table` pour tableaux
- Helius API pour données on-chain

---

## 🔵 PHASE 3 : Production Readiness (2-3 semaines)

### **Tâche #6 : Audit Sécurité**
**Budget:** 15k-30k USD  
**Durée:** 2-3 semaines  
**Prestataires:**
- OtterSec (https://osec.io) - Spécialiste Solana
- Sec3 (https://www.sec3.dev) - Audit Anchor
- Trail of Bits - Audit général

**Scope:**
- Smart contracts (buyback, router, cNFT)
- Permissions & authority checks
- Reentrancy protection
- Integer overflow/underflow
- Token-2022 hooks
- MEV resistance

### **Tâche #7 : Tests de Charge**
**Scénarios:**
```bash
# Test 1: Swaps simultanés
- 100 users × 10 swaps = 1000 transactions
- Vérifier: Taux de succès > 95%

# Test 2: API Stress
- 1000 req/min sur /api/quote
- Vérifier: Latency p95 < 500ms

# Test 3: Buyback Marathon
- 50 buybacks consécutifs
- Vérifier: Pas de leak mémoire

# Test 4: Frontend Load
- 10k users simultanés sur UI
- Vérifier: Time to Interactive < 2s
```

**Outils:**
- `k6` (https://k6.io)
- `artillery` (https://artillery.io)
- `Lighthouse CI` pour performances frontend

### **Tâche #8 : Monitoring Production**
**Stack:**
- **APM:** Datadog ou New Relic
- **Errors:** Sentry
- **Logs:** Logtail (Better Stack)
- **Uptime:** UptimeRobot
- **Blockchain:** Helius webhooks

**Alertes:**
- 🚨 Taux d'erreur > 5%
- 🚨 Latency p95 > 5s
- 🚨 Vault USDC < 10 USDC
- 🚨 Programme Anchor errors
- ⚠️ Wallet balance < 0.1 SOL

---

## 🟣 PHASE 4 : Déploiement Mainnet (1 semaine)

### **Jour 1-2 : Préparation**
- [ ] Audit complété + fixes appliqués
- [ ] Tests de charge validés
- [ ] Monitoring configuré
- [ ] Documentation complète
- [ ] Budget SOL (~5 SOL pour déploiements)
- [ ] Budget USDC (~10k pour liquidité)

### **Jour 3 : Déploiement Programmes**
```bash
# Build programmes
anchor build --verifiable

# Deploy buyback
anchor deploy --provider.cluster mainnet \
  --program-name swapback_buyback

# Deploy router
anchor deploy --provider.cluster mainnet \
  --program-name swapback_router

# Vérification
solana program show <PROGRAM_ID> --url mainnet
```

### **Jour 4 : Initialisation**
```bash
# Initialize buyback state
npx tsx scripts/initialize-buyback-mainnet.ts

# Create USDC vault
npx tsx scripts/create-usdc-vault-mainnet.ts

# Verify state
npx tsx scripts/verify-deployment-mainnet.ts
```

### **Jour 5-7 : Beta Privée**
- 50 early adopters sélectionnés
- Max swap: 100 USDC/tx
- Monitoring 24/7
- Feedback collection

### **Jour 8-14 : Beta Publique**
- Ouverture à tous
- Max swap: 1000 USDC/tx
- Communication Twitter/Discord
- Bug bounty lancé

### **Jour 15+ : Lancement Complet**
- Suppression limites swap
- Marketing campaign
- Partenariats DEX/Wallets
- CEX listings ($BACK)

---

## 📋 Checklist Immédiate (48h)

### Frontend
- [ ] Créer `/app/src/app/buyback/page.tsx`
- [ ] Créer hook `useBuybackState.ts`
- [ ] Créer hook `useExecuteBuyback.ts`
- [ ] Ajouter route navigation "Buyback" dans header
- [ ] Tester sur devnet

### Backend
- [ ] Modifier `swapExecutor.ts` → fonction `depositToBuybackVault()`
- [ ] Modifier API `/api/execute` → ajouter champ `buybackDeposit`
- [ ] Créer tests E2E `swap-with-buyback.test.ts`
- [ ] Mettre à jour `.env` avec addresses mainnet (préparation)

### Documentation
- [ ] Mettre à jour `README.md` avec section Buyback
- [ ] Créer `docs/BUYBACK_SYSTEM.md` avec schémas
- [ ] Documenter API routes dans Swagger
- [ ] Créer guide utilisateur `/docs/USER_GUIDE.md`

---

## 📊 KPIs & Métriques de Succès

### Techniques
| Métrique | Cible | Actuel | Status |
|----------|-------|--------|--------|
| Tests E2E | 100% | ✅ 12/12 | 🟢 |
| Code Coverage | >80% | ~75% | 🟡 |
| Latency Swap (p95) | <2s | ~1.5s | 🟢 |
| Uptime API | >99.9% | - | ⏳ |
| Error Rate | <1% | - | ⏳ |

### Business (Post-Launch)
| Métrique | Mois 1 | Mois 3 | Mois 6 |
|----------|--------|--------|--------|
| Volume Swap | $100k | $500k | $2M |
| Total $BACK Burned | 1M | 10M | 50M |
| Utilisateurs Actifs | 500 | 2k | 10k |
| TVL cNFT Locks | $50k | $250k | $1M |

---

## 🎬 Conclusion

**Status actuel:** ✅ Foundation solide  
**Prochaine milestone:** Dashboard Buyback (5 jours)  
**Target mainnet:** Début Décembre 2025  

**Questions urgentes:**
1. Budget audit sécurité approuvé ? (15-30k USD)
2. Équipe frontend disponible pour dashboard ?
3. Plan marketing post-launch défini ?

---

**Dernière mise à jour:** 31 Octobre 2025  
**Commit:** `774841e`  
**Contact:** bacbacta@users.noreply.github.com
