#!/bin/bash
set -e

echo "=============================================="
echo "🔨 PHASE 3: BUILD DU PROGRAMME CNFT"
echo "=============================================="
echo ""

# Source l'environnement
source $HOME/.cargo/env
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Aller dans le workspace
cd /workspaces/SwapBack

# Afficher les versions
echo "=== Environnement de build ==="
echo "Rust:    $(rustc --version)"
echo "Cargo:   $(cargo --version)"
echo "Solana:  $(solana --version | head -n1)"
echo "Anchor:  $(anchor --version)"
echo ""

# Nettoyer avant build
echo "🧹 Nettoyage avant build..."
anchor clean 2>/dev/null || true
rm -rf target/ Cargo.lock programs/swapback_cnft/target/

# Build avec cargo-build-sbf directement (Rust 1.78)
echo ""
echo "🔨 Build du programme swapback_cnft..."
echo "Note: Build direct avec Rust 1.78 pour éviter conflits de dépendances..."

# S'assurer qu'on utilise Rust 1.78
rustup override set 1.78.0
source $HOME/.cargo/env

# Générer Cargo.lock avec Rust 1.78
cargo generate-lockfile

# Build avec RUSTUP_TOOLCHAIN pour forcer l'utilisation de Rust 1.78
cd programs/swapback_cnft
RUSTUP_TOOLCHAIN=1.78.0 cargo-build-sbf --manifest-path Cargo.toml

# Copier les artifacts
cd /workspaces/SwapBack
mkdir -p target/deploy
if [ -f "programs/swapback_cnft/target/deploy/swapback_cnft.so" ]; then
    cp programs/swapback_cnft/target/deploy/swapback_cnft.so target/deploy/
    cp programs/swapback_cnft/target/deploy/swapback_cnft-keypair.json target/deploy/
fi

# Retour au dossier principal
cd /workspaces/SwapBack

# Vérifier le résultat
if [ -f "target/deploy/swapback_cnft.so" ]; then
    echo ""
    echo "=============================================="
    echo "✅ BUILD RÉUSSI !"
    echo "=============================================="
    ls -lh target/deploy/swapback_cnft.so
    
    # Afficher le Program ID
    PROGRAM_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)
    echo ""
    echo "Program ID: $PROGRAM_ID"
    
    # Générer l'IDL
    echo ""
    echo "📝 Génération de l'IDL..."
    anchor idl build --program-name swapback_cnft
    
    if [ -f "target/idl/swapback_cnft.json" ]; then
        # Copier l'IDL vers le frontend
        mkdir -p app/src/idl
        cp target/idl/swapback_cnft.json app/src/idl/
        
        # Mettre à jour l'adresse dans l'IDL
        jq --arg pid "$PROGRAM_ID" '.address = $pid' app/src/idl/swapback_cnft.json > /tmp/idl.json
        mv /tmp/idl.json app/src/idl/swapback_cnft.json
        
        echo "✅ IDL copié vers app/src/idl/swapback_cnft.json"
        echo "✅ Program ID mis à jour dans l'IDL: $PROGRAM_ID"
    fi
    
    echo ""
    echo "🎉 Programme prêt pour le déploiement !"
    echo ""
    echo "Prochaines étapes:"
    echo "  1. Déployer: ./scripts/4-deploy-devnet.sh"
    echo "  2. Ou build + deploy: ./scripts/build-and-deploy.sh"
    echo ""
else
    echo ""
    echo "❌ ERREUR: Le fichier swapback_cnft.so n'a pas été créé"
    exit 1
fi
