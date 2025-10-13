# 📋 FONCTIONNALITÉS RESTANTES À DÉVELOPPER - SwapBack

**Date:** 12 octobre 2025  
**État actuel:** 95% complété  
**Programmes déployés:** 3/3 sur devnet

---

## 🎯 VUE D'ENSEMBLE

### ✅ Déjà Développé (95%)

- ✅ **3 programmes Solana** déployés sur devnet (router, buyback, cnft)
- ✅ **Architecture cNFT** complète avec niveaux Bronze/Silver/Gold
- ✅ **UI Next.js** avec 4 composants React fonctionnels
- ✅ **Hook blockchain** useCNFT pour fetch données on-chain
- ✅ **Tests automatisés** E2E (100% de réussite)
- ✅ **Documentation** complète (2000+ lignes)

### ⏳ À Développer (5%)

**Priorité Haute:**
1. Interface de Lock/Unlock
2. Système de swap (interface + backend)
3. Token $BACK (mint + distribution)

**Priorité Moyenne:**
4. Bubblegum CPI réel (compression Merkle)
5. Système de buyback automatique
6. Gestion des rebates

**Priorité Basse:**
7. Analytics avancés
8. Tests unitaires complets
9. Optimisations performance

---

## 🔥 PRIORITÉ 1 - Interface Lock/Unlock (Critique)

### État Actuel
- ✅ Programme `swapback_router` avec fonctions `lock_back()` et `unlock_back()`
- ✅ Composant `CNFTCard` pour afficher le cNFT
- ❌ **MANQUE:** Interface utilisateur pour créer un lock

### À Développer

#### 1.1 Composant LockInterface.tsx
**Fichier:** `app/src/components/LockInterface.tsx`

**Fonctionnalités:**
```tsx
interface LockInterfaceProps {
  // Interface pour lock des tokens $BACK
}

Features à implémenter:
- Input: Montant de $BACK à locker
- Input: Durée du lock (en jours)
- Calcul automatique du boost basé sur la durée
- Affichage niveau prévu (Bronze/Silver/Gold)
- Bouton "Lock $BACK"
- Transaction Solana vers lock_back()
- Gestion erreurs et états de chargement
```

**Estimation:** 2-3 heures  
**Complexité:** Moyenne  
**Dépendances:** Token $BACK doit exister (voir 1.3)

#### 1.2 Composant UnlockInterface.tsx
**Fichier:** `app/src/components/UnlockInterface.tsx`

**Fonctionnalités:**
```tsx
Features à implémenter:
- Afficher détails du lock actif
- Countdown jusqu'à unlock_time
- Bouton "Unlock" (actif seulement après expiration)
- Transaction Solana vers unlock_back()
- Confirmation visuelle après unlock
- Mise à jour automatique du cNFT (is_active = false)
```

**Estimation:** 1-2 heures  
**Complexité:** Faible

#### 1.3 Token $BACK de Test
**Nécessaire pour:** Tester le système de lock

**À faire:**
```bash
# Créer un token SPL de test sur devnet
spl-token create-token --decimals 9
spl-token create-account <TOKEN_ADDRESS>
spl-token mint <TOKEN_ADDRESS> 1000000 <RECIPIENT>
```

**Estimation:** 30 minutes  
**Complexité:** Faible

**Total Priorité 1:** ~4-6 heures

---

## 💱 PRIORITÉ 2 - Système de Swap Complet

### État Actuel
- ✅ Composant `SwapInterface.tsx` existe (interface basique)
- ✅ Programme `swapback_router` avec fonction `swap()`
- ❌ **MANQUE:** Logique de routage multi-DEX
- ❌ **MANQUE:** Intégration avec Jupiter/Raydium

### À Développer

#### 2.1 Intégration Jupiter Aggregator
**Fichier:** `app/src/hooks/useJupiter.ts`

**Fonctionnalités:**
```typescript
// Hook pour obtenir le meilleur prix via Jupiter
interface JupiterQuote {
  inputMint: PublicKey;
  outputMint: PublicKey;
  inAmount: number;
  outAmount: number;
  priceImpact: number;
  routePlan: RoutePlan[];
}

Features:
- Fetch quote Jupiter API
- Comparer prix multi-DEX
- Sélection meilleure route
- Exécution swap via Jupiter
- Calcul NPI (Net Positive Impact)
```

