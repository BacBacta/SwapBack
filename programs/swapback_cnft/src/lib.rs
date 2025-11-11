use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::{transfer_checked, Token2022, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount};

// Program ID - Matches keypair in target/deploy/swapback_cnft-keypair.json
declare_id!("CzxpYBeKbcA6AJH7yz8ggkJ1cWen3ejKUuikE6stHEaF");

#[program]
pub mod swapback_cnft {
    use super::*;

    /// Initialise le GlobalState pour tracker le boost total de la communauté
    pub fn initialize_global_state(ctx: Context<InitializeGlobalState>) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;

        global_state.authority = ctx.accounts.authority.key();
        global_state.total_community_boost = 0;
        global_state.active_locks_count = 0;
        global_state.total_value_locked = 0;

        msg!("GlobalState initialisé - Tracking du boost communautaire actif");
        Ok(())
    }

    /// Initialise la collection cNFT pour les niveaux SwapBack
    pub fn initialize_collection(ctx: Context<InitializeCollection>) -> Result<()> {
        let collection_config = &mut ctx.accounts.collection_config;

        collection_config.authority = ctx.accounts.authority.key();
        collection_config.tree_config = ctx.accounts.tree_config.key();
        collection_config.total_minted = 0;

        msg!("Collection cNFT SwapBack initialisée");
        Ok(())
    }

    /// Crée un cNFT de niveau pour un utilisateur
    /// Note: Version simplifiée sans Bubblegum pour éviter les conflits de dépendances
    /// L'intégration Bubblegum sera ajoutée après résolution des versions
    pub fn mint_level_nft(
        ctx: Context<MintLevelNft>,
        amount_locked: u64,
        lock_duration: i64,
    ) -> Result<()> {
        let collection_config = &mut ctx.accounts.collection_config;
        let global_state = &mut ctx.accounts.global_state;
        let user_nft = &mut ctx.accounts.user_nft;

        // Calculer le boost dynamique
        let boost = calculate_boost(amount_locked, lock_duration);

        // Déterminer le niveau automatiquement basé sur montant + durée
        let duration_days = (lock_duration / 86400) as u64;
        let level = LockLevel::from_lock_params(amount_locked, duration_days);

        // Enregistrer le NFT de l'utilisateur (sans mint réel pour l'instant)
        user_nft.user = ctx.accounts.user.key();
        user_nft.level = level;
        user_nft.amount_locked = amount_locked;
        user_nft.lock_duration = lock_duration;
        user_nft.boost = boost;
        user_nft.mint_time = Clock::get()?.unix_timestamp;
        user_nft.is_active = true;
        user_nft.bump = ctx.bumps.user_nft; // 🔧 FIX: Stocker le bump canonical

        // Mettre à jour les statistiques globales
        collection_config.total_minted = collection_config.total_minted.checked_add(1).unwrap();
        global_state.total_community_boost = global_state
            .total_community_boost
            .checked_add(boost as u64)
            .ok_or(ErrorCode::MathOverflow)?;
        global_state.active_locks_count = global_state
            .active_locks_count
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
        global_state.total_value_locked = global_state
            .total_value_locked
            .checked_add(amount_locked)
            .ok_or(ErrorCode::MathOverflow)?;

        emit!(LevelNftMinted {
            user: ctx.accounts.user.key(),
            level,
            amount_locked,
            lock_duration,
            boost,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "cNFT de niveau {:?} enregistré pour {} - Boost: {} basis points ({}%)",
            level,
            ctx.accounts.user.key(),
            boost,
            boost / 100
        );
        Ok(())
    }

    /// Lock des tokens BACK avec transfert vers un PDA
    /// Cette instruction combine le mint du cNFT ET le transfert des tokens
    pub fn lock_tokens(ctx: Context<LockTokens>, amount: u64, lock_duration: i64) -> Result<()> {
        msg!(
            "🔒 LockTokens: amount={}, duration={}",
            amount,
            lock_duration
        );

        let collection_config = &mut ctx.accounts.collection_config;
        let global_state = &mut ctx.accounts.global_state;
        let user_nft = &mut ctx.accounts.user_nft;

        msg!("🔍 Accounts: collection.total_minted={}, global.boost={}, global.tv_locked={}, global.active_locks={}",
             collection_config.total_minted, global_state.total_community_boost, global_state.total_value_locked, global_state.active_locks_count);
        msg!(
            "🔍 User NFT: user={:?}, amount_locked={}, boost={}, is_active={}",
            user_nft.user,
            user_nft.amount_locked,
            user_nft.boost,
            user_nft.is_active
        );

        // Vérifier si c'est un nouveau NFT ou une mise à jour
        let is_new_nft = user_nft.user == Pubkey::default();
        msg!("🔍 is_new_nft: {}", is_new_nft);

        // Calculer le nouveau montant total (cumulatif)
        let new_total_amount = if is_new_nft {
            amount
        } else {
            msg!(
                "🔍 Calculating new_total_amount: {} + {}",
                user_nft.amount_locked,
                amount
            );
            user_nft
                .amount_locked
                .checked_add(amount)
                .ok_or(ErrorCode::MathOverflow)?
        };
        msg!("🔍 new_total_amount: {}", new_total_amount);

        // Calculer la durée maximale pour ce lock
        let max_duration = if is_new_nft {
            lock_duration
        } else {
            std::cmp::max(user_nft.lock_duration, lock_duration)
        };

        // Calculer le nouveau boost basé sur le montant total et la durée maximale
        let duration_days = (max_duration / 86400) as u64;
        msg!(
            "🔍 duration_days: {} (max_duration: {})",
            duration_days,
            max_duration
        );
        let new_level = LockLevel::from_lock_params(new_total_amount, duration_days);
        let new_boost = calculate_boost(new_total_amount, max_duration);
        msg!("🔍 new_level: {:?}, new_boost: {}", new_level, new_boost);

        // Si le NFT existe déjà et est actif, retirer l'ancien boost avant de mettre à jour
        if !is_new_nft && user_nft.is_active {
            msg!(
                "🔍 Removing old boost: global.boost {} - user.boost {}",
                global_state.total_community_boost,
                user_nft.boost as u64
            );
            // Utiliser saturating_sub pour éviter les overflows dus à des données incohérentes
            global_state.total_community_boost = global_state
                .total_community_boost
                .saturating_sub(user_nft.boost as u64);
            msg!("🔍 After sub boost: {}", global_state.total_community_boost);

            msg!(
                "🔍 Removing old tv_locked: global.tv_locked {} - user.amount_locked {}",
                global_state.total_value_locked,
                user_nft.amount_locked
            );
            // Utiliser saturating_sub pour éviter les overflows dus à des données incohérentes
            global_state.total_value_locked = global_state
                .total_value_locked
                .saturating_sub(user_nft.amount_locked);
            msg!(
                "🔍 After sub tv_locked: {}",
                global_state.total_value_locked
            );
        }

        // Enregistrer/Mettre à jour le NFT de l'utilisateur avec le montant cumulé
        user_nft.user = ctx.accounts.user.key();
        user_nft.level = new_level;
        user_nft.amount_locked = new_total_amount;
        // Pour les locks successifs, garder la durée maximale
        user_nft.lock_duration = if is_new_nft {
            lock_duration
        } else {
            std::cmp::max(user_nft.lock_duration, lock_duration)
        };
        user_nft.boost = new_boost;
        user_nft.mint_time = Clock::get()?.unix_timestamp;
        user_nft.is_active = true;
        if is_new_nft {
            user_nft.bump = ctx.bumps.user_nft;
        }

        // Mettre à jour les statistiques globales
        if is_new_nft {
            msg!(
                "🔍 New NFT: incrementing total_minted {} + 1",
                collection_config.total_minted
            );
            collection_config.total_minted = collection_config.total_minted.checked_add(1).unwrap();
            msg!(
                "🔍 New NFT: incrementing active_locks_count {} + 1",
                global_state.active_locks_count
            );
            global_state.active_locks_count = global_state
                .active_locks_count
                .checked_add(1)
                .ok_or(ErrorCode::MathOverflow)?;
            msg!(
                "🔍 After new NFT updates: total_minted={}, active_locks={}",
                collection_config.total_minted,
                global_state.active_locks_count
            );
        }

        // Utiliser saturating_add pour éviter les overflows sur les très grandes valeurs
        msg!(
            "🔍 Adding to global boost: {} + {}",
            global_state.total_community_boost,
            new_boost as u64
        );
        global_state.total_community_boost = global_state
            .total_community_boost
            .saturating_add(new_boost as u64);
        msg!("🔍 After add boost: {}", global_state.total_community_boost);

        msg!(
            "🔍 Adding to global tv_locked: {} + {}",
            global_state.total_value_locked,
            amount
        );
        global_state.total_value_locked = global_state.total_value_locked.saturating_add(amount);
        msg!(
            "🔍 After add tv_locked: {}",
            global_state.total_value_locked
        );

        // Transférer les tokens BACK vers le vault PDA
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
            mint: ctx.accounts.back_mint.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer_checked(cpi_ctx, amount, ctx.accounts.back_mint.decimals)?;

        emit!(TokensLocked {
            user: ctx.accounts.user.key(),
            amount: new_total_amount,
            level: new_level,
            boost: new_boost,
            unlock_time: Clock::get()?.unix_timestamp + lock_duration,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "🔒 +{} tokens BACK verrouillés - Total: {} - Niveau: {:?} - Boost: {}%",
            amount / 1_000_000_000,
            new_total_amount / 1_000_000_000,
            new_level,
            new_boost / 100
        );

        Ok(())
    }

    /// Unlock des tokens BACK et retour vers l'utilisateur
    /// Permet l'unlock anticipé avec une pénalité de 1,5% des tokens brûlés
    pub fn unlock_tokens(ctx: Context<UnlockTokens>) -> Result<()> {
        let user_nft = &mut ctx.accounts.user_nft;
        let global_state = &mut ctx.accounts.global_state;

        // Vérifier que c'est bien le propriétaire
        require!(
            ctx.accounts.user.key() == user_nft.user,
            ErrorCode::Unauthorized
        );

        // Vérifier que le NFT est actif
        require!(user_nft.is_active, ErrorCode::AlreadyUnlocked);

        let current_time = Clock::get()?.unix_timestamp;
        let unlock_time = user_nft.mint_time + user_nft.lock_duration;
        let is_early_unlock = current_time < unlock_time;

        // Calculer les montants
        let total_amount = user_nft.amount_locked;
        
        // 🔒 SÉCURITÉ: Vérifier le solde réel du vault pour éviter "insufficient funds"
        let actual_vault_balance = ctx.accounts.vault_token_account.amount;
        let safe_total_amount = total_amount.min(actual_vault_balance);
        
        // Si le vault n'a pas assez de tokens, ajuster le montant
        if safe_total_amount < total_amount {
            msg!(
                "⚠️ WARNING: Vault insufficient funds! NFT claims: {}, Vault has: {}, Using: {}",
                total_amount,
                actual_vault_balance,
                safe_total_amount
            );
        }
        
        let (user_amount, burn_amount) = if is_early_unlock {
            // Pénalité de 1,5% pour unlock anticipé
            let penalty_bps = 15; // 1.5% = 15 basis points
            let burn_amount = (safe_total_amount * penalty_bps) / 10_000;
            let user_amount = safe_total_amount - burn_amount;
            (user_amount, burn_amount)
        } else {
            // Pas de pénalité pour unlock normal
            (safe_total_amount, 0)
        };

        msg!(
            "🔓 Unlock tokens: total={}, user_amount={}, burn_amount={}, early={}",
            safe_total_amount,
            user_amount,
            burn_amount,
            is_early_unlock
        );

        // Décrémenter les stats globales (utiliser le montant réel transféré)
        global_state.total_community_boost = global_state
            .total_community_boost
            .saturating_sub(user_nft.boost as u64);
        global_state.active_locks_count = global_state.active_locks_count.saturating_sub(1);
        global_state.total_value_locked =
            global_state.total_value_locked.saturating_sub(safe_total_amount);

        // Transférer les tokens du vault
        let bump = ctx.bumps.vault_authority;
        let seeds: &[&[u8]] = &[b"vault_authority", &[bump]];
        let signer_seeds = &[seeds];

        // "Brûler" la pénalité (garder dans le vault - tokens non récupérables)
        if burn_amount > 0 {
            // Les tokens de pénalité restent dans le vault et ne sont pas transférés à l'utilisateur
            // Cela équivaut à un burn effectif puisque personne ne peut les récupérer
            msg!(
                "🔥 Burned {} tokens as early unlock penalty (kept in vault)",
                burn_amount / 1_000_000_000
            );
        }

        // Transférer le reste à l'utilisateur (montant total moins la pénalité)
        if user_amount > 0 {
            let user_accounts = TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
                mint: ctx.accounts.back_mint.to_account_info(),
            };

            let user_cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                user_accounts,
                signer_seeds,
            );

            transfer_checked(user_cpi_ctx, user_amount, ctx.accounts.back_mint.decimals)?;
        }

        // Désactiver le NFT et réinitialiser le montant verrouillé
        user_nft.is_active = false;
        user_nft.amount_locked = 0;

        // TODO: Add TokensUnlocked event
        // emit!(TokensUnlocked {
        //     user: ctx.accounts.user.key(),
        //     amount: user_amount,
        //     burn_amount,
        //     early_unlock: is_early_unlock,
        // });

        msg!(
            "🔓 {} tokens BACK déverrouillés - Brûlé: {} - Anticipé: {}",
            user_amount / 1_000_000_000,
            burn_amount / 1_000_000_000,
            is_early_unlock
        );

        Ok(())
    }

    /// Met à jour le statut d'un NFT (lors du unlock)
    pub fn update_nft_status(ctx: Context<UpdateNftStatus>, is_active: bool) -> Result<()> {
        let user_nft = &mut ctx.accounts.user_nft;
        let global_state = &mut ctx.accounts.global_state;

        // Vérifier que c'est bien le propriétaire
        require!(
            ctx.accounts.user.key() == user_nft.user,
            ErrorCode::Unauthorized
        );

        // Si on désactive (unlock), décrémenter le boost total
        if !is_active && user_nft.is_active {
            global_state.total_community_boost = global_state
                .total_community_boost
                .checked_sub(user_nft.boost as u64)
                .ok_or(ErrorCode::MathOverflow)?;
            global_state.active_locks_count = global_state
                .active_locks_count
                .checked_sub(1)
                .ok_or(ErrorCode::MathOverflow)?;
            global_state.total_value_locked = global_state
                .total_value_locked
                .checked_sub(user_nft.amount_locked)
                .ok_or(ErrorCode::MathOverflow)?;
        }
        // Si on réactive (re-lock), incrémenter le boost total
        else if is_active && !user_nft.is_active {
            global_state.total_community_boost = global_state
                .total_community_boost
                .checked_add(user_nft.boost as u64)
                .ok_or(ErrorCode::MathOverflow)?;
            global_state.active_locks_count = global_state
                .active_locks_count
                .checked_add(1)
                .ok_or(ErrorCode::MathOverflow)?;
            global_state.total_value_locked = global_state
                .total_value_locked
                .checked_add(user_nft.amount_locked)
                .ok_or(ErrorCode::MathOverflow)?;
        }

        user_nft.is_active = is_active;

        emit!(NftStatusUpdated {
            user: ctx.accounts.user.key(),
            level: user_nft.level,
            is_active,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "NFT {} {} - Boost communautaire total: {} BP",
            if is_active { "activé" } else { "désactivé" },
            ctx.accounts.user.key(),
            global_state.total_community_boost
        );

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum LockLevel {
    Bronze,
    Silver,
    Gold,
    Platinum,
    Diamond,
}

impl anchor_lang::Space for LockLevel {
    const INIT_SPACE: usize = 1; // 1 byte pour un enum avec 5 variants
}

impl LockLevel {
    /// Détermine le tier basé sur le montant et la durée
    pub fn from_lock_params(amount: u64, duration_days: u64) -> Self {
        let amount_tokens = amount / 1_000_000_000; // Convertir lamports en tokens

        // Diamond: 100,000+ BACK AND 365+ days
        if amount_tokens >= 100_000 && duration_days >= 365 {
            return LockLevel::Diamond;
        }
        // Platinum: 50,000+ BACK AND 180+ days
        else if amount_tokens >= 50_000 && duration_days >= 180 {
            return LockLevel::Platinum;
        }
        // Gold: 10,000+ BACK AND 90+ days
        else if amount_tokens >= 10_000 && duration_days >= 90 {
            return LockLevel::Gold;
        }
        // Silver: 1,000+ BACK AND 30+ days
        else if amount_tokens >= 1_000 && duration_days >= 30 {
            return LockLevel::Silver;
        }
        // Bronze: default (100+ BACK AND 7+ days recommended)
        else {
            return LockLevel::Bronze;
        }
    }
}

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

    /// CHECK: Tree config account
    pub tree_config: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintLevelNft<'info> {
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
        init,
        payer = user,
        space = 8 + UserNft::INIT_SPACE,
        seeds = [b"user_nft", user.key().as_ref()],
        bump
    )]
    pub user_nft: Account<'info, UserNft>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateNftStatus<'info> {
    #[account(
        mut,
        seeds = [b"user_nft", user.key().as_ref()],
        bump = user_nft.bump
    )]
    pub user_nft: Account<'info, UserNft>,

    #[account(
        mut,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    pub user: Signer<'info>,
}

