# 🦀 Guide d'Intégration Backend Rust - Système de Boost Dynamique

**Date**: 26 octobre 2025  
**Status**: 📋 À FAIRE  
**Prérequis**: Frontend implémenté ✅

---

## 📋 Vue d'Ensemble

Ce guide détaille comment intégrer le nouveau système de boost dynamique dans les programmes Solana (Rust/Anchor).

### Objectifs
1. ✅ Mettre à jour le calcul de boost on-chain
2. ✅ Étendre le système de tiers à 5 niveaux
3. ✅ Implémenter le tracking du boost total de la communauté
4. ✅ Créer la distribution automatique du buyback basée sur le boost

---

## 🎯 Changements Requis

### 1. **Programme `swapback_cnft` - Calcul de Boost**

**Fichier**: `programs/swapback_cnft/src/lib.rs`

#### A. Nouvelle Fonction de Calcul

```rust
/// Calcule le boost dynamique basé sur le montant et la durée
/// Retourne le boost en basis points (10000 = 100%)
pub fn calculate_boost(amount: u64, duration_days: u64) -> u64 {
    // Amount score: max 5000 basis points (50%)
    // Formula: (amount / 1000) * 50
    let amount_tokens = amount / 1_000_000_000; // Convertir lamports en tokens
    let amount_score = std::cmp::min((amount_tokens / 1000) * 50, 5000);
    
    // Duration score: max 5000 basis points (50%)
    // Formula: (days / 10) * 100
    let duration_score = std::cmp::min((duration_days / 10) * 100, 5000);
    
    // Total boost: max 10000 basis points (100%)
    std::cmp::min(amount_score + duration_score, 10000)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_boost_small_lock() {
        // 1,000 BACK × 30 days = 3.5% boost
        let amount = 1_000 * 1_000_000_000; // 1k tokens in lamports
        let duration = 30;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 350); // 3.5% = 350 basis points
    }

    #[test]
    fn test_calculate_boost_medium_lock() {
        // 10,000 BACK × 180 days = 23% boost
        let amount = 10_000 * 1_000_000_000;
        let duration = 180;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 2300); // 23% = 2300 basis points
    }

    #[test]
    fn test_calculate_boost_whale_lock() {
        // 100,000 BACK × 365 days = 86.5% boost
        let amount = 100_000 * 1_000_000_000;
        let duration = 365;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 8650); // 86.5% = 8650 basis points
    }

    #[test]
    fn test_calculate_boost_maximum() {
        // 100,000 BACK × 730 days = 100% boost (capped)
        let amount = 100_000 * 1_000_000_000;
        let duration = 730;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 10000); // 100% = 10000 basis points (max)
    }
}
```

---

#### B. Nouveau Système de Tiers

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum CNFTLevel {
    Bronze,
    Silver,
    Gold,
    Platinum,
    Diamond,
}

impl CNFTLevel {
    /// Détermine le tier basé sur le montant et la durée
    pub fn from_lock_params(amount: u64, duration_days: u64) -> Self {
        let amount_tokens = amount / 1_000_000_000;

        // Diamond: 100,000+ BACK AND 365+ days
        if amount_tokens >= 100_000 && duration_days >= 365 {
            return CNFTLevel::Diamond;
        }
        // Platinum: 50,000+ BACK AND 180+ days
        else if amount_tokens >= 50_000 && duration_days >= 180 {
            return CNFTLevel::Platinum;
        }
        // Gold: 10,000+ BACK AND 90+ days
        else if amount_tokens >= 10_000 && duration_days >= 90 {
            return CNFTLevel::Gold;
        }
        // Silver: 1,000+ BACK AND 30+ days
        else if amount_tokens >= 1_000 && duration_days >= 30 {
            return CNFTLevel::Silver;
        }
        // Bronze: 100+ BACK AND 7+ days (default)
        else {
            return CNFTLevel::Bronze;
        }
    }

    /// Obtient le badge emoji pour l'UI
    pub fn emoji(&self) -> &str {
        match self {
            CNFTLevel::Diamond => "💎",
            CNFTLevel::Platinum => "💍",
            CNFTLevel::Gold => "🥇",
            CNFTLevel::Silver => "🥈",
            CNFTLevel::Bronze => "🥉",
        }
    }
}
```

---

### 2. **État des Comptes - Nouvelles Structures**

**Fichier**: `programs/swapback_cnft/src/state.rs`

```rust
use anchor_lang::prelude::*;

/// Position de lock d'un utilisateur
#[account]
pub struct LockPosition {
    /// Propriétaire de la position
    pub owner: Pubkey,
    
    /// Montant de tokens lockés (en lamports)
    pub amount: u64,
    
