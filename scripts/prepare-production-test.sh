#!/bin/bash

# Script pour préparer et tester le système DCA en mode réel
# Prépare les comptes nécessaires pour exécuter des swaps réels

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🚀 PRÉPARATION DCA PRODUCTION - MODE RÉEL               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

WALLET=$(solana address)
echo "👤 Wallet: $WALLET"
echo ""

# Configuration
WSOL_MINT="So11111111111111111111111111111111111111112"
USDC_MINT="${NEXT_PUBLIC_USDC_MINT:-BinixfcaLhR1JnLvRJgVTqYz2wHoUvT3mSJW5xmyGpF}"

echo "📋 Configuration:"
echo "   - wSOL Mint: $WSOL_MINT"
echo "   - USDC Mint: $USDC_MINT"
echo ""

# Vérifier la balance
BALANCE=$(solana balance | awk '{print $1}')
echo "💰 Balance actuelle: $BALANCE SOL"

if (( $(echo "$BALANCE < 0.5" | bc -l) )); then
  echo ""
  echo "⚠️  Balance insuffisante pour les tests!"
  echo ""
  echo "Solutions:"
  echo "  1. Devnet: solana airdrop 2"
  echo "  2. Mainnet: Transférer des SOL vers ce wallet"
  echo ""
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "ÉTAPE 1: Créer/vérifier les Associated Token Accounts (ATAs)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Fonction pour vérifier/créer un ATA
check_or_create_ata() {
  local mint=$1
  local token_name=$2
  
  echo "🔍 Vérification ATA pour $token_name ($mint)..."
  
  # Obtenir l'ATA
  local ata=$(spl-token accounts --owner "$WALLET" --token "$mint" 2>/dev/null | grep -A1 "Token" | tail -1 | awk '{print $1}')
  
  if [ -z "$ata" ]; then
    echo "   ⚠️  ATA non trouvé, création..."
    spl-token create-account "$mint" --owner "$WALLET"
    echo "   ✅ ATA créé!"
  else
    echo "   ✅ ATA existe: $ata"
    
    # Vérifier la balance
    local balance=$(spl-token balance "$mint" 2>/dev/null || echo "0")
    echo "   💰 Balance: $balance $token_name"
  fi
  echo ""
}

# Créer les ATAs
check_or_create_ata "$WSOL_MINT" "wSOL"
check_or_create_ata "$USDC_MINT" "USDC"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "ÉTAPE 2: Préparer les fonds pour les swaps de test"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Option A - Wrap du SOL natif en wSOL:"
echo ""
echo "  # Wrap 0.5 SOL pour les tests DCA"
echo "  spl-token wrap 0.5"
echo ""
echo "  # Vérifier le wSOL"
echo "  spl-token balance $WSOL_MINT"
echo ""

echo "Option B - Obtenir du USDC devnet:"
echo ""
echo "  # Sur devnet, utiliser le faucet ou échanger"
echo "  # https://spl-token-faucet.com/"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "ÉTAPE 3: Créer un plan DCA de test via l'interface web"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1. Ouvrir: https://swap-back-mauve.vercel.app/dca"
echo ""
echo "2. Connecter le wallet: $WALLET"
echo ""
echo "3. Créer un plan DCA de test:"
echo "   - Token In: SOL (wrapped)"
echo "   - Token Out: USDC"
echo "   - Amount per swap: 0.01 SOL"
echo "   - Frequency: Every 5 minutes (pour test rapide)"
echo "   - Total swaps: 3"
echo ""
echo "4. Attendre que le plan soit créé (vérifier la transaction)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "ÉTAPE 4: Lancer le keeper en mode production"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "  ./scripts/start-dca-keeper.sh"
echo ""
echo "Le keeper va:"
echo "  - Détecter le plan DCA"
echo "  - Attendre que nextExecution arrive"
echo "  - Exécuter automatiquement le swap"
echo "  - Logger les performances (temps, gas, etc.)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "ÉTAPE 5: Tester manuellement le routeur"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Pour tester les performances du routeur SwapBack:"
echo ""
echo "1. Interface Web:"
echo "   https://swap-back-mauve.vercel.app"
echo ""
echo "2. Effectuer des swaps manuels:"
echo "   - Swap SOL → USDC"
echo "   - Swap USDC → SOL"
echo "   - Comparer avec Jupiter (onglet Jupiter)"
echo ""
echo "3. Métriques à observer:"
echo "   - Temps d'exécution"
echo "   - Prix obtenu vs Jupiter"
echo "   - Frais de transaction"
echo "   - Slippage réel"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 TESTS DE PERFORMANCE RECOMMANDÉS"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat << 'TESTS'
Test 1: Petits swaps (0.01 SOL)
  - Objectif: Vérifier la viabilité économique
  - Métrique: Frais < 1% du montant swappé

Test 2: Swaps moyens (0.1 - 1 SOL)
  - Objectif: Tester la liquidité et le slippage
  - Métrique: Slippage < 1%

Test 3: Gros swaps (> 5 SOL)
  - Objectif: Stress test du routeur
  - Métrique: Routage optimal, multi-hop si nécessaire

Test 4: DCA automatique
  - Objectif: Vérifier l'exécution automatique
  - Métrique: Exécution dans les 60s après nextExecution

Test 5: Comparaison Jupiter
  - Objectif: Benchmark de performance
  - Métrique: Prix SwapBack >= 95% du prix Jupiter
TESTS

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Préparation terminée!"
echo ""
echo "Actions immédiates:"
echo "  1. Wrap du SOL: spl-token wrap 0.5"
echo "  2. Créer un plan DCA via l'interface web"
echo "  3. Lancer le keeper: ./scripts/start-dca-keeper.sh"
echo ""
