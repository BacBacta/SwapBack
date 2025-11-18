# 🔥 Migration Guide: Penalty Burn System

## Vue d'ensemble

**Date de mise à jour :** 18 novembre 2025  
**Commit :** `ce178ad`  
**Type :** BREAKING CHANGE

## Qu'est-ce qui change ?

### Ancien comportement
Les tokens de pénalité (2%) lors d'un unlock anticipé étaient **transférés au buyback wallet**.

### Nouveau comportement
Les tokens de pénalité (2%) lors d'un unlock anticipé sont maintenant **BRÛLÉS** 🔥.

## Impact pour les utilisateurs

### ✅ Aucun impact sur l'expérience utilisateur

- Le montant de la pénalité reste **identique : 2%**
- Le montant reçu par l'utilisateur reste **le même**
- Le processus d'unlock reste **inchangé**

**Exemple :**
```
Avant : 1000 BACK lockés → unlock anticipé → 980 BACK reçus + 20 BACK au buyback wallet
Après  : 1000 BACK lockés → unlock anticipé → 980 BACK reçus + 20 BACK brûlés 🔥
```

### 📊 Changement économique

| Aspect | Ancien système | Nouveau système |
|--------|---------------|-----------------|
| Montant reçu | 980 BACK | 980 BACK ✅ |
| Pénalité | 20 BACK | 20 BACK ✅ |
| Destination pénalité | Buyback wallet | Brûlé |
| Impact supply | Neutre | Déflationniste ✨ |

## Impact technique

### Pour les développeurs

#### Changements dans le smart contract

**Fonction modifiée :** `unlock_tokens` (programs/swapback_cnft/src/lib.rs)

**Avant :**
```rust
// Transfert vers buyback wallet
transfer_checked_dynamic(
    ...,
    penalty_accounts,  // vers buyback_wallet_token_account
    penalty_amount,
    ...
)?;
```

**Après :**
```rust
// Burn direct des tokens
burn_checked_dynamic(
    &ctx.accounts.token_program,
    &ctx.accounts.token_2022_program,
    &ctx.accounts.back_mint,
    burn_accounts,
    penalty_amount,
    Some(signer_seeds),
)?;

msg!("🔥 {} BACK brûlés (pénalité 2%)", penalty_amount / BACK_DECIMALS);
```

#### Changements dans la structure UnlockTokens

**Compte supprimé :**
```rust
// ❌ N'est plus nécessaire
pub buyback_wallet_token_account: InterfaceAccount<'info, TokenAccount>
```

Les transactions d'unlock nécessitent maintenant **un compte en moins** :
- ✅ Plus simple
- ✅ Moins de gas
- ✅ Moins de contraintes de validation

### Pour les intégrations frontend

#### Changements dans les appels RPC

**Transaction unlock :**
```typescript
// Avant : 10 comptes requis
const tx = await program.methods.unlockTokens().accounts({
  userLock,
  globalState,
  userTokenAccount,
  vaultTokenAccount,
  buybackWalletTokenAccount,  // ❌ Plus nécessaire
  vaultAuthority,
  backMint,
  user,
  tokenProgram,
  token2022Program,
}).rpc();

// Après : 9 comptes requis
const tx = await program.methods.unlockTokens().accounts({
  userLock,
  globalState,
  userTokenAccount,
  vaultTokenAccount,
  vaultAuthority,
  backMint,
  user,
  tokenProgram,
  token2022Program,
}).rpc();
```

#### Événements on-chain

Les événements `TokensUnlocked` restent identiques :
```rust
#[event]
pub struct TokensUnlocked {
    pub user: Pubkey,
    pub amount: u64,           // Montant reçu par l'utilisateur
    pub penalty_amount: u64,   // Montant brûlé
    pub early_unlock: bool,
    pub timestamp: i64,
}
```

### Pour les analytics

#### Tracking du supply

**Nouvelle métrique importante :**
```
Total Supply = Initial Supply - total_penalties_collected
```

