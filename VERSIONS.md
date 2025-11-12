# 📦 Versions Propres de l'Environnement

Dernière mise à jour : 11 novembre 2025

## 🎯 Stack Technique Validée

| Composant    | Version  | Raison                                           |
|--------------|----------|--------------------------------------------------|
| **Rust**     | 1.75.0   | Dernière version compatible avec time v0.3.29    |
| **Solana**   | 1.18.26  | Version stable pour Anchor 0.30.1                |
| **Anchor**   | 0.30.1   | Dernière version stable (27 juin 2024)           |
| **Node.js**  | 20.x     | LTS pour Next.js 14                              |
| **npm**      | 10.x     | Inclus avec Node.js 20                           |

## ⚠️ Versions à ÉVITER

### Rust
- **≥ 1.79.0** : Bug avec `time v0.3.29` (erreur E0282)
- **< 1.75.0** : Incompatible avec dépendances modernes

### Solana
- **2.x** : Breaking changes incompatibles avec Anchor 0.30.1
- **< 1.18.0** : Fonctionnalités manquantes

### Anchor
- **0.31.x** : Breaking changes (pas encore stable)
- **< 0.30.0** : Fonctionnalités obsolètes

## 🔧 Installation

### Installation Complète (from scratch)

```bash
# 1. Nettoyage total
bash scripts/clean-everything.sh
# Tapez "DELETE EVERYTHING" pour confirmer

# 2. Installation propre
bash scripts/install-fresh.sh
# Tapez "y" pour continuer

# 3. Nettoyage des patches de code
bash scripts/clean-code-patches.sh

# 4. Vérification
rustc --version    # 1.75.0
solana --version   # 1.18.26
anchor --version   # 0.30.1
```

### Mise à Jour Sélective

```bash
# Mettre à jour uniquement Rust
rustup install 1.75.0
rustup default 1.75.0

# Mettre à jour uniquement Solana
sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"

# Mettre à jour uniquement Anchor
cargo install --git https://github.com/coral-xyz/anchor \
    --tag v0.30.1 anchor-cli --locked --force
```

## 📁 Structure des Répertoires

```
~/.rustup/           # Rustup et toolchains Rust
~/.cargo/            # Cargo et binaires Rust
~/.local/share/solana/   # Solana CLI
~/.config/solana/    # Configuration Solana (keypairs, RPC)
~/.cache/solana/     # Cache Solana (platform-tools)
```

## 🧪 Commandes de Vérification

```bash
# Vérifier les versions
rustc --version && cargo --version && \
solana --version && anchor --version

# Vérifier cargo-build-sbf
cargo-build-sbf --version

# Vérifier la configuration Solana
solana config get

# Lister les toolchains Rust
rustup toolchain list

# Vérifier les variables d'environnement
env | grep -i "rust\|cargo\|solana\|anchor"
```

## 🔄 Workflow de Compilation

```bash
# 1. Nettoyer les artefacts précédents
rm -rf target/ Cargo.lock

# 2. Compiler le programme
anchor build -p swapback_cnft

# 3. Vérifier le binaire généré
ls -lh target/deploy/swapback_cnft.so

# 4. Obtenir le Program ID
solana-keygen pubkey target/deploy/swapback_cnft-keypair.json

# 5. Déployer sur devnet
anchor deploy --provider.cluster devnet --program-name swapback_cnft
```

## 🐛 Dépannage

### Erreur `time v0.3.29` lors de la compilation

**Symptôme :** `error[E0282]: type annotations needed`

**Solution :** Vérifier que Rust 1.75.0 est actif :
```bash
rustc --version  # Doit afficher 1.75.0
rustup default 1.75.0
```

### cargo-build-sbf utilise Rust 1.75.0-dev au lieu de 1.75.0

**Solution :** C'est normal ! Platform-tools v1.41 embarque Rust 1.75.0-dev.
Cette version est compatible avec notre stack.

### Anchor build échoue avec "program not found"

**Solution :**
```bash
# Vérifier Anchor.toml
cat Anchor.toml | grep -A 10 "\[programs.devnet\]"

# Régénérer le workspace
anchor build
```

### Terminal bloqué dans un répertoire invalide

**Solution :**
```bash
# Ouvrir un nouveau terminal
cd /workspaces/SwapBack
# Vérifier le répertoire courant
pwd
```

## 📚 Ressources

- [Rust Release Notes](https://github.com/rust-lang/rust/releases/tag/1.75.0)
- [Solana 1.18 Docs](https://docs.solana.com/cluster/versions#1-18-x)
- [Anchor 0.30.1 Release](https://github.com/coral-xyz/anchor/releases/tag/v0.30.1)

## ✅ Checklist de Validation

- [ ] Rust 1.75.0 installé et actif
- [ ] Solana CLI 1.18.26 installé
- [ ] Anchor CLI 0.30.1 installé
- [ ] cargo-build-sbf fonctionnel
- [ ] Aucun patch dans Cargo.toml
- [ ] Aucun rust-toolchain.toml
- [ ] Aucun wrapper cargo personnalisé
- [ ] Configuration Solana pointant vers devnet
- [ ] Keypairs présentes et valides
- [ ] anchor build fonctionne sans erreur

## 🚀 Démarrage Rapide

```bash
# Installation complète en une commande
chmod +x scripts/*.sh && \
bash scripts/clean-everything.sh && \
bash scripts/install-fresh.sh && \
bash scripts/clean-code-patches.sh

# Puis compiler et déployer
cd /workspaces/SwapBack
anchor build -p swapback_cnft
anchor deploy --provider.cluster devnet --program-name swapback_cnft
```

## 📝 Notes Importantes

1. **Toujours faire un backup** avant de nettoyer
2. **Vérifier les versions** après chaque installation
3. **Tester la compilation** avant de déployer
4. **Documenter les changements** de configuration
5. **Committer les modifications** dans git après validation
