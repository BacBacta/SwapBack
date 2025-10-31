# 📋 TODO LIST - SwapBack Final Tasks
**Date:** 31 octobre 2025  
**Status:** Production-Ready with Critical TODOs  
**Completion:** 90% → 100%

---

## 🔴 PRIORITÉ P0 - CRITIQUES (BLOQUANTS PRODUCTION)

### ✅ TODO #1: Jupiter CPI Integration (Buyback Execute)
**Estimé:** 4-6 heures  
**Assigné à:** Developer  
**Deadline:** Semaine 1 - Mardi

**Fichier:** `programs/swapback_buyback/src/lib.rs` ligne 97

**Description:**
Implémenter le CPI (Cross-Program Invocation) vers Jupiter Aggregator pour permettre au programme buyback d'exécuter des swaps USDC → $BACK automatiquement.

**Étapes:**
- [ ] Ajouter dépendance Jupiter SDK dans `Cargo.toml`
- [ ] Créer fonction `build_jupiter_swap_instruction()` 
- [ ] Implémenter `invoke_signed()` pour exécuter swap
- [ ] Parser la réponse pour obtenir le montant $BACK reçu
- [ ] Mettre à jour `execute_buyback()` avec le CPI
- [ ] Ajouter gestion d'erreurs (slippage, insufficient liquidity)
- [ ] Tester sur devnet avec USDC réel
- [ ] Documenter les paramètres (slippage, route, etc.)

**Code à compléter:**
```rust
pub fn execute_buyback(ctx: Context<ExecuteBuyback>, amount: u64) -> Result<()> {
    // TODO: Implémenter CPI Jupiter ici
    let jupiter_swap_instruction = build_jupiter_swap_ix(
        &ctx.accounts.usdc_vault.key(),
        &ctx.accounts.back_vault.key(),
        amount,
        USDC_MINT,
        BACK_MINT,
        slippage_bps: 50, // 0.5% slippage max
    )?;

    invoke_signed(
        &jupiter_swap_instruction,
        &[
            ctx.accounts.usdc_vault.to_account_info(),
            ctx.accounts.back_vault.to_account_info(),
            ctx.accounts.jupiter_program.to_account_info(),
        ],
        &[&[b"buyback_state", &[ctx.accounts.state.bump]]],
    )?;

    // Parse montant $BACK reçu et burn
    let back_amount_received = parse_swap_output(...)?;
    
    // Burn logic déjà présente
    burn_back(ctx, back_amount_received)?;

    Ok(())
}
```

**Ressources:**
- Jupiter API: https://station.jup.ag/docs/apis/swap-api
- Jupiter Program ID: `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`

**Tests requis:**
- [ ] Test unitaire: swap 100 USDC → $BACK
- [ ] Test E2E: execute_buyback avec montant minimum
- [ ] Test edge case: slippage trop élevé
- [ ] Test edge case: insufficient liquidity

**Dépendances:** Token $BACK doit exister (TODO #4)

---

### ✅ TODO #2: Helius API Integration (Recent Buybacks)
**Estimé:** 2-3 heures  
**Assigné à:** Frontend Developer  
**Deadline:** Semaine 1 - Mercredi

**Fichier:** `app/src/app/buyback/components/RecentBuybacks.tsx` ligne 26

**Description:**
Remplacer les données mockées par des transactions réelles via Helius API pour afficher les 5-10 derniers buybacks exécutés.

**Étapes:**
- [ ] Créer compte Helius et obtenir API key
- [ ] Ajouter `NEXT_PUBLIC_HELIUS_API_KEY` dans `.env`
- [ ] Créer fonction `fetchRecentBuybacks()` avec Helius
- [ ] Parser les logs de transaction pour extraire USDC/BACK amounts
- [ ] Formater les données pour le tableau
- [ ] Gérer les erreurs (rate limit, API down)
- [ ] Ajouter loading state pendant fetch
- [ ] Tester avec vraies transactions devnet

**Code à implémenter:**
```typescript
// app/src/hooks/useRecentBuybacks.ts (nouveau fichier)
import { useQuery } from '@tanstack/react-query';

const fetchRecentBuybacks = async () => {
  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
  
  const response = await fetch(
    `https://api.helius.xyz/v0/addresses/${BUYBACK_PROGRAM_ID}/transactions?api-key=${heliusApiKey}&limit=10`
  );
  
  if (!response.ok) {
    throw new Error('Helius API error');
  }
  
  const data = await response.json();
  
  // Filter for execute_buyback instructions
  const buybackTxs = data.filter(tx => 
    tx.instructions.some(ix => 
      ix.programId === BUYBACK_PROGRAM_ID &&
      ix.data.includes('execute_buyback')
    )
  );
  
  // Parse each transaction
  return buybackTxs.slice(0, 5).map(tx => ({
    signature: tx.signature,
    timestamp: tx.timestamp * 1000,
    usdcAmount: parseUsdcFromLogs(tx.meta.logMessages),
    backBurned: parseBackFromLogs(tx.meta.logMessages),
    executor: tx.feePayer,
  }));
};

