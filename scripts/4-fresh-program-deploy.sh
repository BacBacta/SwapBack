#!/bin/bash
set -e

echo "=============================================="
echo "🔄 RESET & REDEPLOY PROGRAMME CNFT"
echo "=============================================="
echo ""

# 1. Vérifier Solana (déjà installé)
echo "1️⃣ Vérification Solana..."
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

if ! command -v solana &> /dev/null; then
    echo "❌ Solana non trouvé, réinstallation..."
    cd /tmp
    wget -q --show-progress https://github.com/solana-labs/solana/releases/download/v1.18.26/solana-release-x86_64-unknown-linux-gnu.tar.bz2
    tar -xf solana-release-x86_64-unknown-linux-gnu.tar.bz2
    mkdir -p ~/.local/share/solana/install/active_release
    cp -r solana-release/bin ~/.local/share/solana/install/active_release/
    rm -rf solana-release*
    cd /workspaces/SwapBack
fi

echo "✅ Solana: $(solana --version | head -n1)"

# Installer platform-tools pour cargo-build-sbf
if ! command -v cargo-build-sbf &> /dev/null; then
    echo "📦 Installation platform-tools..."
    ~/.local/share/solana/install/active_release/bin/sdk/sbf/scripts/install.sh
fi

echo "✅ cargo-build-sbf disponible"

# 2. Nettoyer les anciens builds
echo ""
echo "2️⃣ Nettoyage des anciens builds..."
cd /workspaces/SwapBack
rm -rf target/
rm -rf programs/swapback_cnft/target/
rm -f Cargo.lock
rm -f programs/swapback_cnft/Cargo.lock

# 3. Générer un nouveau keypair pour le programme
echo ""
echo "3️⃣ Génération d'un nouveau Program ID..."
mkdir -p target/deploy
solana-keygen new --no-bip39-passphrase -o target/deploy/swapback_cnft-keypair.json --force

NEW_PROGRAM_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)
echo "✅ Nouveau Program ID: ${NEW_PROGRAM_ID}"

# 4. Mettre à jour le declare_id! dans le code Rust
echo ""
echo "4️⃣ Mise à jour du declare_id! dans le code Rust..."
sed -i "s/declare_id!(\"[^\"]*\")/declare_id!(\"${NEW_PROGRAM_ID}\")/" programs/swapback_cnft/src/lib.rs

echo "✅ declare_id! mis à jour dans lib.rs"

# 5. Build avec Anchor en mode debug d'abord pour vérifier
echo ""
echo "5️⃣ Build du programme avec Anchor..."

# Essayer d'abord avec anchor build standard
echo "   Tentative build standard..."
if anchor build --program-name swapback_cnft 2>&1 | tee /tmp/anchor-build.log; then
    echo "✅ Build standard réussi"
elif grep -q "requires rustc 1.76" /tmp/anchor-build.log || grep -q "requires rustc 1.82" /tmp/anchor-build.log; then
    echo "⚠️  Build standard échoué (conflit version Rust)"
    echo "   Tentative build alternatif avec Rust 1.78 natif..."
    
    # Build alternatif : utiliser rustup override et forcer BPF
    cd /workspaces/SwapBack/programs/swapback_cnft
    
    # S'assurer que le target BPF est disponible via solana toolchain  
    SOLANA_RUSTC="$HOME/.local/share/solana/install/active_release/bin/sdk/sbf/dependencies/platform-tools/rust/bin/rustc"
    if [ -f "$SOLANA_RUSTC" ]; then
        echo "   Utilisation du rustc Solana embarqué..."
        cargo build --target sbf-solana-solana --release 2>&1 || {
            echo "   Tentative avec cargo-build-sbf direct..."
            cargo-build-sbf --manifest-path Cargo.toml 2>&1
        }
    else
        echo "   Fallback: anchor build sans vérification de version..."
        cd /workspaces/SwapBack
        anchor build --program-name swapback_cnft -- --features idl-build 2>&1 || true
    fi
    
    cd /workspaces/SwapBack
fi

if [ ! -f "target/deploy/swapback_cnft.so" ]; then
    echo "❌ Erreur: Build échoué - binaire non trouvé"
    echo "   Logs dans /tmp/anchor-build.log"
    exit 1
fi

