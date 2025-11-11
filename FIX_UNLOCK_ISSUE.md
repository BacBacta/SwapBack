# 🔧 FIX: Unlock Insufficient Funds Error

## 🎯 Problème Identifié

**Erreur:** `Program log: Error: insufficient funds`

**Cause racine:** Le `user_nft` PDA indique que vous avez **5,625,000 BACK** lockés, mais le vault ne contient que **815,100 BACK**.

### Détails techniques:
```
User NFT amount_locked: 5,625,000,000,000,000 (5.6M BACK)
Vault actual balance:     815,100,000,000,000 (815k BACK)
Déficit:                5,809,900,000,000,000 (4.8M BACK manquants!)
```

## 🔍 Cause

Cela peut arriver si:
1. Le lock initial n'a transféré qu'une partie des tokens
2. Il y a eu plusieurs opérations de lock/unlock qui ont désynchronisé les données
3. Les tests ont laissé des données incohérentes

## ✅ Solutions

### Option 1: Unlock partiel (Recommandé)

Modifiez le programme on-chain pour permettre l'unlock du **minimum** entre:
- Ce que le `user_nft` dit être locké
- Ce qui est réellement dans le vault

```rust
// Dans unlock_tokens.rs
let actual_vault_balance = ctx.accounts.vault_token_account.amount;
let amount_to_unlock = user_nft.amount_locked.min(actual_vault_balance);
```

### Option 2: Reset du user_nft

Créer une instruction admin pour réinitialiser le `user_nft` avec le montant correct:

```rust
#[derive(Accounts)]
pub struct AdminResetLock<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"user_nft", user.key().as_ref()],
        bump
    )]
    pub user_nft: Account<'info, UserNft>,
    
    /// CHECK: User being reset
    pub user: AccountInfo<'info>,
}

pub fn admin_reset_lock(ctx: Context<AdminResetLock>, correct_amount: u64) -> Result<()> {
    require!(ctx.accounts.admin.key() == ADMIN_PUBKEY, ErrorCode::Unauthorized);
    ctx.accounts.user_nft.amount_locked = correct_amount;
    Ok(())
}
```

### Option 3: Re-lock avec le bon montant (Solution temporaire)

Si vous n'avez pas d'admin instruction:

1. **Attendre que la période de lock expire** (pas de pénalité)
2. Le programme essaiera d'unlock 5.6M mais échouera
3. **Unlock manuellement en plusieurs fois** si le programme le permet

### Option 4: Simulation d'unlock partiel (Frontend workaround)

Modifier le frontend pour détecter le problème et ajuster:

```typescript
// Dans createUnlockTokensTransaction
const vaultBalance = await connection.getTokenAccountBalance(vaultTokenAccount);
const actualVaultAmount = BigInt(vaultBalance.value.amount);
const nftAmount = BigInt(lockData.amount);

if (actualVaultAmount < nftAmount) {
  console.warn('⚠️  Vault has less than NFT claims. Using vault balance.');
  // Mais le programme on-chain doit aussi le gérer!
}
```

## 🚀 Action Immédiate Recommandée

**Le plus simple:** Modifier le programme Rust pour unlock le minimum:

```bash
# 1. Modifier programs/swapback_cnft/src/instructions/unlock_tokens.rs
# 2. Rebuild
anchor build

# 3. Redeploy (si vous avez l'upgrade authority)
anchor upgrade target/deploy/swapback_cnft.so --program-id 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq

# 4. Tester
```

## 📊 Vérification actuelle

Exécutez ce script pour voir l'état actuel:
```bash
node check-vault-balance.js
```

Résultat actuel:
```
Vault Balance: 815,100 BACK
NFT Claims:    5,625,000 BACK  ❌ INCOHÉRENT
```

## 🎯 Objectif

Après le fix:
```
✅ User peut unlock 815,100 BACK (ce qui est réellement dans le vault)
✅ Le NFT sera mis à jour avec le solde correct (0 après unlock)
✅ Plus d'erreur "insufficient funds"
```