    /// Timestamp de création du lock
    pub locked_at: i64,
    
    /// Timestamp de déblocage
    pub unlock_at: i64,
    
    /// Boost de cet utilisateur (en basis points, 10000 = 100%)
    pub boost: u64,
    
    /// Niveau du cNFT (Bronze, Silver, Gold, Platinum, Diamond)
    pub level: CNFTLevel,
    
    /// Bump seed pour le PDA
    pub bump: u8,
}

impl LockPosition {
    pub const LEN: usize = 8 + // discriminator
        32 + // owner
        8 + // amount
        8 + // locked_at
        8 + // unlock_at
        8 + // boost
        1 + // level (enum)
        1; // bump
}

/// État global du programme cNFT
#[account]
pub struct GlobalState {
    /// Authority du programme
    pub authority: Pubkey,
    
    /// Nombre total de positions de lock actives
    pub total_locks: u64,
    
    /// Montant total de tokens lockés (en lamports)
    pub total_locked: u64,
    
    /// Boost total de la communauté (somme de tous les boosts actifs)
    /// En basis points (10000 = 100%)
    pub total_community_boost: u64,
    
    /// Timestamp de la dernière distribution de buyback
    pub last_buyback_distribution: i64,
    
    /// Bump seed
    pub bump: u8,
}

impl GlobalState {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        8 + // total_locks
        8 + // total_locked
        8 + // total_community_boost
        8 + // last_buyback_distribution
        1; // bump
}
```

---

### 3. **Instruction `lock_tokens` - Mise à Jour**

**Fichier**: `programs/swapback_cnft/src/instructions/lock_tokens.rs`

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{LockPosition, GlobalState, CNFTLevel};
use crate::calculate_boost;

#[derive(Accounts)]
pub struct LockTokens<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// Position de lock de l'utilisateur
    #[account(
        init,
        payer = user,
        space = LockPosition::LEN,
        seeds = [b"lock_position", user.key().as_ref()],
        bump
    )]
    pub lock_position: Account<'info, LockPosition>,
    
    /// État global
    #[account(
        mut,
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,
    
    /// Compte de tokens source (utilisateur)
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    /// Compte de tokens destination (vault)
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<LockTokens>,
    amount: u64,
    duration_days: u64,
) -> Result<()> {
    let lock_position = &mut ctx.accounts.lock_position;
    let global_state = &mut ctx.accounts.global_state;
    
    // Validation
    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(duration_days >= 7, ErrorCode::DurationTooShort);
    
    // Calculer le boost
    let boost = calculate_boost(amount, duration_days);
    
    // Déterminer le niveau
    let level = CNFTLevel::from_lock_params(amount, duration_days);
    
    // Calculer le timestamp de déblocage
    let clock = Clock::get()?;
    let unlock_at = clock.unix_timestamp
        .checked_add((duration_days * 24 * 60 * 60) as i64)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // Initialiser la position de lock
    lock_position.owner = ctx.accounts.user.key();
    lock_position.amount = amount;
    lock_position.locked_at = clock.unix_timestamp;
    lock_position.unlock_at = unlock_at;
    lock_position.boost = boost;
    lock_position.level = level;
    lock_position.bump = ctx.bumps.lock_position;
    
    // Mettre à jour l'état global
    global_state.total_locks = global_state.total_locks
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    
    global_state.total_locked = global_state.total_locked
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    
    global_state.total_community_boost = global_state.total_community_boost
        .checked_add(boost)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // Transférer les tokens vers le vault
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, amount)?;
    
    msg!("Locked {} tokens for {} days", amount, duration_days);
    msg!("Boost: {} basis points ({}%)", boost, boost / 100);
    msg!("Level: {:?} {}", level, level.emoji());
    msg!("Total community boost: {}", global_state.total_community_boost);
    
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,
    
    #[msg("Duration must be at least 7 days")]
    DurationTooShort,
    
    #[msg("Math overflow")]
    MathOverflow,
}
```

---

### 4. **Instruction `unlock_tokens` - Mise à Jour**

**Fichier**: `programs/swapback_cnft/src/instructions/unlock_tokens.rs`

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{LockPosition, GlobalState};

