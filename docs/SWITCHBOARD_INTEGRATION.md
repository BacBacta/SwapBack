# Intégration Switchboard Oracle

## Vue d'ensemble

SwapBack utilise Switchboard comme oracle principal pour obtenir des prix fiables et décentralisés (notamment SOL/USD) sur Solana. Cette intégration permet de calculer les montants attendus lors des swaps et de vérifier la validité des transactions.

## Configuration

### Feature Flag

L'intégration Switchboard est activée via le feature flag `switchboard` dans `Cargo.toml`.

```toml
[features]
switchboard = ["switchboard-solana"]
```

Pour compiler le programme avec Switchboard activé :

```bash
anchor build --program-name swapback_router -- --features switchboard
```

### Feeds Utilisés

| Paire   | Réseau | Adresse Feed (Aggregator) |
|---------|--------|---------------------------|
| SOL/USD | Devnet | `GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR` |
| SOL/USD | Mainnet| `7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE` |

## Implémentation Technique

Le code se trouve dans `programs/swapback_router/src/oracle.rs`.

### Logique de Lecture

1.  **Tentative Switchboard** : Le programme essaie de désérialiser le compte fourni comme un `AggregatorAccountData` Switchboard.
2.  **Validation** :
    *   Vérifie que les données ne sont pas périmées (`MAX_STALENESS_SECS`).
    *   Vérifie que le prix est positif.
3.  **Fallback Pyth** : Si la désérialisation Switchboard échoue (ou si le compte n'est pas un compte Switchboard), le programme tente de lire le compte comme un feed Pyth.

### Structure de Données

```rust
pub struct OracleObservation {
    pub price: u64,          // Prix normalisé (8 décimales)
    pub confidence: u64,     // Intervalle de confiance (0 pour Switchboard)
    pub publish_time: i64,   // Timestamp de publication
    pub slot: u64,           // Slot de publication
    pub oracle_type: OracleType, // Switchboard ou Pyth
}
```

## Tests

Les tests d'intégration se trouvent dans `tests/oracle-switchboard.test.ts`.

Pour exécuter les tests :

```bash
SWAPBACK_RUN_ANCHOR_TESTS=true npx vitest run tests/oracle-switchboard.test.ts
```
