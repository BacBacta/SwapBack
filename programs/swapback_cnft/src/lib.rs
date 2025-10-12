use anchor_lang::prelude::*;

declare_id!("HCsNTpvkUGV7XMAw5VsBSR4Kxvt5x59iFDAeucvY4cre");

#[program]
pub mod swapback_cnft {
    use super::*;

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
        level: LockLevel,
        amount_locked: u64,
        lock_duration: i64,
    ) -> Result<()> {
        let collection_config = &mut ctx.accounts.collection_config;
        let user_nft = &mut ctx.accounts.user_nft;

        // Vérifier que l'utilisateur mérite ce niveau
        let required_boost = match level {
            LockLevel::Bronze => 10,
            LockLevel::Silver => 30,
            LockLevel::Gold => 50,
        };

        let actual_boost = calculate_boost(amount_locked, lock_duration);
        require!(actual_boost >= required_boost, ErrorCode::InsufficientBoost);

        // Enregistrer le NFT de l'utilisateur (sans mint réel pour l'instant)
        user_nft.user = ctx.accounts.user.key();
        user_nft.level = level;
        user_nft.amount_locked = amount_locked;
        user_nft.lock_duration = lock_duration;
        user_nft.mint_time = Clock::get()?.unix_timestamp;
        user_nft.is_active = true;

        // Mettre à jour les statistiques
        collection_config.total_minted = collection_config.total_minted.checked_add(1).unwrap();

        emit!(LevelNftMinted {
            user: ctx.accounts.user.key(),
            level,
            amount_locked,
            lock_duration,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("cNFT de niveau {:?} enregistré pour {}", level, ctx.accounts.user.key());
        Ok(())
    }

    /// Met à jour le statut d'un NFT (lors du unlock)
    pub fn update_nft_status(ctx: Context<UpdateNftStatus>, is_active: bool) -> Result<()> {
        let user_nft = &mut ctx.accounts.user_nft;

        // Vérifier que c'est bien le propriétaire
        require!(
            ctx.accounts.user.key() == user_nft.user,
            ErrorCode::Unauthorized
        );

        user_nft.is_active = is_active;

        emit!(NftStatusUpdated {
            user: ctx.accounts.user.key(),
            level: user_nft.level,
            is_active,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum LockLevel {
    Bronze,
    Silver,
    Gold,
}

impl anchor_lang::Space for LockLevel {
    const INIT_SPACE: usize = 1; // 1 byte pour un enum avec 3 variants
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

#[account]
#[derive(InitSpace)]
pub struct UserNft {
    pub user: Pubkey,
    pub level: LockLevel,
    pub amount_locked: u64,
    pub lock_duration: i64,
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
    pub timestamp: i64,
}

#[event]
pub struct NftStatusUpdated {
    pub user: Pubkey,
    pub level: LockLevel,
    pub is_active: bool,
    pub timestamp: i64,
}

// Fonction utilitaire pour calculer le boost (dupliquée du router pour indépendance)
fn calculate_boost(amount: u64, duration: i64) -> u8 {
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

#[error_code]
pub enum ErrorCode {
    #[msg("Boost insuffisant pour ce niveau")]
    InsufficientBoost,
    #[msg("Non autorisé")]
    Unauthorized,
}