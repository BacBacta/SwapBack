# Analyse: Buyback-Burn & Rebates - État du développement

## 📊 Résumé exécutif

| Fonctionnalité | Programme Solana | SDK | Frontend | État |
|---|---|---|---|---|
| **Buyback-Burn** | ✅ Complet | ⚠️ Partiel | ✅ UI Ready | 🟡 Partiellement fonctionnel |
| **Rebates** | ❌ Non implémenté | ✅ Types définis | ✅ UI Ready | 🔴 Non fonctionnel |

---

## 🔥 1. BUYBACK-BURN

### ✅ Programme Solana: `/programs/swapback_buyback/src/lib.rs`

**État**: Développé et compilé (283 KB)

**Fonctions implémentées**:

1. **`initialize()`** - Initialise le programme de buyback
   ```rust
   pub fn initialize(ctx: Context<Initialize>, min_buyback_amount: u64)
   ```
   - Crée le state PDA
   - Configure le vault USDC
   - Définit l'autorité et le montant minimum

2. **`deposit_usdc()`** - Dépose des USDC pour buyback
   ```rust
   pub fn deposit_usdc(ctx: Context<DepositUSDC>, amount: u64)
   ```
   - Transfère USDC vers le vault
   - Emit event `USDCDeposited`
   - Appelé par le router après chaque swap

3. **`execute_buyback()`** - Achète $BACK avec USDC
   ```rust
   pub fn execute_buyback(ctx, max_usdc_amount, min_back_amount)
   ```
   - Vérifie le montant minimum
   - **TODO**: Intégration Jupiter pour swap USDC → $BACK
   - Met à jour les stats (total spent, count)
   - Emit event `BuybackExecuted`

4. **`burn_back()`** - Brûle les tokens $BACK
   ```rust
   pub fn burn_back(ctx: Context<BurnBack>, amount: u64)
   ```
   - Brûle les $BACK du vault
   - Utilise PDA signer
   - Met à jour `total_back_burned`
   - Emit event `BackBurned`

5. **`update_params()`** - Met à jour les paramètres
   ```rust
   pub fn update_params(ctx, new_min_buyback)
   ```
   - Permet de changer le minimum buyback

**State Account**:
```rust
pub struct BuybackState {
    pub authority: Pubkey,
    pub back_mint: Pubkey,
    pub usdc_vault: Pubkey,
    pub min_buyback_amount: u64,
    pub total_usdc_spent: u64,      // ✅ Tracking
    pub total_back_burned: u64,     // ✅ Tracking
    pub buyback_count: u64,         // ✅ Tracking
    pub bump: u8,
}
```

**Déployé sur Devnet**: 
- Program ID: `46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU`
- Taille: 792 KB (compilé)

### ⚠️ SDK: Implémentation partielle

**Fichier**: `/sdk/src/index.ts`

**Défini dans les types**:
```typescript
interface RouteSimulation {
  burnAmount: number;  // ✅ Défini
}

interface SwapResult {
  burnExecuted: number;  // ✅ Défini
}
```

**Manque**: 
- ❌ Fonction `depositUSDC()` non exposée
- ❌ Fonction `executeBuyback()` non exposée
- ❌ Fonction `burnBack()` non exposée
- ❌ Pas d'intégration avec le programme buyback

### ✅ Frontend: UI implémentée

**Fichier**: `/app/src/components/SwapInterface.tsx`

**Affichage**:
```tsx
<div>
  <span>Burn $BACK (10%)</span>
  <span>{routeInfo.burn.toFixed(4)} USDC</span>
</div>
```

**Calcul simulé**:
```typescript
burn: parseFloat(inputAmount) * 0.0005  // 0.05% du swap
```

**Dashboard**: `/app/src/components/Dashboard.tsx`
```tsx
<div>[$BACK BURNED]</div>
<div>{globalStats.totalBurned.toLocaleString()}</div>
```

### 🔴 Problèmes à résoudre

1. **Intégration Jupiter manquante** dans `execute_buyback()`
   - Actuellement: Swap simulé
   - Besoin: CPI vers Jupiter pour USDC → $BACK

2. **SDK incomplet**
   - Pas de méthodes pour interagir avec le programme buyback
   - Pas d'appel automatique à `deposit_usdc()` après swap

3. **Frontend déconnecté**
   - Affiche des valeurs mockées
   - Pas de lecture du `BuybackState` on-chain

---

## 💰 2. REBATES

### ❌ Programme Solana: NON IMPLÉMENTÉ

**Recherche effectuée**:
```bash
grep -r "rebate" programs/**/*.rs
# Résultat: No matches found
```

**Conclusion**: Aucun code Solana pour les rebates.

### ✅ SDK: Types définis

