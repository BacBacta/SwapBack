use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{transfer_checked as spl_transfer_checked, burn as spl_burn, Token, TransferChecked, Burn};
use anchor_spl::token_2022::{transfer_checked as token2022_transfer_checked, burn as token2022_burn, Token2022};
use anchor_spl::token_interface::{Mint, TokenAccount};

// ⚠️ IMPORTANT: Ce program ID doit correspondre au déploiement devnet actif
declare_id!("DGDipfpHGVAnWXj7yPEBc3JYFWghQN76tEBzuK2Nojw3");

// ============================================================================
// CONSTANTES ÉCONOMIQUES
// ============================================================================

/// Frais de swap prélevés par le routeur (30 bps = 0.30 %)
pub const PLATFORM_FEE_BPS: u64 = 30;
pub const BASIS_POINTS_DIVISOR: u64 = 10_000;
pub const EARLY_UNLOCK_PENALTY_BPS: u64 = 200; // 2 %

/// Répartition des frais de swap (Flux 1)
pub const SWAP_TREASURY_SHARE_BPS: u64 = 8500; // 85 % pour la trésorerie
pub const SWAP_BUYBACK_SHARE_BPS: u64 = 1500; // 15 % pour le buyback & burn

/// Répartition des NPI générés par le routeur (Flux 2)
pub const NPI_USER_SHARE_BPS: u64 = 7000; // 70 % pour l'utilisateur
pub const NPI_TREASURY_SHARE_BPS: u64 = 2000; // 20 % pour la plateforme
pub const NPI_BOOST_VAULT_BPS: u64 = 1000; // 10 % pour le vault boost

/// Boosts maximaux en basis points
pub const MAX_DURATION_BOOST_BPS: u64 = 500; // +5 %
pub const MAX_AMOUNT_BOOST_BPS: u64 = 500; // +5 %
pub const MAX_TOTAL_BOOST_BPS: u64 = 1000; // +10 % global

/// Facteur d'échelle pour convertir les montants BACK (6 décimales)
pub const BACK_DECIMALS: u64 = 1_000_000;

/// Tiers de durée exprimés en jours
pub const DURATION_TIER1_DAYS: u64 = 30;
pub const DURATION_TIER2_DAYS: u64 = 90;
pub const DURATION_TIER3_DAYS: u64 = 180;
pub const DURATION_TIER4_DAYS: u64 = 365;

/// Boost attribué par palier de durée
pub const DURATION_TIER1_BPS: u64 = 50; // +0.5 %
pub const DURATION_TIER2_BPS: u64 = 150; // +1.5 %
pub const DURATION_TIER3_BPS: u64 = 300; // +3.0 %
pub const DURATION_TIER4_BPS: u64 = 500; // +5.0 %

/// Paliers de montants (BACK entiers)
pub const AMOUNT_TIER1_MIN: u64 = 1_000;
pub const AMOUNT_TIER2_MIN: u64 = 10_000;
pub const AMOUNT_TIER3_MIN: u64 = 50_000;
pub const AMOUNT_TIER4_MIN: u64 = 100_000;

/// Boost attribué par palier de montant
pub const AMOUNT_TIER1_BPS: u64 = 100; // +1.0 %
pub const AMOUNT_TIER2_BPS: u64 = 200; // +2.0 %
pub const AMOUNT_TIER3_BPS: u64 = 350; // +3.5 %
pub const AMOUNT_TIER4_BPS: u64 = 500; // +5.0 %

#[program]
pub mod swapback_cnft {
    use super::*;

    /// Initialise le GlobalState pour tracker les locks
    pub fn initialize_global_state(
        ctx: Context<InitializeGlobalState>,
        treasury_wallet: Pubkey,
        boost_vault_wallet: Pubkey,
        buyback_wallet: Pubkey,
        npi_vault_wallet: Pubkey,
    ) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;