#[derive(Accounts)]
pub struct UnlockTokens<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// Position de lock de l'utilisateur
    #[account(
        mut,
        close = user,
        seeds = [b"lock_position", user.key().as_ref()],
        bump = lock_position.bump,
        constraint = lock_position.owner == user.key()
    )]
    pub lock_position: Account<'info, LockPosition>,
    
    /// État global
    #[account(
        mut,
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,
    
    /// Compte de tokens destination (utilisateur)
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    /// Compte de tokens source (vault)
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    /// PDA du vault (signer pour le transfer)
    /// CHECK: Vérifié par seeds
    #[account(
        seeds = [b"vault"],
        bump
    )]
    pub vault: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<UnlockTokens>) -> Result<()> {
    let lock_position = &ctx.accounts.lock_position;
    let global_state = &mut ctx.accounts.global_state;
    
    // Vérifier que la période de lock est terminée
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= lock_position.unlock_at,
        ErrorCode::LockPeriodNotOver
    );
    
    // Mettre à jour l'état global (AVANT de fermer le compte)
    global_state.total_locks = global_state.total_locks.saturating_sub(1);
    global_state.total_locked = global_state.total_locked.saturating_sub(lock_position.amount);
    global_state.total_community_boost = global_state.total_community_boost.saturating_sub(lock_position.boost);
    
    // Transférer les tokens du vault vers l'utilisateur
    let vault_bump = ctx.bumps.vault;
    let vault_seeds = &[b"vault".as_ref(), &[vault_bump]];
    let signer_seeds = &[&vault_seeds[..]];
    
    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_ctx, lock_position.amount)?;
    
    msg!("Unlocked {} tokens", lock_position.amount);
    msg!("Boost lost: {} basis points", lock_position.boost);
    msg!("Total community boost: {}", global_state.total_community_boost);
    
    // Le compte lock_position sera fermé automatiquement (close = user)
    
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Lock period is not over yet")]
    LockPeriodNotOver,
}
```

---

### 5. **Programme `swapback_buyback` - Distribution Basée sur le Boost**

**Fichier**: `programs/swapback_buyback/src/lib.rs`

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Burn};

declare_id!("BuybackProgramID111111111111111111111111111");

#[program]
pub mod swapback_buyback {
    use super::*;
    
    /// Distribue les tokens de buyback proportionnellement au boost de chaque utilisateur
    pub fn distribute_buyback(ctx: Context<DistributeBuyback>) -> Result<()> {
        let global_state = &ctx.accounts.global_state;
        let buyback_vault = &ctx.accounts.buyback_vault;
        
        // Montant total de tokens à distribuer/brûler
        let total_buyback_tokens = buyback_vault.amount;
        
        require!(
            total_buyback_tokens > 0,
            ErrorCode::NoBuybackTokens
        );
        
        require!(
            global_state.total_community_boost > 0,
            ErrorCode::NoActiveBoost
        );
        
        msg!("Starting buyback distribution");
        msg!("Total tokens: {}", total_buyback_tokens);
        msg!("Total community boost: {}", global_state.total_community_boost);
        
        // Note: Cette instruction devrait être appelée pour CHAQUE utilisateur
        // avec une position de lock active. Dans une implémentation complète,
        // on itérerait sur tous les comptes ou on utiliserait un système de claim.
        
        // Pour l'instant, cette instruction calcule et brûle la part d'UN utilisateur
        // Elle doit être appelée séparément pour chaque lock position
        
        Ok(())
    }
    
    /// Brûle la part de buyback d'un utilisateur spécifique
    pub fn burn_user_share(
        ctx: Context<BurnUserShare>,
        lock_position_bump: u8,
    ) -> Result<()> {
        let lock_position = &ctx.accounts.lock_position;
        let global_state = &ctx.accounts.global_state;
        let buyback_vault = &ctx.accounts.buyback_vault;
        
        // Calculer la part de l'utilisateur
        // Formula: user_share = (user_boost / total_community_boost) * total_buyback_tokens
        let user_boost = lock_position.boost as u128;
        let total_boost = global_state.total_community_boost as u128;
        let total_tokens = buyback_vault.amount as u128;
        
        let user_share = (user_boost
            .checked_mul(total_tokens)
            .ok_or(ErrorCode::MathOverflow)?)
            .checked_div(total_boost)
            .ok_or(ErrorCode::MathOverflow)? as u64;
        
        msg!("User boost: {} basis points", lock_position.boost);
        msg!("User share: {} / {} = {}%", user_boost, total_boost, (user_boost * 100) / total_boost);
        msg!("Burning {} tokens for user", user_share);
        
        // Brûler les tokens
        let burn_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.back_mint.to_account_info(),
                from: ctx.accounts.buyback_vault.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
        );
        token::burn(burn_ctx, user_share)?;
        
        msg!("✅ Burned {} $BACK for {}", user_share, lock_position.owner);
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct DistributeBuyback<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// État global du programme cNFT
    /// CHECK: Vérifié par seeds du programme cNFT
    pub global_state: AccountInfo<'info>,
    
    /// Vault contenant les tokens de buyback
    #[account(mut)]
    pub buyback_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(lock_position_bump: u8)]
pub struct BurnUserShare<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// Position de lock de l'utilisateur
    /// CHECK: Vérifié par le programme cNFT
    pub lock_position: AccountInfo<'info>,
    
    /// État global
    /// CHECK: Vérifié par seeds
    pub global_state: AccountInfo<'info>,
    
    /// Vault de buyback
    #[account(mut)]
    pub buyback_vault: Account<'info, TokenAccount>,
    
    /// Mint $BACK
    /// CHECK: Vérifié par constraint
    pub back_mint: AccountInfo<'info>,
    
    /// Authority du vault
    /// CHECK: PDA du vault
    pub vault_authority: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("No buyback tokens available")]
    NoBuybackTokens,
    
    #[msg("No active boost in community")]
    NoActiveBoost,
    
    #[msg("Math overflow")]
    MathOverflow,
}
```

