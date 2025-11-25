#!/bin/bash

# Script de benchmark des performances du routeur SwapBack
# Compare SwapBack vs Jupiter et mesure les métriques

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        📊 BENCHMARK ROUTEUR SWAPBACK                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

WALLET=$(solana address)
WSOL_MINT="So11111111111111111111111111111111111111112"
USDC_MINT="${NEXT_PUBLIC_USDC_MINT:-BinixfcaLhR1JnLvRJgVTqYz2wHoUvT3mSJW5xmyGpF}"

echo "Configuration:"
echo "  Wallet: $WALLET"
echo "  wSOL: $WSOL_MINT"
echo "  USDC: $USDC_MINT"
echo ""

# Vérifier que Node.js est disponible
if ! command -v node &> /dev/null; then
  echo "❌ Node.js non trouvé"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📈 Test 1: Mesure des temps d'exécution"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node << 'EOF'
const { Connection, PublicKey } = require('@solana/web3.js');

async function benchmarkRouterState() {
  console.log('🔗 Connexion au RPC...');
  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    'confirmed'
  );
  
  const ROUTER_PROGRAM = new PublicKey('9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh');
  
  // Test 1: Temps de réponse RPC
  console.log('\n📡 Test latence RPC:');
  const rpcTests = [];
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    await connection.getLatestBlockhash();
    const elapsed = Date.now() - start;
    rpcTests.push(elapsed);
    console.log(`   Requête ${i + 1}: ${elapsed}ms`);
  }
  const avgRpc = rpcTests.reduce((a, b) => a + b, 0) / rpcTests.length;
  console.log(`   ✅ Moyenne: ${avgRpc.toFixed(0)}ms`);
  
  // Test 2: Temps de fetch des comptes
  console.log('\n📦 Test fetch comptes du programme:');
  const start = Date.now();
  const accounts = await connection.getProgramAccounts(ROUTER_PROGRAM);
  const elapsed = Date.now() - start;
  console.log(`   Comptes trouvés: ${accounts.length}`);
  console.log(`   ✅ Temps: ${elapsed}ms`);
  
  // Test 3: Taille des données
  const totalSize = accounts.reduce((sum, acc) => sum + acc.account.data.length, 0);
  console.log(`   📊 Données totales: ${(totalSize / 1024).toFixed(2)} KB`);
  
  // Test 4: Calculer les PDAs
  console.log('\n🔑 Test calcul PDAs:');
  const pdaStart = Date.now();
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('router_state')],
    ROUTER_PROGRAM
  );
  const pdaElapsed = Date.now() - pdaStart;
  console.log(`   State PDA: ${statePda.toBase58()}`);
  console.log(`   ✅ Temps: ${pdaElapsed}ms`);
  
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 Résumé Performance:');
  console.log(`   Latence RPC moyenne: ${avgRpc.toFixed(0)}ms`);
  console.log(`   Fetch ${accounts.length} comptes: ${elapsed}ms`);
  console.log(`   Calcul PDA: ${pdaElapsed}ms`);
  
  // Métriques
  if (avgRpc < 100) {
    console.log('\n   ✅ EXCELLENT - Latence RPC < 100ms');
  } else if (avgRpc < 300) {
    console.log('\n   ⚠️  BON - Latence RPC < 300ms');
  } else {
    console.log('\n   ❌ LENT - Latence RPC > 300ms');
  }
}

benchmarkRouterState().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📈 Test 2: Analyse des plans DCA existants"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node << 'EOF'
const { Connection, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');

async function analyzeDCAPlans() {
  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    'confirmed'
  );
  
  const ROUTER_PROGRAM = new PublicKey('9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh');
  const DCA_DISCRIMINATOR = Buffer.from([231, 97, 112, 227, 171, 241, 52, 84]);
  
  console.log('🔍 Recherche des plans DCA...\n');
  
  const accounts = await connection.getProgramAccounts(ROUTER_PROGRAM, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: bs58.encode(DCA_DISCRIMINATOR),
        },
      },
    ],
  });
  
  console.log(`📦 Plans DCA trouvés: ${accounts.length}\n`);
  
  if (accounts.length === 0) {
    console.log('⚠️  Aucun plan DCA actif');
    console.log('   Créer un plan via: https://swap-back-mauve.vercel.app/dca\n');
    return;
  }
  
  let totalInvested = 0n;
  let totalExecuted = 0;
  let activePlans = 0;
  
  accounts.forEach((acc, idx) => {
    const data = acc.account.data;
    
    // Parse les données
    const executedSwaps = data.readUInt32LE(136);
    const totalSwaps = data.readUInt32LE(132);
    const isActive = data.readUInt8(172) !== 0;
    const amountPerSwap = data.readBigUInt64LE(104);
    const invested = data.readBigUInt64LE(173);
    
    if (isActive) activePlans++;
    totalExecuted += executedSwaps;
    totalInvested += invested;
    
    console.log(`Plan ${idx + 1}: ${acc.pubkey.toBase58().slice(0, 8)}...`);
    console.log(`   Progression: ${executedSwaps}/${totalSwaps} swaps`);
    console.log(`   Montant/swap: ${Number(amountPerSwap) / 1e9} tokens`);
    console.log(`   Investi total: ${Number(invested) / 1e9} tokens`);
    console.log(`   Statut: ${isActive ? '🟢 ACTIF' : '🔴 INACTIF'}`);
    console.log('');
  });
  
  console.log('═'.repeat(60));
  console.log('\n📊 Statistiques Globales:');
  console.log(`   Plans actifs: ${activePlans}/${accounts.length}`);
  console.log(`   Swaps exécutés: ${totalExecuted}`);
  console.log(`   Volume investi: ${Number(totalInvested) / 1e9} tokens`);
  console.log('');
}

analyzeDCAPlans().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
EOF

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Benchmark terminé!"
echo ""
echo "📋 Prochaines étapes:"
echo ""
echo "1. Pour tester un swap réel:"
echo "   - Wraper du SOL: spl-token wrap 0.1"
echo "   - Aller sur: https://swap-back-mauve.vercel.app"
echo "   - Effectuer un swap et noter les métriques"
echo ""
echo "2. Pour tester le DCA automatique:"
echo "   - Créer un plan DCA avec fréquence 5 minutes"
echo "   - Lancer: ./scripts/start-dca-keeper.sh"
echo "   - Observer l'exécution automatique"
echo ""
echo "3. Pour comparer avec Jupiter:"
echo "   - Noter le prix obtenu sur SwapBack"
echo "   - Vérifier le prix sur Jupiter (onglet dans l'interface)"
echo "   - Calculer la différence: (SwapBack / Jupiter) * 100"
echo ""
