# Jupiter CPI Integration - Solution Technique

## 🎯 Problème

Jupiter Aggregator n'est **pas directement accessible via CPI** car :
- Jupiter est un agrégateur off-chain qui calcule les meilleures routes
- Les swaps Jupiter sont exécutés via des instructions précalculées
- Impossible de faire un CPI direct vers Jupiter depuis un programme Solana

## ✅ Solutions Possibles

### Solution 1: Direct DEX CPI (RECOMMANDÉE - Production Ready)

**Avantages:**
- ✅ 100% on-chain, pas de dépendance externe
- ✅ Déterministe et fiable
- ✅ Gas fees prévisibles
- ✅ Pas besoin de services off-chain

**Implémentation:**
Intégrer directement avec Raydium V4 AMM via CPI pour swap USDC → $BACK

**DEX supportés:**
- **Raydium V4** (le plus populaire, recommandé)
- **Orca Whirlpools**
- **Meteora**

**Code:**
```rust
// CPI vers Raydium V4 AMM
pub fn swap_raydium_v4(
    ctx: Context<SwapRaydium>,
    amount_in: u64,
    minimum_amount_out: u64,
) -> Result<u64> {
    // Invoke Raydium V4 swap instruction
    raydium_amm::swap(
        ctx.accounts.amm_program,
        ctx.accounts.amm,
        ctx.accounts.amm_authority,
        ctx.accounts.pool_usdc,
        ctx.accounts.pool_back,
        ctx.accounts.user_usdc,
        ctx.accounts.user_back,
        amount_in,
        minimum_amount_out,
    )?;
    
    // Retourner le montant reçu
    Ok(amount_received)
}
```

### Solution 2: Jupiter Instructions Pass-Through (Flexible)

**Avantages:**
- ✅ Meilleur prix via agrégation
- ✅ Routes optimisées automatiquement
- ✅ Supporte tous les DEX

**Inconvénients:**
- ⚠️ Nécessite un service off-chain pour calculer les routes
- ⚠️ Plus complexe à implémenter
- ⚠️ Dépendance à l'API Jupiter

**Implémentation:**
```rust
// Le frontend calcule la route Jupiter
const route = await fetch('https://quote-api.jup.ag/v6/quote', {
    params: { inputMint: USDC, outputMint: BACK, amount: usdcAmount }
});

// Obtient les instructions de swap
const swapInstructions = await fetch('https://quote-api.jup.ag/v6/swap', {
    body: { route, userPublicKey: buybackProgram }
});

// Le programme execute_buyback reçoit ces instructions et les exécute
```

### Solution 3: Hybrid Approach (MEILLEURE pour SwapBack)

**Concept:**
- Utiliser Raydium CPI comme fallback fiable
- Permettre optionnellement de passer des instructions Jupiter précalculées
- Le programme vérifie les slippage protections

**Code:**
```rust
pub fn execute_buyback(
    ctx: Context<ExecuteBuyback>,
    max_usdc_amount: u64,
    min_back_amount: u64,
    swap_mode: SwapMode, // Direct ou Jupiter
    jupiter_instructions: Option<Vec<Instruction>>, // Si mode Jupiter
) -> Result<()> {
    match swap_mode {
        SwapMode::RaydiumDirect => {
            // CPI direct vers Raydium (simple, fiable)
            swap_raydium_v4(ctx, max_usdc_amount, min_back_amount)?
        }
        SwapMode::JupiterRoute => {
            // Exécuter les instructions Jupiter précalculées
            let instructions = jupiter_instructions.ok_or(ErrorCode::MissingJupiterInstructions)?;
            
            // Validation de sécurité
            validate_jupiter_instructions(&instructions, max_usdc_amount, min_back_amount)?;
            
            // Exécuter via invoke_signed
            for ix in instructions {
                invoke_signed(&ix, ctx.accounts, signer_seeds)?;
            }
        }
    }
}
```

## 🚀 Recommandation Finale

Pour **SwapBack DEX - Phase 1 (Mainnet Launch):**

### Implémenter Solution 1: Raydium V4 CPI Direct