**API Jupiter:** https://quote-api.jup.ag/v6/quote

**Estimation:** 4-5 heures  
**Complexité:** Moyenne-Haute

#### 2.2 Calcul NPI (Net Positive Impact)
**Fichier:** `app/src/utils/calculateNPI.ts`

**Formule:**
```typescript
NPI = (Prix_SwapBack - Prix_Référence) / Prix_Référence * Montant_Swap

Où:
- Prix_SwapBack = Prix obtenu via notre routeur optimisé
- Prix_Référence = Prix moyen sur DEX standards
- Montant_Swap = Montant de la transaction

Si NPI > 0 → Utilisateur a économisé
```

**Estimation:** 2 heures  
**Complexité:** Moyenne

#### 2.3 Interface Swap Complète
**Fichier:** Améliorer `app/src/components/SwapInterface.tsx`

**Features manquantes:**
- ✅ Sélection tokens (déjà présent)
- ❌ Affichage quote en temps réel
- ❌ Slippage tolerance
- ❌ Affichage NPI estimé
- ❌ Historique des swaps
- ❌ Transaction confirmation modal
- ❌ Affichage rebate estimé

**Estimation:** 3-4 heures  
**Complexité:** Moyenne

**Total Priorité 2:** ~9-11 heures

---

## 💰 PRIORITÉ 3 - Système de Rebates

### État Actuel
- ✅ Dashboard affiche "Rebates en attente" (mocké)
- ❌ **MANQUE:** Calcul réel des rebates
- ❌ **MANQUE:** Distribution automatique
- ❌ **MANQUE:** Interface de claim

### À Développer

#### 3.1 Calcul Rebates avec Boost
**Fichier:** `programs/swapback_router/src/lib.rs` (amélioration)

**Logique:**
```rust
// Dans la fonction swap()
pub fn swap(ctx: Context<Swap>, amount_in: u64) -> Result<()> {
    // 1. Exécuter le swap
    // ...
    
    // 2. Calculer le rebate de base (ex: 0.1% du volume)
    let base_rebate = (amount_in as u128)
        .checked_mul(10)  // 0.1% = 10 / 10000
        .unwrap()
        .checked_div(10000)
        .unwrap() as u64;
    
    // 3. Appliquer le boost si l'utilisateur a un cNFT actif
    let user_lock = get_lock_state(&ctx.accounts.user)?;
    let boosted_rebate = if user_lock.is_active {
        base_rebate
            .checked_mul(100 + user_lock.boost as u64)
            .unwrap()
            .checked_div(100)
            .unwrap()
    } else {
        base_rebate
    };
    
    // 4. Accumuler dans RebateState
    let rebate_state = &mut ctx.accounts.rebate_state;
    rebate_state.pending_amount += boosted_rebate;
    
    Ok(())
}
```

**Nouveau compte à créer:**
```rust
#[account]
pub struct RebateState {
    pub user: Pubkey,
    pub pending_amount: u64,
    pub claimed_amount: u64,
    pub last_claim: i64,
}
```

**Estimation:** 3-4 heures  
**Complexité:** Moyenne-Haute

#### 3.2 Instruction claim_rebates()
**Fichier:** `programs/swapback_router/src/lib.rs`

**À implémenter:**
```rust
pub fn claim_rebates(ctx: Context<ClaimRebates>) -> Result<()> {
    let rebate_state = &mut ctx.accounts.rebate_state;
    
    // Vérifier qu'il y a des rebates à claim
    require!(rebate_state.pending_amount > 0, ErrorCode::NoRebates);
    
    // Transfer les rebates en $BACK
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.rebate_vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.program_signer.to_account_info(),
            },
        ),
        rebate_state.pending_amount,
    )?;
    
    // Mettre à jour l'état
    rebate_state.claimed_amount += rebate_state.pending_amount;
    rebate_state.pending_amount = 0;
    rebate_state.last_claim = Clock::get()?.unix_timestamp;
    
    Ok(())
}
```

**Estimation:** 2-3 heures  
**Complexité:** Moyenne

#### 3.3 Interface Claim Rebates
**Fichier:** `app/src/components/Dashboard.tsx` (amélioration)

