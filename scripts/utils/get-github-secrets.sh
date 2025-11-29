#!/bin/bash

# Helper script pour récupérer les valeurs des secrets pour Github Actions

echo "🔐 SwapBack Github Secrets Generator"
echo "===================================="
echo ""

WALLET_FILE="/workspaces/SwapBack/devnet-keypair.json"
PROGRAM_FILE="/workspaces/SwapBack/target/deploy/swapback_cnft-keypair.json"

echo "📋 Copier les valeurs suivantes dans Github (Settings > Secrets > Actions):"
echo ""

echo "═════════════════════════════════════════════════════════════"
echo "Secret 1: DEVNET_WALLET"
echo "═════════════════════════════════════════════════════════════"
echo "Name: DEVNET_WALLET"
echo "Value:"
cat "$WALLET_FILE"
echo ""
echo ""

echo "═════════════════════════════════════════════════════════════"
echo "Secret 2: DEVNET_PROGRAM_KEYPAIR"
echo "═════════════════════════════════════════════════════════════"
echo "Name: DEVNET_PROGRAM_KEYPAIR"
echo "Value:"
cat "$PROGRAM_FILE"
echo ""
echo ""

echo "✅ Prochaines étapes:"
echo ""
echo "1. Aller à: https://github.com/BacBacta/SwapBack/settings/secrets/actions"
echo ""
echo "2. Créer deux nouveaux secrets en copiant les valeurs ci-dessus"
echo ""
echo "3. Aller à: https://github.com/BacBacta/SwapBack/actions/workflows/deploy-devnet.yml"
echo ""
echo "4. Cliquer sur 'Run workflow'"
echo ""
echo "5. Entrer confirm_deployment = true et lancer"
echo ""
