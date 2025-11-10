#!/bin/bash
# Test de simulation Vercel - Vérifie que toutes les variables sont correctes

echo "🧪 SIMULATION ENVIRONNEMENT VERCEL"
echo "===================================="
echo ""

# Définir les variables comme sur Vercel
export NEXT_PUBLIC_SOLANA_NETWORK=devnet
export NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
export NEXT_PUBLIC_CNFT_PROGRAM_ID=9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
export NEXT_PUBLIC_ROUTER_PROGRAM_ID=BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
export NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
export NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
export NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR
export NEXT_PUBLIC_MERKLE_TREE=93Tzc7btocwzDSbscW9EfL9dBzWLx85FHE6zeWrwHbNT
export NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom

echo "✅ Variables définies:"
echo "   NEXT_PUBLIC_SOLANA_NETWORK=$NEXT_PUBLIC_SOLANA_NETWORK"
echo "   NEXT_PUBLIC_CNFT_PROGRAM_ID=$NEXT_PUBLIC_CNFT_PROGRAM_ID"
echo "   NEXT_PUBLIC_ROUTER_PROGRAM_ID=$NEXT_PUBLIC_ROUTER_PROGRAM_ID"
echo "   NEXT_PUBLIC_BACK_MINT=$NEXT_PUBLIC_BACK_MINT"
echo ""

# Vérifier que les IDL correspondent
echo "📋 Vérification des IDL..."
CNFT_IDL_ADDRESS=$(grep -A 1 '"address"' app/src/idl/swapback_cnft.json | head -1 | cut -d'"' -f4)
ROUTER_IDL_ADDRESS=$(grep '"address"' app/src/idl/swapback_router.json | tail -1 | cut -d'"' -f4)

echo "   IDL cNFT: $CNFT_IDL_ADDRESS"
echo "   Env cNFT: $NEXT_PUBLIC_CNFT_PROGRAM_ID"

if [ "$CNFT_IDL_ADDRESS" = "$NEXT_PUBLIC_CNFT_PROGRAM_ID" ]; then
    echo "   ✅ CNFT Program ID MATCH"
else
    echo "   ❌ CNFT Program ID MISMATCH!"
    exit 1
fi

echo "   IDL Router: $ROUTER_IDL_ADDRESS"
echo "   Env Router: $NEXT_PUBLIC_ROUTER_PROGRAM_ID"

if [ "$ROUTER_IDL_ADDRESS" = "$NEXT_PUBLIC_ROUTER_PROGRAM_ID" ]; then
    echo "   ✅ Router Program ID MATCH"
else
    echo "   ❌ Router Program ID MISMATCH!"
    exit 1
fi

echo ""
echo "📦 Test de build Next.js..."
cd app

# Clean
rm -rf .next

# Build
echo "   Building..."
npm run build 2>&1 | tail -20

if [ $? -eq 0 ]; then
    echo "   ✅ BUILD RÉUSSI"
else
    echo "   ❌ BUILD ÉCHOUÉ"
    exit 1
fi

echo ""
echo "===================================="
echo "✅ TOUS LES TESTS PASSÉS"
echo "===================================="
echo ""
echo "📝 Si Vercel continue de planter:"
echo "   1. Vérifiez les logs de build sur Vercel"
echo "   2. Assurez-vous d'avoir fait 'Redeploy' SANS cache"
echo "   3. Vérifiez la console du navigateur (F12)"
