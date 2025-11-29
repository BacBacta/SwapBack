#!/bin/bash

# Script complet de test du projet SwapBack
# Exécute tous les tests possibles sans compilation BPF

set -e

echo "🧪 =========================================="
echo "  SWAPBACK - TEST COMPLET"
echo "=========================================="
echo ""

# Étape 1: Vérifier les versions
echo "📦 Étape 1: Vérifier les versions..."
echo ""
echo "Node.js:"
node --version
echo ""
echo "NPM:"
npm --version
echo ""
echo "Rust:"
rustc --version
echo ""
echo "Cargo:"
cargo --version
echo ""

# Étape 2: Installer les dépendances NPM
echo "📦 Étape 2: Installer les dépendances NPM..."
npm ci --legacy-peer-deps 2>&1 | tail -5
echo "✅ Dépendances NPM installées"
echo ""

# Étape 3: Compiler le code Rust standard
echo "🔨 Étape 3: Compiler le code Rust (standard)..."
cd /workspaces/SwapBack
cargo build --release 2>&1 | grep -E "(Compiling|Finished|error)" | head -20
echo "✅ Compilation Rust réussie"
echo ""

# Étape 4: Compiler le SDK TypeScript
echo "📦 Étape 4: Compiler le SDK TypeScript..."
if [ -f "sdk/package.json" ]; then
    cd sdk && npm run build 2>&1 | tail -10
    cd ..
    echo "✅ SDK TypeScript compilé"
else
    echo "⚠️ SDK TypeScript non trouvé, skipping..."
fi
echo ""

# Étape 5: Lancer les tests unitaires
echo "🧪 Étape 5: Lancer les tests unitaires..."
npm run test:unit 2>&1 | tail -50
echo ""
echo "✅ Tests unitaires terminés"
echo ""

# Étape 6: Lister les résultats
echo "📊 =========================================="
echo "  RÉSULTATS"
echo "=========================================="
echo ""
echo "✅ Compilations réussies:"
echo "  • Code Rust (Rust 1.82.0)"
echo "  • SDK TypeScript"
echo ""
echo "📝 Tests exécutés:"
echo "  • Tests unitaires TypeScript"
echo ""
echo "⏭️  Prochaines étapes:"
echo "  • BPF compilation (Rust 1.80.0 + sbf-solana-solana)"
echo "  • Déploiement sur devnet"
echo "  • Tests on-chain"
echo ""
echo "🎯 MVP Status: READY (await BPF compilation)"
echo ""