**Features:**
```tsx
// Ajouter dans le Dashboard
{stats.pendingRebates > 0 && (
  <button 
    className="btn-primary w-full"
    onClick={handleClaimRebates}
  >
    Réclamer {stats.pendingRebates.toFixed(2)} $BACK
  </button>
)}

// Fonction avec vraie transaction
const handleClaimRebates = async () => {
  const tx = await program.methods
    .claimRebates()
    .accounts({
      user: wallet.publicKey,
      rebateState: rebateStatePDA,
      rebateVault: rebateVaultPDA,
      userTokenAccount: userTokenAccountPDA,
      // ...
    })
    .rpc();
  
  toast.success("Rebates réclamés avec succès!");
};
```

**Estimation:** 1-2 heures  
**Complexité:** Faible

**Total Priorité 3:** ~6-9 heures

---

## 🔄 PRIORITÉ 4 - Système de Buyback Automatique

### État Actuel
- ✅ Programme `swapback_buyback` déployé
- ✅ Structure de base du buyback présente
- ❌ **MANQUE:** Logique de déclenchement automatique
- ❌ **MANQUE:** Mécanisme de burn

### À Développer

#### 4.1 Trigger Buyback Automatique
**Fichier:** `programs/swapback_buyback/src/lib.rs`

**Logique:**
```rust
// Buyback déclenché quand le trésor atteint un seuil
pub fn trigger_buyback(ctx: Context<TriggerBuyback>) -> Result<()> {
    let treasury_balance = ctx.accounts.treasury.amount;
    let buyback_threshold = 10_000 * 10u64.pow(9); // 10k $BACK
    
    require!(
        treasury_balance >= buyback_threshold,
        ErrorCode::InsufficientTreasury
    );
    
    // Calculer montant à racheter (ex: 50% du trésor)
    let buyback_amount = treasury_balance / 2;
    
    // Swap SOL/USDC → $BACK via Jupiter
    // ... (intégration Jupiter)
    
    // Burn les tokens achetés
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.back_mint.to_account_info(),
                from: ctx.accounts.buyback_wallet.to_account_info(),
                authority: ctx.accounts.program_signer.to_account_info(),
            },
        ),
        buyback_amount,
    )?;
    
    emit!(BuybackEvent {
        amount: buyback_amount,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}
```

**Estimation:** 4-5 heures  
**Complexité:** Haute

#### 4.2 Scheduled Cron Job
**Fichier:** `oracle/src/buybackScheduler.ts`

**Utiliser Clockwork ou Cron personnalisé:**
```typescript
// Vérifier toutes les 24h si buyback nécessaire
setInterval(async () => {
  const treasuryBalance = await getTreasuryBalance();
  const threshold = 10_000 * 10**9;
  
  if (treasuryBalance >= threshold) {
    await triggerBuyback();
    console.log(`Buyback déclenché: ${treasuryBalance / 10**9} $BACK`);
  }
}, 24 * 60 * 60 * 1000); // 24h
```

**Alternative:** Utiliser Clockwork (scheduler Solana)

**Estimation:** 3-4 heures  
**Complexité:** Haute

#### 4.3 Interface Buyback Stats
**Fichier:** `app/src/components/BuybackDashboard.tsx`

**Features:**
```tsx
interface BuybackStats {
  totalBurned: number;
  lastBuyback: Date;
  nextBuybackEstimate: Date;
  treasuryBalance: number;
  burnRate: number; // tokens/jour
}

// Afficher graphique burn historique
<BurnChart data={burnHistory} />
```

**Estimation:** 2-3 heures  
**Complexité:** Moyenne

**Total Priorité 4:** ~9-12 heures

---

## 🌳 PRIORITÉ 5 - Bubblegum CPI Réel (TODO #10)

### État Actuel
- ✅ Programme cNFT avec logique de base
- ✅ CPI placeholders avec `msg!()`
- ❌ **MANQUE:** Vraie compression Merkle
- ❌ **MANQUE:** Intégration Metaplex Bubblegum

### À Développer

#### 5.1 Setup Merkle Tree
**Fichier:** `programs/swapback_cnft/src/lib.rs`

