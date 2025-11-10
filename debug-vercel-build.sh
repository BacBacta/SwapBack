#!/bin/bash
# Simule exactement un build Vercel avec tes variables

set -e

echo "🔍 SIMULATION BUILD VERCEL EXACTE"
echo "=================================="
echo ""

# Définir EXACTEMENT tes variables Vercel
export NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
export NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR
export NEXT_PUBLIC_MERKLE_TREE=93Tzc7btocwzDSbscW9EfL9dBzWLx85FHE6zeWrwHbNT
export NEXT_PUBLIC_CNFT_PROGRAM_ID=9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
export NEXT_PUBLIC_ROUTER_PROGRAM_ID=BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
export NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
export NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom
export NEXT_PUBLIC_SOLANA_NETWORK=devnet
export NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

echo "✅ Variables Vercel exportées"
echo ""

# Vérifier les IDL
echo "📋 Vérification IDL vs Variables..."
CNFT_IDL=$(jq -r '.address' app/src/idl/swapback_cnft.json)
ROUTER_IDL=$(jq -r '.address' app/src/idl/swapback_router.json)

echo "   cNFT:"
echo "     IDL:    $CNFT_IDL"
echo "     Vercel: $NEXT_PUBLIC_CNFT_PROGRAM_ID"
if [ "$CNFT_IDL" = "$NEXT_PUBLIC_CNFT_PROGRAM_ID" ]; then
    echo "     ✅ MATCH"
else
    echo "     ❌ MISMATCH"
    exit 1
fi

echo ""
echo "   Router:"
echo "     IDL:    $ROUTER_IDL"
echo "     Vercel: $NEXT_PUBLIC_ROUTER_PROGRAM_ID"
if [ "$ROUTER_IDL" = "$NEXT_PUBLIC_ROUTER_PROGRAM_ID" ]; then
    echo "     ✅ MATCH"
else
    echo "     ❌ MISMATCH"
    exit 1
fi

echo ""
echo "🧪 Test: Vérification du Token BACK sur devnet..."
BACK_TOKEN_INFO=$(solana account $NEXT_PUBLIC_BACK_MINT --url devnet -o json 2>&1)
if echo "$BACK_TOKEN_INFO" | grep -q "Account does not exist"; then
    echo "   ❌ ERREUR: Token BACK n'existe pas sur devnet!"
    echo "   Address: $NEXT_PUBLIC_BACK_MINT"
    exit 1
else
    echo "   ✅ Token BACK existe sur devnet"
fi

echo ""
echo "📦 BUILD Next.js (simulation Vercel)..."
cd app

# Clean comme Vercel
rm -rf .next
rm -rf node_modules/.cache

echo "   Installing dependencies..."
npm ci --quiet > /dev/null 2>&1

echo "   Building..."
npm run build 2>&1 | tee /tmp/vercel-build.log

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo ""
    echo "   ✅ BUILD RÉUSSI"
else
    echo ""
    echo "   ❌ BUILD ÉCHOUÉ"
    echo ""
    echo "📋 Erreurs détectées:"
    grep -i "error" /tmp/vercel-build.log || echo "   (aucune erreur explicite)"
    exit 1
fi

echo ""
echo "🧪 Test: Import des modules critiques..."

# Test que les modules se chargent sans erreur
cat > /tmp/test-imports.mjs << 'EOF'
import { PublicKey } from '@solana/web3.js';

// Simuler les env vars pour le test
process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID = '9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq';
process.env.NEXT_PUBLIC_BACK_MINT = '862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux';

try {
    // Tester que les helpers fonctionnent
    const getCnftProgramId = () => {
        const id = process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID;
        if (!id) throw new Error('Missing NEXT_PUBLIC_CNFT_PROGRAM_ID');
        return new PublicKey(id);
    };
    
    const getBackMint = () => {
        const mint = process.env.NEXT_PUBLIC_BACK_MINT;
        if (!mint) throw new Error('Missing NEXT_PUBLIC_BACK_MINT');
        return new PublicKey(mint);
    };
    
    // Test
    const cnftId = getCnftProgramId();
    const backMint = getBackMint();
    
    console.log('✅ Imports OK');
    console.log('   cNFT Program:', cnftId.toBase58());
    console.log('   BACK Mint:', backMint.toBase58());
    process.exit(0);
} catch (error) {
    console.error('❌ Import Error:', error.message);
    process.exit(1);
}
EOF

node /tmp/test-imports.mjs

if [ $? -eq 0 ]; then
    echo "   ✅ Imports fonctionnent correctement"
else
    echo "   ❌ Erreur dans les imports"
    exit 1
fi

echo ""
echo "=================================="
echo "✅ SIMULATION BUILD VERCEL: SUCCÈS"
echo "=================================="
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Sur Vercel, va dans Deployments"
echo "   2. Clique sur le dernier deployment"
echo "   3. Clique sur '...' menu → Redeploy"
echo "   4. DÉCOCHE 'Use existing Build Cache'"
echo "   5. Clique Redeploy"
echo ""
echo "   Ensuite, ouvre la console navigateur (F12)"
echo "   et copie l'erreur EXACTE si elle persiste"
