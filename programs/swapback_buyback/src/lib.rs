use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

declare_id!("71vALqj3cmQWDmq9bi9GYYDPQqpoRstej3snUbikpCHW");

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

        // Execute Jupiter swap: USDC -> $BACK
        let back_bought = execute_jupiter_swap(ctx, actual_usdc, min_back_amount)?;

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

    /// Execute Jupiter V6 swap via CPI
    fn execute_jupiter_swap(
        ctx: Context<ExecuteBuyback>,
        usdc_amount: u64,
        min_back_amount: u64,
    ) -> Result<u64> {
        let buyback_state = &ctx.accounts.buyback_state;

        // Jupiter V6 uses a SharedAccountsRoute instruction
        // We need to invoke Jupiter's swap instruction with our vault as authority

        let jupiter_program = ctx.accounts.jupiter_program.as_ref()
            .ok_or(ErrorCode::InvalidJupiterProgram)?;

        // PDA seeds for signing
        let seeds = &[
            b"buyback_state".as_ref(),
            &[buyback_state.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        // Build Jupiter swap instruction data
        // Jupiter V6 discriminator for sharedAccountsRoute: [0xec, 0xd0, 0x6f, 0x55, 0x5d, 0x47, 0xc7, 0x3f]
        let mut instruction_data = vec![0xec, 0xd0, 0x6f, 0x55, 0x5d, 0x47, 0xc7, 0x3f];
        instruction_data.extend_from_slice(&usdc_amount.to_le_bytes()); // in_amount
        instruction_data.extend_from_slice(&min_back_amount.to_le_bytes()); // quoted_out_amount
        instruction_data.extend_from_slice(&50u16.to_le_bytes()); // slippage_bps (0.5%)
        instruction_data.push(1); // platform_fee_bps (0.01%)

        // Jupiter requires specific account ordering - this is a simplified version
        // In production, you'd get this from Jupiter API quote response
        let accounts = vec![
            ctx.accounts.jupiter_program.as_ref().unwrap().to_account_info(),
            ctx.accounts.usdc_vault.to_account_info(), // source
            ctx.accounts.back_vault.as_ref().ok_or(ErrorCode::InvalidJupiterProgram)?.to_account_info(), // destination
            buyback_state.to_account_info(), // user (authority - PDA)
            ctx.accounts.token_program.to_account_info(),
            // Additional accounts would be passed via remaining_accounts in a real implementation
        ];

        let instruction = solana_program::instruction::Instruction {
            program_id: *jupiter_program.key,
            accounts: accounts.iter().enumerate().map(|(i, acc)| {
                solana_program::instruction::AccountMeta {
                    pubkey: *acc.key,
                    is_signer: i == 3, // buyback_state PDA signs
                    is_writable: i == 1 || i == 2, // source and destination are writable
                }
            }).collect(),
            data: instruction_data,
        };

        // Get initial BACK balance
        let back_vault_account = ctx.accounts.back_vault.as_ref()
            .ok_or(ErrorCode::InvalidJupiterProgram)?;
        let initial_back_balance = back_vault_account.amount;

        // Execute CPI to Jupiter
        solana_program::program::invoke_signed(
            &instruction,
            &accounts,
            signer_seeds,
        ).map_err(|_| ErrorCode::JupiterSwapFailed)?;

        // Reload and calculate BACK received
        let back_vault_account = ctx.accounts.back_vault.as_mut()
            .ok_or(ErrorCode::InvalidJupiterProgram)?;
        back_vault_account.reload()?;
        let final_back_balance = back_vault_account.amount;
        
        let back_received = final_back_balance
            .checked_sub(initial_back_balance)
            .ok_or(ErrorCode::InvalidAmount)?;

        require!(
            back_received >= min_back_amount,
            ErrorCode::SlippageExceeded
        );

        msg!("Jupiter swap executed: {} USDC -> {} $BACK", usdc_amount, back_received);
        Ok(back_received)
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
    pub back_vault: Option<Account<'info, TokenAccount>>,

    /// CHECK: Jupiter V6 program
    pub jupiter_program: Option<AccountInfo<'info>>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    // Jupiter requires additional accounts passed via remaining_accounts
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
    #[msg("Programme Jupiter invalide")]
    InvalidJupiterProgram,
    #[msg("Échec du swap Jupiter")]
    JupiterSwapFailed,
    #[msg("Slippage dépassé")]
    SlippageExceeded,
}
