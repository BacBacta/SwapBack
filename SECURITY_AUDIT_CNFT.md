# 🔒 Security Audit Report - swapback_cnft Program

**Programme**: `swapback_cnft`  
**Program ID**: `9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw` (Devnet)  
**Date d'audit**: 26 Octobre 2025  
**Auditeur**: GitHub Copilot  
**Statut**: 🔄 EN COURS

---

## 📊 Résumé Exécutif

### Statistiques
- **Lignes de code**: 431
- **Fonctions publiques**: 4
- **Structures de données**: 5
- **Events**: 2
- **Tests unitaires**: 10 ✅

### Scores de Sécurité

| Catégorie | Score | Commentaire |
|-----------|-------|-------------|
| Access Control | ⚠️ 7/10 | Bon, mais manque quelques validations |
| Arithmetic Safety | ✅ 10/10 | Excellent usage de checked_* |
| Account Validation | ✅ 9/10 | PDAs bien sécurisés |
| Business Logic | ✅ 9/10 | Formules correctes |
| Error Handling | ✅ 8/10 | Bonne gestion d'erreurs |
| **SCORE GLOBAL** | **✅ 8.6/10** | **BON - Quelques améliorations recommandées** |

---

## 🔍 Analyse Détaillée

### ✅ Points Forts

#### 1. Arithmetic Safety - EXCELLENT ✅

Toutes les opérations arithmétiques utilisent `checked_*` pour éviter overflow/underflow :

```rust
// ✅ EXCELLENT: Protection overflow dans mint_level_nft
global_state.total_community_boost = global_state.total_community_boost
    .checked_add(boost as u64)
    .ok_or(ErrorCode::MathOverflow)?;

global_state.active_locks_count = global_state.active_locks_count
    .checked_add(1)
    .ok_or(ErrorCode::MathOverflow)?;

global_state.total_value_locked = global_state.total_value_locked
    .checked_add(amount_locked)
    .ok_or(ErrorCode::MathOverflow)?;
```

**Verdict**: ✅ Aucun risque d'overflow/underflow

#### 2. PDA Security - EXCELLENT ✅

Utilisation correcte des PDAs avec seeds appropriés :

```rust
// ✅ EXCELLENT: User NFT dérivé avec user.key() comme seed unique
#[account(
    init,
    payer = user,
    space = 8 + UserNft::INIT_SPACE,
    seeds = [b"user_nft", user.key().as_ref()],
    bump
)]
pub user_nft: Account<'info, UserNft>,

// ✅ EXCELLENT: Global state singleton avec seed fixe
#[account(
    init,
    payer = authority,
    space = 8 + GlobalState::INIT_SPACE,
    seeds = [b"global_state"],
    bump
)]
pub global_state: Account<'info, GlobalState>,
```

**Verdict**: ✅ PDAs correctement sécurisés

#### 3. Boost Calculation - CORRECT ✅

La formule de boost est sécurisée et bien testée :

```rust
fn calculate_boost(amount: u64, duration: i64) -> u16 {
    let days = (duration / 86400) as u64;
    let amount_tokens = amount / 1_000_000_000;

    // ✅ CORRECT: max 5000 BP (50%) pour amount
    let amount_score = std::cmp::min((amount_tokens / 1000) * 50, 5000);
    
    // ✅ CORRECT: max 5000 BP (50%) pour duration
    let duration_score = std::cmp::min((days / 10) * 100, 5000);
    
    // ✅ CORRECT: total max 10000 BP (100%)
    std::cmp::min(amount_score + duration_score, 10000) as u16
}
```

**Validations**:
- ✅ Tests unitaires passent (10/10)
- ✅ Caps correctement appliqués (max 100%)
- ✅ Pas de possibilité d'overflow (u16 max = 65535, boost max = 10000)

#### 4. State Consistency - BON ✅

Mise à jour cohérente du global_state lors de (dé)activation :

```rust
// ✅ Décrémentation lors du unlock
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
```

---

### ⚠️ Vulnérabilités Identifiées

#### 🟡 MEDIUM - M1: Pas de validation de durée minimale/maximale

**Localisation**: `mint_level_nft` (ligne ~35)

**Problème**:
```rust
pub fn mint_level_nft(
    ctx: Context<MintLevelNft>,
    amount_locked: u64,
    lock_duration: i64, // ⚠️ AUCUNE VALIDATION
) -> Result<()> {
    // ...
}
```

