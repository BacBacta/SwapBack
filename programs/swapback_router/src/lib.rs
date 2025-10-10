use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod swapback_router {
    use super::*;

    /// Initialise l'état global du routeur
    pub fn initialize(
        ctx: Context<Initialize>,
        rebate_percentage: u8,
        burn_percentage: u8,
        npi_threshold: u64,
    ) -> Result<()> {
        require!(
            rebate_percentage + burn_percentage <= 100,
            ErrorCode::InvalidPercentages
        );

        let global_state = &mut ctx.accounts.global_state;
        global_state.authority = ctx.accounts.authority.key();
        global_state.rebate_percentage = rebate_percentage;
        global_state.burn_percentage = burn_percentage;
        global_state.npi_threshold = npi_threshold;
        global_state.treasury = ctx.accounts.treasury.key();
        global_state.total_volume = 0;
        global_state.total_npi = 0;
        global_state.total_rebates = 0;
        global_state.bump = ctx.bumps.global_state;

        msg!("SwapBack Router initialisé avec succès");
        Ok(())
    }

    /// Simule une route de swap et calcule le NPI (Net Price Improvement)
    pub fn simulate_route(
        ctx: Context<SimulateRoute>,
        input_amount: u64,
        minimum_output_amount: u64,
        route_type: RouteType,
    ) -> Result<()> {
        let global_state = &ctx.accounts.global_state;
        
        // Validation des paramètres
        require!(input_amount > 0, ErrorCode::InvalidAmount);
        require!(minimum_output_amount > 0, ErrorCode::InvalidAmount);

        // TODO: Implémenter la logique de simulation avec oracle off-chain
        // Pour le MVP, on crée simplement l'enregistrement de simulation
        
        msg!(
            "Route simulée: input={}, min_output={}, type={:?}",
            input_amount,
            minimum_output_amount,
            route_type
        );

        Ok(())
    }

    /// Exécute un swap optimisé via la meilleure route
    pub fn execute_swap(
        ctx: Context<ExecuteSwap>,
        input_amount: u64,
        minimum_output_amount: u64,
        npi_amount: u64,
    ) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        let user_rebate = &mut ctx.accounts.user_rebate;

        // Validation de sécurité
        require!(input_amount > 0, ErrorCode::InvalidAmount);
        require!(minimum_output_amount > 0, ErrorCode::InvalidAmount);
        require!(
            ctx.accounts.user_authority.key() == user_rebate.user,
            ErrorCode::Unauthorized
        );

        // Calcul des remises et du burn
        let rebate_amount = npi_amount
            .checked_mul(global_state.rebate_percentage as u64)
            .unwrap()
            .checked_div(100)
            .unwrap();
        
        let burn_amount = npi_amount
            .checked_mul(global_state.burn_percentage as u64)
            .unwrap()
            .checked_div(100)
            .unwrap();

        // Mise à jour des statistiques utilisateur
        user_rebate.total_npi = user_rebate.total_npi.checked_add(npi_amount).unwrap();
        user_rebate.pending_rebates = user_rebate.pending_rebates.checked_add(rebate_amount).unwrap();
        user_rebate.swap_count = user_rebate.swap_count.checked_add(1).unwrap();

        // Mise à jour des statistiques globales
        global_state.total_volume = global_state.total_volume.checked_add(input_amount).unwrap();
        global_state.total_npi = global_state.total_npi.checked_add(npi_amount).unwrap();
        global_state.total_rebates = global_state.total_rebates.checked_add(rebate_amount).unwrap();

        // TODO: Implémenter le transfert réel du token de burn vers le programme de buyback
        
        emit!(SwapExecuted {
            user: ctx.accounts.user_authority.key(),
            input_amount,
            output_amount: minimum_output_amount,
            npi_amount,
            rebate_amount,
            burn_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "Swap exécuté: NPI={}, Rebate={}, Burn={}",
            npi_amount,
            rebate_amount,
            burn_amount
        );

        Ok(())
    }

    /// Verrouille des tokens $BACK pour obtenir des remises améliorées
    pub fn lock_back(
        ctx: Context<LockBack>,
        amount: u64,
        lock_duration: i64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(lock_duration > 0, ErrorCode::InvalidLockDuration);

        let user_rebate = &mut ctx.accounts.user_rebate;
        let clock = Clock::get()?;

        // Transfert des tokens vers le compte de verrouillage
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.lock_account.to_account_info(),
            authority: ctx.accounts.user_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Mise à jour du statut de verrouillage
        user_rebate.locked_amount = user_rebate.locked_amount.checked_add(amount).unwrap();
        user_rebate.lock_end_time = clock.unix_timestamp.checked_add(lock_duration).unwrap();
        user_rebate.rebate_boost = calculate_boost(amount, lock_duration);

        emit!(TokensLocked {
            user: ctx.accounts.user_authority.key(),
            amount,
            lock_duration,
            boost: user_rebate.rebate_boost,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Déverrouille les tokens $BACK après la période de verrouillage
    pub fn unlock_back(ctx: Context<UnlockBack>) -> Result<()> {
        let user_rebate = &mut ctx.accounts.user_rebate;
        let clock = Clock::get()?;

        require!(
            clock.unix_timestamp >= user_rebate.lock_end_time,
            ErrorCode::LockPeriodNotEnded
        );

        let unlock_amount = user_rebate.locked_amount;

        // Transfert des tokens de retour vers l'utilisateur
        // Note: Nécessite une signature PDA pour le transfert
        let seeds = &[
            b"user_rebate",
            user_rebate.user.as_ref(),
            &[user_rebate.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.lock_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: user_rebate.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, unlock_amount)?;

        // Réinitialisation du verrouillage
        user_rebate.locked_amount = 0;
        user_rebate.lock_end_time = 0;
        user_rebate.rebate_boost = 0;

        emit!(TokensUnlocked {
            user: ctx.accounts.user_authority.key(),
            amount: unlock_amount,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Récupère les remises accumulées
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let user_rebate = &mut ctx.accounts.user_rebate;
        
        require!(
            user_rebate.pending_rebates > 0,
            ErrorCode::NoRewardsToClaim
        );

        let claim_amount = user_rebate.pending_rebates;

        // TODO: Implémenter le transfert réel des remises en USDC ou $BACK
        
        user_rebate.total_claimed = user_rebate.total_claimed.checked_add(claim_amount).unwrap();
        user_rebate.pending_rebates = 0;

        emit!(RewardsClaimed {
            user: ctx.accounts.user_authority.key(),
            amount: claim_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

// === STRUCTS DE CONTEXTE ===

#[derive(Accounts)]
pub struct Initialize<'info> {
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
    
    /// CHECK: Compte de trésorerie USDC
    pub treasury: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SimulateRoute<'info> {
    #[account(seeds = [b"global_state"], bump = global_state.bump)]
    pub global_state: Account<'info, GlobalState>,
}

#[derive(Accounts)]
pub struct ExecuteSwap<'info> {
    #[account(mut, seeds = [b"global_state"], bump = global_state.bump)]
    pub global_state: Account<'info, GlobalState>,
    
    #[account(
        init_if_needed,
        payer = user_authority,
        space = 8 + UserRebate::INIT_SPACE,
        seeds = [b"user_rebate", user_authority.key().as_ref()],
        bump
    )]
    pub user_rebate: Account<'info, UserRebate>,
    
    #[account(mut)]
    pub user_authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LockBack<'info> {
    #[account(
        mut,
        seeds = [b"user_rebate", user_authority.key().as_ref()],
        bump = user_rebate.bump
    )]
    pub user_rebate: Account<'info, UserRebate>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub lock_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UnlockBack<'info> {
    #[account(
        mut,
        seeds = [b"user_rebate", user_authority.key().as_ref()],
        bump = user_rebate.bump
    )]
    pub user_rebate: Account<'info, UserRebate>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub lock_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(
        mut,
        seeds = [b"user_rebate", user_authority.key().as_ref()],
        bump = user_rebate.bump
    )]
    pub user_rebate: Account<'info, UserRebate>,
    
    #[account(mut)]
    pub user_authority: Signer<'info>,
}

// === COMPTES ===

#[account]
#[derive(InitSpace)]
pub struct GlobalState {
    pub authority: Pubkey,
    pub rebate_percentage: u8,      // 70-80%
    pub burn_percentage: u8,         // 20-30%
    pub npi_threshold: u64,          // Seuil NPI pour utiliser bundles
    pub treasury: Pubkey,
    pub total_volume: u64,
    pub total_npi: u64,
    pub total_rebates: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserRebate {
    pub user: Pubkey,
    pub total_npi: u64,
    pub pending_rebates: u64,
    pub total_claimed: u64,
    pub swap_count: u64,
    pub locked_amount: u64,
    pub lock_end_time: i64,
    pub rebate_boost: u8,            // Boost en pourcentage (0-50%)
    pub bump: u8,
}

impl Default for UserRebate {
    fn default() -> Self {
        Self {
            user: Pubkey::default(),
            total_npi: 0,
            pending_rebates: 0,
            total_claimed: 0,
            swap_count: 0,
            locked_amount: 0,
            lock_end_time: 0,
            rebate_boost: 0,
            bump: 0,
        }
    }
}

// === TYPES ===

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum RouteType {
    Direct,
    Aggregator,
    RFQ,
    Bundle,
}

// === EVENTS ===

#[event]
pub struct SwapExecuted {
    pub user: Pubkey,
    pub input_amount: u64,
    pub output_amount: u64,
    pub npi_amount: u64,
    pub rebate_amount: u64,
    pub burn_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokensLocked {
    pub user: Pubkey,
    pub amount: u64,
    pub lock_duration: i64,
    pub boost: u8,
    pub timestamp: i64,
}

#[event]
pub struct TokensUnlocked {
    pub user: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct RewardsClaimed {
    pub user: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

// === ERREURS ===

#[error_code]
pub enum ErrorCode {
    #[msg("Les pourcentages de remise et de burn doivent totaliser max 100%")]
    InvalidPercentages,
    #[msg("Montant invalide")]
    InvalidAmount,
    #[msg("Non autorisé")]
    Unauthorized,
    #[msg("Durée de verrouillage invalide")]
    InvalidLockDuration,
    #[msg("La période de verrouillage n'est pas terminée")]
    LockPeriodNotEnded,
    #[msg("Aucune récompense à réclamer")]
    NoRewardsToClaim,
}

// === FONCTIONS UTILITAIRES ===

fn calculate_boost(amount: u64, duration: i64) -> u8 {
    // Calcul simple du boost basé sur le montant et la durée
    // Plus le montant et la durée sont élevés, plus le boost est important
    let days = duration / 86400; // Conversion en jours
    
    if amount >= 10_000_000_000 && days >= 365 {
        50 // Gold: 50% boost
    } else if amount >= 1_000_000_000 && days >= 180 {
        30 // Silver: 30% boost
    } else if amount >= 100_000_000 && days >= 90 {
        10 // Bronze: 10% boost
    } else {
        0
    }
}
