#!/bin/bash

set -e  # Exit on error

echo "🔍 SwapBack Build Script - Vercel Compatible"
echo "=============================================="
echo ""

echo "📂 Working directory:"
pwd
echo ""

echo "📋 Node version:"
node --version
echo ""

echo "📋 npm version:"
npm --version
echo ""

# Detect if we're in the app directory (Vercel) or root (local)
if [ -f "package.json" ] && grep -q "@swapback/app" package.json 2>/dev/null; then
  echo "📍 Running in app directory (Vercel mode)"
  APP_DIR="."
  ROOT_DIR=".."
else
  echo "📍 Running in root directory (Local mode)"
  APP_DIR="app"
  ROOT_DIR="."
fi

echo "🧹 Cleaning previous build..."
rm -rf "${APP_DIR}/.next"
rm -rf "${APP_DIR}/node_modules/.cache"
echo "✅ Clean complete"
echo ""

echo "📦 Checking dependencies..."
# Check if dependencies are installed in app directory
if [ ! -d "${APP_DIR}/node_modules/next" ] || [ ! -d "${APP_DIR}/node_modules/react" ] || [ ! -d "${APP_DIR}/node_modules/tailwindcss" ]; then
  echo "⚠️  Dependencies missing in app directory"
  
  # Install in app directory
  echo "📦 Installing dependencies in ${APP_DIR}..."
  cd "${APP_DIR}"
  npm install --legacy-peer-deps
  cd - > /dev/null
  echo "✅ Dependencies installed"
else
  echo "✅ Dependencies already installed"
fi
echo ""

echo "🔧 Environment variables:"
echo "NEXT_PUBLIC_SOLANA_NETWORK: ${NEXT_PUBLIC_SOLANA_NETWORK:-NOT SET}"
echo "NODE_OPTIONS: ${NODE_OPTIONS:-NOT SET}"
echo ""

echo "🏗️  Building Next.js app..."
cd "${APP_DIR}"
npm run build
echo "✅ Build complete!"
echo ""

echo "📊 Build output:"
ls -la .next 2>/dev/null || echo "⚠️  .next directory not found!"
echo ""

echo "✅ All done!"
