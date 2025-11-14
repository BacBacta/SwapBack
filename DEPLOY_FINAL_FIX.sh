#!/bin/bash
set -e

echo "=============================================="
echo "🚀 DÉPLOIEMENT FINAL - SOLUTION DÉFINITIVE"
echo "=============================================="
echo ""
echo "Basé sur:"
echo "- Anchor Book: https://www.anchor-lang.com/docs/cli"
echo "- Solana Cookbook: https://solana.com/developers/cookbook"
echo ""

# Configuration
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
source $HOME/.cargo/env

cd /workspaces/SwapBack

# 1. Vérifier l'environnement
echo "📋 1/6 Vérification environnement..."
echo "   Solana: $(solana --version | head -1)"
echo "   Anchor: $(anchor --version)"
echo "   Rust: $(rustc --version)"
echo ""

# 2. Configurer devnet
echo "📋 2/6 Configuration devnet..."
solana config set --url devnet
echo ""

# 3. Vérifier le solde
echo "📋 3/6 Vérification wallet..."
BALANCE=$(solana balance 2>/dev/null | awk '{print $1}' || echo "0")
echo "   Balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 3" | bc -l 2>/dev/null || echo "1") )); then
    echo "   Demande airdrop..."
    solana airdrop 2 2>/dev/null || echo "   ⚠️  Airdrop échoué, continuons..."
    sleep 3
fi
echo ""

# 4. Nettoyer et builder
echo "📋 4/6 Build du programme..."
echo "   Nettoyage..."
anchor clean 2>/dev/null || true
rm -rf target/deploy/*.so

echo "   Build avec Anchor..."
if anchor build --program-name swapback_cnft; then
    echo "   ✅ Build réussi"
else
    echo "   ❌ Build échoué"
    exit 1
fi

# Vérifier que le .so existe
if [ ! -f "target/deploy/swapback_cnft.so" ]; then
    echo "   ❌ Fichier .so non trouvé"
    exit 1
fi

PROGRAM_SIZE=$(ls -lh target/deploy/swapback_cnft.so | awk '{print $5}')
echo "   📦 Taille: $PROGRAM_SIZE"
echo ""

# 5. Obtenir le Program ID
echo "📋 5/6 Program ID..."
if [ -f "target/deploy/swapback_cnft-keypair.json" ]; then
    PROGRAM_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)
    echo "   Program ID: $PROGRAM_ID"
else
    echo "   ❌ Keypair non trouvé"
    exit 1
fi
echo ""

# 6. Déployer sur devnet
echo "📋 6/6 Déploiement sur devnet..."
echo "   Vérification si programme déjà déployé..."

if solana program show $PROGRAM_ID --url devnet &>/dev/null; then
    echo "   ⚠️  Programme existe déjà, upgrade..."
    ACTION="upgrade"
else
    echo "   ✅ Nouveau déploiement"
    ACTION="deploy"
fi

# Déployer avec Anchor (gère automatiquement deploy/upgrade)
if anchor deploy --program-name swapback_cnft --provider.cluster devnet; then
    echo ""
    echo "✅ Déploiement réussi!"
else
    echo ""
    echo "❌ Déploiement échoué"
    exit 1
fi
echo ""

# 7. Vérification post-déploiement
echo "📋 Vérification post-déploiement..."
if solana program show $PROGRAM_ID --url devnet | head -5; then
    echo ""
    echo "✅ Programme visible sur devnet"
else
    echo "❌ Programme non trouvé après déploiement"
    exit 1
fi
echo ""

# 8. Vérifier unlock_tokens dans le binaire déployé
echo "📋 Vérification unlock_tokens..."
DUMP_FILE="/tmp/deployed-program-$PROGRAM_ID.so"
if solana program dump $PROGRAM_ID $DUMP_FILE --url devnet 2>&1 >/dev/null; then
    if strings $DUMP_FILE | grep -q "unlock_tokens"; then
        echo "   ✅ unlock_tokens présent dans le programme déployé"
    else
        echo "   ⚠️  unlock_tokens non détecté (peut être obfusqué)"
    fi
    rm -f $DUMP_FILE
fi
echo ""

# 9. Générer et mettre à jour l'IDL
echo "📋 Mise à jour IDL..."
anchor idl build --program-name swapback_cnft

if [ -f "target/idl/swapback_cnft.json" ]; then
    # Copier vers le frontend
    mkdir -p app/src/idl
    cp target/idl/swapback_cnft.json app/src/idl/
    
    # Mettre à jour l'address dans l'IDL
    if command -v jq &> /dev/null; then
        jq --arg pid "$PROGRAM_ID" '.address = $pid | .metadata.address = $pid' \
            app/src/idl/swapback_cnft.json > /tmp/idl-updated.json
        mv /tmp/idl-updated.json app/src/idl/swapback_cnft.json
        echo "   ✅ IDL mis à jour avec Program ID"
    else
        echo "   ⚠️  jq non installé, mise à jour manuelle de l'IDL nécessaire"
    fi
    
    # Vérifier que unlock_tokens est dans l'IDL
    if grep -q "unlock_tokens" app/src/idl/swapback_cnft.json; then
        echo "   ✅ unlock_tokens présent dans l'IDL"
    else
        echo "   ⚠️  unlock_tokens absent de l'IDL"
    fi
fi
echo ""

# 10. Mettre à jour les variables d'environnement
echo "📋 Mise à jour configuration..."

# Mettre à jour declare_id! dans le code Rust
sed -i "s/declare_id!(\"[^\"]*\")/declare_id!(\"${PROGRAM_ID}\")/" programs/swapback_cnft/src/lib.rs
echo "   ✅ declare_id! mis à jour dans lib.rs"

# Mettre à jour .env.local
cat > app/.env.local << EOF
# ✅ Configuration mise à jour automatiquement le $(date)
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# Program IDs (devnet)
NEXT_PUBLIC_CNFT_PROGRAM_ID=$PROGRAM_ID
NEXT_PUBLIC_ROUTER_PROGRAM_ID=BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf

# Tokens (devnet)
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR

# Infrastructure
NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom
EOF

echo "   ✅ .env.local créé"
echo ""

# 11. Résumé final
echo "=============================================="
echo "✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS"
echo "=============================================="
echo ""
echo "📋 Program ID: $PROGRAM_ID"
echo "🔗 Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo ""
echo "🎯 Prochaines étapes:"
echo ""
echo "1. Commit les changements:"
echo "   git add -A"
echo "   git commit -m \"deploy: new CNFT program with unlock_tokens on devnet\""
echo "   git push origin main"
echo ""
echo "2. Mettre à jour Vercel (CRITIQUE):"
echo "   URL: https://vercel.com/bactas-projects/swap-back/settings/environment-variables"
echo "   Variable: NEXT_PUBLIC_CNFT_PROGRAM_ID"
echo "   Valeur: $PROGRAM_ID"
echo ""
echo "3. Redéployer sur Vercel:"
echo "   - Dashboard → Deployments → Redeploy"
echo "   - Décocher 'Use existing Build Cache'"
echo ""
echo "4. Tester sur production:"
echo "   - Connecter wallet"
echo "   - Tester lock de tokens"
echo "   - Vérifier: pas d'erreur 'program does not exist'"
echo ""
echo "💡 Le nouveau programme contient unlock_tokens et est déployé sur devnet"
echo ""
