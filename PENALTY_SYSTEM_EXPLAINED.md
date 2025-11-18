# 🔥 Système de Pénalités - Explication Complète

## ✅ MISE À JOUR : Les tokens de pénalité sont maintenant BRÛLÉS

### Ce qui se passe maintenant

Lorsqu'un utilisateur déverrouille ses tokens BACK avant la fin de la période de lock, une **pénalité de 2%** est appliquée et **les tokens sont BRÛLÉS** :

```rust
// Calcul de la pénalité (2%)
let penalty = amount * 200 / 10_000  // 200 bps = 2%
let user_receives = amount - penalty

// Les tokens de pénalité sont BRÛLÉS, pas transférés
burn_checked_dynamic(..., penalty_amount, ...)?;
```

### Destination des tokens de pénalité

**Les tokens de pénalité sont BRÛLÉS** ⚡️ définitivement retirés de la circulation.

```rust
// Code dans unlock_tokens (lib.rs ligne 310-340)
if penalty_amount > 0 {
    // BURN des tokens de pénalité 🔥
    let burn_accounts = Burn {
        mint: ctx.accounts.back_mint.to_account_info(),
        from: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };

    burn_checked_dynamic(
        &ctx.accounts.token_program,
        &ctx.accounts.token_2022_program,
        &ctx.accounts.back_mint,
        burn_accounts,
        penalty_amount,
        Some(signer_seeds),
    )?;

    // Mise à jour du compteur global
    global_state.total_penalties_collected += penalty_amount;
    
    msg!("🔥 {} BACK brûlés (pénalité 2%)", penalty_amount / BACK_DECIMALS);
}
```

### Pourquoi cette approche ?

Les pénalités sont **définitivement retirées de la circulation** pour :

1. **Réduire l'offre** : Chaque unlock anticipé diminue le supply total de BACK
2. **Valorisation** : Moins de tokens en circulation = pression déflationniste
3. **Transparence** : On-chain et vérifiable par tous
4. **Simplicité** : Pas besoin de gérer un wallet intermédiaire

### Affichage dans l'interface

#### 1. UnlockInterface (lors du unlock)

L'utilisateur voit :
```
Locked Amount: 1,000 BACK
Penalty (2%): -20 BACK
You will receive: 980 BACK
```

Le calcul est correct : `amount * 0.98`

#### 2. Dashboard → Analytics → Protocol Statistics

Nouvelle métrique ajoutée :
```
🔥 Penalties Burned: XXX BACK
```

Cela montre le total cumulé de toutes les pénalités **brûlées** depuis le début.

### Structure des données

#### Rust (programs/swapback_cnft/src/lib.rs)

```rust
pub struct GlobalState {
    // ... autres champs
    pub total_penalties_collected: u64,  // Nouveau champ
}
```

#### TypeScript (app/src/hooks/useGlobalState.ts)

```typescript
interface GlobalStateData {
    // ... autres champs
    totalPenaltiesCollected: number;  // Converti en unités UI (/ 1_000_000)
}
```

### Flux complet du unlock anticipé

```
┌─────────────────┐
│ User unlocks    │
│ 1000 BACK early │
└────────┬────────┘
         │
         ├─► 980 BACK → User wallet
         │
         └─► 20 BACK → 🔥 BURNED (supply réduit de 20 BACK)
                 │
                 └─► global_state.total_penalties_collected += 20
```

### Vérification on-chain

Pour vérifier que les pénalités sont bien brûlées :

```bash
# Vérifier le supply total du token BACK (doit diminuer)
spl-token supply <BACK_MINT_ADDRESS>

# Voir les événements de burn dans les transactions
solana transaction-history <VAULT_AUTHORITY> | grep "burn"
```

### Avantages du burn direct

1. **Déflationniste** : Réduit l'offre totale automatiquement
2. **Transparent** : Visible on-chain via les events
3. **Simple** : Pas de wallet intermédiaire à gérer
4. **Sécurisé** : Impossible de récupérer les tokens brûlés

### Comparaison avec l'ancien système

| Aspect | Ancien (Transfer) | Nouveau (Burn) |
|--------|------------------|----------------|
| Destination | Buyback wallet | 🔥 Brûlé |
| Supply | Inchangé | Réduit |
| Gestion | Nécessite intervention | Automatique |
| Effet | Neutre | Déflationniste |

### Prochaines étapes possibles

1. **Analytics avancées** : Graphique de l'évolution du supply
2. **Statistiques détaillées** : Tracker les pénalités par niveau de lock
3. **Events enrichis** : Émettre des événements détaillés de burn

## Code modifié

### Commit principal : Burn implementation

**Fichiers modifiés :**
- `programs/swapback_cnft/src/lib.rs` : 
  - Ajout des imports `Burn`, `spl_burn`, `token2022_burn`
  - Nouvelle fonction `burn_checked_dynamic` pour gérer Token et Token-2022
  - Remplacement du `transfer_checked_dynamic` par `burn_checked_dynamic` dans `unlock_tokens`
  - Suppression du compte `buyback_wallet_token_account` de la struct `UnlockTokens`
  - Message de log "🔥 X BACK brûlés (pénalité 2%)"
  
- `app/src/components/Dashboard.tsx` : 
  - Texte changé : "Penalties Sent to Buyback" → "Penalties Burned"
  
- `app/src/components/UnlockInterface.tsx` : 
  - Message changé : "(sent to buyback vault)" → "(burned 🔥)"

**Changements clés :**
1. Ajout de `burn_checked_dynamic()` pour supporter Token et Token-2022
2. Les pénalités sont maintenant brûlées au lieu d'être transférées
3. Le champ `total_penalties_collected` track maintenant les tokens brûlés
4. Simplification de la struct `UnlockTokens` (moins de comptes requis)

---

**Note** : L'interface UnlockInterface affiche déjà correctement le montant reçu après déduction de la pénalité. Aucune correction n'était nécessaire de ce côté.