/// Contexte pour verrouiller des tokens BACK
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
        space = 8 + UserNft::INIT_SPACE,
        seeds = [b"user_nft", user.key().as_ref()],
        bump
    )]
    pub user_nft: Account<'info, UserNft>,

    /// Token Account de l'utilisateur (source)
    #[account(mut)]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Vault PDA pour stocker les tokens verrouillés
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = back_mint,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Autorité du vault (PDA)
    /// CHECK: PDA utilisé comme autorité du vault
    #[account(
        seeds = [b"vault_authority"],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,

    /// Mint du token BACK (Token-2022)
    pub back_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Contexte pour déverrouiller des tokens BACK
#[derive(Accounts)]
pub struct UnlockTokens<'info> {
    #[account(
        mut,
        seeds = [b"user_nft", user.key().as_ref()],
        bump = user_nft.bump
    )]
    pub user_nft: Account<'info, UserNft>,

    #[account(
        mut,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    /// Token Account de l'utilisateur (destination)
    #[account(mut)]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Vault PDA qui contient les tokens verrouillés
    #[account(mut)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Autorité du vault (PDA)
    /// CHECK: PDA utilisé comme autorité du vault
    #[account(
        seeds = [b"vault_authority"],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,

    /// Mint du token BACK (Token-2022)
    pub back_mint: InterfaceAccount<'info, Mint>,

    pub user: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
}

