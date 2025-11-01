#!/bin/bash

set -e  # Exit on error

echo "🔍 SwapBack Build Script - Detailed Logging"
echo "=========================================="
echo ""

echo "📂 Current directory:"
pwd
echo ""

echo "📋 Node version:"
node --version
echo ""

echo "📋 npm version:"
npm --version
echo ""

echo "📦 Package.json location:"
ls -la package.json || echo "❌ package.json not found!"
echo ""

echo "🧹 Cleaning previous build..."
rm -rf .next
rm -rf node_modules/.cache
echo "✅ Clean complete"
echo ""

echo "📦 Re-installing dependencies with --legacy-peer-deps..."
# Vercel already ran `npm install`, but we need --legacy-peer-deps
# So we force a clean install
if [ ! -d "node_modules/tailwindcss" ]; then
  echo "⚠️  Tailwind CSS missing, forcing full reinstall..."
  rm -rf node_modules
  npm install --legacy-peer-deps
else
  echo "✅ Dependencies already installed (Tailwind found)"
fi
echo "✅ Dependencies ready"
echo ""

echo "🔧 Environment variables check:"
echo "NEXT_PUBLIC_SOLANA_NETWORK: ${NEXT_PUBLIC_SOLANA_NETWORK:-NOT SET}"
echo "NODE_OPTIONS: ${NODE_OPTIONS:-NOT SET}"
echo ""

echo "🏗️  Starting Next.js build..."
npm run build
echo "✅ Build complete!"
echo ""

echo "📊 Build output:"
ls -la .next || echo "❌ .next directory not found!"
