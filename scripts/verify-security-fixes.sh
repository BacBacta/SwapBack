#!/bin/bash
# Script de vérification des actions correctives - SwapBack
# Date: 25 Novembre 2025

set -e

echo "🔍 ======================================"
echo "   VÉRIFICATION DES ACTIONS CORRECTIVES"
echo "   SwapBack Security Audit Follow-up"
echo "========================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
PASSED=0
FAILED=0

check_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    PASSED=$((PASSED + 1))
}

check_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    FAILED=$((FAILED + 1))
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

echo "📋 CHECK 1: Version Rust"
echo "------------------------"
RUST_VERSION=$(rustc --version | grep -oP '\d+\.\d+' | head -1)
if [[ $(echo "$RUST_VERSION >= 1.80" | bc -l) -eq 1 ]]; then
    check_pass "Rust version $RUST_VERSION (>= 1.80 requis)"
else
    check_fail "Rust version $RUST_VERSION (< 1.80 BLOQUANT)"
fi
echo ""

echo "📋 CHECK 2: Validations CPI Buyback"
echo "-----------------------------------"
if grep -q "InvalidVaultOwner" programs/swapback_buyback/src/lib.rs; then
    check_pass "Code d'erreur InvalidVaultOwner présent"
else
    check_fail "Code d'erreur InvalidVaultOwner manquant"
fi

if grep -q "usdc_vault.owner == buyback_state.key()" programs/swapback_buyback/src/lib.rs; then
    check_pass "Validation owner du vault présente"
else
    check_fail "Validation owner du vault manquante"
fi

if grep -q "InvalidVaultMint" programs/swapback_buyback/src/lib.rs; then
    check_pass "Code d'erreur InvalidVaultMint présent"
else
    check_fail "Code d'erreur InvalidVaultMint manquant"
fi
echo ""

echo "📋 CHECK 3: Protection Slippage"
echo "-------------------------------"
if grep -q "InvalidSwapAmounts" programs/swapback_buyback/src/lib.rs; then
    check_pass "Code d'erreur InvalidSwapAmounts présent"
else
    check_fail "Code d'erreur InvalidSwapAmounts manquant"
fi

if grep -q "InvalidBackReceived" programs/swapback_buyback/src/lib.rs; then
    check_pass "Code d'erreur InvalidBackReceived présent"
else
    check_fail "Code d'erreur InvalidBackReceived manquant"
fi

if grep -q "back_vault.amount >= back_received" programs/swapback_buyback/src/lib.rs; then
    check_pass "Validation montant reçu présente"
else
    check_fail "Validation montant reçu manquante"
fi
echo ""

echo "📋 CHECK 4: Limite Montant Max Router"
echo "-------------------------------------"
if grep -q "SwapAmountExceedsMaximum" programs/swapback_router/src/lib.rs; then
    check_pass "Code d'erreur SwapAmountExceedsMaximum présent"
else
    check_fail "Code d'erreur SwapAmountExceedsMaximum manquant"
fi

if grep -q "args.amount_in <= MAX_SINGLE_SWAP_LAMPORTS" programs/swapback_router/src/lib.rs; then
    check_pass "Validation montant max présente"
else
    check_fail "Validation montant max manquante"
fi
echo ""

echo "📋 CHECK 5: Token-2022 Compatibility"
echo "------------------------------------"
if grep -q "transfer_checked" programs/swapback_buyback/src/lib.rs; then
    check_pass "Utilisation de transfer_checked (Token-2022)"
else
    check_warn "transfer_checked non trouvé (vérifie manuellement)"
fi
echo ""

echo "📋 CHECK 6: Compilation"
echo "----------------------"
if cargo check --package swapback_buyback --package swapback_router --quiet 2>&1 | grep -q "error:"; then
    check_fail "Erreurs de compilation détectées"
else
    check_pass "Compilation réussie (0 erreurs)"
fi
echo ""

echo "📋 CHECK 7: Unwraps en Production"
echo "---------------------------------"
UNWRAPS_PROD=$(grep -n "\.unwrap()" programs/swapback_router/src/lib.rs programs/swapback_buyback/src/lib.rs | grep -v "#\[cfg(test)\]" | grep -v "^.*tests::" | wc -l || echo "0")
if [ "$UNWRAPS_PROD" -eq 0 ]; then
    check_pass "Aucun unwrap() en code production"
else
    check_warn "$UNWRAPS_PROD unwrap() trouvés (vérifier qu'ils sont dans tests)"
fi
echo ""

echo "📋 CHECK 8: Checked Arithmetic"
echo "------------------------------"
CHECKED_OPS=$(grep -h "checked_" programs/swapback_router/src/lib.rs programs/swapback_buyback/src/lib.rs 2>/dev/null | wc -l || echo "0")
if [ "$CHECKED_OPS" -gt 50 ]; then
    check_pass "$CHECKED_OPS opérations checked_* trouvées (>50 requis)"
else
    check_fail "$CHECKED_OPS opérations checked_* trouvées (<50 INSUFFISANT)"
fi
echo ""

echo "📋 CHECK 9: Documentation"
echo "------------------------"
if [ -f "ACTIONS_CORRECTIVES_25NOV2025.md" ]; then
    check_pass "Rapport des actions correctives créé"
else
    check_fail "Rapport des actions correctives manquant"
fi
echo ""

# Résumé
echo "======================================"
echo "           RÉSUMÉ FINAL"
echo "======================================"
echo ""
echo "Tests réussis: ${GREEN}$PASSED${NC}"
echo "Tests échoués: ${RED}$FAILED${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}🎉 TOUS LES CHECKS SONT PASSÉS !${NC}"
    echo ""
    echo "✅ Les actions correctives ont été implémentées avec succès."
    echo "✅ Le code est prêt pour les tests unitaires et le fuzzing."
    echo ""
    echo "Prochaines étapes:"
    echo "  1. cargo test --package swapback_buyback --package swapback_router"
    echo "  2. Lancer fuzzing 24h+"
    echo "  3. Déployer sur devnet pour tests E2E"
    exit 0
else
    echo -e "${RED}⚠️  CERTAINS CHECKS ONT ÉCHOUÉ !${NC}"
    echo ""
    echo "❌ Corriger les problèmes identifiés avant de continuer."
    echo "📖 Consulter: ACTIONS_CORRECTIVES_25NOV2025.md"
    exit 1
fi
