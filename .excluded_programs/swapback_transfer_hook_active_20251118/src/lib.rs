use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::Token2022,
    token_interface::{Mint, TokenAccount},
};
use spl_tlv_account_resolution::{account::ExtraAccountMeta, state::ExtraAccountMetaList};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

declare_id!("5vgpMPVKRxk3k7e5arcZSoayp6iKJ3mkNu9MbayGBJ4X");

#[program]
pub mod swapback_transfer_hook {
    use super::*;

    /**
     * Initialise le Transfer Hook avec les comptes extra requis
     */
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        // Comptes extra pour le hook:
        // 1. Buyback program state
        // 2. Buyback vault (pour accumuler les tokens)
        let account_metas = vec![
            ExtraAccountMeta::new_with_pubkey(&ctx.accounts.buyback_state.key(), false, false)?,
            ExtraAccountMeta::new_with_pubkey(&ctx.accounts.buyback_vault.key(), false, true)?,
        ];

        // Initialiser la liste dans le compte
        let account_size = ExtraAccountMetaList::size_of(account_metas.len())?;
        let mut data = ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?;
        ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &account_metas)?;

        msg!("Transfer Hook initialized with {} extra accounts", account_metas.len());
        Ok(())
    }

    /**
     * Execute - appelé automatiquement à chaque transfer de $BACK
     * 
     * Logique:
     * 1. Calculer le montant de buyback (0.5% du transfer par exemple)
     * 2. Transférer vers buyback vault
     * 3. Émettre event pour tracking
     */
    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        msg!("Transfer Hook triggered: amount = {}", amount);

        // Configuration: 0.5% de chaque transfer va au buyback
        const BUYBACK_BPS: u64 = 50; // 0.5% = 50 basis points
        const BPS_DENOMINATOR: u64 = 10_000;

        // Calculer montant buyback
        let buyback_amount = amount
            .checked_mul(BUYBACK_BPS)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(ErrorCode::MathOverflow)?;

        // Si montant significatif, logger pour buyback futur
        if buyback_amount > 0 {
            msg!("Buyback amount: {} tokens", buyback_amount);
            
            // TODO: Accumuler dans buyback vault
            // Pour l'instant, on log uniquement
            // La logique complète sera dans le Buyback program
            
            emit!(TransferHookEvent {
                from: ctx.accounts.source_token.key(),
                to: ctx.accounts.destination_token.key(),
                amount,
                buyback_amount,
                timestamp: Clock::get()?.unix_timestamp,
            });
        }

        Ok(())
    }

    /**
     * Fallback instruction - requis par l'interface
     */
    pub fn fallback<'info>(
        _program_id: &Pubkey,
        _accounts: &'info [AccountInfo<'info>],
        _data: &[u8],
    ) -> Result<()> {
        Err(ErrorCode::FallbackNotSupported.into())
    }
}

// ============================
// 📦 ACCOUNTS
// ============================

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList Account, must use these seeds
    #[account(
        init,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump,
        space = ExtraAccountMetaList::size_of(2)?,
        payer = payer
    )]
    pub extra_account_meta_list: AccountInfo<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
    
    /// CHECK: Buyback program state PDA
    pub buyback_state: AccountInfo<'info>,
    
    /// CHECK: Buyback vault pour accumuler tokens
    pub buyback_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(
        token::mint = mint,
        token::authority = owner,
    )]
    pub source_token: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        token::mint = mint,
    )]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Source account owner
    pub owner: UncheckedAccount<'info>,

    /// CHECK: ExtraAccountMetaList Account
    #[account(
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump,
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    /// CHECK: Buyback state
    pub buyback_state: UncheckedAccount<'info>,
    
    /// CHECK: Buyback vault
    #[account(mut)]
    pub buyback_vault: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
}

// ============================
// 📡 EVENTS
// ============================

#[event]
pub struct TransferHookEvent {
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
    pub buyback_amount: u64,
    pub timestamp: i64,
}

// ============================
// ⚠️ ERRORS
// ============================

#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow")]
    MathOverflow,
    
    #[msg("Fallback instruction not supported")]
    FallbackNotSupported,
}
