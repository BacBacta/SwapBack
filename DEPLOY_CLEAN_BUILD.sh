#!/bin/bash
set -e

echo "=============================================="
echo "🔧 BUILD PROPRE AVEC VERSIONS COMPATIBLES"
echo "=============================================="
echo ""
echo "Basé sur:"
echo "- Solana Programs with Rust: https://solana.com/fr/docs/programs/rust"
echo "- Anchor Version Compatibility: https://www.anchor-lang.com/docs/updates/changelog"
echo ""

export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
source $HOME/.cargo/env

cd /workspaces/SwapBack

# 1. Vérifier versions
echo "📋 Versions actuelles:"
echo "   Solana: $(solana --version | head -1)"
echo "   Rust: $(rustc --version)"
echo ""

# 2. Passer à Rust 1.78 (compatible Solana 1.18)
echo "📋 Configuration Rust 1.78 (compatible Solana 1.18)..."
rustup install 1.78.0 2>/dev/null || true
rustup default 1.78.0
rustup override set 1.78.0
source $HOME/.cargo/env
echo "   ✅ Rust: $(rustc --version)"
echo ""

# 3. Nettoyer complètement
echo "📋 Nettoyage complet..."
rm -rf target/
rm -rf .anchor/
rm -rf programs/swapback_cnft/target/
rm -f Cargo.lock
rm -f programs/swapback_cnft/Cargo.lock
echo "   ✅ Nettoyage terminé"
echo ""

# 4. Régénérer Cargo.lock avec Rust 1.78
echo "📋 Génération Cargo.lock avec Rust 1.78..."
cargo generate-lockfile
echo "   ✅ Cargo.lock généré"
echo ""

# 5. Build direct avec cargo-build-sbf (bypass Anchor)
echo "📋 Build avec cargo-build-sbf (méthode Solana native)..."
cd programs/swapback_cnft

# Forcer Rust 1.78
export RUSTUP_TOOLCHAIN=1.78.0

if cargo-build-sbf --manifest-path Cargo.toml; then
    echo "   ✅ Build réussi"
else
    echo "   ❌ Build échoué"
    exit 1
fi

cd /workspaces/SwapBack

# 6. Copier les artifacts
echo "📋 Copie des artifacts..."
mkdir -p target/deploy
if [ -f "programs/swapback_cnft/target/deploy/swapback_cnft.so" ]; then
    cp programs/swapback_cnft/target/deploy/swapback_cnft.so target/deploy/
    cp programs/swapback_cnft/target/deploy/swapback_cnft-keypair.json target/deploy/
    SIZE=$(ls -lh target/deploy/swapback_cnft.so | awk '{print $5}')
    echo "   ✅ Programme: $SIZE"
else
    echo "   ❌ Programme non trouvé"
    exit 1
fi
echo ""

# 7. Obtenir Program ID
PROGRAM_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)
echo "📋 Program ID: $PROGRAM_ID"
echo ""

# 8. Vérifier le solde
echo "📋 Vérification wallet..."
solana config set --url devnet >/dev/null
BALANCE=$(solana balance 2>/dev/null | awk '{print $1}' || echo "0")
echo "   Balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 3" | bc -l 2>/dev/null || echo "1") )); then
    echo "   Airdrop de 2 SOL..."
    solana airdrop 2 2>/dev/null || echo "   ⚠️  Airdrop échoué"
    sleep 3
fi
echo ""

# 9. Déployer avec solana program deploy (méthode native)
echo "📋 Déploiement sur devnet..."

# Vérifier si existe déjà
if solana program show $PROGRAM_ID --url devnet &>/dev/null; then
    echo "   ⚠️  Programme existe, upgrade..."
    
    # Upgrade
    if solana program deploy target/deploy/swapback_cnft.so \
        --program-id target/deploy/swapback_cnft-keypair.json \
        --url devnet \
        --upgrade-authority ~/.config/solana/id.json; then
        echo "   ✅ Upgrade réussi"
    else
        echo "   ❌ Upgrade échoué"
        exit 1
    fi
else
    echo "   ✅ Nouveau déploiement..."
    
    # Nouveau déploiement
    if solana program deploy target/deploy/swapback_cnft.so \
        --program-id target/deploy/swapback_cnft-keypair.json \
        --url devnet; then
        echo "   ✅ Déploiement réussi"
    else
        echo "   ❌ Déploiement échoué"
        exit 1
    fi
fi
echo ""

# 10. Vérification
echo "📋 Vérification..."
if solana program show $PROGRAM_ID --url devnet | head -5; then
    echo ""
    echo "   ✅ Programme visible sur devnet"
else
    echo "   ❌ Programme non visible"
    exit 1
fi
echo ""

# 11. Check unlock_tokens
echo "📋 Vérification unlock_tokens..."
if solana program dump $PROGRAM_ID /tmp/deployed.so --url devnet 2>&1 >/dev/null; then
    if strings /tmp/deployed.so | grep -q "unlock_tokens"; then
        echo "   ✅ unlock_tokens PRÉSENT"
    else
        echo "   ⚠️  unlock_tokens non détecté"
    fi
    rm -f /tmp/deployed.so
fi
echo ""

# 12. Générer IDL avec Anchor
echo "📋 Génération IDL..."
rustup default 1.78.0
if anchor idl build --program-name swapback_cnft 2>/dev/null; then
    mkdir -p app/src/idl
    cp target/idl/swapback_cnft.json app/src/idl/ 2>/dev/null || true
    echo "   ✅ IDL généré"
else
    echo "   ⚠️  IDL non généré (utiliser l'IDL existant)"
fi
echo ""

# 13. Mettre à jour la configuration
echo "📋 Mise à jour configuration..."

# declare_id! dans lib.rs
sed -i "s/declare_id!(\"[^\"]*\")/declare_id!(\"${PROGRAM_ID}\")/" programs/swapback_cnft/src/lib.rs
echo "   ✅ lib.rs mis à jour"

# .env.local
cat > app/.env.local << EOF
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_CNFT_PROGRAM_ID=$PROGRAM_ID
NEXT_PUBLIC_ROUTER_PROGRAM_ID=BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR
NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom
EOF
echo "   ✅ .env.local créé"
echo ""

# 14. Résumé
echo "=============================================="
echo "✅ DÉPLOIEMENT RÉUSSI"
echo "=============================================="
echo ""
echo "📋 Program ID: $PROGRAM_ID"
echo "🔗 Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo ""
echo "🎯 PROCHAINES ÉTAPES OBLIGATOIRES:"
echo ""
echo "1. Commit et push:"
echo "   git add -A"
echo "   git commit -m \"deploy: CNFT program $PROGRAM_ID on devnet\""
echo "   git push origin main"
echo ""
echo "2. ⚠️  CRITIQUE - Mettre à jour Vercel:"
echo "   https://vercel.com/bactas-projects/swap-back/settings/environment-variables"
echo ""
echo "   Variable: NEXT_PUBLIC_CNFT_PROGRAM_ID"
echo "   Valeur:   $PROGRAM_ID"
echo ""
echo "3. Redéployer Vercel:"
echo "   Dashboard → Deployments → Redeploy"
echo "   ✅ Décocher 'Use existing Build Cache'"
echo ""
echo "4. Tester lock/unlock sur production"
echo ""