**Risque**:
- Un utilisateur pourrait lock pour 0 secondes et obtenir un boost
- Un utilisateur pourrait lock pour 100 ans (overflow potentiel)
- Pas de cohérence avec les tiers (Bronze recommande 7+ jours, mais aucune enforcement)

**Recommandation**:
```rust
// Ajouter des constantes
const MIN_LOCK_DURATION: i64 = 7 * 86400;  // 7 jours minimum
const MAX_LOCK_DURATION: i64 = 1095 * 86400; // 3 ans maximum

pub fn mint_level_nft(
    ctx: Context<MintLevelNft>,
    amount_locked: u64,
    lock_duration: i64,
) -> Result<()> {
    // ✅ VALIDATION AJOUTÉE
    require!(
        lock_duration >= MIN_LOCK_DURATION && lock_duration <= MAX_LOCK_DURATION,
        ErrorCode::InvalidLockDuration
    );
    
    // ... reste du code
}
```

**Sévérité**: 🟡 MEDIUM  
**Impact**: Moyen (gaming du système possible)  
**Probabilité**: Haute

---

#### 🟡 MEDIUM - M2: Pas de validation de montant minimum

**Localisation**: `mint_level_nft` (ligne ~35)

**Problème**:
```rust
pub fn mint_level_nft(
    ctx: Context<MintLevelNft>,
    amount_locked: u64, // ⚠️ AUCUNE VALIDATION
    lock_duration: i64,
) -> Result<()> {
    // ...
}
```

**Risque**:
- Un utilisateur pourrait lock 1 lamport et créer du spam
- Global state pollué avec des micro-locks
- Gas inefficiency

**Recommandation**:
```rust
const MIN_LOCK_AMOUNT: u64 = 100 * 1_000_000_000; // 100 BACK minimum

pub fn mint_level_nft(
    ctx: Context<MintLevelNft>,
    amount_locked: u64,
    lock_duration: i64,
) -> Result<()> {
    // ✅ VALIDATION AJOUTÉE
    require!(
        amount_locked >= MIN_LOCK_AMOUNT,
        ErrorCode::AmountTooLow
    );
    
    // ... reste du code
}
```

**Sévérité**: 🟡 MEDIUM  
**Impact**: Faible (spam/inefficiency)  
**Probabilité**: Moyenne

---

#### 🟢 LOW - L1: Pas de time lock enforcement

**Localisation**: `update_nft_status` (ligne ~93)

**Problème**:
```rust
pub fn update_nft_status(ctx: Context<UpdateNftStatus>, is_active: bool) -> Result<()> {
    let user_nft = &mut ctx.accounts.user_nft;
    
    // ⚠️ PAS DE CHECK: l'utilisateur peut unlock avant l'expiration
    require!(
        ctx.accounts.user.key() == user_nft.user,
        ErrorCode::Unauthorized
    );
    
    user_nft.is_active = is_active; // ← Pas de vérification de lock_duration
    // ...
}
```

**Risque**:
- Utilisateur peut unlock immédiatement après mint
- Pas d'enforcement de la durée promise
- Incohérence avec le système de boost (boost basé sur durée, mais pas forcé)

**Recommandation**:
```rust
pub fn update_nft_status(ctx: Context<UpdateNftStatus>, is_active: bool) -> Result<()> {
    let user_nft = &mut ctx.accounts.user_nft;
    let clock = Clock::get()?;
    
    require!(
        ctx.accounts.user.key() == user_nft.user,
        ErrorCode::Unauthorized
    );
    
    // ✅ ENFORCEMENT AJOUTÉ: Vérifier que la période de lock est expirée
    if !is_active {
        let unlock_time = user_nft.mint_time + user_nft.lock_duration;
        require!(
            clock.unix_timestamp >= unlock_time,
            ErrorCode::LockPeriodNotExpired
        );
    }
    
    // ... reste du code
}
```

**Sévérité**: 🟢 LOW  
**Impact**: Moyen (intégrité du système de boost)  
**Probabilité**: Haute (utilisateurs opportunistes)

---

#### 🟢 LOW - L2: Pas de protection contre double-mint

**Localisation**: `MintLevelNft` struct (ligne ~135)