**Fichier**: `/sdk/src/index.ts`

```typescript
interface RouteSimulation {
  rebateAmount: number;  // ✅ Défini
}

interface SwapResult {
  rebateEarned: number;  // ✅ Défini
}

interface UserStats {
  totalRebates: number;     // ✅ Défini
  pendingRebates: number;   // ✅ Défini
  rebateBoost: number;      // ✅ Défini (lié au lock cNFT)
}
```

**Référence à un PDA**:
```typescript
const [userRebatePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("user_rebate"), this.wallet.publicKey.toBuffer()],
  this.routerProgramId
);

// Tentative de lecture (mais le compte n'existe pas on-chain)
const accountInfo = await connection.getAccountInfo(userRebatePDA);
```

### ✅ Frontend: UI implémentée

**Fichier**: `/app/src/components/SwapInterface.tsx`

**Affichage**:
```tsx
<div>
  <span>Your rebate (30%)</span>
  <span>+{routeInfo.rebate.toFixed(4)} USDC</span>
</div>
```

**Calcul simulé**:
```typescript
rebate: parseFloat(inputAmount) * 0.0015  // 0.15% du swap
```

**Dashboard**: `/app/src/components/Dashboard.tsx`
```tsx
<div>[REBATES]</div>
<div>${userStats.totalRebates.toFixed(2)}</div>

{userStats.pendingRebates > 0 && (
  <div>[PENDING REBATES]</div>
  <div>${userStats.pendingRebates.toFixed(2)}</div>
)}
```

### 🔴 Problèmes à résoudre

1. **Aucun programme Solana**
   - Besoin: Créer `swapback_rebates` program
   - Fonctions requises:
     - `initialize_user_rebate()`
     - `distribute_rebate()`
     - `claim_rebate()`
     - `update_rebate_rate()`

2. **Structure de données manquante**
   ```rust
   // À implémenter
   pub struct UserRebate {
       pub owner: Pubkey,
       pub total_earned: u64,
       pub total_claimed: u64,
       pub pending_amount: u64,
       pub boost_multiplier: u16,  // Basé sur cNFT lock
       pub last_claim: i64,
   }
   ```

3. **Intégration avec router manquante**
   - Le router devrait appeler `distribute_rebate()` après chaque swap
   - Calculer le montant basé sur le volume et le boost

4. **Intégration avec cNFT lock manquante**
   - Les rebates devraient être boostés selon le niveau de lock
   - Exemple: Bronze +10%, Silver +25%, Gold +50%

---

## 📈 3. MÉCANISME COMPLET (comme prévu)

### Flow théorique

```
1. USER SWAP
   ├─ Input: 100 SOL
   ├─ Router fee: 0.5 SOL (0.5%)
   └─ Split fee:
       ├─ Buyback: 0.05 SOL (10% de la fee = 0.05% du swap)
       ├─ Rebate pool: 0.15 SOL (30% de la fee = 0.15% du swap)
       └─ Treasury: 0.30 SOL (60% de la fee = 0.30% du swap)

2. BUYBACK (automatique ou manuel)
   ├─ Vault USDC accumulé → Swap vers $BACK (Jupiter)
   └─ $BACK acheté → Burn immédiat
   
3. REBATE (temps réel)
   ├─ Calcul: 0.15 SOL * boost_multiplier
   ├─ Si user a cNFT Bronze locked: 0.15 * 1.1 = 0.165 SOL
   └─ Rebate ajouté au compte user_rebate (pending)

4. CLAIM REBATE (par l'utilisateur)
   ├─ User clique "Claim Rebates"
   └─ Transfert des pending_rebates vers son wallet
```

### États actuels

| Étape | Solana | SDK | Frontend | Fonctionnel |
|---|---|---|---|---|
| 1. Router fee split | ❌ | ❌ | ✅ Mock | 🔴 Non |
| 2. Buyback deposit | ✅ | ❌ | ✅ Mock | 🔴 Non |
| 3. Buyback execute | ⚠️ Sans Jupiter | ❌ | ✅ Mock | 🔴 Non |
| 4. Burn $BACK | ✅ | ❌ | ✅ Mock | 🔴 Non |
| 5. Rebate tracking | ❌ | ⚠️ Types | ✅ Mock | 🔴 Non |
| 6. Rebate boost (cNFT) | ❌ | ❌ | ❌ | 🔴 Non |
| 7. Claim rebate | ❌ | ❌ | ❌ | 🔴 Non |

---

## 🛠️ 4. TRAVAIL À FAIRE

### Priority 1: Compléter Buyback

