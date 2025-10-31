use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};
use anchor_spl::token_2022::{self, Token2022};

// Program ID déployé sur devnet - 31 Oct 2025 (nouveau déploiement avec Token-2022)
declare_id!("92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir");

// Program ID du cNFT pour lire GlobalState et UserNft (mis à jour)
pub const CNFT_PROGRAM_ID: Pubkey = pubkey!("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");

// Ratio de distribution: 50% burn, 50% distribution
pub const BURN_RATIO_BPS: u16 = 5000; // 50%
pub const DISTRIBUTION_RATIO_BPS: u16 = 5000; // 50%

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
        if ctx.accounts.token_program.key() == token_2022::ID {
            // Token-2022
            let cpi_accounts = token_2022::Transfer {
                from: ctx.accounts.source_usdc.to_account_info(),
                to: ctx.accounts.usdc_vault.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            token_2022::transfer(cpi_ctx, amount)?;
        } else {
            // Token standard
            let cpi_accounts = Transfer {
                from: ctx.accounts.source_usdc.to_account_info(),
                to: ctx.accounts.usdc_vault.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            token::transfer(cpi_ctx, amount)?;
        }

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

        msg!(
            "Buyback exécuté: {} USDC -> {} $BACK",
            actual_usdc,
            back_bought
        );

        Ok(())
    }

    /// Distribue une portion des tokens buyback à un utilisateur proportionnellement à son boost
    /// Ratio: 50% distribution, 50% burn
    /// Formula: user_share = (user_boost / total_community_boost) * (buyback_tokens * 50%)
    pub fn distribute_buyback(
        ctx: Context<DistributeBuyback>,
        max_tokens: u64,
    ) -> Result<()> {
        require!(max_tokens > 0, ErrorCode::InvalidAmount);

        let global_state = &ctx.accounts.global_state;
        let user_nft = &ctx.accounts.user_nft;
        let buyback_state = &ctx.accounts.buyback_state;

        // Vérifier que le NFT est actif
        require!(user_nft.is_active, ErrorCode::InactiveNft);

        // Vérifier qu'il y a du boost dans la communauté
        require!(
            global_state.total_community_boost > 0,
            ErrorCode::NoBoostInCommunity
        );

        // Calculer la portion distribuable (50% du total)
        let distributable_tokens = (max_tokens as u128)
            .checked_mul(DISTRIBUTION_RATIO_BPS as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::MathOverflow)? as u64;

        // Calculer la part de l'utilisateur
        // user_share = (user_boost / total_boost) * distributable_tokens
        let user_share = (distributable_tokens as u128)
            .checked_mul(user_nft.boost as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(global_state.total_community_boost as u128)
            .ok_or(ErrorCode::MathOverflow)? as u64;

        require!(user_share > 0, ErrorCode::ShareTooSmall);

        // Vérifier qu'il y a assez de tokens dans le vault
        require!(
            ctx.accounts.back_vault.amount >= user_share,
            ErrorCode::InsufficientFunds
        );

        // Transférer les tokens $BACK vers le compte utilisateur
        let seeds = &[b"buyback_state".as_ref(), &[buyback_state.bump]];
        let signer = &[&seeds[..]];

        // Détecter si c'est Token ou Token2022 et utiliser la bonne instruction
        if ctx.accounts.token_program.key() == token::ID {
            // Token standard
            let cpi_accounts = Transfer {
                from: ctx.accounts.back_vault.to_account_info(),
                to: ctx.accounts.user_back_account.to_account_info(),
                authority: buyback_state.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, user_share)?;
        } else if ctx.accounts.token_program.key() == token_2022::ID {
            // Token-2022 - utiliser transfer (la fonction de base existe encore)
            let cpi_accounts = token_2022::Transfer {
                from: ctx.accounts.back_vault.to_account_info(),
                to: ctx.accounts.user_back_account.to_account_info(),
                authority: buyback_state.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token_2022::transfer(cpi_ctx, user_share)?;
        } else {
            return err!(ErrorCode::InvalidTokenProgram);
        }

        emit!(BuybackDistributed {
            user: ctx.accounts.user.key(),
            user_boost: user_nft.boost,
            total_boost: global_state.total_community_boost,
            distributable_amount: distributable_tokens,
            tokens_received: user_share,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "Distribution buyback: {} $BACK pour {} (boost: {} / {} = {:.2}%)",
            user_share,
            ctx.accounts.user.key(),
            user_nft.boost,
            global_state.total_community_boost,
            (user_nft.boost as f64 / global_state.total_community_boost as f64) * 100.0
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

        // Détecter si c'est Token ou Token2022 et utiliser la bonne instruction
        if ctx.accounts.token_program.key() == token::ID {
            // Token standard
            let cpi_accounts = Burn {
                mint: ctx.accounts.back_mint.to_account_info(),
                from: ctx.accounts.back_vault.to_account_info(),
                authority: buyback_state.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::burn(cpi_ctx, amount)?;
        } else if ctx.accounts.token_program.key() == token_2022::ID {
            // Token-2022 - utiliser burn (la fonction de base existe encore)
            let cpi_accounts = token_2022::Burn {
                mint: ctx.accounts.back_mint.to_account_info(),
                from: ctx.accounts.back_vault.to_account_info(),
                authority: buyback_state.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token_2022::burn(cpi_ctx, amount)?;
        } else {
            return err!(ErrorCode::InvalidTokenProgram);
        }

        // Mise à jour des statistiques
        buyback_state.total_back_burned = buyback_state
            .total_back_burned
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;

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

    /// CHECK: Peut être Token standard ou Token-2022
    pub back_mint: AccountInfo<'info>,

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

    /// CHECK: Token Program (standard ou 2022)
    pub token_program: AccountInfo<'info>,
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
    /// CHECK: Token Program (standard ou 2022)
    pub token_program: AccountInfo<'info>,
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
    /// CHECK: Token Program (standard ou 2022)
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct BurnBack<'info> {
    #[account(mut, seeds = [b"buyback_state"], bump = buyback_state.bump)]
    pub buyback_state: Account<'info, BuybackState>,

    /// CHECK: Peut être Token standard ou Token-2022
    pub back_mint: AccountInfo<'info>,

    #[account(mut)]
    pub back_vault: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    /// CHECK: Token program (either Token or Token2022)
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct UpdateParams<'info> {
    #[account(mut, seeds = [b"buyback_state"], bump = buyback_state.bump)]
    pub buyback_state: Account<'info, BuybackState>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DistributeBuyback<'info> {
    #[account(seeds = [b"buyback_state"], bump = buyback_state.bump)]
    pub buyback_state: Account<'info, BuybackState>,

    /// CHECK: GlobalState du programme cNFT pour lire total_community_boost
    #[account(
        seeds = [b"global_state"],
        bump,
        seeds::program = CNFT_PROGRAM_ID
    )]
    pub global_state: Account<'info, GlobalState>,

    /// CHECK: UserNft du programme cNFT pour lire le boost utilisateur
    #[account(
        seeds = [b"user_nft", user.key().as_ref()],
        bump,
        seeds::program = CNFT_PROGRAM_ID
    )]
    pub user_nft: Account<'info, UserNft>,

    #[account(mut)]
    pub back_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_back_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    /// CHECK: Token program (either Token or Token2022)
    pub token_program: AccountInfo<'info>,
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

// Structures importées du programme cNFT
#[account]
pub struct GlobalState {
    pub authority: Pubkey,
    pub total_community_boost: u64,
    pub active_locks_count: u64,
    pub total_value_locked: u64,
}

#[account]
pub struct UserNft {
    pub user: Pubkey,
    pub level: LockLevel,
    pub amount_locked: u64,
    pub lock_duration: i64,
    pub boost: u16,
    pub mint_time: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum LockLevel {
    Bronze,
    Silver,
    Gold,
    Platinum,
    Diamond,
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

#[event]
pub struct BuybackDistributed {
    pub user: Pubkey,
    pub user_boost: u16,
    pub total_boost: u64,
    pub distributable_amount: u64,
    pub tokens_received: u64,
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
    #[msg("NFT inactif")]
    InactiveNft,
    #[msg("Aucun boost dans la communauté")]
    NoBoostInCommunity,
    #[msg("Dépassement arithmétique")]
    MathOverflow,
    #[msg("Part trop petite")]
    ShareTooSmall,
    #[msg("Programme token invalide")]
    InvalidTokenProgram,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_distribution_ratio_50_50() {
        // Test que le ratio est bien 50/50
        assert_eq!(BURN_RATIO_BPS, 5000);
        assert_eq!(DISTRIBUTION_RATIO_BPS, 5000);
        assert_eq!(BURN_RATIO_BPS + DISTRIBUTION_RATIO_BPS, 10_000);
    }

    #[test]
    fn test_calculate_distributable_amount() {
        // Total buyback: 100,000 tokens
        // Distributable (50%): 50,000 tokens
        let total_buyback = 100_000u64;
        let distributable = (total_buyback as u128)
            .checked_mul(DISTRIBUTION_RATIO_BPS as u128)
            .unwrap()
            .checked_div(10_000)
            .unwrap() as u64;
        
        assert_eq!(distributable, 50_000, "50% should be distributable");
    }

    #[test]
    fn test_user_share_calculation_single_user() {
        // Scénario: 1 seul utilisateur avec 100% du boost
        let distributable = 50_000u64;
        let user_boost = 10_000u16; // 100%
        let total_boost = 10_000u64;

        let user_share = (distributable as u128)
            .checked_mul(user_boost as u128)
            .unwrap()
            .checked_div(total_boost as u128)
            .unwrap() as u64;

        assert_eq!(user_share, 50_000, "Single user should get 100% of distributable");
    }

    #[test]
    fn test_user_share_calculation_multiple_users() {
        // Scénario: 3 utilisateurs
        // Alice: 8600 BP (76.4%)
        // Bob: 2300 BP (20.4%)
        // Charlie: 350 BP (3.1%)
        // Total: 11,250 BP

        let distributable = 50_000u64;
        let total_boost = 11_250u64;

        // Alice
        let alice_boost = 8_600u16;
        let alice_share = (distributable as u128)
            .checked_mul(alice_boost as u128)
            .unwrap()
            .checked_div(total_boost as u128)
            .unwrap() as u64;
        assert_eq!(alice_share, 38_222, "Alice should get ~76.4%");

        // Bob
        let bob_boost = 2_300u16;
        let bob_share = (distributable as u128)
            .checked_mul(bob_boost as u128)
            .unwrap()
            .checked_div(total_boost as u128)
            .unwrap() as u64;
        assert_eq!(bob_share, 10_222, "Bob should get ~20.4%");

        // Charlie
        let charlie_boost = 350u16;
        let charlie_share = (distributable as u128)
            .checked_mul(charlie_boost as u128)
            .unwrap()
            .checked_div(total_boost as u128)
            .unwrap() as u64;
        assert_eq!(charlie_share, 1_555, "Charlie should get ~3.1%");

        // Vérifier que la somme est proche du distributable (avec arrondi)
        let total_distributed = alice_share + bob_share + charlie_share;
        assert!(
            total_distributed >= distributable - 3 && total_distributed <= distributable,
            "Total distributed should be close to distributable amount"
        );
    }

    #[test]
    fn test_burn_amount_calculation() {
        // Total buyback: 100,000 tokens
        // Burn (50%): 50,000 tokens
        let total_buyback = 100_000u64;
        let burn_amount = (total_buyback as u128)
            .checked_mul(BURN_RATIO_BPS as u128)
            .unwrap()
            .checked_div(10_000)
            .unwrap() as u64;
        
        assert_eq!(burn_amount, 50_000, "50% should be burned");
    }

    #[test]
    fn test_realistic_scenario() {
        // Scénario réaliste:
        // Buyback de 1,000,000 $BACK
        // 500,000 distribués, 500,000 brûlés
        // 10 utilisateurs avec des boosts variés

        let total_buyback = 1_000_000u64;
        let distributable = (total_buyback as u128 * DISTRIBUTION_RATIO_BPS as u128 / 10_000) as u64;
        
        assert_eq!(distributable, 500_000);

        // Simuler différents boosts (total: 50,000 BP)
        let total_boost = 50_000u64;
        
        // Whale avec 20,000 BP (40%)
        let whale_share = (distributable as u128 * 20_000 / total_boost as u128) as u64;
        assert_eq!(whale_share, 200_000, "Whale gets 40% of distribution");

        // Medium avec 5,000 BP (10%)
        let medium_share = (distributable as u128 * 5_000 / total_boost as u128) as u64;
        assert_eq!(medium_share, 50_000, "Medium gets 10% of distribution");
    }
}
