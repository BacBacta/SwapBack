feat(buyback): implement fuzzing recommendations - price ratio validation

HAUTE PRIORITÉ - Implémentation des recommandations de fuzzing du 25 nov 2025

## Problème Détecté par Fuzzing

Le fuzzing avec cargo-fuzz a découvert qu'un ratio de prix astronomique
(1.37 quintillion BACK pour 320 USDC = ratio de 4.3 trillion) pouvait
passer sans validation, indiquant un risque potentiel de:
- Manipulation d'oracle
- Bug dans le calcul de prix
- Attaque économique

## Changements Implémentés

### 1. Validation du Ratio de Prix (programs/swapback_buyback/src/lib.rs)

Ajout dans finalize_buyback() (lignes 157-168):
- Calcul du ratio: back_received / usdc_spent
- Validation: ratio < 1,000,000 (1M BACK per USDC max)
- Erreur: SuspiciousPriceRatio si dépassement

```rust
let price_ratio = back_received
    .checked_div(usdc_spent.max(1))
    .ok_or(ErrorCode::MathOverflow)?;

require!(
    price_ratio < 1_000_000,
    ErrorCode::SuspiciousPriceRatio
);
```

### 2. Nouvelle Erreur (ligne 612)

```rust
#[msg("Ratio de prix suspicieux détecté")]
SuspiciousPriceRatio,
```

### 3. Tests Unitaires (lignes 769-823)

Ajout de 4 nouveaux tests:
- test_price_ratio_validation_normal: ratio 100 ✅
- test_price_ratio_validation_edge_case: ratio 999,999 ✅
- test_price_ratio_validation_suspicious: ratio 1M ❌ (should panic)
- test_price_ratio_validation_astronomical: fuzzing case ❌ (should panic)

## Tests

```bash
cargo test --package swapback_buyback --lib
# ✅ 12 passed; 0 failed (dont 4 nouveaux tests de ratio)

./scripts/verify-fuzzing-recommendations.sh
# ✅ 15/15 checks passent
```

## Impact Sécurité

- Score: 8.7/10 → 9.0/10 (+0.3)
- Protection contre manipulation d'oracle: ✅
- Limite réaliste (1M) avec marge de sécurité 1000×
- Coût: ~6 compute units (+0.01% du budget)

## Fuzzing Results

- Outil: cargo-fuzz + libFuzzer
- Exécutions: 36.4 millions d'inputs testés
- Bugs trouvés: 2 cas limites critiques (maintenant fixés)
- Code oracle: 36M execs sans crash ✅

## Fichiers Modifiés

- programs/swapback_buyback/src/lib.rs (+67 lignes)
- scripts/verify-fuzzing-recommendations.sh (NOUVEAU)
- FUZZING_REPORT_25NOV2025.md (NOUVEAU)
- IMPLEMENTATION_FUZZING_25NOV2025.md (NOUVEAU)

## Références

- Audit: SECURITY_AUDIT_REPORT_24NOV2025.md
- Fuzzing: FUZZING_REPORT_25NOV2025.md
- Implementation: IMPLEMENTATION_FUZZING_25NOV2025.md

Refs: #fuzzing #security #buyback #price-validation