export const useRecentBuybacks = () => {
  return useQuery({
    queryKey: ['recent-buybacks'],
    queryFn: fetchRecentBuybacks,
    refetchInterval: 30000, // Refresh every 30s
    staleTime: 20000,
  });
};
```

**Parser helpers à créer:**
```typescript
const parseUsdcFromLogs = (logs: string[]): number => {
  const usdcLog = logs.find(log => log.includes('USDC spent:'));
  if (!usdcLog) return 0;
  
  const match = usdcLog.match(/USDC spent: (\d+)/);
  return match ? parseInt(match[1]) : 0;
};

const parseBackFromLogs = (logs: string[]): number => {
  const backLog = logs.find(log => log.includes('BACK burned:'));
  if (!backLog) return 0;
  
  const match = backLog.match(/BACK burned: (\d+)/);
  return match ? parseInt(match[1]) : 0;
};
```

**Tests requis:**
- [ ] Test: API call avec vraie clé
- [ ] Test: Parsing de logs réels
- [ ] Test: Gestion erreur 429 (rate limit)
- [ ] Test: Loading state affichage
- [ ] Test: Empty state (0 transactions)

**Configuration:**
```env
# .env.local
NEXT_PUBLIC_HELIUS_API_KEY=your_helius_api_key_here
```

---

### ✅ TODO #3: On-Chain Data for BuybackChart
**Estimé:** 3-4 heures  
**Assigné à:** Frontend Developer  
**Deadline:** Semaine 1 - Jeudi

**Fichier:** `app/src/app/buyback/components/BuybackChart.tsx` ligne 15

**Description:**
Remplacer les données mockées du graphique par l'historique réel des buybacks des 30 derniers jours, agrégé par jour.

**Étapes:**
- [ ] Créer fonction `fetchBuybackHistory()` (30 jours)
- [ ] Utiliser Helius API ou `getSignaturesForAddress()`
- [ ] Parser chaque transaction pour extraire montants
- [ ] Agréger par jour (sum USDC spent, sum BACK burned)
- [ ] Formater pour Recharts (format: `{ date, usdcSpent, backBurned }[]`)
- [ ] Gérer les jours sans transaction (fill avec 0)
- [ ] Optimiser performance (cache, pagination)
- [ ] Ajouter loading skeleton pendant fetch

**Code à implémenter:**
```typescript
// app/src/hooks/useBuybackHistory.ts (nouveau fichier)
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';

interface DailyBuyback {
  date: string;
  usdcSpent: number;
  backBurned: number;
}

const fetchBuybackHistory = async (): Promise<DailyBuyback[]> => {
  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
  
  // Fetch transactions from last 30 days
  const response = await fetch(
    `https://api.helius.xyz/v0/addresses/${BUYBACK_PROGRAM_ID}/transactions?api-key=${heliusApiKey}&before=${thirtyDaysAgo}`
  );
  
  const transactions = await response.json();
  
  // Filter buyback transactions
  const buybacks = transactions.filter(tx => 
    tx.instructions.some(ix => ix.programId === BUYBACK_PROGRAM_ID)
  );
  
  // Group by day
  const dailyMap = new Map<string, { usdc: number; back: number }>();
  
  buybacks.forEach(tx => {
    const date = format(new Date(tx.timestamp * 1000), 'yyyy-MM-dd');
    const usdc = parseUsdcFromLogs(tx.meta.logMessages);
    const back = parseBackFromLogs(tx.meta.logMessages);
    
    const current = dailyMap.get(date) || { usdc: 0, back: 0 };
    dailyMap.set(date, {
      usdc: current.usdc + usdc,
      back: current.back + back,
    });
  });
  
  // Fill missing days with 0
  const result: DailyBuyback[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
    const data = dailyMap.get(date) || { usdc: 0, back: 0 };
    
    result.push({
      date,
      usdcSpent: data.usdc / 1e6, // Convert to USDC units
      backBurned: data.back / 1e9, // Convert to BACK units
    });
  }
  
  return result;
};