#[account]
#[derive(InitSpace)]
pub struct CollectionConfig {
    pub authority: Pubkey,
    pub tree_config: Pubkey,
    pub total_minted: u64,
    pub bump: u8,
}

/// GlobalState pour tracker le boost total de la communauté
/// Utilisé pour calculer la distribution du buyback proportionnellement au boost de chaque utilisateur
#[account]
#[derive(InitSpace)]
pub struct GlobalState {
    pub authority: Pubkey,
    pub total_community_boost: u64, // Somme de tous les boosts actifs (en basis points)
    pub active_locks_count: u64,    // Nombre de locks actifs
    pub total_value_locked: u64,    // TVL total en lamports
}

#[account]
#[derive(InitSpace)]
pub struct UserNft {
    pub user: Pubkey,
    pub level: LockLevel,
    pub amount_locked: u64,
    pub lock_duration: i64,
    pub boost: u16, // Boost en basis points (10000 = 100%)
    pub mint_time: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[event]
pub struct LevelNftMinted {
    pub user: Pubkey,
    pub level: LockLevel,
    pub amount_locked: u64,
    pub lock_duration: i64,
    pub boost: u16, // Boost en basis points
    pub timestamp: i64,
}

#[event]
pub struct NftStatusUpdated {
    pub user: Pubkey,
    pub level: LockLevel,
    pub is_active: bool,
    pub timestamp: i64,
}

// Fonction utilitaire pour calculer le boost dynamique
// Formule AJUSTÉE: boost = min((amount_score + duration_score), 2000)
// amount_score: max 1000 basis points (10%)
// duration_score: max 1000 basis points (10%)
// Total: max 2000 basis points (20%) - RÉDUIT de 100% à 20%
//
// Niveaux de boost réalistes:
// - Bronze (1k BACK, 30j):    ~60 BP (0.6%)
// - Silver (1k BACK, 30j):    ~60 BP (0.6%)
// - Gold (10k BACK, 90j):     ~280 BP (2.8%)
// - Platinum (50k BACK, 180j): ~860 BP (8.6%)
// - Diamond (100k+ BACK, 365j): ~1730 BP (17.3%)
fn calculate_boost(amount: u64, duration: i64) -> u16 {
    let days = (duration / 86400) as u64; // Conversion en jours
    let amount_tokens = amount / 1_000_000_000; // Convertir lamports en tokens

    // Amount score: (amount / 10000) * 100, max 1000 basis points (10%)
    // Cela signifie: 100k tokens = 1000 BP max
    let amount_score = std::cmp::min((amount_tokens / 10_000) * 100, 1000);

    // Duration score: (days / 5) * 10, max 1000 basis points (10%)
    // Cela signifie: 365 jours = 730 BP ≈ 7.3%, 500 jours = 1000 BP (10%)
    let duration_score = std::cmp::min((days / 5) * 10, 1000);

    // Total boost: max 2000 basis points (20%)
    std::cmp::min(amount_score + duration_score, 2000) as u16
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_boost_small_lock() {
        // 1,000 BACK × 30 days
        // Amount: (1000 / 10000) * 100 = 0 (division entière) → 0 BP
        // Duration: (30 / 5) * 10 = 60 BP (0.6%)
        // Total: 60 BP ≈ 0.6%
        let amount = 1_000 * 1_000_000_000;
        let duration = 30 * 86400;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 60);
    }