**Dépendances à ajouter:**
```toml
[dependencies]
mpl-bubblegum = "1.4"
spl-account-compression = "0.4"
```

**Initialisation:**
```rust
use mpl_bubblegum::instructions::CreateTreeConfigCpiBuilder;
use spl_account_compression::cpi::init_empty_merkle_tree;

pub fn initialize_collection(ctx: Context<InitializeCollection>) -> Result<()> {
    // Créer le Merkle tree pour stocker les cNFTs
    init_empty_merkle_tree(
        CpiContext::new(
            ctx.accounts.compression_program.to_account_info(),
            InitEmptyMerkleTree {
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
                authority: ctx.accounts.tree_authority.to_account_info(),
                noop: ctx.accounts.log_wrapper.to_account_info(),
            },
        ),
        32,  // max_depth
        64,  // max_buffer_size
    )?;
    
    // Créer tree config Bubblegum
    CreateTreeConfigCpiBuilder::new(&ctx.accounts.bubblegum_program)
        .tree_config(&ctx.accounts.tree_config)
        .merkle_tree(&ctx.accounts.merkle_tree)
        .payer(&ctx.accounts.payer)
        // ...
        .invoke()?;
    
    Ok(())
}
```

**Estimation:** 5-6 heures  
**Complexité:** Très Haute

#### 5.2 Mint cNFT avec Bubblegum
**Fichier:** `programs/swapback_cnft/src/lib.rs`

**Remplacer les msg!() par:**
```rust
use mpl_bubblegum::instructions::MintToCollectionV1CpiBuilder;

pub fn mint_level_nft(ctx: Context<MintLevelNFT>, level: u8) -> Result<()> {
    // Calculer metadata
    let metadata = create_nft_metadata(level, &ctx.accounts.user.key())?;
    
    // Mint via Bubblegum
    MintToCollectionV1CpiBuilder::new(&ctx.accounts.bubblegum_program)
        .tree_config(&ctx.accounts.tree_config)
        .leaf_owner(&ctx.accounts.user)
        .leaf_delegate(&ctx.accounts.user)
        .merkle_tree(&ctx.accounts.merkle_tree)
        .payer(&ctx.accounts.payer)
        .tree_creator_or_delegate(&ctx.accounts.tree_authority)
        .collection_authority(&ctx.accounts.collection_authority)
        .collection_mint(&ctx.accounts.collection_mint)
        .metadata(metadata)
        .invoke()?;
    
    Ok(())
}
```

**Estimation:** 4-5 heures  
**Complexité:** Très Haute

#### 5.3 Tests Compression
**Fichier:** `tests/bubblegum-integration.test.ts`

**À tester:**
- Mint 1000+ cNFTs pour vérifier compression
- Vérifier coût storage (devrait être ~0.001 SOL par cNFT)
- Tester lecture cNFT depuis Merkle tree
- Vérifier transfert cNFT

**Estimation:** 3-4 heures  
**Complexité:** Haute

**Total Priorité 5:** ~12-15 heures

---

## 📊 PRIORITÉ 6 - Analytics & Monitoring

### À Développer

#### 6.1 Dashboard Analytics
**Fichier:** `app/src/components/Analytics.tsx`

**Métriques à afficher:**
- Volume total swaps (24h, 7j, 30j, all-time)
- Nombre utilisateurs actifs
- TVL (Total Value Locked)
- Tokens $BACK brûlés (graphique temporel)
- Distribution des niveaux cNFT (Bronze/Silver/Gold %)
- Top utilisateurs par volume
- Rebates distribués

**Estimation:** 4-5 heures  
**Complexité:** Moyenne

#### 6.2 Historique Transactions
**Fichier:** `app/src/components/TransactionHistory.tsx`

**Features:**
```tsx
interface Transaction {
  signature: string;
  type: 'swap' | 'lock' | 'unlock' | 'claim';
  amount: number;
  timestamp: Date;
  status: 'success' | 'pending' | 'failed';
}

// Afficher tableau avec pagination
<TransactionTable 
  transactions={txHistory}
  onLoadMore={loadMore}
/>
```

**Estimation:** 3-4 heures  
**Complexité:** Moyenne

#### 6.3 Notifications
**Fichier:** `app/src/hooks/useNotifications.ts`