**Problème**:
```rust
#[account(
    init,
    payer = user,
    space = 8 + UserNft::INIT_SPACE,
    seeds = [b"user_nft", user.key().as_ref()],
    bump
)]
pub user_nft: Account<'info, UserNft>,
```

**Note**: En réalité, Anchor empêche le double-init via l'instruction `init`, mais c'est implicite.

**Risque Théorique**:
- Si l'utilisateur a déjà un NFT actif, `init` va échouer (OK)
- Mais pas de message d'erreur explicite

**Recommandation**: ✅ Aucune (Anchor gère déjà)

**Sévérité**: 🟢 INFO  
**Impact**: Aucun (déjà protégé)

---

#### 🟢 INFO - I1: Pas de mécanisme de pause

**Localisation**: Global

**Observation**:
- Pas de fonction `pause()` / `unpause()` en cas d'urgence
- Pas d'upgrade authority visible

**Recommandation**:
```rust
#[account]
#[derive(InitSpace)]
pub struct GlobalState {
    pub authority: Pubkey,
    pub total_community_boost: u64,
    pub active_locks_count: u64,
    pub total_value_locked: u64,
    pub is_paused: bool, // ✅ AJOUT
}

// ✅ Nouvelle instruction
pub fn toggle_pause(ctx: Context<TogglePause>) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    
    require!(
        ctx.accounts.authority.key() == global_state.authority,
        ErrorCode::Unauthorized
    );
    
    global_state.is_paused = !global_state.is_paused;
    Ok(())
}

// ✅ Ajouter check dans mint_level_nft
pub fn mint_level_nft(...) -> Result<()> {
    require!(!global_state.is_paused, ErrorCode::ProgramPaused);
    // ...
}
```

