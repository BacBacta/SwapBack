use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::{transfer_checked, Token2022, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount};

// ⚠️ IMPORTANT: Ce program ID sera généré lors du premier build
// Ne PAS hardcoder l'ancien ID ici - laisser Anchor le générer
declare_id!("c5aEUgYctZv5Yh7fiTWN18jr6seP7KThJsRPmxs2kKR");

#[program]
pub mod swapback_cnft {
    use super::*;

    /// Initialise le GlobalState pour tracker les locks
    pub fn initialize_global_state(ctx: Context<InitializeGlobalState>) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        
        global_state.authority = ctx.accounts.authority.key();
        global_state.total_community_boost = 0;
        global_state.active_locks_count = 0;
        global_state.total_value_locked = 0;

        msg!("✅ GlobalState initialisé");
        Ok(())
    }

    /// Initialise la configuration de la collection
    pub fn initialize_collection(ctx: Context<InitializeCollection>) -> Result<()> {
        let collection_config = &mut ctx.accounts.collection_config;

        collection_config.authority = ctx.accounts.authority.key();
        collection_config.total_minted = 0;

        msg!("✅ Collection initialisée");
        Ok(())
    }

    /// Lock des tokens BACK avec calcul de boost
    pub fn lock_tokens(
        ctx: Context<LockTokens>,
        amount: u64,
        lock_duration: i64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(lock_duration >= 7 * 86400, ErrorCode::DurationTooShort); // Min 7 jours

        let collection_config = &mut ctx.accounts.collection_config;
        let global_state = &mut ctx.accounts.global_state;
        let user_lock = &mut ctx.accounts.user_lock;

        msg!("🔒 Lock tokens: amount={}, duration={}", amount, lock_duration);

        // Vérifier si c'est un nouveau lock ou un ajout
        let is_new_lock = user_lock.user == Pubkey::default();

        // Calculer le nouveau montant total
        let new_total_amount = if is_new_lock {
            amount
        } else {
            user_lock.amount_locked
                .checked_add(amount)
                .ok_or(ErrorCode::MathOverflow)?
        };

        // Calculer la durée maximale
        let max_duration = if is_new_lock {
            lock_duration
        } else {
            lock_duration.max(user_lock.lock_duration)
        };

        // Calculer le nouveau boost et niveau
        let duration_days = (max_duration / 86400) as u64;
        let new_level = LockLevel::from_lock_params(new_total_amount, duration_days);
        let new_boost = calculate_boost(new_total_amount, max_duration);

        msg!("📊 Nouveau niveau: {:?}, boost: {} BP", new_level, new_boost);

        // Si lock existant et actif, retirer l'ancien boost
        if !is_new_lock && user_lock.is_active {
            global_state.total_community_boost = global_state
                .total_community_boost
                .saturating_sub(user_lock.boost as u64);
            global_state.total_value_locked = global_state
                .total_value_locked
                .saturating_sub(user_lock.amount_locked);
        }

        // Mettre à jour le lock utilisateur
        user_lock.user = ctx.accounts.user.key();
        user_lock.level = new_level;
        user_lock.amount_locked = new_total_amount;
        user_lock.lock_duration = max_duration;
        user_lock.boost = new_boost;
        user_lock.lock_time = Clock::get()?.unix_timestamp;
        user_lock.is_active = true;
        
        if is_new_lock {
            user_lock.bump = ctx.bumps.user_lock;
        }

        // Mettre à jour les statistiques globales
        if is_new_lock {
            collection_config.total_minted = collection_config
                .total_minted
                .checked_add(1)
                .ok_or(ErrorCode::MathOverflow)?;
            global_state.active_locks_count = global_state
                .active_locks_count
                .checked_add(1)
                .ok_or(ErrorCode::MathOverflow)?;
        }

        global_state.total_community_boost = global_state
            .total_community_boost
            .saturating_add(new_boost as u64);
        global_state.total_value_locked = global_state
            .total_value_locked
            .saturating_add(amount);

        // Transférer les tokens vers le vault
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
            mint: ctx.accounts.back_mint.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        transfer_checked(cpi_ctx, amount, ctx.accounts.back_mint.decimals)?;

        emit!(TokensLocked {
            user: ctx.accounts.user.key(),
            amount: new_total_amount,
            level: new_level,
            boost: new_boost,
            unlock_time: user_lock.lock_time + max_duration,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("✅ {} tokens BACK verrouillés - Niveau: {:?} - Boost: {}%",
            amount / 1_000_000_000,
            new_level,
            new_boost / 100
        );

        Ok(())
    }

    /// Unlock des tokens BACK avec pénalité de 1.5% si anticipé
    pub fn unlock_tokens(ctx: Context<UnlockTokens>) -> Result<()> {
        let user_lock = &mut ctx.accounts.user_lock;
        let global_state = &mut ctx.accounts.global_state;

        // Vérifications de sécurité
        require!(
            ctx.accounts.user.key() == user_lock.user,
            ErrorCode::Unauthorized
        );
        require!(user_lock.is_active, ErrorCode::AlreadyUnlocked);

        let current_time = Clock::get()?.unix_timestamp;
        let unlock_time = user_lock.lock_time + user_lock.lock_duration;
        let is_early_unlock = current_time < unlock_time;

        // Vérifier le solde réel du vault
        let vault_balance = ctx.accounts.vault_token_account.amount;
        let safe_amount = user_lock.amount_locked.min(vault_balance);

        if safe_amount < user_lock.amount_locked {
            msg!("⚠️ Vault insuffisant! Demandé: {}, Disponible: {}",
                user_lock.amount_locked, vault_balance);
        }

        // Calculer la pénalité si unlock anticipé (1.5%)
        let (user_amount, burn_amount) = if is_early_unlock {
            let penalty_bps = 150; // 1.5% = 150 basis points
            let burn = (safe_amount * penalty_bps) / 10_000;
            (safe_amount - burn, burn)
        } else {
            (safe_amount, 0)
        };

        msg!("🔓 Unlock: total={}, user={}, burn={}, early={}",
            safe_amount, user_amount, burn_amount, is_early_unlock);

        // Mettre à jour les statistiques globales
        global_state.total_community_boost = global_state
            .total_community_boost
            .saturating_sub(user_lock.boost as u64);
        global_state.active_locks_count = global_state
            .active_locks_count
            .saturating_sub(1);
        global_state.total_value_locked = global_state
            .total_value_locked
            .saturating_sub(safe_amount);

        // Transférer les tokens du vault à l'utilisateur
        if user_amount > 0 {
            let bump = ctx.bumps.vault_authority;
            let seeds: &[&[u8]] = &[b"vault_authority", &[bump]];
            let signer_seeds = &[seeds];

            let transfer_accounts = TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
                mint: ctx.accounts.back_mint.to_account_info(),
            };

            let transfer_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_accounts,
                signer_seeds,
            );

            transfer_checked(transfer_ctx, user_amount, ctx.accounts.back_mint.decimals)?;
        }

        // Désactiver le lock
        user_lock.is_active = false;
        user_lock.amount_locked = 0;

        emit!(TokensUnlocked {
            user: ctx.accounts.user.key(),
            amount: user_amount,
            burn_amount,
            early_unlock: is_early_unlock,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("✅ {} tokens déverrouillés - Pénalité: {} - Anticipé: {}",
            user_amount / 1_000_000_000,
            burn_amount / 1_000_000_000,
            is_early_unlock
        );

        Ok(())
    }
}

// ============================================================================
// TYPES ET STRUCTURES
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum LockLevel {
    Bronze,   // 100+ BACK, 7+ jours
    Silver,   // 1,000+ BACK, 30+ jours
    Gold,     // 10,000+ BACK, 90+ jours
    Platinum, // 50,000+ BACK, 180+ jours
    Diamond,  // 100,000+ BACK, 365+ jours
}

impl anchor_lang::Space for LockLevel {
    const INIT_SPACE: usize = 1;
}

impl LockLevel {
    pub fn from_lock_params(amount: u64, duration_days: u64) -> Self {
        let amount_tokens = amount / 1_000_000_000;

        if amount_tokens >= 100_000 && duration_days >= 365 {
            LockLevel::Diamond
        } else if amount_tokens >= 50_000 && duration_days >= 180 {
            LockLevel::Platinum
        } else if amount_tokens >= 10_000 && duration_days >= 90 {
            LockLevel::Gold
        } else if amount_tokens >= 1_000 && duration_days >= 30 {
            LockLevel::Silver
        } else {
            LockLevel::Bronze
        }
    }
}

// ============================================================================
// ACCOUNTS
// ============================================================================

#[derive(Accounts)]
pub struct InitializeGlobalState<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalState::INIT_SPACE,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeCollection<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + CollectionConfig::INIT_SPACE,
        seeds = [b"collection_config"],
        bump
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LockTokens<'info> {
    #[account(
        mut,
        seeds = [b"collection_config"],
        bump
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(
        mut,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserLock::INIT_SPACE,
        seeds = [b"user_lock", user.key().as_ref()],
        bump
    )]
    pub user_lock: Account<'info, UserLock>,

    #[account(mut)]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: PDA vault authority
    #[account(
        seeds = [b"vault_authority"],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,

    pub back_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnlockTokens<'info> {
    #[account(
        mut,
        seeds = [b"user_lock", user.key().as_ref()],
        bump = user_lock.bump
    )]
    pub user_lock: Account<'info, UserLock>,

    #[account(
        mut,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: PDA vault authority
    #[account(
        seeds = [b"vault_authority"],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,

    pub back_mint: InterfaceAccount<'info, Mint>,

    pub user: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
}

