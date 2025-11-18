# 🔥 Système de Pénalités - Explication Complète

## ⚠️ Important : Les tokens de pénalité ne sont PAS brûlés

### Ce qui se passe réellement

Lorsqu'un utilisateur déverrouille ses tokens BACK avant la fin de la période de lock, une **pénalité de 2%** est appliquée :

```rust
// Calcul de la pénalité (2%)
let penalty = amount * 200 / 10_000  // 200 bps = 2%
let user_receives = amount - penalty
```

### Destination des tokens de pénalité

**Les tokens de pénalité sont transférés au `buyback_wallet`**, ils ne sont **PAS brûlés**.

```rust
// Code dans unlock_tokens (lib.rs ligne 310-335)
if penalty_amount > 0 {
    // Transfert vers le buyback wallet
    transfer_checked_dynamic(
        ...,
        penalty_accounts,  // vers buyback_wallet_token_account
        penalty_amount,
        ...
    )?;

    // Mise à jour du compteur global
    global_state.total_penalties_collected += penalty_amount;
}
```

### Pourquoi cette approche ?

Les pénalités alimentent le **système de buyback & burn** :

1. **Collecte** : Pénalités + 15% des frais de swap → `buyback_wallet`
2. **Buyback** : Tokens utilisés pour racheter BACK sur le marché
3. **Distribution** : 50% brûlés, 50% redistribués aux lockers

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
🔥 Penalties Sent to Buyback: XXX BACK
```

Cela montre le total cumulé de toutes les pénalités collectées depuis le début.

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
         └─► 20 BACK → Buyback wallet
                 │
                 └─► global_state.total_penalties_collected += 20
```

### Vérification on-chain

Pour vérifier que les pénalités arrivent bien au buyback wallet :

```bash
# Récupérer le solde du buyback wallet
solana balance <BUYBACK_WALLET_ADDRESS>

# Voir les transactions du vault
solana transaction-history <VAULT_AUTHORITY>
```

### Prochaines étapes possibles

1. **Burn des pénalités** : Modifier le code pour brûler directement au lieu de transférer
2. **Split configurable** : Permettre à l'admin de définir le ratio burn/redistribution
3. **Statistiques détaillées** : Tracker les pénalités par niveau de lock

## Code modifié

### Commit : `f3afb83`

**Fichiers modifiés :**
- `programs/swapback_cnft/src/lib.rs` : Ajout du champ et tracking
- `app/src/hooks/useGlobalState.ts` : Lecture du nouveau champ
- `app/src/components/Dashboard.tsx` : Affichage dans l'UI

**Changements clés :**
1. Ajout de `total_penalties_collected: u64` dans `GlobalState`
2. Incrémentation du compteur dans `unlock_tokens`
3. Affichage dans Protocol Statistics avec badge 🔥

---

**Note** : L'interface UnlockInterface affiche déjà correctement le montant reçu après déduction de la pénalité. Aucune correction n'était nécessaire de ce côté.