    #[test]
    fn test_calculate_boost_medium_lock() {
        // 10,000 BACK × 90 days (Gold tier)
        // Amount: (10000 / 10000) * 100 = 100 BP (1%)
        // Duration: (90 / 5) * 10 = 180 BP (1.8%)
        // Total: 280 BP ≈ 2.8%
        let amount = 10_000 * 1_000_000_000;
        let duration = 90 * 86400;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 280);
    }

    #[test]
    fn test_calculate_boost_whale_lock() {
        // 100,000 BACK × 365 days (Diamond tier)
        // Amount: (100000 / 10000) * 100 = 1000 BP (10%) - maxed
        // Duration: (365 / 5) * 10 = 730 BP (7.3%)
        // Total: 1000 + 730 = 1730 BP ≈ 17.3%
        let amount = 100_000 * 1_000_000_000;
        let duration = 365 * 86400;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 1730);
    }

    #[test]
    fn test_calculate_boost_maximum() {
        // 200,000 BACK × 730 days
        // Amount: (200000 / 10000) * 100 = 2000 BP (capped at 1000)
        // Duration: (730 / 5) * 10 = 1460 BP (capped at 1000)
        // Total: 1000 + 1000 = 2000 BP (20% - max possible)
        let amount = 200_000 * 1_000_000_000;
        let duration = 730 * 86400;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 2000); // Capped at maximum 20%
    }

    #[test]
    fn test_lock_level_bronze() {
        let level = LockLevel::from_lock_params(100 * 1_000_000_000, 7);
        assert_eq!(level, LockLevel::Bronze);
    }

    #[test]
    fn test_lock_level_silver() {
        let level = LockLevel::from_lock_params(1_000 * 1_000_000_000, 30);
        assert_eq!(level, LockLevel::Silver);
    }

    #[test]
    fn test_lock_level_gold() {
        let level = LockLevel::from_lock_params(10_000 * 1_000_000_000, 90);
        assert_eq!(level, LockLevel::Gold);
    }

    #[test]
    fn test_lock_level_platinum() {
        let level = LockLevel::from_lock_params(50_000 * 1_000_000_000, 180);
        assert_eq!(level, LockLevel::Platinum);
    }

    #[test]
    fn test_lock_level_diamond() {
        let level = LockLevel::from_lock_params(100_000 * 1_000_000_000, 365);
        assert_eq!(level, LockLevel::Diamond);
    }
}

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
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Boost insuffisant pour ce niveau")]
    InsufficientBoost,
    #[msg("Non autorisé")]
    Unauthorized,
    #[msg("Dépassement arithmétique")]
    MathOverflow,
    #[msg("Période de verrouillage non expirée")]
    LockNotExpired,
    #[msg("Déjà déverrouillé")]
    AlreadyUnlocked,
}
