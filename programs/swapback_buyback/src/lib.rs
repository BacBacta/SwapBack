use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

declare_id!("75nEwGH4cpRq13PG2eEioQE1wBqSvxvK9bhWfvpvZvP7");

#[program]
pub mod swapback_buyback {
    use super::*;

    /// Initialise le programme de buyback
    pub fn initialize(ctx: Context<Initialize>, min_buyback_amount: u64) -> Result<()> {
        let buyback_state = &mut ctx.accounts.buyback_state;

        buyback_state.authority = ctx.accounts.authority.key();
        buyback_state.back_mint = ctx.accounts.back_mint.key();
        buyback_state.usdc_vault = ctx.accounts.usdc_vault.key();
        buyback_state.min_buyback_amount = min_buyback_amount;
        buyback_state.total_usdc_spent = 0;
        buyback_state.total_back_burned = 0;
        buyback_state.buyback_count = 0;
        buyback_state.bump = ctx.bumps.buyback_state;

        msg!("Programme de buyback initialisé avec succès");
        Ok(())
    }

    /// Dépose des USDC pour le buyback (appelé par le routeur)
    pub fn deposit_usdc(ctx: Context<DepositUSDC>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Transfert des USDC vers le vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.source_usdc.to_account_info(),
            to: ctx.accounts.usdc_vault.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        emit!(USDCDeposited {
            depositor: ctx.accounts.depositor.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Dépôt de {} USDC pour buyback", amount);
        Ok(())
    }

    /// Exécute un buyback de $BACK avec les USDC accumulés
    pub fn execute_buyback(
        ctx: Context<ExecuteBuyback>,
        max_usdc_amount: u64,
        min_back_amount: u64,
    ) -> Result<()> {
        let buyback_state = &mut ctx.accounts.buyback_state;

        require!(
            ctx.accounts.usdc_vault.amount >= buyback_state.min_buyback_amount,
            ErrorCode::InsufficientFunds
        );

        require!(max_usdc_amount > 0, ErrorCode::InvalidAmount);
        require!(min_back_amount > 0, ErrorCode::InvalidAmount);

        // Vérification de l'autorité
        require!(
            ctx.accounts.authority.key() == buyback_state.authority,
            ErrorCode::Unauthorized
        );

        let actual_usdc = std::cmp::min(max_usdc_amount, ctx.accounts.usdc_vault.amount);

        // TODO: Implémenter l'intégration avec Jupiter pour exécuter le swap USDC -> $BACK
        // Pour le MVP, on simule le buyback

        let back_bought = min_back_amount; // Sera remplacé par le montant réel du swap

        // Mise à jour des statistiques
        buyback_state.total_usdc_spent = buyback_state
            .total_usdc_spent
            .checked_add(actual_usdc)
            .unwrap();
        buyback_state.buyback_count = buyback_state.buyback_count.checked_add(1).unwrap();

        emit!(BuybackExecuted {
            usdc_amount: actual_usdc,
            back_amount: back_bought,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "Buyback exécuté: {} USDC -> {} $BACK",
            actual_usdc,
            back_bought
        );

        Ok(())
    }

    /// Brûle les tokens $BACK achetés
    pub fn burn_back(ctx: Context<BurnBack>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let buyback_state = &mut ctx.accounts.buyback_state;

        // Vérification de l'autorité
        require!(
            ctx.accounts.authority.key() == buyback_state.authority,
            ErrorCode::Unauthorized
        );

        // Brûlage des tokens avec signature PDA
        // seeds must be slices of bytes; utiliser .as_ref() pour forcer les types
        let seeds = &[b"buyback_state".as_ref(), &[buyback_state.bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Burn {
            mint: ctx.accounts.back_mint.to_account_info(),
            from: ctx.accounts.back_vault.to_account_info(),
            authority: buyback_state.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::burn(cpi_ctx, amount)?;

        // Mise à jour des statistiques
        buyback_state.total_back_burned =
            buyback_state.total_back_burned.checked_add(amount).unwrap();

        emit!(BackBurned {
            amount,
            total_burned: buyback_state.total_back_burned,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "Brûlage de {} $BACK (total brûlé: {})",
            amount,
            buyback_state.total_back_burned
        );
        Ok(())
    }

    /// Met à jour les paramètres du buyback
    pub fn update_params(ctx: Context<UpdateParams>, new_min_buyback: Option<u64>) -> Result<()> {
        let buyback_state = &mut ctx.accounts.buyback_state;

        require!(
            ctx.accounts.authority.key() == buyback_state.authority,
            ErrorCode::Unauthorized
        );

        if let Some(min_buyback) = new_min_buyback {
            buyback_state.min_buyback_amount = min_buyback;
            msg!("Nouveau montant minimum de buyback: {}", min_buyback);
        }

        Ok(())
    }
}

// === STRUCTS DE CONTEXTE ===

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + BuybackState::INIT_SPACE,
        seeds = [b"buyback_state"],
        bump
    )]
    pub buyback_state: Account<'info, BuybackState>,

    pub back_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = buyback_state,
        seeds = [b"usdc_vault"],
        bump
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DepositUSDC<'info> {
    #[account(mut, seeds = [b"buyback_state"], bump = buyback_state.bump)]
    pub buyback_state: Account<'info, BuybackState>,

    #[account(mut)]
    pub source_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"usdc_vault"],
        bump
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    pub depositor: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ExecuteBuyback<'info> {
    #[account(mut, seeds = [b"buyback_state"], bump = buyback_state.bump)]
    pub buyback_state: Account<'info, BuybackState>,

    #[account(mut, seeds = [b"usdc_vault"], bump)]
    pub usdc_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub back_vault: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnBack<'info> {
    #[account(mut, seeds = [b"buyback_state"], bump = buyback_state.bump)]
    pub buyback_state: Account<'info, BuybackState>,

    #[account(mut)]
    pub back_mint: Account<'info, Mint>,

    #[account(mut)]
    pub back_vault: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateParams<'info> {
    #[account(mut, seeds = [b"buyback_state"], bump = buyback_state.bump)]
    pub buyback_state: Account<'info, BuybackState>,

    pub authority: Signer<'info>,
}

// === COMPTES ===

#[account]
#[derive(InitSpace)]
pub struct BuybackState {
    pub authority: Pubkey,
    pub back_mint: Pubkey,
    pub usdc_vault: Pubkey,
    pub min_buyback_amount: u64,
    pub total_usdc_spent: u64,
    pub total_back_burned: u64,
    pub buyback_count: u64,
    pub bump: u8,
}

// === EVENTS ===

#[event]
pub struct USDCDeposited {
    pub depositor: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct BuybackExecuted {
    pub usdc_amount: u64,
    pub back_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct BackBurned {
    pub amount: u64,
    pub total_burned: u64,
    pub timestamp: i64,
}

// === ERREURS ===

#[error_code]
pub enum ErrorCode {
    #[msg("Montant invalide")]
    InvalidAmount,
    #[msg("Fonds insuffisants")]
    InsufficientFunds,
    #[msg("Non autorisé")]
    Unauthorized,
}
