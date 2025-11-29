#!/bin/bash

# =================================================================
# FIX BUILD RUST - SwapBack
# Solution: Recréer workspace propre avec anchor init
# Durée estimée: 30 minutes
# =================================================================

set -e  # Exit on error

echo "🚀 STARTING RUST BUILD FIX..."
echo "================================"

# Vérifier si anchor est installé
if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor CLI not found. Installing..."
    cargo install --locked anchor-cli@0.30.1 --force 2>&1 | tail -5
fi

echo "✅ Anchor version: $(anchor --version)"

# STEP 1: Sauvegarder le code actuel
echo ""
echo "📦 STEP 1: Backing up current code..."
mkdir -p /workspaces/backup_$(date +%s)
BACKUP_DIR="/workspaces/backup_$(date +%s)"
cp -r /workspaces/SwapBack/programs $BACKUP_DIR/
echo "✅ Backup created: $BACKUP_DIR/programs"

# STEP 2: Recréer le workspace
echo ""
echo "🔧 STEP 2: Creating clean Anchor workspace..."
cd /tmp
rm -rf swapback_clean 2>/dev/null || true
anchor init swapback_clean --no-git --force 2>&1 | grep -v "^warning"
cd swapback_clean

# STEP 3: Créer les programmes
echo ""
echo "📝 STEP 3: Creating programs (swapback_router, swapback_buyback)..."
cd programs
anchor new swapback_router --force 2>&1 | grep -v "^warning" || true
anchor new swapback_buyback --force 2>&1 | grep -v "^warning" || true
cd ..

# STEP 4: Copier le code source
echo ""
echo "📋 STEP 4: Copying source code from backup..."
cp $BACKUP_DIR/programs/swapback_router/src/lib.rs programs/swapback_router/src/lib.rs
cp $BACKUP_DIR/programs/swapback_buyback/src/lib.rs programs/swapback_buyback/src/lib.rs
cp $BACKUP_DIR/programs/common_swap programs/common_swap -r || true
echo "✅ Source code copied"

# STEP 5: Créer Cargo.toml workspace
echo ""
echo "⚙️  STEP 5: Configuring workspace Cargo.toml..."
cat > Cargo.toml << 'EOF'
[workspace]
members = [
    "programs/swapback_router",
    "programs/swapback_buyback",
]
resolver = "2"

[workspace.dependencies]
anchor-lang = "=0.30.1"
anchor-spl = "=0.30.1"
solana-program = "=1.18.22"
solana-sdk = "=1.18.22"

[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1
EOF
echo "✅ Workspace configured"

# STEP 6: Essayer le build
echo ""
echo "🔨 STEP 6: Building Rust programs..."
if anchor build 2>&1 | tail -20; then
    echo "✅ BUILD SUCCESSFUL!"
else
    echo "❌ Build failed. Check output above."
    exit 1
fi

# STEP 7: Extraire les Program IDs
echo ""
echo "🔑 STEP 7: Extracting Program IDs..."
ROUTER_ID=$(solana address -k target/deploy/swapback_router-keypair.json 2>/dev/null || echo "ERROR")
BUYBACK_ID=$(solana address -k target/deploy/swapback_buyback-keypair.json 2>/dev/null || echo "ERROR")

echo "📋 Program IDs:"
echo "  - swapback_router:  $ROUTER_ID"
echo "  - swapback_buyback: $BUYBACK_ID"

# STEP 8: Créer nouveau Anchor.toml
echo ""
echo "📄 STEP 8: Creating Anchor.toml..."
cat > Anchor.toml << EOF
[build]
shell = "/bin/bash"

[provider]
cluster = "Devnet"
wallet = "~/.config/solana/id.json"

[[test.genesis]]
address = "$ROUTER_ID"
program = "target/deploy/swapback_router.so"

[[test.genesis]]
address = "$BUYBACK_ID"
program = "target/deploy/swapback_buyback.so"

[programs.devnet]
swapback_router = "$ROUTER_ID"
swapback_buyback = "$BUYBACK_ID"

[programs.mainnet]
swapback_router = "$ROUTER_ID"
swapback_buyback = "$BUYBACK_ID"
EOF
echo "✅ Anchor.toml created"

# STEP 9: Copier back to SwapBack
echo ""
echo "📂 STEP 9: Copying built workspace back..."
cp -r /tmp/swapback_clean/programs /workspaces/SwapBack/programs_new
cp /tmp/swapback_clean/Cargo.toml /workspaces/SwapBack/Cargo.toml_new
cp /tmp/swapback_clean/Anchor.toml /workspaces/SwapBack/Anchor.toml_new

# STEP 10: Backup old, restore new
echo ""
echo "🔄 STEP 10: Updating SwapBack workspace..."
cd /workspaces/SwapBack
rm -rf programs.old
mv programs programs.old
mv programs_new programs
cp Cargo.toml Cargo.toml.old
mv Cargo.toml_new Cargo.toml
cp Anchor.toml Anchor.toml.old
mv Anchor.toml_new Anchor.toml

echo ""
echo "✅ SUCCESS! Build is fixed!"
echo ""
echo "📝 Next steps:"
echo "   1. Review new Program IDs:"
echo "      - swapback_router:  $ROUTER_ID"
echo "      - swapback_buyback: $BUYBACK_ID"
echo "   2. Update .env if needed"
echo "   3. Deploy to devnet: anchor deploy --provider.cluster devnet"
echo "   4. Run on-chain tests: npm run test"
echo ""
echo "📦 Original programs backed up in: $BACKUP_DIR/programs"
echo "==================================================================="