**Raisons:**
1. ✅ **Simplicité** - Moins de code, moins de bugs
2. ✅ **Fiabilité** - Pas de dépendance API externe
3. ✅ **Rapidité** - Déploiement immédiat sans infrastructure off-chain
4. ✅ **Sécurité** - Audit plus simple, surface d'attaque réduite
5. ✅ **Performance** - Pas de latence API, exécution directe on-chain

**Pour Phase 2 (Post-Launch Optimization):**
- Ajouter Jupiter route pass-through (Solution 3)
- Comparer les prix Raydium vs Jupiter
- Choisir automatiquement la meilleure route

## 📦 Implémentation

### Étape 1: Ajouter Raydium AMM Dependency

```toml
# programs/swapback_buyback/Cargo.toml
[dependencies]
anchor-lang = { workspace = true, features = ["init-if-needed"] }
anchor-spl = { workspace = true }
raydium-amm = { git = "https://github.com/raydium-io/raydium-amm", features = ["cpi"] }
```

### Étape 2: Créer le Context pour Raydium Swap

```rust
#[derive(Accounts)]
pub struct SwapRaydium<'info> {
    /// Buyback state PDA (authority pour signer)
    #[account(
        mut,
        seeds = [b"buyback_state"],
        bump = buyback_state.bump,
    )]
    pub buyback_state: Account<'info, BuybackState>,
    
    /// Raydium AMM Program
    /// CHECK: Raydium V4 program ID validé
    #[account(address = raydium_amm::ID)]
    pub amm_program: AccountInfo<'info>,
    
    /// Raydium AMM Pool Account
    /// CHECK: Validé par Raydium program
    #[account(mut)]
    pub amm: AccountInfo<'info>,
    
    /// Raydium AMM Authority
    /// CHECK: Validé par Raydium program
    pub amm_authority: AccountInfo<'info>,
    
    /// Pool USDC token account
    #[account(mut)]
    pub pool_usdc: Account<'info, TokenAccount>,
    
    /// Pool BACK token account
    #[account(mut)]
    pub pool_back: Account<'info, TokenAccount>,
    
    /// USDC vault (source)
    #[account(mut)]
    pub usdc_vault: Account<'info, TokenAccount>,
    
    /// BACK vault (destination)
    #[account(mut)]
    pub back_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}
```

### Étape 3: Modifier execute_buyback()

```rust
pub fn execute_buyback(
    ctx: Context<ExecuteBuyback>,
    max_usdc_amount: u64,
    min_back_amount: u64,
) -> Result<()> {
    let buyback_state = &mut ctx.accounts.buyback_state;
    
    // Validation
    require!(
        ctx.accounts.usdc_vault.amount >= buyback_state.min_buyback_amount,
        ErrorCode::InsufficientFunds
    );
    
    let actual_usdc = std::cmp::min(max_usdc_amount, ctx.accounts.usdc_vault.amount);
    
    // ✅ SWAP RAYDIUM V4 via CPI
    let back_bought = swap_via_raydium(
        &ctx.accounts.raydium_swap,
        actual_usdc,
        min_back_amount,
        buyback_state.bump,
    )?;
    
    // Mise à jour stats
    buyback_state.total_usdc_spent = buyback_state
        .total_usdc_spent
        .checked_add(actual_usdc)
        .ok_or(ErrorCode::MathOverflow)?;
    
    buyback_state.buyback_count = buyback_state
        .buyback_count
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    
    emit!(BuybackExecuted {
        usdc_amount: actual_usdc,
        back_amount: back_bought,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

// Fonction helper pour le swap
fn swap_via_raydium(
    accounts: &SwapRaydium,
    amount_in: u64,
    minimum_amount_out: u64,
    bump: u8,
) -> Result<u64> {
    // PDA signer seeds
    let seeds = &[b"buyback_state".as_ref(), &[bump]];
    let signer = &[&seeds[..]];
    
    // CPI vers Raydium AMM
    let cpi_accounts = raydium_amm::cpi::accounts::Swap {
        amm: accounts.amm.to_account_info(),
        amm_authority: accounts.amm_authority.to_account_info(),
        amm_open_orders: accounts.amm_open_orders.to_account_info(),
        pool_coin_token_account: accounts.pool_usdc.to_account_info(),
        pool_pc_token_account: accounts.pool_back.to_account_info(),
        serum_program: accounts.serum_program.to_account_info(),
        serum_market: accounts.serum_market.to_account_info(),
        serum_bids: accounts.serum_bids.to_account_info(),
        serum_asks: accounts.serum_asks.to_account_info(),
        serum_event_queue: accounts.serum_event_queue.to_account_info(),
        serum_coin_vault: accounts.serum_coin_vault.to_account_info(),
        serum_pc_vault: accounts.serum_pc_vault.to_account_info(),
        serum_vault_signer: accounts.serum_vault_signer.to_account_info(),
        user_source_token_account: accounts.usdc_vault.to_account_info(),
        user_destination_token_account: accounts.back_vault.to_account_info(),
        user_source_owner: accounts.buyback_state.to_account_info(),
        token_program: accounts.token_program.to_account_info(),
    };
    
    let cpi_program = accounts.amm_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    
    raydium_amm::cpi::swap(
        cpi_ctx,
        amount_in,
        minimum_amount_out,
    )?;
    
    // Calculer le montant reçu (difference de balance)
    let back_received = accounts.back_vault.amount;
    
    Ok(back_received)
}
```