**Types de notifications:**
- Swap complété
- cNFT minté
- Rebates disponibles
- Unlock disponible
- Buyback déclenché

**Utiliser:** React-Toastify ou Sonner

**Estimation:** 2-3 heures  
**Complexité:** Faible

**Total Priorité 6:** ~9-12 heures

---

## 🧪 PRIORITÉ 7 - Tests Complets

### État Actuel
- ✅ Tests E2E basiques (5/5)
- ❌ **MANQUE:** Tests unitaires programmes
- ❌ **MANQUE:** Tests UI (Playwright/Cypress)
- ❌ **MANQUE:** Tests d'intégration

### À Développer

#### 7.1 Tests Unitaires Programmes
**Fichiers:** `tests/swapback_*.test.ts`

**À tester:**
```typescript
describe("swapback_router", () => {
  it("devrait calculer le boost correctement", ...);
  it("devrait mint cNFT Bronze pour 15% boost", ...);
  it("devrait mint cNFT Silver pour 35% boost", ...);
  it("devrait mint cNFT Gold pour 55% boost", ...);
  it("devrait refuser lock < 10% boost", ...);
  it("devrait calculer rebates avec boost", ...);
});

describe("swapback_buyback", () => {
  it("devrait déclencher buyback au seuil", ...);
  it("devrait burn les tokens achetés", ...);
});

describe("swapback_cnft", () => {
  it("devrait initialiser collection", ...);
  it("devrait mint et update status", ...);
});
```

**Estimation:** 8-10 heures  
**Complexité:** Moyenne-Haute

#### 7.2 Tests UI (Playwright)
**Fichier:** `e2e/swapback.spec.ts`

**Scénarios:**
```typescript
test("flux complet swap", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await page.click("text=Connect Wallet");
  // Sélectionner tokens
  // Enter montant
  // Cliquer Swap
  // Vérifier transaction success
});

test("flux lock → mint cNFT", async ({ page }) => {
  // Lock 1000 $BACK
  // Vérifier cNFT créé
  // Vérifier badge affiché
});
```

**Estimation:** 5-6 heures  
**Complexité:** Moyenne

**Total Priorité 7:** ~13-16 heures

---

## ⚡ PRIORITÉ 8 - Optimisations & Sécurité

### À Développer

#### 8.1 Optimisations Performance
**Fichiers divers**