---

## 📋 Checklist d'Implémentation

### Phase 1: Mise à Jour du Programme cNFT
- [ ] Ajouter la fonction `calculate_boost()` avec tests unitaires
- [ ] Étendre `CNFTLevel` enum à 5 niveaux
- [ ] Créer/mettre à jour `LockPosition` struct
- [ ] Créer/mettre à jour `GlobalState` struct
- [ ] Mettre à jour `lock_tokens` instruction
- [ ] Mettre à jour `unlock_tokens` instruction
- [ ] Tester sur localnet

### Phase 2: Programme Buyback
- [ ] Créer le programme `swapback_buyback`
- [ ] Implémenter `distribute_buyback` instruction
- [ ] Implémenter `burn_user_share` instruction
- [ ] Ajouter tests unitaires
- [ ] Tester sur localnet

### Phase 3: Tests d'Intégration
- [ ] Tester le flow complet: lock → boost → buyback → burn
- [ ] Vérifier les calculs de boost on-chain vs frontend
- [ ] Tester avec plusieurs utilisateurs simultanément
- [ ] Vérifier que `total_community_boost` est correctement mis à jour

### Phase 4: Déploiement Devnet
- [ ] Déployer programmes sur devnet
- [ ] Initialiser `GlobalState`
- [ ] Tester avec l'UI frontend
- [ ] Créer plusieurs locks de test
- [ ] Exécuter une distribution de buyback de test

### Phase 5: Documentation & Audit
- [ ] Documenter toutes les instructions
- [ ] Créer des exemples d'utilisation
- [ ] Audit de sécurité (overflow, autorisation, etc.)
- [ ] Préparer pour mainnet

---

## 🧪 Commandes de Test

```bash
# Tests unitaires
anchor test

# Tests avec logs détaillés
RUST_LOG=debug anchor test

# Tests d'un fichier spécifique
anchor test --skip-deploy -- test_calculate_boost

# Déploiement local
anchor localnet

# Déploiement devnet
anchor deploy --provider.cluster devnet
```

---

## 📊 Exemples de Calculs On-Chain

### Exemple 1: Petit Lock
```rust
// 1,000 $BACK × 30 jours
let amount = 1_000 * 1_000_000_000; // lamports
let duration = 30;
let boost = calculate_boost(amount, duration);
// Expected: 350 basis points (3.5%)
```

### Exemple 2: Gros Lock
```rust
// 100,000 $BACK × 365 jours
let amount = 100_000 * 1_000_000_000;
let duration = 365;
let boost = calculate_boost(amount, duration);
// Expected: 8650 basis points (86.5%)
```

### Exemple 3: Distribution Buyback
```rust
// User 1: 50% boost (5000 BP)
// User 2: 30% boost (3000 BP)
// Total community: 8000 BP
// Total buyback: 100,000 tokens

// User 1 share: (5000 / 8000) * 100,000 = 62,500 tokens
// User 2 share: (3000 / 8000) * 100,000 = 37,500 tokens
```

---

## 🚀 Prochaine Action

**COMMENCEZ ICI**:

1. Créer le fichier `programs/swapback_cnft/src/utils/boost.rs` :
```bash
touch programs/swapback_cnft/src/utils/boost.rs
```

2. Implémenter la fonction `calculate_boost()` avec les tests

3. Mettre à jour `lib.rs` pour exporter la fonction

4. Compiler et tester:
```bash
anchor build
anchor test
```

---

**Questions?** Consultez:
- LOCK_BOOST_SYSTEM.md (formules détaillées)
- BOOST_SYSTEM_UI_UPDATE.md (implémentation frontend)
- GUIDE_UTILISATEUR_BOOST.md (perspective utilisateur)

---

*Guide créé le 26 octobre 2025*  
*Système de boost v2.0 - Backend Integration*