Le champ `global_state.total_penalties_collected` track maintenant les **tokens brûlés**, pas transférés.

#### Affichage dans l'UI

**Dashboard → Analytics → Protocol Statistics :**
```diff
- 🔥 Penalties Sent to Buyback: XXX BACK
+ 🔥 Penalties Burned: XXX BACK
```

## Migration checklist

### Pour les utilisateurs : ✅ Rien à faire

### Pour les développeurs frontend :

- [ ] Mettre à jour les appels `unlockTokens` pour retirer le compte `buybackWalletTokenAccount`
- [ ] Vérifier que les messages d'erreur ne référencent plus le buyback wallet
- [ ] Mettre à jour les textes UI : "sent to buyback" → "burned"
- [ ] Tester les transactions unlock sur devnet

### Pour les intégrateurs :

- [ ] Mettre à jour la documentation API
- [ ] Adapter les analytics pour tracker la réduction du supply
- [ ] Informer les utilisateurs du changement (s'ils suivent le supply)

### Pour les auditeurs :

- [ ] Vérifier la fonction `burn_checked_dynamic` (Token + Token-2022)
- [ ] Confirmer que les pénalités sont bien brûlées et non transférables
- [ ] Valider que le compteur `total_penalties_collected` est correct

## Avantages du nouveau système

### 🎯 Économiques

1. **Déflationniste** : Réduit automatiquement le supply total
2. **Transparent** : Visible on-chain via les burn transactions
3. **Valorisation** : Moins de tokens en circulation = pression haussière potentielle

### 🔧 Techniques

1. **Simplicité** : Moins de comptes à gérer
2. **Sécurité** : Pas de wallet intermédiaire = moins de vecteurs d'attaque
3. **Efficacité** : Transactions plus légères (9 comptes au lieu de 10)

### 📊 Opérationnels

1. **Automatique** : Pas d'intervention manuelle nécessaire
2. **Irrévocable** : Les tokens brûlés ne peuvent pas être récupérés
3. **Vérifiable** : Tout le monde peut vérifier le supply on-chain

## Vérification

### Tester sur devnet

```bash
# 1. Déployer la nouvelle version
anchor build
anchor deploy --provider.cluster devnet

# 2. Faire un lock de test
# 3. Faire un unlock anticipé
# 4. Vérifier que le supply a diminué

# Avant unlock
spl-token supply <BACK_MINT> --url devnet

# Après unlock
spl-token supply <BACK_MINT> --url devnet
# Le supply doit avoir diminué de penalty_amount
```

### Explorer on-chain

Les burns sont visibles via :
- Solana Explorer : voir les "Burn" instructions
- Solscan : filtrer par "token burn" events
- RPC : `getParsedTransaction` montre les burn dans `meta.postTokenBalances`

## Support

### Questions fréquentes

**Q : Mon ancien code va-t-il casser ?**  
R : Oui, si vous passiez `buybackWalletTokenAccount` dans les transactions unlock. Retirez ce compte des appels.

**Q : Les anciens locks sont-ils affectés ?**  
R : Non, tous les locks existants fonctionnent normalement. Seul le comportement lors de l'unlock change.

**Q : Puis-je récupérer les tokens brûlés ?**  
R : Non, c'est impossible. Les tokens brûlés sont définitivement retirés de la circulation.

**Q : Comment voir le total de tokens brûlés ?**  
R : Via `global_state.total_penalties_collected` ou en comparant le supply actuel avec le supply initial.

### Ressources

- **Documentation complète :** `PENALTY_SYSTEM_EXPLAINED.md`
- **Code source :** `programs/swapback_cnft/src/lib.rs` (ligne ~310)
- **Tests :** À venir dans `programs/swapback_cnft/tests/`

### Contact

Pour toute question ou problème, ouvrir une issue sur GitHub avec le tag `[burn-migration]`.

---

**⚠️ Note importante :** Ce changement nécessite un redéploiement du programme on-chain. Assurez-vous de tester en profondeur sur devnet avant le déploiement mainnet.

