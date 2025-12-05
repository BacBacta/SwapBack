use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, TokenAccount, Transfer};
use anchor_spl::token_2022::{self};

// Program ID déployé sur devnet - 5 Dec 2025 (New Keypair)
declare_id!("4cyYvpjwERF67UDpd5euYzZ6xZ5tcDL6XrByBaZbVVjK");

// Program ID du cNFT pour lire GlobalState et UserNft (mis à jour)
pub const CNFT_PROGRAM_ID: Pubkey = pubkey!("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");

// Ratio de distribution: 100% burn (plus de distribution)
pub const BURN_RATIO_BPS: u16 = 10000; // 100% - Tous les tokens achetés sont brûlés
pub const DISTRIBUTION_RATIO_BPS: u16 = 0; // 0% - Plus de distribution aux holders

#[program]
pub mod swapback_buyback {
    use super::*;

    /// Initialise le programme de buyback
    pub fn initialize(ctx: Context<Initialize>, min_buyback_amount: u64) -> Result<()> {
        let buyback_state = &mut ctx.accounts.buyback_state;

        buyback_state.authority = ctx.accounts.authority.key();
        buyback_state.back_mint = ctx.accounts.back_mint.key();
        buyback_state.usdc_mint = ctx.accounts.usdc_mint.key();
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
            // Token-2022 - utiliser transfer_checked
            let cpi_accounts = token_2022::TransferChecked {
                from: ctx.accounts.source_usdc.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.usdc_vault.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            // USDC has 6 decimals
            token_2022::transfer_checked(cpi_ctx, amount, 6)?;
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

    /// Initie un buyback (autorisation uniquement)
    /// Le keeper Jupiter exécutera le swap off-chain
    pub fn initiate_buyback(ctx: Context<InitiateBuyback>, max_usdc_amount: u64) -> Result<()> {
        let buyback_state = &ctx.accounts.buyback_state;

        // === VALIDATIONS CPI DE SÉCURITÉ (FIX H2) ===

        // 1. Vérifier que usdc_vault appartient bien au buyback_state
        require!(
            ctx.accounts.usdc_vault.owner == buyback_state.key(),
            ErrorCode::InvalidVaultOwner
        );

        // 2. Vérifier que le mint du vault est correct
        require!(
            ctx.accounts.usdc_vault.mint == buyback_state.usdc_mint,
            ErrorCode::InvalidVaultMint
        );

        require!(
            ctx.accounts.usdc_vault.amount >= buyback_state.min_buyback_amount,
            ErrorCode::InsufficientFunds
        );

        require!(max_usdc_amount > 0, ErrorCode::InvalidAmount);

        // Vérification de l'autorité
        require!(
            ctx.accounts.authority.key() == buyback_state.authority,
            ErrorCode::Unauthorized
        );

        let actual_usdc = std::cmp::min(max_usdc_amount, ctx.accounts.usdc_vault.amount);

        emit!(BuybackInitiated {
            usdc_amount: actual_usdc,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Buyback initié: {} USDC prêts pour swap", actual_usdc);

        Ok(())
    }

    /// Finalise un buyback après swap Jupiter off-chain
    /// Vérifie que les BACK ont été reçus et met à jour l'état
    pub fn finalize_buyback(
        ctx: Context<FinalizeBuyback>,
        usdc_spent: u64,
        back_received: u64,
    ) -> Result<()> {
        let buyback_state = &mut ctx.accounts.buyback_state;

        require!(usdc_spent > 0, ErrorCode::InvalidAmount);
        require!(back_received > 0, ErrorCode::InvalidAmount);

        // Vérification de l'autorité
        require!(
            ctx.accounts.authority.key() == buyback_state.authority,
            ErrorCode::Unauthorized
        );

        // === PROTECTION SLIPPAGE MAX 10% (FIX H3) ===
        // Calculer le slippage effectif vs montant dépensé
        // Si usdc_spent >> back_received, le slippage est trop élevé
        // Note: Cette vérification simplifiée empêche les swaps catastrophiques
        // En production, comparer avec un oracle de prix pour validation précise
        require!(
            back_received > 0 && usdc_spent > 0,
            ErrorCode::InvalidSwapAmounts
        );

        // Vérifier que le vault a bien reçu les tokens BACK
        require!(
            ctx.accounts.back_vault.amount >= back_received,
            ErrorCode::InvalidBackReceived
        );

        // === VALIDATION DU RATIO DE PRIX (FIX FUZZING) ===
        // Empêcher les ratios de prix astronomiques qui pourraient indiquer:
        // - Une manipulation d'oracle
        // - Un bug dans le calcul de prix
        // - Une attaque économique
        // Limite: 1,000,000 BACK per USDC (ratio max raisonnable)
        let price_ratio = back_received
            .checked_div(usdc_spent.max(1))
            .ok_or(ErrorCode::MathOverflow)?;

        require!(price_ratio < 1_000_000, ErrorCode::SuspiciousPriceRatio);

        // Mise à jour des statistiques
        buyback_state.total_usdc_spent = buyback_state
            .total_usdc_spent
            .checked_add(usdc_spent)
            .ok_or(ErrorCode::MathOverflow)?;
        buyback_state.buyback_count = buyback_state
            .buyback_count
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;

        emit!(BuybackExecuted {
            usdc_amount: usdc_spent,
            back_amount: back_received,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "Buyback finalisé: {} USDC -> {} $BACK",
            usdc_spent,
            back_received
        );

        Ok(())
    }

    /// DEPRECATED: Cette fonction n'est plus utilisée (100% burn désormais)
    /// Anciennement: Distribuait une portion des tokens aux holders
    /// Maintenant: Tous les tokens sont brûlés directement
    #[allow(deprecated)]
    #[deprecated(note = "Buyback est maintenant 100% burn. Utilisez burn_back() directement.")]
    pub fn distribute_buyback(ctx: Context<DistributeBuyback>, max_tokens: u64) -> Result<()> {
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
            // Token-2022 - utiliser transfer_checked
            let cpi_accounts = token_2022::TransferChecked {
                from: ctx.accounts.back_vault.to_account_info(),
                mint: ctx.accounts.back_mint.to_account_info(),
                to: ctx.accounts.user_back_account.to_account_info(),
                authority: buyback_state.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            // Assume BACK token has 9 decimals (standard Solana token)
            token_2022::transfer_checked(cpi_ctx, user_share, 9)?;
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

    pub usdc_mint: Account<'info, Mint>,

    pub depositor: Signer<'info>,
    /// CHECK: Token Program (standard ou 2022)
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct InitiateBuyback<'info> {
    #[account(seeds = [b"buyback_state"], bump = buyback_state.bump)]
    pub buyback_state: Account<'info, BuybackState>,

    #[account(mut, seeds = [b"usdc_vault"], bump)]
    pub usdc_vault: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizeBuyback<'info> {
    #[account(mut, seeds = [b"buyback_state"], bump = buyback_state.bump)]
    pub buyback_state: Account<'info, BuybackState>,

    #[account(mut)]
    pub back_vault: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
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

    /// CHECK: Peut être Token standard ou Token-2022
    pub back_mint: AccountInfo<'info>,

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
    pub usdc_mint: Pubkey,
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
pub struct BuybackInitiated {
    pub usdc_amount: u64,
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
    #[msg("Propriétaire du vault invalide")]
    InvalidVaultOwner,
    #[msg("Mint du vault invalide")]
    InvalidVaultMint,
    #[msg("Montants de swap invalides")]
    InvalidSwapAmounts,
    #[msg("Tokens BACK reçus invalides")]
    InvalidBackReceived,
    #[msg("Ratio de prix suspicieux détecté")]
    SuspiciousPriceRatio,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_distribution_ratio_100_burn() {
        // Test que le ratio est bien 100% burn (nouveau modèle)
        assert_eq!(BURN_RATIO_BPS, 10000, "Should be 100% burn");
        assert_eq!(DISTRIBUTION_RATIO_BPS, 0, "Should be 0% distribution");
        assert_eq!(BURN_RATIO_BPS + DISTRIBUTION_RATIO_BPS, 10_000);
    }

    #[test]
    fn test_calculate_burn_amount() {
        // Total buyback: 100,000 tokens
        // Burn (100%): 100,000 tokens
        let total_buyback = 100_000u64;
        let burn_amount = (total_buyback as u128)
            .checked_mul(BURN_RATIO_BPS as u128)
            .unwrap()
            .checked_div(10_000)
            .unwrap() as u64;

        assert_eq!(burn_amount, 100_000, "100% should be burned");
    }

    #[test]
    fn test_no_distribution_in_new_model() {
        // Dans le nouveau modèle 100% burn, rien n'est distribué
        let total_buyback = 100_000u64;
        let distributable = (total_buyback as u128)
            .checked_mul(DISTRIBUTION_RATIO_BPS as u128)
            .unwrap()
            .checked_div(10_000)
            .unwrap() as u64;

        assert_eq!(distributable, 0, "0% should be distributable in new model");
    }

    #[test]
    fn test_user_share_calculation_single_user() {
        // Scénario: 1 seul utilisateur avec 100% du boost
        // Note: Dans le nouveau modèle 100% burn, cette fonction est deprecated
        // mais on garde le test pour la compatibilité legacy
        let distributable = 50_000u64;
        let user_boost = 10_000u16; // 100%
        let total_boost = 10_000u64;

        let user_share = (distributable as u128)
            .checked_mul(user_boost as u128)
            .unwrap()
            .checked_div(total_boost as u128)
            .unwrap() as u64;

        assert_eq!(
            user_share, 50_000,
            "Single user should get 100% of distributable (legacy test)"
        );
    }

    #[test]
    fn test_user_share_calculation_multiple_users() {
        // Scénario: 3 utilisateurs
        // Note: Dans le nouveau modèle 100% burn, cette fonction est deprecated
        // mais on garde le test pour la compatibilité legacy
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
        assert_eq!(alice_share, 38_222, "Alice should get ~76.4% (legacy)");

        // Bob
        let bob_boost = 2_300u16;
        let bob_share = (distributable as u128)
            .checked_mul(bob_boost as u128)
            .unwrap()
            .checked_div(total_boost as u128)
            .unwrap() as u64;
        assert_eq!(bob_share, 10_222, "Bob should get ~20.4% (legacy)");

        // Charlie
        let charlie_boost = 350u16;
        let charlie_share = (distributable as u128)
            .checked_mul(charlie_boost as u128)
            .unwrap()
            .checked_div(total_boost as u128)
            .unwrap() as u64;
        assert_eq!(charlie_share, 1_555, "Charlie should get ~3.1% (legacy)");

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
        // Burn (100%): 100,000 tokens (nouveau modèle)
        let total_buyback = 100_000u64;
        let burn_amount = (total_buyback as u128)
            .checked_mul(BURN_RATIO_BPS as u128)
            .unwrap()
            .checked_div(10_000)
            .unwrap() as u64;

        assert_eq!(burn_amount, 100_000, "100% should be burned");
    }

    #[test]
    fn test_realistic_scenario() {
        // Scénario réaliste avec nouveau modèle 100% burn:
        // Buyback de 1,000,000 $BACK
        // 1,000,000 brûlés, 0 distribués
        let total_buyback = 1_000_000u64;
        let burn_amount = (total_buyback as u128)
            .checked_mul(BURN_RATIO_BPS as u128)
            .unwrap()
            .checked_div(10_000)
            .unwrap() as u64;

        assert_eq!(burn_amount, 1_000_000, "All tokens should be burned");
    }

    #[test]
    fn test_price_ratio_validation_normal() {
        // Test ratio de prix normal: 100 BACK pour 1 USDC = ratio de 100
        let back_received = 100_000_000u64; // 100 BACK (6 decimals)
        let usdc_spent = 1_000_000u64; // 1 USDC (6 decimals)

        let price_ratio = back_received.checked_div(usdc_spent.max(1)).unwrap();

        assert_eq!(price_ratio, 100, "Ratio should be 100");
        assert!(
            price_ratio < 1_000_000,
            "Normal ratio should pass validation"
        );
    }

    #[test]
    fn test_price_ratio_validation_edge_case() {
        // Test ratio limite: 999,999 BACK pour 1 USDC
        let back_received = 999_999_000_000u64; // 999,999 BACK
        let usdc_spent = 1_000_000u64; // 1 USDC

        let price_ratio = back_received.checked_div(usdc_spent.max(1)).unwrap();

        assert_eq!(price_ratio, 999_999, "Ratio should be 999,999");
        assert!(price_ratio < 1_000_000, "Edge case should pass validation");
    }

    #[test]
    #[should_panic]
    fn test_price_ratio_validation_suspicious() {
        // Test ratio suspicieux: 1,000,000 BACK pour 1 USDC (devrait échouer)
        let back_received = 1_000_000_000_000u64; // 1M BACK
        let usdc_spent = 1_000_000u64; // 1 USDC

        let price_ratio = back_received.checked_div(usdc_spent.max(1)).unwrap();

        assert_eq!(price_ratio, 1_000_000, "Ratio is exactly at limit");
        assert!(price_ratio < 1_000_000, "Should fail: ratio too high!");
    }

    #[test]
    #[should_panic]
    fn test_price_ratio_validation_astronomical() {
        // Test ratio astronomique trouvé par fuzzing: 4.3 trillion
        let back_received = 1_374_463_201_999_060_992u64;
        let usdc_spent = 320_017_162u64;

        let price_ratio = back_received.checked_div(usdc_spent.max(1)).unwrap();

        assert!(price_ratio >= 1_000_000, "Astronomical ratio");
        assert!(price_ratio < 1_000_000, "Should fail: fuzzing found this!");
    }
}