export const useBuybackHistory = () => {
  return useQuery({
    queryKey: ['buyback-history'],
    queryFn: fetchBuybackHistory,
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5min
  });
};
```

**Mise à jour BuybackChart.tsx:**
```typescript
// app/src/app/buyback/components/BuybackChart.tsx
import { useBuybackHistory } from '@/hooks/useBuybackHistory';

export default function BuybackChart() {
  const { data: chartData, isLoading } = useBuybackHistory();
  
  if (isLoading) {
    return <LoadingSkeleton.ChartSkeleton />;
  }
  
  return (
    <AreaChart data={chartData} {...props}>
      {/* Existing chart config */}
    </AreaChart>
  );
}
```

**Tests requis:**
- [ ] Test: Fetch 30 jours de données
- [ ] Test: Agrégation correcte par jour
- [ ] Test: Fill jours manquants avec 0
- [ ] Test: Format date correct (yyyy-MM-dd)
- [ ] Test: Conversion units (lamports → USDC/BACK)

---

## 🟡 PRIORITÉ P1 - IMPORTANTES (POST-LAUNCH OK)

### ✅ TODO #4: Create Token $BACK
**Estimé:** 1 jour  
**Assigné à:** Founder/Tech Lead  
**Deadline:** Semaine 2 - Mardi

**Description:**
Créer le token $BACK officiel qui sera utilisé pour le buyback & burn mechanism.

**Décisions à prendre:**
- [ ] Token standard vs Token-2022 ?
- [ ] Supply totale ? (Recommandé: 1 milliard)
- [ ] Freeze authority ? (Recommandé: None pour DeFi)
- [ ] Mint authority ? (Recommandé: Multisig)

**Étapes:**
- [ ] Installer Solana CLI tools
- [ ] Créer keypair pour mint authority
- [ ] Créer le mint token
  ```bash
  spl-token create-token --decimals 9
  ```
- [ ] Sauvegarder mint address dans `.env`
- [ ] Créer initial supply
  ```bash
  spl-token mint <MINT_ADDRESS> 1000000000
  ```
- [ ] Créer compte token pour buyback vault
- [ ] Mettre à jour constantes dans code
  ```typescript
  // sdk/src/constants.ts
  export const BACK_MINT = new PublicKey('YOUR_MINT_ADDRESS');
  ```
- [ ] Tester sur devnet d'abord
- [ ] Deploy sur mainnet
- [ ] Distribuer initial supply selon tokenomics

**Distribution recommandée:**
```
Total Supply: 1,000,000,000 BACK (100%)