## 🔧 Alternative Simplifiée (Sans dépendance Raydium)

Si Raydium CPI est trop complexe, utiliser **Direct Token Swap Simulation**:

```rust
// Pour le MVP/Demo, simuler le swap avec un ratio fixe
// En production, remplacer par un oracle (Pyth/Switchboard)
pub fn execute_buyback(
    ctx: Context<ExecuteBuyback>,
    max_usdc_amount: u64,
    min_back_amount: u64,
) -> Result<()> {
    // Obtenir le prix de $BACK depuis Pyth Oracle
    let back_price_feed = &ctx.accounts.back_price_feed;
    let price = back_price_feed.get_current_price()
        .ok_or(ErrorCode::InvalidOracle)?;
    
    // Calculer combien de $BACK on peut acheter
    let back_amount = (max_usdc_amount as u128)
        .checked_mul(1_000_000) // USDC decimals
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(price.price as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;
    
    // Vérifier slippage protection
    require!(
        back_amount >= min_back_amount,
        ErrorCode::SlippageExceeded
    );
    
    // Transfert USDC vers pool externe (Raydium pool directement)
    // Transfert BACK depuis pool vers vault
    
    Ok(())
}
```

## 📊 Comparaison des Solutions

| Critère | Raydium Direct CPI | Jupiter Pass-Through | Oracle Simulation |
|---------|-------------------|---------------------|-------------------|
| **Complexité** | Moyenne | Haute | Faible |
| **Fiabilité** | Haute | Moyenne | Moyenne |
| **Prix** | Pool Raydium | Meilleur prix | Prix Oracle |
| **Temps dev** | 2-3 jours | 4-5 jours | 1 jour |
| **Audit** | Standard | Complexe | Simple |
| **Mainnet ready** | ✅ Oui | ⚠️ Nécessite backend | ⚠️ MVP only |

## 🎯 Action Plan

**MAINTENANT (31 Oct):**
1. Implémenter Oracle Simulation (MVP quick win)
2. Ajouter Pyth Price Feed pour $BACK/USDC
3. Tester sur devnet avec token $BACK créé

**CETTE SEMAINE (1-3 Nov):**
1. Implémenter Raydium V4 CPI (production)
2. Créer pool Raydium USDC/$BACK sur devnet
3. Tests end-to-end complets

**PHASE 2 (Post-launch):**
1. Ajouter Jupiter route optimization
2. Auto-routing meilleur prix
3. Multi-DEX aggregation

## 🚀 Next Steps

1. ✅ Créer token $BACK (déjà fait - TODO #4)
2. ⏳ Choisir approche: Oracle MVP ou Raydium CPI ?
3. ⏳ Implémenter solution choisie
4. ⏳ Tester avec vrais tokens sur devnet
5. ⏳ Deploy & validate

**Recommandation:** Commencer avec **Oracle Simulation** pour déployer rapidement, puis migrer vers **Raydium CPI** dans la semaine.
