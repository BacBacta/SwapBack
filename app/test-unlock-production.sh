#!/bin/bash

echo "================================================"
echo "🧪 TEST UNLOCK PRODUCTION"
echo "================================================"
echo ""

# Configuration
PROGRAM_ID="9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq"
RPC_URL="https://api.devnet.solana.com"

echo "📋 Configuration:"
echo "   Program ID: $PROGRAM_ID"
echo "   RPC: $RPC_URL"
echo ""

# Vérifier que le programme existe
echo "1️⃣ Vérification du programme..."
PROGRAM_EXISTS=$(solana program show $PROGRAM_ID --url $RPC_URL 2>&1)
if echo "$PROGRAM_EXISTS" | grep -q "Program Id"; then
    echo "   ✅ Programme trouvé sur devnet"
    echo "$PROGRAM_EXISTS" | head -5
else
    echo "   ❌ Programme introuvable"
    exit 1
fi
echo ""

# Vérifier l'instruction unlock_tokens dans le binaire
echo "2️⃣ Vérification de l'instruction unlock_tokens..."
PROGRAM_FILE="/tmp/program-$PROGRAM_ID.so"
solana program dump $PROGRAM_ID $PROGRAM_FILE --url $RPC_URL > /dev/null 2>&1

if [ -f "$PROGRAM_FILE" ]; then
    if strings "$PROGRAM_FILE" | grep -q "unlock_tokens"; then
        echo "   ✅ Instruction unlock_tokens présente"
    else
        echo "   ❌ Instruction unlock_tokens absente"
        rm -f "$PROGRAM_FILE"
        exit 1
    fi
    rm -f "$PROGRAM_FILE"
else
    echo "   ⚠️  Impossible de dumper le programme (permissions?)"
fi
echo ""

# Vérifier l'IDL
echo "3️⃣ Vérification de l'IDL..."
if [ -f "/workspaces/SwapBack/target/idl/swapback_cnft.json" ]; then
    if grep -q "unlock_tokens" "/workspaces/SwapBack/target/idl/swapback_cnft.json"; then
        echo "   ✅ unlock_tokens dans l'IDL"
    else
        echo "   ❌ unlock_tokens manquant dans l'IDL"
        exit 1
    fi
else
    echo "   ⚠️  IDL non trouvé (normal si pas de build local)"
fi
echo ""

# Test de simulation (nécessite une transaction réelle)
echo "4️⃣ Préparation du test de simulation..."
echo "   ℹ️  Pour tester réellement:"
echo ""
echo "   A. Sur l'interface Vercel:"
echo "      - Connecter un wallet avec un NFT locké"
echo "      - Cliquer sur 'Unlock'"
echo "      - Observer les logs de transaction"
echo ""
echo "   B. Vérifier les transactions sur Solana Explorer:"
echo "      https://explorer.solana.com/?cluster=devnet"
echo ""
echo "   C. Erreurs attendues à surveiller:"
echo "      - Error 4100: DeclaredProgramIdMismatch (connu, voir si ça bloque)"
echo "      - Error 101: InstructionFallbackNotFound (ne devrait PAS arriver)"
echo "      - Account not provided (ne devrait PAS arriver)"
echo ""

# Checklist finale
echo "================================================"
echo "✅ CHECKLIST DÉPLOIEMENT"
echo "================================================"
echo ""
echo "[ ] 1. Variable Vercel mise à jour:"
echo "       NEXT_PUBLIC_CNFT_PROGRAM_ID=$PROGRAM_ID"
echo ""
echo "[ ] 2. Redéploiement Vercel effectué"
echo ""
echo "[ ] 3. Test lock/unlock sur production:"
echo "       - Lock fonctionne"
echo "       - Unlock fonctionne"
echo "       - Tokens retournés à l'utilisateur"
echo ""
echo "[ ] 4. Pas d'erreur bloquante Error 4100"
echo ""
echo "[ ] 5. Monitoring activé sur:"
echo "       - Vercel Logs: https://vercel.com/bacbacta/swap-back-app/logs"
echo "       - Solana Explorer: https://explorer.solana.com/?cluster=devnet"
echo ""
echo "================================================"
echo ""
echo "💡 Si Error 4100 cause des problèmes:"
echo "   → Rollback: Remettre l'ancien Program ID"
echo "   → Planifier Option B: Upgrade Solana 1.19+"
echo ""
