#!/bin/bash
set -e

echo "🧹 =================================================="
echo "🧹 NETTOYAGE DES PATCHES DANS LE CODE"
echo "🧹 =================================================="
echo ""

cd /workspaces/SwapBack

# ==================================================
# SUPPRIMER LES PATCHES CARGO
# ==================================================
echo "🔍 Recherche de patches Cargo dans Cargo.toml..."

if grep -q "\[patch.crates-io\]" Cargo.toml; then
    echo "  ⚠️  Patches [patch.crates-io] détectés"
    echo "  → Création d'un backup : Cargo.toml.backup-$(date +%Y%m%d-%H%M%S)"
    cp Cargo.toml Cargo.toml.backup-$(date +%Y%m%d-%H%M%S)
    
    # Supprimer la section [patch.crates-io] et son contenu
    sed -i '/\[patch.crates-io\]/,/^$/d' Cargo.toml
    
    echo "  ✅ Patches supprimés de Cargo.toml"
else
    echo "  ✅ Aucun patch détecté dans Cargo.toml"
fi

echo ""

# ==================================================
# VÉRIFIER LES PATCHES DANS LES SOUS-PROGRAMMES
# ==================================================
echo "🔍 Vérification des Cargo.toml des programmes..."

for PROG_CARGO in programs/*/Cargo.toml; do
    if [ -f "$PROG_CARGO" ] && grep -q "\[patch" "$PROG_CARGO"; then
        echo "  ⚠️  Patches détectés dans $PROG_CARGO"
        cp "$PROG_CARGO" "$PROG_CARGO.backup-$(date +%Y%m%d-%H%M%S)"
        sed -i '/\[patch/,/^$/d' "$PROG_CARGO"
        echo "  ✅ Patches supprimés de $PROG_CARGO"
    fi
done

echo "  ✅ Tous les Cargo.toml vérifiés"

echo ""

# ==================================================
# SUPPRIMER LES RUST-TOOLCHAIN
# ==================================================
echo "🔍 Recherche de fichiers rust-toolchain..."

TOOLCHAIN_FILES=$(find . -name "rust-toolchain" -o -name "rust-toolchain.toml" 2>/dev/null)

if [ -n "$TOOLCHAIN_FILES" ]; then
    echo "  → Fichiers trouvés :"
    echo "$TOOLCHAIN_FILES" | sed 's/^/      /'
    echo ""
    echo "$TOOLCHAIN_FILES" | xargs rm -f
    echo "  ✅ Fichiers rust-toolchain supprimés"
else
    echo "  ✅ Aucun fichier rust-toolchain trouvé"
fi

echo ""

# ==================================================
# NETTOYER LES OVERRIDES DE DÉPENDANCES
# ==================================================
echo "🔍 Vérification des overrides de dépendances..."

# Chercher dans tous les Cargo.toml
for CARGO_FILE in $(find . -name "Cargo.toml"); do
    if grep -q "^\[dependencies\]" "$CARGO_FILE" && \
       grep -q "version.*path.*git" "$CARGO_FILE"; then
        echo "  ⚠️  Overrides suspects dans $CARGO_FILE"
        echo "      Vérifiez manuellement ce fichier"
    fi
done

echo "  ✅ Vérification terminée"

echo ""

# ==================================================
# SUPPRIMER LES WRAPPERS CARGO PERSONNALISÉS
# ==================================================
echo "🔍 Recherche de wrappers cargo personnalisés..."

WRAPPER_LOCATIONS=(
    "$HOME/.local/bin/cargo-build-sbf"
    "$HOME/.cargo/bin/cargo-build-sbf-wrapper"
    "/usr/local/bin/cargo-build-sbf-wrapper"
)

for WRAPPER in "${WRAPPER_LOCATIONS[@]}"; do
    if [ -f "$WRAPPER" ]; then
        echo "  → Suppression de $WRAPPER"
        rm -f "$WRAPPER"
    fi
done

echo "  ✅ Aucun wrapper personnalisé restant"

echo ""

# ==================================================
# NETTOYER LES VARIABLES D'ENV PERSONNALISÉES
# ==================================================
echo "🔍 Vérification des variables d'environnement..."

# Chercher dans .bashrc, .profile, etc.
for RC_FILE in ~/.bashrc ~/.profile ~/.zshrc; do
    if [ -f "$RC_FILE" ] && grep -q "RUSTUP_TOOLCHAIN\|CARGO_BUILD_SBF" "$RC_FILE"; then
        echo "  ⚠️  Variables personnalisées détectées dans $RC_FILE"
        echo "      Vérifiez et nettoyez manuellement"
    fi
done

echo "  ✅ Vérification terminée"

echo ""

# ==================================================
# SUPPRIMER LES SCRIPTS TEMPORAIRES
# ==================================================
echo "🔍 Nettoyage des scripts temporaires..."

TEMP_SCRIPTS=(
    "compile-cnft.sh"
    "commit-and-push.sh"
    "/tmp/git-commit.sh"
    "build-fixed.sh"
    "build-simple.sh"
)

for SCRIPT in "${TEMP_SCRIPTS[@]}"; do
    if [ -f "$SCRIPT" ]; then
        echo "  → Suppression de $SCRIPT"
        rm -f "$SCRIPT"
    fi
done

echo "  ✅ Scripts temporaires nettoyés"

echo ""

# ==================================================
# RÉSUMÉ
# ==================================================
echo "✅ =================================================="
echo "✅ NETTOYAGE DU CODE TERMINÉ"
echo "✅ =================================================="
echo ""
echo "📋 Actions effectuées :"
echo "  ✅ Patches Cargo supprimés (backups créés)"
echo "  ✅ Fichiers rust-toolchain supprimés"
echo "  ✅ Wrappers cargo personnalisés supprimés"
echo "  ✅ Overrides de dépendances vérifiés"
echo "  ✅ Scripts temporaires nettoyés"
echo ""
echo "⚠️  Actions manuelles requises :"
echo "  • Vérifier Cargo.toml pour d'éventuels overrides restants"
echo "  • Nettoyer ~/.bashrc / ~/.profile si variables d'env personnalisées"
echo ""