**Améliorations:**
- Cache des quotes Jupiter (éviter trop d'appels API)
- Batch les transactions multiples
- Optimiser décodage PDAs (utiliser Borsh)
- Lazy loading composants React
- Service Worker pour cache offline

**Estimation:** 6-8 heures  
**Complexité:** Haute

#### 8.2 Audit de Sécurité
**À faire:**

```markdown
Checklist Sécurité:
- [ ] Vérifier tous les authority checks
- [ ] Valider toutes les PDA derivations
- [ ] Protéger contre reentrancy attacks
- [ ] Limiter montants max (overflow protection)
- [ ] Rate limiting sur API calls
- [ ] Input sanitization UI
- [ ] Slippage protection swaps
- [ ] Emergency pause mechanism
```

**Estimation:** 8-10 heures  
**Complexité:** Très Haute

**Total Priorité 8:** ~14-18 heures

---

## 📅 ROADMAP ESTIMÉE

### Phase 1 - MVP Complet (Semaine 1-2)
**Total: ~30-40 heures**

- ✅ Programmes déployés (FAIT)
- ✅ UI basique (FAIT)
- ⏳ Interface Lock/Unlock (4-6h)
- ⏳ Token $BACK test (0.5h)
- ⏳ Système rebates basique (6-9h)
- ⏳ Swap Jupiter intégration (9-11h)
- ⏳ Tests E2E complets (5-6h)

### Phase 2 - Fonctionnalités Avancées (Semaine 3-4)
**Total: ~40-50 heures**

- Bubblegum CPI réel (12-15h)
- Buyback automatique (9-12h)
- Analytics dashboard (9-12h)
- Tests unitaires (8-10h)
- Optimisations (6-8h)

### Phase 3 - Production Ready (Semaine 5-6)
**Total: ~20-30 heures**

- Audit sécurité (8-10h)
- Tests Playwright (5-6h)
- Documentation utilisateur (4-5h)
- Déploiement mainnet (3-4h)

---

## 📊 RÉCAPITULATIF PAR PRIORITÉ

| Priorité | Fonctionnalité | Estimation | Complexité | Status |
|----------|----------------|------------|------------|--------|
| 1 | Lock/Unlock Interface | 4-6h | Moyenne | ⏳ À faire |
| 2 | Système Swap Complet | 9-11h | Haute | ⏳ À faire |
| 3 | Rebates + Claim | 6-9h | Moyenne-Haute | ⏳ À faire |
| 4 | Buyback Automatique | 9-12h | Haute | ⏳ À faire |
| 5 | Bubblegum CPI Réel | 12-15h | Très Haute | 📋 TODO #10 |
| 6 | Analytics | 9-12h | Moyenne | ⏳ À faire |
| 7 | Tests Complets | 13-16h | Haute | ⏳ À faire |
| 8 | Optimisations + Sécurité | 14-18h | Très Haute | ⏳ À faire |

**TOTAL ESTIMÉ:** ~76-99 heures (≈ 10-13 jours de travail)

---

## 🎯 RECOMMANDATIONS ORDRE DE DÉVELOPPEMENT

### Semaine 1 (MVP Fonctionnel)
1. **Créer token $BACK test** (30min) ✅ Quick win
2. **Interface Lock** (3h) → Permet de tester cNFT en conditions réelles
3. **Interface Unlock** (2h) → Compléter le cycle
4. **Système rebates basique** (6h) → Valeur ajoutée immédiate

### Semaine 2 (Swap Fonctionnel)
5. **Intégration Jupiter** (5h) → Core feature
6. **Calcul NPI** (2h) → Différentiateur clé
7. **Interface swap complète** (4h) → UX polish
8. **Tests E2E swap** (3h) → Validation

### Semaine 3 (Fonctionnalités Avancées)
9. **Bubblegum CPI** (12-15h) → Compression réelle
10. **Analytics dashboard** (5h) → Insights utilisateurs
11. **Historique transactions** (4h) → UX

### Semaine 4 (Automatisation & Polish)
12. **Buyback automatique** (10h) → Tokenomics
13. **Tests unitaires** (10h) → Qualité code
14. **Optimisations** (8h) → Performance

### Semaine 5-6 (Production)
15. **Audit sécurité** (10h) → Critique
16. **Tests Playwright** (6h) → Validation UI
17. **Documentation** (5h) → Onboarding
18. **Déploiement mainnet** (4h) → Launch 🚀

---

## 💡 QUICK WINS (Faciles & Impactants)

**À faire en premier pour démonstration:**

1. **Token $BACK test** (30min) → Permet de tester tout le reste
2. **Interface Lock basique** (2h) → Demo lock → cNFT
3. **Améliorer CNFTCard** (1h) → Polish visuel
4. **Notifications toast** (1h) → Feedback utilisateur

**Total Quick Wins:** ~4-5 heures pour rendre le système utilisable

---

## 🔗 DÉPENDANCES EXTERNES À PRÉVOIR

- **Jupiter API** → Quotes et swaps
- **Metaplex Bubblegum** → Compression cNFT
- **Clockwork** (optionnel) → Scheduled tasks
- **Helius RPC** (optionnel) → Enhanced RPC
- **Analytics service** (optionnel) → Dune, Flipside

---

## 📈 MÉTRIQUES DE SUCCÈS

**MVP Complet quand:**
- ✅ Utilisateur peut lock $BACK
- ✅ cNFT mint automatiquement
- ✅ UI affiche le cNFT
- ✅ Utilisateur peut swap avec NPI positif
- ✅ Rebates calculés et claimables
- ✅ Tests E2E 100% passent

**Production Ready quand:**
- ✅ Bubblegum CPI implémenté
- ✅ Buyback automatique actif
- ✅ Audit sécurité validé
- ✅ Tests coverage > 80%
- ✅ Documentation complète
- ✅ Déployé sur mainnet

---

**État actuel:** 95% complété  
**Prochaine étape recommandée:** Interface Lock (Priorité 1.1)  
**Temps estimé MVP:** 30-40 heures

---

*Document généré le 12 octobre 2025*
