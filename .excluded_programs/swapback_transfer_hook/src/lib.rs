use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, Token2022};
use anchor_spl::token_interface::{Mint, TokenAccount};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;
use spl_transfer_hook_interface::onchain::add_extra_accounts_for_execute;
use spl_tlv_account_resolution::{account::ExtraAccountMeta, state::ExtraAccountMetaList};
use spl_type_length_value::state::TlvStateBorrowed;

declare_id!("BACKTransferHook1111111111111111111111111111111");

#[program]
pub mod swapback_transfer_hook {
    use super::*;

    /// Initialise le Transfer Hook pour le token $BACK
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let transfer_hook_config = &mut ctx.accounts.transfer_hook_config;

        // Configuration du burn automatique (0.1% par transfert)
        transfer_hook_config.bump = ctx.bumps.transfer_hook_config;
        transfer_hook_config.authority = ctx.accounts.authority.key();
        transfer_hook_config.burn_percentage = 10; // 0.1% = 10 basis points
        transfer_hook_config.total_burned = 0;

        msg!("Transfer Hook $BACK initialisé avec burn de 0.1%");
        Ok(())
    }

    /// Exécute le Transfer Hook - appelé automatiquement lors des transferts
    pub fn execute(ctx: Context<Execute>) -> Result<()> {
        let transfer_hook_config = &mut ctx.accounts.transfer_hook_config;

        // Récupérer les informations du transfert depuis les comptes extra
        let source_account = &ctx.accounts.source_token_account;
        let destination_account = &ctx.accounts.destination_token_account;
        let amount = ctx.accounts.amount_account.load()?.amount;

        // Calculer le montant à brûler (0.1% du transfert)
        let burn_amount = (amount as u128)
            .checked_mul(transfer_hook_config.burn_percentage as u128)
            .unwrap()
            .checked_div(10000) // Diviser par 10000 pour les basis points
            .unwrap() as u64;

        if burn_amount > 0 {
            // Effectuer le burn en réduisant le supply du mint
            let cpi_accounts = token_2022::Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.source_token_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            };

            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

            token_2022::burn(cpi_ctx, burn_amount)?;

            // Mettre à jour les statistiques
            transfer_hook_config.total_burned = transfer_hook_config.total_burned
                .checked_add(burn_amount)
                .unwrap();

            msg!("Burn automatique: {} tokens $BACK brûlés", burn_amount);
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TransferHookConfig::INIT_SPACE,
        seeds = [b"transfer_hook_config"],
        bump
    )]
    pub transfer_hook_config: Account<'info, TransferHookConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(
        mut,
        seeds = [b"transfer_hook_config"],
        bump = transfer_hook_config.bump
    )]
    pub transfer_hook_config: Account<'info, TransferHookConfig>,

    #[account(mut)]
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub destination_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: Validated by token program
    pub authority: UncheckedAccount<'info>,

    /// CHECK: Amount account for transfer hook
    #[account(owner = token_2022::ID)]
    pub amount_account: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
}

#[account]
#[derive(InitSpace)]
pub struct TransferHookConfig {
    pub bump: u8,
    pub authority: Pubkey,
    pub burn_percentage: u16, // En basis points (1 = 0.01%)
    pub total_burned: u64,
}

#[event]
pub struct TokensBurned {
    pub amount: u64,
    pub total_burned: u64,
    pub timestamp: i64,
}