        global_state.authority = ctx.accounts.authority.key();
        global_state.treasury_wallet = treasury_wallet;
        global_state.boost_vault_wallet = boost_vault_wallet;
        global_state.buyback_wallet = buyback_wallet;
        global_state.npi_vault_wallet = npi_vault_wallet;
        global_state.total_community_boost = 0;
        global_state.active_locks_count = 0;
        global_state.total_value_locked = 0;
        global_state.total_swap_volume = 0;
        global_state.total_swap_fees_collected = 0;
        global_state.swap_treasury_accrued = 0;
        global_state.swap_buyback_accrued = 0;
        global_state.total_npi_volume = 0;
        global_state.npi_user_distributed = 0;
        global_state.npi_treasury_accrued = 0;
        global_state.npi_boost_vault_accrued = 0;
        global_state.npi_boost_vault_distributed = 0;
        global_state.total_penalties_collected = 0;

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
    pub fn lock_tokens(ctx: Context<LockTokens>, amount: u64, lock_duration: i64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(lock_duration >= 7 * 86400, ErrorCode::DurationTooShort); // Min 7 jours

        let collection_config = &mut ctx.accounts.collection_config;
        let global_state = &mut ctx.accounts.global_state;
        let user_lock = &mut ctx.accounts.user_lock;

        msg!(
            "🔒 Lock tokens: amount={}, duration={}",
            amount,
            lock_duration
        );

        // Vérifier si c'est un nouveau lock ou un ajout
        let is_new_lock = user_lock.user == Pubkey::default();

        // Calculer le nouveau montant total
        let new_total_amount = if is_new_lock {
            amount
        } else {
            user_lock
                .amount_locked
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

        msg!(
            "📊 Nouveau niveau: {:?}, boost: {} BP",
            new_level,
            new_boost
        );

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
        global_state.total_value_locked = global_state.total_value_locked.saturating_add(amount);

        // Transférer les tokens vers le vault
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
            mint: ctx.accounts.back_mint.to_account_info(),
        };
        transfer_checked_dynamic(
            &ctx.accounts.token_program,
            &ctx.accounts.token_2022_program,
            &ctx.accounts.back_mint,
            cpi_accounts,
            amount,
            ctx.accounts.back_mint.decimals,
            None,
        )?;

        emit!(TokensLocked {
            user: ctx.accounts.user.key(),
            amount: new_total_amount,
            level: new_level,
            boost: new_boost,
            unlock_time: user_lock.lock_time + max_duration,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "✅ {} BACK verrouillés - Niveau: {:?} - Boost: {:.2}%",
            amount / BACK_DECIMALS,
            new_level,
            (new_boost as f64) / 100.0
        );

        Ok(())
    }

    /// Unlock des tokens BACK avec pénalité de 2% si anticipé
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
            msg!(
                "⚠️ Vault insuffisant! Demandé: {}, Disponible: {}",
                user_lock.amount_locked,
                vault_balance
            );
        }

        // Calculer la pénalité si unlock anticipé (2%)
        let (user_amount, penalty_amount) = if is_early_unlock {
            let penalty = safe_amount
                .checked_mul(EARLY_UNLOCK_PENALTY_BPS)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(BASIS_POINTS_DIVISOR)
                .ok_or(ErrorCode::MathOverflow)?;
            (safe_amount.saturating_sub(penalty), penalty)
        } else {
            (safe_amount, 0)
        };

        msg!(
            "🔓 Unlock: total={}, user={}, penalty={}, early={}",
            safe_amount,
            user_amount,
            penalty_amount,
            is_early_unlock
        );

        // Mettre à jour les statistiques globales
        global_state.total_community_boost = global_state
            .total_community_boost
            .saturating_sub(user_lock.boost as u64);
        global_state.active_locks_count = global_state.active_locks_count.saturating_sub(1);
        global_state.total_value_locked =
            global_state.total_value_locked.saturating_sub(safe_amount);

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