30% - Liquidity Pools (300M)
20% - Team (vested 2 ans) (200M)
20% - Community Rewards (200M)
15% - Marketing & Partnerships (150M)
15% - Protocol Reserve (150M)
```

**Configuration:**
```env
# .env
BACK_MINT_ADDRESS=<your_mint_address>
BACK_MINT_AUTHORITY=<multisig_address>
```

**Tests requis:**
- [ ] Test: Mint tokens sur devnet
- [ ] Test: Transfer tokens
- [ ] Test: Burn tokens (pour buyback)
- [ ] Test: Metadata update
- [ ] Vérifier sur Solscan

**Documentation:**
- [ ] Créer `TOKENOMICS.md`
- [ ] Publier contract address
- [ ] Ajouter au README

---

### ✅ TODO #5: Implement Claim Rewards
**Estimé:** 2-3 heures  
**Assigné à:** Smart Contract Developer  
**Deadline:** Semaine 3 - Lundi

**Fichier:** `programs/swapback_router/src/lib.rs` ligne 838

**Description:**
Compléter la fonction `claim_rewards()` pour permettre aux utilisateurs de récupérer leurs rebates accumulés.

**Étapes:**
- [ ] Compléter la logique de transfer USDC
- [ ] Ajouter vérification balance vault suffisante
- [ ] Implémenter CPI token::transfer avec PDA signer
- [ ] Émettre event `RewardsClaimed`
- [ ] Mettre à jour stats utilisateur
- [ ] Ajouter test unitaire
- [ ] Tester sur devnet avec wallet réel
- [ ] Documenter l'instruction

**Code à compléter:**
```rust
pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
    let user_rebate = &mut ctx.accounts.user_rebate;
    
    // Vérifier qu'il y a des rewards à claim
    require!(
        user_rebate.unclaimed_rebate > 0,
        ErrorCode::NoRewardsToClaim
    );

    // Vérifier que le vault a assez de USDC
    require!(
        ctx.accounts.rebate_vault.amount >= user_rebate.unclaimed_rebate,
        ErrorCode::InsufficientVaultBalance
    );

    // TODO: Transférer USDC du vault vers user
    let seeds = &[b"rebate_vault", &[ctx.accounts.state.bump]];
    let signer = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.rebate_vault.to_account_info(),
        to: ctx.accounts.user_usdc_account.to_account_info(),
        authority: ctx.accounts.state.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

    token::transfer(cpi_ctx, user_rebate.unclaimed_rebate)?;

    // Mettre à jour le compte utilisateur
    let claimed_amount = user_rebate.unclaimed_rebate;
    user_rebate.unclaimed_rebate = 0;
    user_rebate.total_claimed += claimed_amount;
    user_rebate.last_claim_timestamp = Clock::get()?.unix_timestamp;

    // Émettre event
    emit!(RewardsClaimed {
        user: ctx.accounts.user.key(),
        amount: claimed_amount,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("Rewards claimed: {} USDC", claimed_amount / 1_000_000);

    Ok(())
}
```

**Tests requis:**
- [ ] Test: Claim avec balance suffisante
- [ ] Test: Fail si unclaimed_rebate = 0
- [ ] Test: Fail si vault insuffisant
- [ ] Test: Event émis correctement
- [ ] Test: Stats mises à jour

**Frontend integration:**
```typescript
// app/src/hooks/useClaimRewards.ts
const claimRewards = async () => {
  const tx = await program.methods
    .claimRewards()
    .accounts({
      user: wallet.publicKey,
      userRebate: userRebatePDA,
      rebateVault: rebateVaultPDA,
      userUsdcAccount: userUsdcATA,
      state: routerStatePDA,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
    
  return tx;
};
```

---

### ✅ TODO #6: Parse Transaction Logs (Buyback)
**Estimé:** 1-2 heures  
**Assigné à:** Frontend Developer  
**Deadline:** Semaine 3 - Lundi

**Fichier:** `app/src/hooks/useExecuteBuyback.ts` ligne 88

**Description:**
Extraire le montant de $BACK brûlé depuis les logs de transaction pour l'afficher dans l'UI et le tracker dans analytics.

**Étapes:**
- [ ] Créer fonction `parseBuybackLogs()`
- [ ] Chercher pattern "BACK burned: XXX" dans logs
- [ ] Parser le montant avec regex
- [ ] Convertir lamports → BACK units
- [ ] Utiliser dans onSuccess callback
- [ ] Afficher dans toast notification
- [ ] Tracker dans Mixpanel
- [ ] Gérer cas où log absent (fallback)

**Code à implémenter:**
```typescript
// app/src/lib/parsers.ts (nouveau fichier)
export const parseBuybackLogs = (logs: string[]): {
  usdcSpent: number;
  backBurned: number;
} => {
  let usdcSpent = 0;
  let backBurned = 0;
  
  // Parse USDC spent
  const usdcLog = logs.find(log => log.includes('USDC spent:'));
  if (usdcLog) {
    const match = usdcLog.match(/USDC spent: (\d+)/);
    if (match) {
      usdcSpent = parseInt(match[1]);
    }
  }
  
  // Parse BACK burned
  const backLog = logs.find(log => log.includes('BACK burned:'));
  if (backLog) {
    const match = backLog.match(/BACK burned: (\d+)/);
    if (match) {
      backBurned = parseInt(match[1]);
    }
  }
  
  return { usdcSpent, backBurned };
};
```

**Mise à jour useExecuteBuyback.ts:**
```typescript
// app/src/hooks/useExecuteBuyback.ts
import { parseBuybackLogs } from '@/lib/parsers';

const executeBuyback = useMutation({
  mutationFn: async (amount: number) => {
    const signature = await program.methods
      .executeBuyback(new BN(amount * 1e6))
      .accounts({...})
      .rpc();
      
    return signature;
  },
  onSuccess: async (signature) => {
    // Fetch transaction pour obtenir logs
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    
    if (!tx || !tx.meta) {
      throw new Error('Transaction not found');
    }
    
    // Parse logs
    const { usdcSpent, backBurned } = parseBuybackLogs(tx.meta.logMessages || []);
    
    // Track analytics avec vraies valeurs
    trackBuyback({
      usdcAmount: usdcSpent,
      backBurned: backBurned, // ✅ Valeur réelle parsée
      executor: wallet.publicKey.toString(),
      signature,
    });
    
    // Toast avec détails
    toast.success(
      `Buyback executed! ${(backBurned / 1e9).toFixed(2)} BACK burned 🔥`
    );
    
    // Invalidate queries
    queryClient.invalidateQueries(['buyback-state']);
    queryClient.invalidateQueries(['recent-buybacks']);
  },
});
```

**Tests requis:**
- [ ] Test: Parse logs avec format correct
- [ ] Test: Gestion logs manquants
- [ ] Test: Gestion format inattendu
- [ ] Test: Conversion units correcte
- [ ] Test: Analytics trackées

---

## 🟢 PRIORITÉ P2 - NICE TO HAVE (OPTIONNEL)

### ✅ TODO #7: Code Cleanup & Linting
**Estimé:** 2-3 heures  
**Assigné à:** Any Developer  
**Deadline:** Semaine 3 - Mardi

**Description:**
Nettoyer le code pour éliminer warnings et améliorer qualité.

**Tâches:**
- [ ] Supprimer imports inutilisés
  - `BuybackDashboard.tsx`: SystemProgram
  - `useExecuteBuyback.ts`: PublicKey
- [ ] Fixer warnings useEffect dependencies
  ```typescript
  // Ajouter loadBuybackState dans deps
  useEffect(() => {
    loadBuybackState();
  }, [loadBuybackState]);
  ```
- [ ] Remplacer `any` types par types explicites
  ```typescript
  // AVANT: (data: any) => {}
  // APRÈS: (data: BuybackData) => {}
  ```
- [ ] Exécuter ESLint fix
  ```bash
  npm run lint -- --fix
  ```
- [ ] Formatter avec Prettier
  ```bash
  npm run format
  ```
- [ ] Vérifier TypeScript strict errors
  ```bash
  npm run type-check
  ```

**Checklist:**
- [ ] 0 ESLint errors
- [ ] 0 TypeScript errors
- [ ] < 5 warnings (acceptable)
- [ ] Code formaté uniformément

---

### ✅ TODO #8: Performance Optimizations
**Estimé:** 4-6 heures  
**Assigné à:** Senior Developer  
**Deadline:** Semaine 3 - Mercredi

**Description:**
Optimiser performance frontend et smart contracts.

**Frontend:**
- [ ] Remplacer polling par WebSocket (Helius)
  ```typescript
  const ws = new WebSocket('wss://api.helius.xyz/...');
  ws.onmessage = (event) => {
    queryClient.invalidateQueries(['buyback-state']);
  };
  ```
- [ ] Code splitting avec dynamic imports
  ```typescript
  const BuybackDashboard = dynamic(() => import('@/components/BuybackDashboard'), {
    loading: () => <LoadingSkeleton.PageSkeleton />,
    ssr: false,
  });
  ```
- [ ] Optimiser bundle size
  ```bash
  npm run analyze
  # Target: < 500KB initial bundle
  ```
- [ ] Lazy load images
  ```typescript
  <Image loading="lazy" ... />
  ```

**Smart Contracts:**
- [ ] Optimiser Rust compilation
  ```toml
  [profile.release]
  opt-level = "z"
  lto = true
  codegen-units = 1
  strip = true
  ```
- [ ] Réduire taille PDAs (si possible)
- [ ] Benchmark gas costs
  ```bash
  anchor test --detach -- --nocapture
  ```

**Métriques cibles:**
- [ ] FCP < 1.5s
- [ ] TTI < 2.5s
- [ ] Bundle < 500KB
- [ ] Lighthouse score > 90

---

### ✅ TODO #9: Security Enhancements
**Estimé:** 1 jour  
**Assigné à:** Security Engineer  
**Deadline:** Semaine 3 - Jeudi

**Tâches:**
- [ ] Implémenter rate limiting API
  ```typescript
  import rateLimit from 'express-rate-limit';
  const limiter = rateLimit({ windowMs: 60000, max: 10 });
  ```
- [ ] Setup multisig pour program upgrades
  ```bash
  solana-keygen grind --starts-with multi:1
  # Require 2/3 signatures
  ```
- [ ] Intégrer Sentry error monitoring
  ```typescript
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
  ```
- [ ] Audit externe (recommandé)
  - Soumettre à OtterSec ou Zellic
  - Budget: $5k-$15k
- [ ] Bug bounty program
  - Immunefi platform
  - Récompenses: $500-$50k

---

### ✅ TODO #10: UX/UI Improvements
**Estimé:** 3-5 jours  
**Assigné à:** Frontend Developer  
**Deadline:** Semaine 3 - Vendredi

**Tâches:**
- [ ] Keyboard shortcuts
  ```typescript
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.ctrlKey) executeSwap();
      if (e.key === 'r' && e.ctrlKey) reverseTokens();
    };
    window.addEventListener('keydown', handleKeyPress);
  }, []);
  ```
- [ ] PWA support
  ```bash
  npm install next-pwa
  # Add manifest.json, service worker
  ```
- [ ] Theme toggle (Dark/Light/Terminal)
  ```typescript
  const [theme, setTheme] = useState('terminal');
  ```
- [ ] Mobile responsive polish
  - Test iPhone SE, iPhone 14 Pro
  - Test Android (Pixel, Samsung)
- [ ] Loading states améliorés
  - Skeleton screens partout
  - Progress indicators
- [ ] Empty states
  - No transactions yet
  - No rewards to claim
- [ ] Error states
  - Network error UI
  - Transaction failed UI

---

### ✅ TODO #11: CI/CD Pipeline
**Estimé:** 1 jour  
**Assigné à:** DevOps  
**Deadline:** Semaine 4 - Lundi

**Description:**
Automatiser tests et déploiements avec GitHub Actions.

**Étapes:**
- [ ] Créer `.github/workflows/ci.yml`
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - name: Install Rust
          uses: actions-rs/toolchain@v1
        - name: Build programs
          run: anchor build
        - name: Run tests
          run: anchor test
        - name: Lint frontend
          run: cd app && npm run lint
        - name: Run E2E tests
          run: npm test
  ```