// ============================================================================
// STATE ACCOUNTS
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct GlobalState {
    pub authority: Pubkey,
    pub total_community_boost: u64,
    pub active_locks_count: u64,
    pub total_value_locked: u64,
}

#[account]
#[derive(InitSpace)]
pub struct CollectionConfig {
    pub authority: Pubkey,
    pub total_minted: u64,
}

#[account]
#[derive(InitSpace)]
pub struct UserLock {
    pub user: Pubkey,
    pub level: LockLevel,
    pub amount_locked: u64,
    pub lock_duration: i64,
    pub boost: u16,
    pub lock_time: i64,
    pub is_active: bool,
    pub bump: u8,
}

// ============================================================================
// EVENTS
// ============================================================================

#[event]
pub struct TokensLocked {
    pub user: Pubkey,
    pub amount: u64,
    pub level: LockLevel,
    pub boost: u16,
    pub unlock_time: i64,
    pub timestamp: i64,
}

#[event]
pub struct TokensUnlocked {
    pub user: Pubkey,
    pub amount: u64,
    pub burn_amount: u64,
    pub early_unlock: bool,
    pub timestamp: i64,
}

// ============================================================================
// ERRORS
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Montant invalide")]
    InvalidAmount,
    #[msg("Durée trop courte (min 7 jours)")]
    DurationTooShort,
    #[msg("Non autorisé")]
    Unauthorized,
    #[msg("Dépassement arithmétique")]
    MathOverflow,
    #[msg("Déjà déverrouillé")]
    AlreadyUnlocked,
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/// Calcule le boost dynamique basé sur montant et durée
/// Max: 2000 basis points (20%)
fn calculate_boost(amount: u64, duration: i64) -> u16 {
    let days = (duration / 86400) as u64;
    let amount_tokens = amount / 1_000_000_000;

    // Score montant: max 1000 BP (10%)
    let amount_score = ((amount_tokens / 10_000) * 100).min(1000);

    // Score durée: max 1000 BP (10%)
    let duration_score = ((days / 5) * 10).min(1000);

    // Total: max 2000 BP (20%)
    (amount_score + duration_score).min(2000) as u16
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_boost_bronze() {
        let amount = 1_000 * 1_000_000_000;
        let duration = 30 * 86400;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 60); // 0.6%
    }

    #[test]
    fn test_boost_diamond() {
        let amount = 100_000 * 1_000_000_000;
        let duration = 365 * 86400;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 1730); // 17.3%
    }

    #[test]
    fn test_level_assignment() {
        assert_eq!(
            LockLevel::from_lock_params(1_000 * 1_000_000_000, 30),
            LockLevel::Silver
        );
        assert_eq!(
            LockLevel::from_lock_params(100_000 * 1_000_000_000, 365),
            LockLevel::Diamond
        );
    }
}
