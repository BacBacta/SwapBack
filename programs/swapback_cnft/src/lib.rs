use anchor_lang::prelude::*;

// Program ID generated locally for deployment
declare_id!("CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH");

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

        // Mettre à jour les statistiques globales
        collection_config.total_minted = collection_config.total_minted.checked_add(1).unwrap();
        global_state.total_community_boost = global_state.total_community_boost
            .checked_add(boost as u64)
            .ok_or(ErrorCode::MathOverflow)?;
        global_state.active_locks_count = global_state.active_locks_count
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
        global_state.total_value_locked = global_state.total_value_locked
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
            global_state.total_community_boost = global_state.total_community_boost
                .checked_sub(user_nft.boost as u64)
                .ok_or(ErrorCode::MathOverflow)?;
            global_state.active_locks_count = global_state.active_locks_count
                .checked_sub(1)
                .ok_or(ErrorCode::MathOverflow)?;
            global_state.total_value_locked = global_state.total_value_locked
                .checked_sub(user_nft.amount_locked)
                .ok_or(ErrorCode::MathOverflow)?;
        }
        // Si on réactive (re-lock), incrémenter le boost total
        else if is_active && !user_nft.is_active {
            global_state.total_community_boost = global_state.total_community_boost
                .checked_add(user_nft.boost as u64)
                .ok_or(ErrorCode::MathOverflow)?;
            global_state.active_locks_count = global_state.active_locks_count
                .checked_add(1)
                .ok_or(ErrorCode::MathOverflow)?;
            global_state.total_value_locked = global_state.total_value_locked
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
    pub total_community_boost: u64,  // Somme de tous les boosts actifs (en basis points)
    pub active_locks_count: u64,     // Nombre de locks actifs
    pub total_value_locked: u64,     // TVL total en lamports
}

#[account]
#[derive(InitSpace)]
pub struct UserNft {
    pub user: Pubkey,
    pub level: LockLevel,
    pub amount_locked: u64,
    pub lock_duration: i64,
    pub boost: u16,           // Boost en basis points (10000 = 100%)
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
    pub boost: u16,           // Boost en basis points
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
// Formule: boost = min((amount_score + duration_score), 10000)
// amount_score: max 5000 basis points (50%)
// duration_score: max 5000 basis points (50%)
// Total: max 10000 basis points (100%)
fn calculate_boost(amount: u64, duration: i64) -> u16 {
    let days = (duration / 86400) as u64; // Conversion en jours
    let amount_tokens = amount / 1_000_000_000; // Convertir lamports en tokens

    // Amount score: (amount / 1000) * 50, max 5000 basis points (50%)
    let amount_score = std::cmp::min((amount_tokens / 1000) * 50, 5000);
    
    // Duration score: (days / 10) * 100, max 5000 basis points (50%)
    let duration_score = std::cmp::min((days / 10) * 100, 5000);
    
    // Total boost: max 10000 basis points (100%)
    std::cmp::min(amount_score + duration_score, 10000) as u16
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_boost_small_lock() {
        // 1,000 BACK × 30 days = 3.5% boost = 350 basis points
        let amount = 1_000 * 1_000_000_000;
        let duration = 30 * 86400;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 350);
    }

    #[test]
    fn test_calculate_boost_medium_lock() {
        // 10,000 BACK × 180 days = 23% boost = 2300 basis points
        let amount = 10_000 * 1_000_000_000;
        let duration = 180 * 86400;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 2300);
    }

    #[test]
    fn test_calculate_boost_whale_lock() {
        // 100,000 BACK × 365 days
        // Amount score: (100000 / 1000) * 50 = 5000 BP (max)
        // Duration score: (365 / 10) * 100 = 3650 BP (36.5 troncated = 36)
        // Total: 5000 + 3600 = 8600 BP (86%)
        let amount = 100_000 * 1_000_000_000;
        let duration = 365 * 86400;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 8600); // Arrondi à cause de la division entière
    }

    #[test]
    fn test_calculate_boost_maximum() {
        // 100,000 BACK × 730 days = 100% boost (capped at 10000 BP)
        let amount = 100_000 * 1_000_000_000;
        let duration = 730 * 86400;
        let boost = calculate_boost(amount, duration);
        assert_eq!(boost, 10000);
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

#[error_code]
pub enum ErrorCode {
    #[msg("Boost insuffisant pour ce niveau")]
    InsufficientBoost,
    #[msg("Non autorisé")]
    Unauthorized,
    #[msg("Dépassement arithmétique")]
    MathOverflow,
}