- [ ] Setup CD pour Vercel
- [ ] Auto-deploy devnet on merge to `develop`
- [ ] Manual approve pour mainnet deploy
- [ ] Slack notifications sur deploy

---

### ✅ TODO #12: Documentation Updates
**Estimé:** 4-6 heures  
**Assigné à:** Tech Writer  
**Deadline:** Semaine 4 - Mardi

**Tâches:**
- [ ] Mettre à jour README.md
  - Quick start guide
  - Architecture overview
  - Deployment instructions
- [ ] Créer CONTRIBUTING.md
  - Code style guide
  - PR process
  - Testing requirements
- [ ] API Documentation
  - Toutes les instructions programs
  - Paramètres, erreurs, events
- [ ] User Guide
  - How to swap
  - How to claim rewards
  - How to participate in buyback
- [ ] FAQ
  - Qu'est-ce que le NPI ?
  - Comment fonctionne le boost ?
  - Pourquoi lock $BACK ?

---

### ✅ TODO #13: Beta Testing
**Estimé:** 3-5 jours  
**Assigné à:** QA Team + Community  
**Deadline:** Semaine 4 - Mercredi-Vendredi

**Étapes:**
- [ ] Recruter 20-50 beta testers
- [ ] Créer Discord channel #beta-testing
- [ ] Distribuer test tokens (devnet)
- [ ] Créer checklist test scenarios
  ```
  - Swap SOL → USDC
  - Swap with boost (lock $BACK)
  - Execute buyback
  - Claim rewards
  - Mobile testing
  - Edge cases
  ```