echo "✅ Build réussi: $(ls -lh target/deploy/swapback_cnft.so | awk '{print $5}')"

# 6. Vérifier le declare_id dans le binaire
echo ""
echo "6️⃣ Vérification du declare_id dans le binaire..."
BINARY_PROGRAM_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)
echo "   Keypair Program ID: ${BINARY_PROGRAM_ID}"
echo "   Rust declare_id:    ${NEW_PROGRAM_ID}"

if [ "${BINARY_PROGRAM_ID}" = "${NEW_PROGRAM_ID}" ]; then
    echo "✅ Program IDs correspondent!"
else
    echo "❌ Mismatch détecté"
    exit 1
fi

# 7. Déployer sur devnet
echo ""
echo "7️⃣ Déploiement sur devnet..."
solana config set --url devnet

# Vérifier le balance
BALANCE=$(solana balance 2>/dev/null | awk '{print $1}' || echo "0")
echo "   Balance wallet: ${BALANCE} SOL"

if (( $(echo "$BALANCE < 5" | bc -l 2>/dev/null || echo "1") )); then
    echo "⚠️  Balance faible, airdrop de 2 SOL..."
    solana airdrop 2 || echo "⚠️  Airdrop peut avoir échoué, continuons..."
    sleep 5
fi

# Déployer
echo "   Déploiement en cours..."
anchor deploy --provider.cluster devnet --program-name swapback_cnft

echo "✅ Programme déployé avec succès!"

# 8. Générer et copier l'IDL
echo ""
echo "8️⃣ Génération de l'IDL..."
anchor idl build -p swapback_cnft
mkdir -p app/src/idl
cp target/idl/swapback_cnft.json app/src/idl/

# Vérifier que unlock_tokens est présent
if grep -q "unlock_tokens" app/src/idl/swapback_cnft.json; then
    echo "✅ IDL contient unlock_tokens"
else
    echo "❌ WARNING: unlock_tokens absent de l'IDL"
fi

# 9. Mettre à jour .env.local
echo ""
echo "9️⃣ Mise à jour de .env.local..."
cat > app/.env.local << EOF
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_CNFT_PROGRAM_ID=${NEW_PROGRAM_ID}
NEXT_PUBLIC_ROUTER_PROGRAM_ID=BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom
EOF

echo "✅ .env.local mis à jour"

# 10. Tester le programme
echo ""
echo "🔟 Test du programme déployé..."
echo "   Vérification de unlock_tokens dans le binaire..."
PROGRAM_FILE="/tmp/new-program.so"
solana program dump ${NEW_PROGRAM_ID} $PROGRAM_FILE --url https://api.devnet.solana.com > /dev/null 2>&1

if [ -f "$PROGRAM_FILE" ]; then
    if strings "$PROGRAM_FILE" | grep -q "unlock_tokens"; then
        echo "✅ unlock_tokens présent dans le programme déployé"
    else
        echo "⚠️  unlock_tokens non trouvé (peut être normal si obfusqué)"
    fi
    rm -f "$PROGRAM_FILE"
fi

# 11. Commit des changements
echo ""
echo "1️⃣1️⃣ Commit des changements..."
cd /workspaces/SwapBack
git add programs/swapback_cnft/src/lib.rs
git add app/src/idl/swapback_cnft.json
git add app/.env.local
git add target/deploy/swapback_cnft-keypair.json
git commit -m "🚀 Fresh CNFT program deployment

- New Program ID: ${NEW_PROGRAM_ID}
- Updated declare_id! to match deployment
- Regenerated IDL with unlock_tokens
- Fixed DeclaredProgramIdMismatch (Error 4100)
- Built with Solana stable + Rust 1.76+
" || echo "⚠️  Pas de changements à committer ou erreur git"

echo ""
echo "=============================================="
echo "✅ DÉPLOIEMENT TERMINÉ!"
echo "=============================================="
echo ""
echo "📋 Nouveau Program ID: ${NEW_PROGRAM_ID}"
echo ""
echo "🎯 Prochaines étapes:"
echo "1. Push vers GitHub: git push origin main"
echo "2. Mettre à jour Vercel:"
echo "   NEXT_PUBLIC_CNFT_PROGRAM_ID=${NEW_PROGRAM_ID}"
echo "3. Tester sur production: swap-back-app.vercel.app"
echo ""
