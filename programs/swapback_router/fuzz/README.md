# Fuzzing - SwapBack Router

Ce dossier contient l'infrastructure de fuzzing pour le programme Solana `swapback_router`.

## 🎯 Objectifs

Le fuzzing permet de détecter :
- **Overflow/underflow** dans les calculs arithmétiques
- **Panic** sur des entrées inattendues
- **Violations d'invariants** (ex: fees > amount, slippage hors bornes)
- **Edge cases** non couverts par les tests unitaires

## 📁 Structure

```
fuzz/
├── Cargo.toml              # Configuration du workspace fuzzing
├── README.md               # Ce fichier
├── fuzz_targets/           # Targets de fuzzing
│   ├── fuzz_swap_amounts.rs    # Montants swap, fees, NPI
│   ├── fuzz_oracle_price.rs    # Oracles, staleness, divergence
│   └── fuzz_buyback_flow.rs    # Buyback, slippage, burn
├── corpus/                 # Inputs intéressants découverts
│   ├── fuzz_swap_amounts/
│   ├── fuzz_oracle_price/
│   └── fuzz_buyback_flow/
└── artifacts/              # Crashes et inputs problématiques
```

## 🚀 Lancement rapide

### Prérequis

```bash
# Installer cargo-fuzz (nécessite nightly)
rustup install nightly
cargo +nightly install cargo-fuzz
```

### Lancer un target

```bash
cd programs/swapback_router

# Lancer un target spécifique (1h)
cargo +nightly fuzz run fuzz_swap_amounts -- -max_total_time=3600

# Lancer avec plus de parallélisme
cargo +nightly fuzz run fuzz_swap_amounts -- -jobs=4 -workers=4

# Lancer tous les targets (24h recommandé)
../../scripts/start-fuzzing.sh 24
```

### Monitoring

```bash
# Voir les logs en temps réel
tail -f fuzz_logs/fuzz_*.log

# Vérifier les processus
ps aux | grep cargo-fuzz

# Script de monitoring
./fuzz_logs/monitor_fuzzing.sh
```

## 🎯 Targets disponibles

### 1. `fuzz_swap_amounts`

Teste les calculs de swap et distribution des fees.

| Paramètre | Range | Vérifie |
|-----------|-------|---------|
| `amount_in` | 0..u64::MAX | Anti-whale (5000 SOL max) |
| `slippage_bps` | 0..10000 | Max 50% |
| `platform_fee_bps` | 0..100 | Max 1% |
| `rebate_bps` | 0..10000 | Distribution NPI |

**Invariants testés** :
- `fee <= amount_in`
- `rebate + treasury + boost <= npi`
- Pas d'overflow dans les multiplications

### 2. `fuzz_oracle_price`

Teste la lecture et validation des prix oracles.

| Paramètre | Range | Vérifie |
|-----------|-------|---------|
| `price_feed_1/2` | i64 | Prix positifs |
| `timestamp_1/2` | i64 | Staleness < 300s |
| `expo_1/2` | -18..0 | Exposants valides |

**Invariants testés** :
- Divergence < 2% entre feeds
- Prix normalisé > 0
- Médian dans [min, max]

### 3. `fuzz_buyback_flow`

Teste le flow de buyback USDC → BACK.

| Paramètre | Range | Vérifie |
|-----------|-------|---------|
| `usdc_amount` | 0..u64::MAX | Input valide |
| `back_amount_out` | 0..u64::MAX | >= min_expected |
| `burn_ratio_bps` | 10000 | Toujours 100% |

**Invariants testés** :
- `burned == back_amount_out` (100% burn)
- Ratio prix réaliste (< 100k)
- Slippage respecté

## 📊 Interprétation des résultats

### Succès (0 crash)

```
#12345  DONE   cov: 1234 ft: 5678 corp: 100/10Kb exec/s: 1000
```

- `cov`: Couverture de code atteinte
- `corp`: Taille du corpus
- `exec/s`: Exécutions par seconde

### Crash détecté

```
==12345== ERROR: libFuzzer: deadly signal
artifact_prefix='./artifacts/'; Test unit written to ./artifacts/crash-abc123
```

**Actions** :
1. Reproduire : `cargo +nightly fuzz run TARGET artifacts/crash-abc123`
2. Analyser l'input : `xxd artifacts/crash-abc123`
3. Créer un test de régression
4. Fixer le bug
5. Vérifier : relancer le fuzzing

## 🔄 CI/CD Integration

Le fuzzing est intégré à GitHub Actions :

```yaml
# .github/workflows/fuzz.yml
# Lancé quotidiennement et sur PR touchant programs/
```

### Déclenchement manuel

```bash
gh workflow run fuzz.yml
```

## 📝 Ajouter un nouveau target

1. Créer le fichier dans `fuzz_targets/` :

```rust
#![no_main]
use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;

#[derive(Arbitrary, Debug)]
struct MyFuzzInput {
    field1: u64,
    field2: u16,
}

fuzz_target!(|input: MyFuzzInput| {
    // Logique de test
    // assert!(...) pour vérifier les invariants
});
```

2. Ajouter dans `Cargo.toml` :

```toml
[[bin]]
name = "fuzz_my_target"
path = "fuzz_targets/fuzz_my_target.rs"
test = false
doc = false
bench = false
```

3. Créer le corpus initial :

```bash
mkdir -p corpus/fuzz_my_target
```

## 🏆 Bonnes pratiques

1. **Durée minimale** : 24h pour résultats significatifs
2. **Corpus** : Sauvegarder les inputs intéressants
3. **Régression** : Convertir les crashes en tests unitaires
4. **Couverture** : Viser > 80% des branches critiques
5. **Parallélisme** : Utiliser `-jobs=N` sur machines multi-core

## 📚 Ressources

- [libFuzzer Documentation](https://llvm.org/docs/LibFuzzer.html)
- [cargo-fuzz Book](https://rust-fuzz.github.io/book/cargo-fuzz.html)
- [Arbitrary crate](https://docs.rs/arbitrary/latest/arbitrary/)

## 🐛 Bugs trouvés par fuzzing

| Date | Target | Bug | Commit fix |
|------|--------|-----|------------|
| 2025-11-25 | fuzz_swap | Ratio astronomique overflow | `abc123` |
| - | - | - | - |

---

**Dernière mise à jour** : Décembre 2025