- [ ] Collecter feedback (Google Form)
- [ ] Fixer bugs critiques découverts
- [ ] Itérer si nécessaire
- [ ] Final GO/NO-GO decision

**Bugs tracking:**
- [ ] Setup GitHub Issues labels
  - `bug-critical`
  - `bug-high`
  - `bug-medium`
  - `bug-low`
  - `enhancement`

---

### ✅ TODO #14: Mainnet Deployment
**Estimé:** 1 jour  
**Assigné à:** Tech Lead  
**Deadline:** Semaine 4 - Vendredi (LAUNCH DAY 🚀)

**Pre-deployment checklist:**
- [ ] Tous les tests P0 complétés ✅
- [ ] Token $BACK créé et distribué ✅
- [ ] Audit sécurité passé ✅
- [ ] Beta testing terminé ✅
- [ ] Liquidity pools créés ✅
- [ ] Multisig setup ✅

**Deployment steps:**
```bash
# 1. Build programs (production)
anchor build --verifiable

# 2. Deploy programs
anchor deploy --provider.cluster mainnet

# 3. Initialize programs
anchor run initialize-mainnet

# 4. Verify deployments
solana program show <PROGRAM_ID>

# 5. Update frontend env
NEXT_PUBLIC_CLUSTER=mainnet-beta
NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com

# 6. Deploy frontend (Vercel)
vercel --prod

# 7. DNS setup
# Point swapback.io to Vercel
```