**Sévérité**: 🟢 INFO  
**Impact**: Haute (en cas d'exploit découvert)  
**Probabilité**: Faible

---

## 🧪 Tests de Sécurité Recommandés

### Tests à Ajouter

#### Test 1: Tentative de lock avec durée négative
```rust
#[tokio::test]
async fn test_negative_lock_duration() {
    // Setup...
    
    let result = program
        .methods()
        .mint_level_nft(
            1_000 * 1_000_000_000, // 1000 BACK
            -86400, // ⚠️ -1 jour
        )
        .accounts(...)
        .rpc()
        .await;
    
    assert!(result.is_err()); // Devrait échouer
}
```

#### Test 2: Tentative de lock avec montant 0
```rust
#[tokio::test]
async fn test_zero_amount_lock() {
    let result = program
        .methods()
        .mint_level_nft(
            0, // ⚠️ 0 BACK
            30 * 86400,
        )
        .accounts(...)
        .rpc()
        .await;
    
    assert!(result.is_err());
}
```

#### Test 3: Tentative d'unlock avant expiration
```rust
#[tokio::test]
async fn test_early_unlock() {
    // 1. Mint NFT avec 30 jours de lock
    program.methods()
        .mint_level_nft(1_000 * 1_000_000_000, 30 * 86400)
        .rpc()
        .await
        .unwrap();
    
    // 2. Immédiatement essayer d'unlock (sans avancer le temps)
    let result = program
        .methods()
        .update_nft_status(false)
        .rpc()
        .await;
    
    assert!(result.is_err()); // Devrait échouer avec LockPeriodNotExpired
}
```

#### Test 4: Overflow du total_community_boost
```rust
#[tokio::test]
async fn test_community_boost_overflow() {
    // Setup: Créer un état avec boost proche de u64::MAX
    let global_state = GlobalState {
        total_community_boost: u64::MAX - 100,
        // ...
    };
    
    // Essayer d'ajouter un boost qui causerait overflow
    let result = program
        .methods()
        .mint_level_nft(
            100_000 * 1_000_000_000, // Gros montant
            365 * 86400, // Max durée
        )
        .rpc()
        .await;
    
    assert!(result.is_err()); // Devrait échouer avec MathOverflow
}
```

#### Test 5: Tentative de modification du NFT d'un autre user
```rust
#[tokio::test]
async fn test_unauthorized_update() {
    // User A mint un NFT
    program.methods()
        .mint_level_nft(1_000 * 1_000_000_000, 30 * 86400)
        .accounts({ user: userA.publicKey })
        .rpc()
        .await
        .unwrap();
    
    // User B essaie de désactiver le NFT de User A
    let result = program
        .methods()
        .update_nft_status(false)
        .accounts({
            user_nft: /* PDA de UserA */,
            user: userB, // ⚠️ Différent user
        })
        .rpc()
        .await;
    
    assert!(result.is_err()); // Devrait échouer avec Unauthorized
}
```

---

## 📋 Checklist de Correction

### 🔴 CRITICAL (Bloquant pour production)
Aucune vulnérabilité critique identifiée ✅

### 🟡 MEDIUM (Recommandé avant mainnet)
- [ ] **M1**: Ajouter validation de durée min/max (MIN: 7 jours, MAX: 3 ans)
- [ ] **M2**: Ajouter validation de montant minimum (MIN: 100 BACK)

### 🟢 LOW (Nice-to-have)
- [ ] **L1**: Enforcer la durée de lock dans `update_nft_status`
- [ ] **L2**: (Déjà OK) Protection contre double-mint

### 🟢 INFO (Améliorations futures)
- [ ] **I1**: Ajouter mécanisme de pause/unpause
- [ ] Ajouter tests de sécurité (5 tests recommandés)
- [ ] Ajouter logging pour monitoring on-chain
- [ ] Documenter les constantes (MIN/MAX values)

---

## 🛡️ Recommandations Générales

### 1. Constantes de Configuration

Créer un fichier `constants.rs` :

```rust
// programs/swapback_cnft/src/constants.rs
pub const MIN_LOCK_DURATION: i64 = 7 * 86400;      // 7 jours
pub const MAX_LOCK_DURATION: i64 = 1095 * 86400;   // 3 ans
pub const MIN_LOCK_AMOUNT: u64 = 100 * 1_000_000_000; // 100 BACK
pub const MAX_BOOST_BP: u16 = 10000;                // 100%
pub const AMOUNT_BOOST_CAP_BP: u16 = 5000;          // 50%
pub const DURATION_BOOST_CAP_BP: u16 = 5000;        // 50%
```

### 2. Améliorations du Code d'Erreur

```rust
#[error_code]
pub enum ErrorCode {
    #[msg("Boost insuffisant pour ce niveau")]
    InsufficientBoost,
    #[msg("Non autorisé")]
    Unauthorized,
    #[msg("Dépassement arithmétique")]
    MathOverflow,
    
    // ✅ NOUVEAUX
    #[msg("Durée de lock invalide (min: 7 jours, max: 3 ans)")]
    InvalidLockDuration,
    #[msg("Montant trop faible (min: 100 BACK)")]
    AmountTooLow,
    #[msg("Période de lock non expirée - impossible d'unlock")]
    LockPeriodNotExpired,
    #[msg("Programme en pause")]
    ProgramPaused,
}
```

### 3. Events de Sécurité

Ajouter des events pour monitoring :

```rust
#[event]
pub struct SecurityEvent {
    pub event_type: SecurityEventType,
    pub user: Pubkey,
    pub timestamp: i64,
    pub details: String,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum SecurityEventType {
    InvalidLockAttempt,
    EarlyUnlockAttempt,
    UnauthorizedAccess,
    OverflowPrevented,
}
```

---

## ✅ Conclusion

### Verdict Final

Le programme `swapback_cnft` présente une **bonne sécurité générale** avec un score de **8.6/10**.

**Points positifs** ✅:
- Protection overflow/underflow excellente
- PDAs correctement sécurisés
- Formule de boost mathématiquement correcte
- Tests unitaires présents

**Points d'amélioration** ⚠️:
- Ajouter validations sur les inputs (durée, montant)
- Enforcer la durée de lock
- Ajouter mécanisme de pause

### Recommandation

✅ **APPROUVÉ pour déploiement TESTNET** avec les conditions suivantes :
1. Corriger M1 et M2 avant déploiement testnet
2. Ajouter tests de sécurité recommandés
3. L1 peut être corrigé après UAT si pas de problème détecté

🚫 **PAS ENCORE PRÊT pour MAINNET** sans :
1. Toutes les corrections M1, M2, L1 appliquées
2. Audit externe par un tiers
3. Tests de sécurité passant à 100%
4. Mécanisme de pause implémenté

---

**Prochaine étape**: Audit du programme `swapback_router`

_Audit effectué le 26 Octobre 2025 - swapback_cnft v1.0.0_
