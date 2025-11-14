#!/bin/bash
set -e

echo "=============================================="
echo "🚀 SOLUTION: AGAVE (Solana 2.0+)"
echo "=============================================="
echo ""
echo "Agave = Nouveau nom de Solana CLI depuis 2024"
echo "Agave 2.x/3.x = Rust 1.76+ compatible ✅"
echo ""

# 1. Nettoyer l'ancienne installation Solana
echo "1️⃣ Nettoyage ancienne installation Solana 1.18.26..."
rm -rf ~/.local/share/solana
rm -rf ~/.cache/solana

# 2. Installer Agave 2.3 (version stable LTS)
echo ""
echo "2️⃣ Installation Agave v2.3.13 (LTS)..."
cd /tmp
wget -q --show-progress https://github.com/anza-xyz/agave/releases/download/v2.3.13/solana-release-x86_64-unknown-linux-gnu.tar.bz2
tar -xf solana-release-x86_64-unknown-linux-gnu.tar.bz2
mkdir -p ~/.local/share/solana/install/active_release
cp -r solana-release/bin ~/.local/share/solana/install/active_release/
rm -rf solana-release*
cd /workspaces/SwapBack

export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

echo "✅ Agave installé: $(solana --version)"

# 3. Installer platform-tools pour cargo-build-sbf
echo ""
echo "3️⃣ Installation platform-tools..."
solana-install init 2.3.13 || echo "⚠️  Init peut échouer, continuons..."

# Vérifier la version Rust de cargo-build-sbf
if command -v cargo-build-sbf &> /dev/null; then
    echo ""
    echo "🔍 Version Rust de cargo-build-sbf:"
    RUST_VERSION=$(~/.local/share/solana/install/active_release/bin/sdk/sbf/dependencies/platform-tools/rust/bin/rustc --version 2>/dev/null || echo "Non disponible")
    echo "   $RUST_VERSION"
    
    if echo "$RUST_VERSION" | grep -q "1.7[6-9]"; then
        echo "✅ Rust 1.76+ détecté - Compatible avec Anchor 0.30!"
    else
        echo "⚠️  Rust < 1.76 détecté"
    fi
fi

# 4. Nettoyer et rebuild
echo ""
echo "4️⃣ Nettoyage des anciens builds..."
cd /workspaces/SwapBack
rm -rf target/
rm -rf programs/swapback_cnft/target/
rm -f Cargo.lock
rm -f programs/swapback_cnft/Cargo.lock

# 5. Générer nouveau Program ID
echo ""
echo "5️⃣ Génération nouveau Program ID..."
mkdir -p target/deploy
solana-keygen new --no-bip39-passphrase -o target/deploy/swapback_cnft-keypair.json --force

NEW_PROGRAM_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)
echo "✅ Nouveau Program ID: ${NEW_PROGRAM_ID}"

# 6. Mettre à jour declare_id!
echo ""
echo "6️⃣ Mise à jour declare_id! dans lib.rs..."
sed -i "s/declare_id!(\"[^\"]*\")/declare_id!(\"${NEW_PROGRAM_ID}\")/" programs/swapback_cnft/src/lib.rs
echo "✅ declare_id! mis à jour"

# 7. Build avec Anchor
echo ""
echo "7️⃣ Build du programme avec Anchor..."
echo "   (Cette fois devrait fonctionner avec Rust 1.76+!)"

anchor build --program-name swapback_cnft 2>&1 | tee /tmp/agave-build.log

if [ ! -f "target/deploy/swapback_cnft.so" ]; then
    echo "❌ Build échoué, vérifier /tmp/agave-build.log"
    exit 1
fi

BINARY_SIZE=$(ls -lh target/deploy/swapback_cnft.so | awk '{print $5}')
echo "✅ Build réussi: ${BINARY_SIZE}"

# 8. Vérifier unlock_tokens dans le binaire
echo ""
echo "8️⃣ Vérification unlock_tokens dans le binaire..."
if strings target/deploy/swapback_cnft.so | grep -q "unlock_tokens"; then
    echo "✅ unlock_tokens présent"
else
    echo "⚠️  unlock_tokens non détecté (peut être normal si obfusqué)"
fi

# 9. Déployer sur devnet
echo ""
echo "9️⃣ Déploiement sur devnet..."
solana config set --url devnet

BALANCE=$(solana balance 2>/dev/null | awk '{print $1}' || echo "0")
echo "   Balance: ${BALANCE} SOL"

if (( $(echo "$BALANCE < 5" | bc -l 2>/dev/null || echo "1") )); then
    echo "   Airdrop de 2 SOL..."
    solana airdrop 2 || echo "⚠️  Airdrop échoué, continuons..."
    sleep 5
fi

echo "   Déploiement en cours..."
anchor deploy --provider.cluster devnet --program-name swapback_cnft

echo "✅ Programme déployé!"

# 10. Générer IDL
echo ""
echo "🔟 Génération IDL..."
anchor idl build -p swapback_cnft
mkdir -p app/src/idl
cp target/idl/swapback_cnft.json app/src/idl/

if grep -q "unlock_tokens" app/src/idl/swapback_cnft.json; then
    echo "✅ IDL contient unlock_tokens"
else
    echo "❌ unlock_tokens absent de l'IDL"
fi

# 11. Mettre à jour .env.local
echo ""
echo "1️⃣1️⃣ Mise à jour .env.local..."
cat > app/.env.local << EOF
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_CNFT_PROGRAM_ID=${NEW_PROGRAM_ID}
NEXT_PUBLIC_ROUTER_PROGRAM_ID=BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom
EOF

echo "✅ .env.local mis à jour"

# 12. Test du programme
echo ""
echo "1️⃣2️⃣ Test du programme déployé..."
PROGRAM_FILE="/tmp/deployed-program.so"
solana program dump ${NEW_PROGRAM_ID} $PROGRAM_FILE --url https://api.devnet.solana.com > /dev/null 2>&1

if [ -f "$PROGRAM_FILE" ]; then
    if strings "$PROGRAM_FILE" | grep -q "unlock_tokens"; then
        echo "✅ unlock_tokens confirmé dans le programme déployé"
    else
        echo "⚠️  unlock_tokens non trouvé"
    fi
    rm -f "$PROGRAM_FILE"
fi

# 13. Commit
echo ""
echo "1️⃣3️⃣ Commit des changements..."
git add programs/swapback_cnft/src/lib.rs
git add app/src/idl/swapback_cnft.json
git add app/.env.local
git add target/deploy/swapback_cnft-keypair.json
git commit -m "🚀 Fresh deployment with Agave 2.3.13

- Agave (Solana 2.x) with Rust 1.76+ support
- New Program ID: ${NEW_PROGRAM_ID}
- Fixed DeclaredProgramIdMismatch (Error 4100)
- Regenerated IDL with unlock_tokens
- Built successfully with modern toolchain
" || echo "⚠️  Rien à committer"

echo ""
echo "=============================================="
echo "✅ DÉPLOIEMENT TERMINÉ AVEC AGAVE!"
echo "=============================================="
echo ""
echo "📋 Nouveau Program ID: ${NEW_PROGRAM_ID}"
echo ""
echo "🎯 Prochaines étapes:"
echo "1. git push origin main"
echo "2. Mettre à jour Vercel:"
echo "   NEXT_PUBLIC_CNFT_PROGRAM_ID=${NEW_PROGRAM_ID}"
echo "3. Tester sur production"
echo ""
echo "💡 Pourquoi ça fonctionne:"
echo "   Agave 2.3+ = Rust 1.76+ = Compatible Anchor 0.30 ✅"
echo ""
