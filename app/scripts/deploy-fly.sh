#!/bin/bash
# Script de déploiement Fly.io pour SwapBack
# Usage: ./scripts/deploy-fly.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}
APP_NAME="swapback-api"

if [ "$ENVIRONMENT" = "production" ]; then
  APP_NAME="swapback-api-prod"
fi

echo "🚀 Déploiement SwapBack sur Fly.io ($ENVIRONMENT)"
echo "================================================"

# Vérifier que fly CLI est installé
if ! command -v fly &> /dev/null; then
  echo "❌ Fly CLI non installé. Installation..."
  curl -L https://fly.io/install.sh | sh
  export PATH="$HOME/.fly/bin:$PATH"
fi

# Vérifier l'authentification
if ! fly auth whoami &> /dev/null; then
  echo "📝 Connexion à Fly.io requise..."
  fly auth login
fi

# Vérifier si l'app existe
if ! fly apps list | grep -q "$APP_NAME"; then
  echo "📦 Création de l'application $APP_NAME..."
  fly apps create "$APP_NAME" --org personal
fi

# Configurer les secrets si pas déjà fait
echo "🔐 Vérification des secrets..."
if ! fly secrets list -a "$APP_NAME" 2>/dev/null | grep -q "NEXT_PUBLIC_SOLANA_RPC_URL"; then
  echo "⚠️  Secrets non configurés. Configuration requise:"
  echo ""
  echo "Exécutez les commandes suivantes avec vos valeurs:"
  echo ""
  echo "  fly secrets set -a $APP_NAME \\"
  echo "    NEXT_PUBLIC_SOLANA_RPC_URL='https://api.mainnet-beta.solana.com' \\"
  echo "    NEXT_PUBLIC_SOLANA_NETWORK='mainnet-beta'"
  echo ""
  read -p "Appuyez sur Entrée après avoir configuré les secrets (ou Ctrl+C pour annuler)..."
fi

# Déployer
echo "🏗️  Build et déploiement..."
fly deploy -a "$APP_NAME" --remote-only

# Vérifier le déploiement
echo "✅ Vérification du déploiement..."
sleep 5

HEALTH_URL="https://$APP_NAME.fly.dev/api/health"
echo "🔍 Health check: $HEALTH_URL"

HEALTH_RESPONSE=$(curl -s "$HEALTH_URL" 2>/dev/null || echo '{}')

if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
  echo "✅ Déploiement réussi! Status: healthy"
elif echo "$HEALTH_RESPONSE" | grep -q '"status":"degraded"'; then
  echo "⚠️  Déploiement réussi mais status: degraded"
  echo "   Vérifiez les logs: fly logs -a $APP_NAME"
else
  echo "❌ Health check échoué. Vérifiez les logs:"
  echo "   fly logs -a $APP_NAME"
fi

echo ""
echo "🌐 URL de l'API: https://$APP_NAME.fly.dev"
echo "📊 Dashboard: https://fly.io/apps/$APP_NAME"