**Post-deployment:**
- [ ] Smoke tests sur mainnet
- [ ] Monitorer logs (Sentry)
- [ ] Surveiller transactions
- [ ] Annoncer sur Twitter/Discord
- [ ] Communiqué de presse

---

## 📊 RÉCAPITULATIF

### Par Priorité
- **P0 (Critiques):** 3 TODOs | 9-13 heures
- **P1 (Importantes):** 3 TODOs | ~2 jours
- **P2 (Nice to have):** 8 TODOs | ~2 semaines

### Par Catégorie
- **Smart Contracts:** TODOs #1, #4, #5
- **Frontend:** TODOs #2, #3, #6, #7, #10
- **Infrastructure:** TODOs #8, #9, #11
- **QA/Launch:** TODOs #12, #13, #14

### Timeline Globale
```
Semaine 1: P0 (Critiques)           ████████░░ 80%
Semaine 2: Token + Deploy           ██████░░░░ 60%
Semaine 3: P1 + P2 (Polish)         ████░░░░░░ 40%
Semaine 4: Beta + Launch 🚀         ██████████ 100%
```

---

## 🎯 PROCHAINES ACTIONS IMMÉDIATES

**AUJOURD'HUI (31 Oct):**
1. ✅ Commencer TODO #1 (Jupiter CPI) - 2h session
2. ✅ Setup Helius account pour TODO #2
3. ✅ Créer branches Git pour chaque TODO

**DEMAIN (1 Nov):**
1. ✅ Finaliser TODO #1 (Jupiter CPI)
2. ✅ Compléter TODO #2 (Helius API)
3. ✅ Tests E2E TODO #1 & #2

**Cette Semaine:**
1. ✅ Tous les TODOs P0 terminés
2. ✅ Tests complets
3. ✅ Ready pour TODO #4 (Token)

---

## 📝 NOTES

- **Delegation:** Certains TODOs peuvent être parallélisés
- **Blockers:** TODO #1 (Jupiter) bloque déploiement mainnet
- **Dependencies:** TODO #4 (Token) requis avant TODO #1 tests réels
- **Budget:** Audit sécurité ~$10k à prévoir (TODO #9)
- **Timeline flexible:** P2 TODOs peuvent être post-launch

---

**Dernière mise à jour:** 31 octobre 2025  
**Auteur:** BacBacta  
**Status:** 📋 TODO List Active