            transfer_checked_dynamic(
                &ctx.accounts.token_program,
                &ctx.accounts.token_2022_program,
                &ctx.accounts.back_mint,
                transfer_accounts,
                user_amount,
                ctx.accounts.back_mint.decimals,
                Some(signer_seeds),
            )?;
        }

        if penalty_amount > 0 {
            let bump = ctx.bumps.vault_authority;
            let seeds: &[&[&[u8]]] = &[&[b"vault_authority", &[bump]]];
            let signer_seeds = &[seeds[0]];

            // Brûler les tokens de pénalité
            let burn_accounts = Burn {
                mint: ctx.accounts.back_mint.to_account_info(),
                from: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            };

            burn_checked_dynamic(
                &ctx.accounts.token_program,
                &ctx.accounts.token_2022_program,
                &ctx.accounts.back_mint,
                burn_accounts,
                penalty_amount,
                Some(signer_seeds),
            )?;

            // Tracker les pénalités brûlées
            let global_state = &mut ctx.accounts.global_state;
            global_state.total_penalties_collected = global_state
                .total_penalties_collected
                .checked_add(penalty_amount)
                .ok_or(ErrorCode::MathOverflow)?;

            msg!("🔥 {} BACK brûlés (pénalité 2%)", penalty_amount / BACK_DECIMALS);
        }

        // Désactiver le lock
        user_lock.is_active = false;
        user_lock.amount_locked = 0;

        emit!(TokensUnlocked {
            user: ctx.accounts.user.key(),
            amount: user_amount,
            penalty_amount,
            early_unlock: is_early_unlock,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "✅ {} BACK déverrouillés - Pénalité: {} - Anticipé: {}",
            user_amount / BACK_DECIMALS,
            penalty_amount / BACK_DECIMALS,
            is_early_unlock
        );

        Ok(())
    }

    /// Met à jour le wallet buyback (ATA) détenu par l'autorité
    pub fn update_buyback_wallet(ctx: Context<UpdateBuybackWallet>) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;

        require_keys_eq!(
            global_state.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );

        require_keys_eq!(
            ctx.accounts.buyback_wallet_token_account.owner,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );

        require_keys_eq!(
            ctx.accounts.buyback_wallet_token_account.mint,
            ctx.accounts.back_mint.key(),
            ErrorCode::InvalidBuybackWallet
        );

        global_state.buyback_wallet = ctx.accounts.buyback_wallet_token_account.key();

        msg!(
            "✅ Buyback wallet mis à jour: {}",
            global_state.buyback_wallet
        );

        Ok(())
    }

    /// Enregistre la répartition des frais de swap (Flux 1)
    pub fn record_swap_fees(ctx: Context<RecordSwapFees>, swap_volume: u64) -> Result<()> {
        require!(swap_volume > 0, ErrorCode::InvalidAmount);

        let total_fee = swap_volume
            .checked_mul(PLATFORM_FEE_BPS)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(ErrorCode::MathOverflow)?;

        let treasury_amount = total_fee
            .checked_mul(SWAP_TREASURY_SHARE_BPS)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(ErrorCode::MathOverflow)?;

        let buyback_amount = total_fee
            .checked_sub(treasury_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        let global_state = &mut ctx.accounts.global_state;
        global_state.total_swap_volume = global_state
            .total_swap_volume
            .checked_add(swap_volume)
            .ok_or(ErrorCode::MathOverflow)?;
        global_state.total_swap_fees_collected = global_state
            .total_swap_fees_collected
            .checked_add(total_fee)
            .ok_or(ErrorCode::MathOverflow)?;
        global_state.swap_treasury_accrued = global_state
            .swap_treasury_accrued
            .checked_add(treasury_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        global_state.swap_buyback_accrued = global_state
            .swap_buyback_accrued
            .checked_add(buyback_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        emit!(SwapFeesRecorded {
            volume: swap_volume,
            total_fee,
            treasury_amount,
            buyback_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Répartit les NPI du routeur (Flux 2) - Accumule dans le solde utilisateur
    pub fn distribute_npi(
        ctx: Context<DistributeNpi>,
        npi_amount: u64,
        user_boost_bps: u16,
    ) -> Result<()> {
        require!(npi_amount > 0, ErrorCode::InvalidAmount);

        let base_user_amount = npi_amount
            .checked_mul(NPI_USER_SHARE_BPS)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(ErrorCode::MathOverflow)?;

        let treasury_amount = npi_amount
            .checked_mul(NPI_TREASURY_SHARE_BPS)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(ErrorCode::MathOverflow)?;

        let boost_vault_allocation = npi_amount
            .checked_mul(NPI_BOOST_VAULT_BPS)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(ErrorCode::MathOverflow)?;

        let clamped_boost = (user_boost_bps as u64).min(MAX_TOTAL_BOOST_BPS);
        let boost_bonus_target = boost_vault_allocation
            .checked_mul(clamped_boost)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(MAX_TOTAL_BOOST_BPS)
            .ok_or(ErrorCode::MathOverflow)?;
        let boost_bonus = boost_bonus_target.min(boost_vault_allocation);
        let total_user_amount = base_user_amount
            .checked_add(boost_bonus)
            .ok_or(ErrorCode::MathOverflow)?;
        let remaining_boost_vault = boost_vault_allocation
            .checked_sub(boost_bonus)
            .ok_or(ErrorCode::MathOverflow)?;

        // Initialiser le compte utilisateur si nouveau
        let user_balance = &mut ctx.accounts.user_npi_balance;
        if user_balance.user == Pubkey::default() {
            user_balance.user = ctx.accounts.user.key();
            user_balance.pending_npi = 0;
            user_balance.total_claimed = 0;
            user_balance.bump = ctx.bumps.user_npi_balance;
        }

        // Accumuler les NPI dans le solde pending
        user_balance.pending_npi = user_balance
            .pending_npi
            .checked_add(total_user_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        let global_state = &mut ctx.accounts.global_state;
        global_state.total_npi_volume = global_state
            .total_npi_volume
            .checked_add(npi_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        global_state.npi_user_distributed = global_state
            .npi_user_distributed
            .checked_add(total_user_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        global_state.npi_treasury_accrued = global_state
            .npi_treasury_accrued
            .checked_add(treasury_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        global_state.npi_boost_vault_accrued = global_state
            .npi_boost_vault_accrued
            .checked_add(boost_vault_allocation)
            .ok_or(ErrorCode::MathOverflow)?;
        global_state.npi_boost_vault_distributed = global_state
            .npi_boost_vault_distributed
            .checked_add(boost_bonus)
            .ok_or(ErrorCode::MathOverflow)?;
        emit!(NpiDistributed {
            total_npi: npi_amount,
            user_base: base_user_amount,
            user_boost_bonus: boost_bonus,
            user_total: total_user_amount,
            treasury_amount,
            boost_vault_allocation,
            remaining_boost_vault,
            applied_boost_bps: clamped_boost as u16,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "💰 NPI distribué à {} - Pending: {} (base: {}, boost: {})",
            ctx.accounts.user.key(),
            user_balance.pending_npi,
            base_user_amount,
            boost_bonus
        );

        Ok(())
    }

    /// Permet à l'utilisateur de réclamer ses NPI accumulés
    pub fn claim_npi(ctx: Context<ClaimNpi>, amount: u64) -> Result<()> {
        let user_balance = &mut ctx.accounts.user_npi_balance;
        
        require!(
            ctx.accounts.user.key() == user_balance.user,
            ErrorCode::Unauthorized
        );
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(
            user_balance.pending_npi >= amount,
            ErrorCode::InsufficientBalance
        );

        // Vérifier que le vault a assez de tokens
        let vault_balance = ctx.accounts.npi_vault.amount;
        require!(
            vault_balance >= amount,
            ErrorCode::InsufficientVaultBalance
        );

        // Déduire du solde pending
        user_balance.pending_npi = user_balance
            .pending_npi
            .checked_sub(amount)
            .ok_or(ErrorCode::MathOverflow)?;
        
        user_balance.total_claimed = user_balance
            .total_claimed
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;

        // Transférer les NPI du vault vers l'utilisateur
        let bump = ctx.bumps.vault_authority;
        let seeds: &[&[u8]] = &[b"npi_vault_authority", &[bump]];
        let signer_seeds = &[seeds];

        let transfer_accounts = TransferChecked {
            from: ctx.accounts.npi_vault.to_account_info(),
            to: ctx.accounts.user_npi_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
            mint: ctx.accounts.npi_mint.to_account_info(),
        };

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_accounts,
            signer_seeds,
        );

        spl_transfer_checked(transfer_ctx, amount, ctx.accounts.npi_mint.decimals)?;

        emit!(NpiClaimed {
            user: ctx.accounts.user.key(),
            amount,
            remaining_pending: user_balance.pending_npi,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "✅ {} NPI réclamés - Restant: {}",
            amount / 1_000_000_000,
            user_balance.pending_npi / 1_000_000_000
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
        let amount_tokens = amount / BACK_DECIMALS;

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

    #[account(
        mut,
        constraint = buyback_wallet_token_account.key() == global_state.buyback_wallet @ ErrorCode::InvalidBuybackWallet
    )]
    pub buyback_wallet_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: PDA vault authority
    #[account(
        seeds = [b"vault_authority"],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,

    pub back_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub token_2022_program: Program<'info, Token2022>,
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

    pub token_program: Program<'info, Token>,
    pub token_2022_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct UpdateBuybackWallet<'info> {
    #[account(
        mut,
        seeds = [b"global_state"],
        bump,
        has_one = authority
    )]
    pub global_state: Account<'info, GlobalState>,

    pub authority: Signer<'info>,

    #[account(mut)]
    pub buyback_wallet_token_account: InterfaceAccount<'info, TokenAccount>,

    pub back_mint: InterfaceAccount<'info, Mint>,
}

#[derive(Accounts)]
pub struct RecordSwapFees<'info> {
    #[account(
        mut,
        seeds = [b"global_state"],
        bump,
        has_one = authority
    )]
    pub global_state: Account<'info, GlobalState>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DistributeNpi<'info> {
    #[account(
        mut,
        seeds = [b"global_state"],
        bump,
        has_one = authority
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + UserNpiBalance::INIT_SPACE,
        seeds = [b"user_npi_balance", user.key().as_ref()],
        bump
    )]
    pub user_npi_balance: Account<'info, UserNpiBalance>,

    /// CHECK: User receiving the NPI allocation
    pub user: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimNpi<'info> {
    #[account(
        mut,
        seeds = [b"user_npi_balance", user.key().as_ref()],
        bump = user_npi_balance.bump
    )]
    pub user_npi_balance: Account<'info, UserNpiBalance>,

    #[account(
        mut,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        mut,
        constraint = npi_vault.key() == global_state.npi_vault_wallet @ ErrorCode::InvalidNpiVault
    )]
    pub npi_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub user_npi_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: PDA authority for NPI vault
    #[account(
        seeds = [b"npi_vault_authority"],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,

    pub npi_mint: InterfaceAccount<'info, Mint>,

    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// ============================================================================
// STATE ACCOUNTS
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct GlobalState {
    pub authority: Pubkey,
    pub treasury_wallet: Pubkey,
    pub boost_vault_wallet: Pubkey,
    pub buyback_wallet: Pubkey,
    pub npi_vault_wallet: Pubkey,
    pub total_community_boost: u64,
    pub active_locks_count: u64,
    pub total_value_locked: u64,
    pub total_swap_volume: u64,
    pub total_swap_fees_collected: u64,
    pub swap_treasury_accrued: u64,
    pub swap_buyback_accrued: u64,
    pub total_npi_volume: u64,
    pub npi_user_distributed: u64,
    pub npi_treasury_accrued: u64,
    pub npi_boost_vault_accrued: u64,
    pub npi_boost_vault_distributed: u64,
    pub total_penalties_collected: u64,
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

#[account]
#[derive(InitSpace)]
pub struct UserNpiBalance {
    pub user: Pubkey,
    pub pending_npi: u64,
    pub total_claimed: u64,
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
    pub penalty_amount: u64,
    pub early_unlock: bool,
    pub timestamp: i64,
}

#[event]
pub struct SwapFeesRecorded {
    pub volume: u64,
    pub total_fee: u64,
    pub treasury_amount: u64,
    pub buyback_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct NpiDistributed {
    pub total_npi: u64,
    pub user_base: u64,
    pub user_boost_bonus: u64,
    pub user_total: u64,
    pub treasury_amount: u64,
    pub boost_vault_allocation: u64,
    pub remaining_boost_vault: u64,
    pub applied_boost_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct NpiClaimed {
    pub user: Pubkey,
    pub amount: u64,
    pub remaining_pending: u64,
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
    #[msg("Wallet buyback invalide")]
    InvalidBuybackWallet,
    #[msg("Wallet NPI vault invalide")]
    InvalidNpiVault,
    #[msg("Solde pending insuffisant")]
    InsufficientBalance,
    #[msg("Vault NPI insuffisant")]
    InsufficientVaultBalance,
    #[msg("Unsupported token program for mint")]
    UnsupportedTokenProgram,
}

// ============================================================================
// UTILITAIRES
// ============================================================================

fn transfer_checked_dynamic<'info>(
    token_program: &Program<'info, Token>,
    token_2022_program: &Program<'info, Token2022>,
    mint: &InterfaceAccount<'info, Mint>,
    accounts: TransferChecked<'info>,
    amount: u64,
    decimals: u8,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> Result<()> {
    let owner = mint.to_account_info().owner;

    if owner == &anchor_spl::token_2022::ID {
        let program_info = token_2022_program.to_account_info();
        let accounts_2022 = anchor_spl::token_2022::TransferChecked {
            from: accounts.from.clone(),
            mint: accounts.mint.clone(),
            to: accounts.to.clone(),
            authority: accounts.authority.clone(),
        };

        if let Some(seeds) = signer_seeds {
            let cpi_ctx = CpiContext::new_with_signer(program_info, accounts_2022, seeds);
            token2022_transfer_checked(cpi_ctx, amount, decimals)?;
        } else {
            let cpi_ctx = CpiContext::new(program_info, accounts_2022);
            token2022_transfer_checked(cpi_ctx, amount, decimals)?;
        }

        return Ok(());
    }

    if owner == &anchor_spl::token::ID {
        let program_info = token_program.to_account_info();
        if let Some(seeds) = signer_seeds {
            let cpi_ctx = CpiContext::new_with_signer(program_info, accounts, seeds);
            spl_transfer_checked(cpi_ctx, amount, decimals)?;
        } else {
            let cpi_ctx = CpiContext::new(program_info, accounts);
            spl_transfer_checked(cpi_ctx, amount, decimals)?;
        }

        return Ok(());
    }

    Err(error!(ErrorCode::UnsupportedTokenProgram))
}

/// Brûle des tokens de manière dynamique (Token ou Token-2022)
fn burn_checked_dynamic<'info>(
    token_program: &Program<'info, Token>,
    token_2022_program: &Program<'info, Token2022>,
    mint: &InterfaceAccount<'info, Mint>,
    accounts: Burn<'info>,
    amount: u64,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> Result<()> {
    let owner = mint.to_account_info().owner;

    if owner == &anchor_spl::token_2022::ID {
        let program_info = token_2022_program.to_account_info();
        let accounts_2022 = anchor_spl::token_2022::Burn {
            mint: accounts.mint.clone(),
            from: accounts.from.clone(),
            authority: accounts.authority.clone(),
        };

        if let Some(seeds) = signer_seeds {
            let cpi_ctx = CpiContext::new_with_signer(program_info, accounts_2022, seeds);
            token2022_burn(cpi_ctx, amount)?;
        } else {
            let cpi_ctx = CpiContext::new(program_info, accounts_2022);
            token2022_burn(cpi_ctx, amount)?;
        }

        return Ok(());
    }

    if owner == &anchor_spl::token::ID {
        let program_info = token_program.to_account_info();
        if let Some(seeds) = signer_seeds {
            let cpi_ctx = CpiContext::new_with_signer(program_info, accounts, seeds);
            spl_burn(cpi_ctx, amount)?;
        } else {
            let cpi_ctx = CpiContext::new(program_info, accounts);
            spl_burn(cpi_ctx, amount)?;
        }

        return Ok(());
    }

    Err(error!(ErrorCode::UnsupportedTokenProgram))
}

/// Calcule le boost dynamique basé sur la durée et le montant verrouillé
/// Formule multiplicative: (boost_durée + boost_montant + produit croisé)
fn calculate_boost(amount: u64, duration: i64) -> u16 {
    if amount == 0 || duration <= 0 {
        return 0;
    }

    let days = (duration.max(0) as u64) / 86_400;
    let amount_tokens = amount / BACK_DECIMALS;

    let duration_boost = duration_boost_from_days(days);
    let amount_boost = amount_boost_from_tokens(amount_tokens);
    let cross = duration_boost
        .saturating_mul(amount_boost)
        .checked_div(BASIS_POINTS_DIVISOR)
        .unwrap_or(0);

    let total = duration_boost
        .saturating_add(amount_boost)
        .saturating_add(cross)
        .min(MAX_TOTAL_BOOST_BPS);

    total as u16
}

fn duration_boost_from_days(days: u64) -> u64 {
    if days >= DURATION_TIER4_DAYS {
        DURATION_TIER4_BPS
    } else if days >= DURATION_TIER3_DAYS {
        DURATION_TIER3_BPS
    } else if days >= DURATION_TIER2_DAYS {
        DURATION_TIER2_BPS
    } else if days >= DURATION_TIER1_DAYS {
        DURATION_TIER1_BPS
    } else {
        0
    }
}

fn amount_boost_from_tokens(amount_tokens: u64) -> u64 {
    if amount_tokens >= AMOUNT_TIER4_MIN {
        AMOUNT_TIER4_BPS
    } else if amount_tokens >= AMOUNT_TIER3_MIN {
        AMOUNT_TIER3_BPS
    } else if amount_tokens >= AMOUNT_TIER2_MIN {
        AMOUNT_TIER2_BPS
    } else if amount_tokens >= AMOUNT_TIER1_MIN {
        AMOUNT_TIER1_BPS
    } else {
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_boost_bronze() {
        let amount = 1_000 * BACK_DECIMALS;
        let duration = 30 * 86400;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 150); // 1.5%
    }

    #[test]
    fn test_boost_diamond() {
        let amount = 100_000 * BACK_DECIMALS;
        let duration = 365 * 86400;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 1000); // 10.0% (cap)
    }

    #[test]
    fn test_level_assignment() {
        assert_eq!(
            LockLevel::from_lock_params(1_000 * BACK_DECIMALS, 30),
            LockLevel::Silver
        );
        assert_eq!(
            LockLevel::from_lock_params(100_000 * BACK_DECIMALS, 365),
            LockLevel::Diamond
        );
    }
}