1. **Intégrer Jupiter dans `execute_buyback()`**
   ```rust
   // Dans programs/swapback_buyback/src/lib.rs
   pub fn execute_buyback(...) {
       // CPI vers Jupiter
       // Swap USDC → $BACK
       // Stocker $BACK dans back_vault
   }
   ```

2. **Créer SDK buyback**
   ```typescript
   // Dans sdk/src/index.ts
   class BuybackClient {
       async executeBuyback(): Promise<string>
       async getBuybackStats(): Promise<BuybackStats>
   }
   ```

3. **Connecter le router au buyback**
   ```rust
   // Dans programs/swapback_router/src/lib.rs
   pub fn execute_swap(...) {
       // Après le swap
       deposit_usdc_to_buyback(fee_amount * 0.1)?;
   }
   ```

### Priority 2: Implémenter Rebates

1. **Créer le programme rebates**
   ```bash
   anchor init swapback_rebates
   ```

2. **Structures de données**
   ```rust
   #[account]
   pub struct GlobalRebateConfig {
       pub rebate_rate: u16,        // 30% = 3000 bps
       pub total_distributed: u64,
   }

   #[account]
   pub struct UserRebate {
       pub owner: Pubkey,
       pub total_earned: u64,
       pub total_claimed: u64,
       pub pending_amount: u64,
       pub boost_multiplier: u16,   // 100 = 1.0x, 150 = 1.5x
   }
   ```

3. **Instructions**
   ```rust
   pub fn initialize_user_rebate(ctx) -> Result<()>
   pub fn distribute_rebate(ctx, amount) -> Result<()>
   pub fn claim_rebate(ctx) -> Result<()>
   pub fn update_boost(ctx, nft_level) -> Result<()>
   ```

4. **Intégration avec router**
   ```rust
   // Appel dans execute_swap
   distribute_rebate_cpi(fee_amount * 0.3, boost)?;
   ```

### Priority 3: Intégration cNFT → Rebate Boost

1. **Lire le niveau du cNFT locked**
   ```rust
   // Dans swapback_rebates
   let cnft_level = get_user_cnft_level(user)?;
   let boost = match cnft_level {
       Level::Bronze => 110,  // 1.1x
       Level::Silver => 125,  // 1.25x
       Level::Gold => 150,    // 1.5x
       _ => 100,              // 1.0x
   };
   ```

2. **Calculer rebate avec boost**
   ```rust
   let base_rebate = swap_volume * rebate_rate / 10000;
   let boosted_rebate = base_rebate * boost / 100;
   user_rebate.pending_amount += boosted_rebate;
   ```

---

## 📊 5. DASHBOARD & STATS

### Données à afficher (actuellement mockées)

**Global Stats**:
```typescript
totalBurned: number      // ✅ Devrait venir de BuybackState.total_back_burned
totalRebates: number     // ❌ Besoin GlobalRebateConfig.total_distributed
```

**User Stats**:
```typescript
totalRebates: number     // ❌ Besoin UserRebate.total_earned
pendingRebates: number   // ❌ Besoin UserRebate.pending_amount
rebateBoost: number      // ❌ Besoin UserRebate.boost_multiplier
```

### Requêtes à implémenter

```typescript
// Lire buyback stats
const buybackState = await program.account.buybackState.fetch(buybackPDA);
globalStats.totalBurned = buybackState.totalBackBurned;

// Lire user rebates (quand le programme existera)
const userRebate = await rebatesProgram.account.userRebate.fetch(userPDA);
userStats.pendingRebates = userRebate.pendingAmount;
userStats.rebateBoost = userRebate.boostMultiplier / 100;
```

---

## 🎯 CONCLUSION

### Ce qui fonctionne ✅
- Programme buyback compilé et déployé
- UI complète pour buyback et rebates
- Types SDK définis

### Ce qui ne fonctionne PAS ❌
- Buyback-burn: Pas d'intégration Jupiter, pas de CPI depuis router
- Rebates: Aucun programme on-chain, tout est mocké
- Stats: Toutes les valeurs sont en dur

### Estimation du travail restant
- **Buyback complet**: 2-3 jours
  - Intégration Jupiter: 1 jour
  - SDK + Router CPI: 1 jour
  - Tests: 0.5 jour

- **Rebates complet**: 4-5 jours
  - Programme Solana: 2 jours
  - SDK + Frontend: 1 jour
  - Intégration cNFT boost: 1 jour
  - Tests: 1 jour

**Total**: 6-8 jours de développement pour avoir buyback-burn + rebates 100% fonctionnels.

---

## 📝 Prochaines étapes recommandées

1. Finir le buyback (intégration Jupiter)
2. Créer le programme rebates
3. Intégrer les deux dans le router
4. Connecter le frontend aux vraies données on-chain
5. Tests end-to-end

**Date du rapport**: 25 octobre 2025
