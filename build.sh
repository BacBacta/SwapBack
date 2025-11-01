#!/bin/bash

set -e  # Exit on error

echo "🔍 SwapBack Build Script - Detailed Logging"
echo "=========================================="
echo ""

echo "📂 Initial directory:"
pwd
echo ""

# Change to app directory
echo "📂 Changing to app directory..."
cd app
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

echo "📦 Checking dependencies..."
# Check if essential dependencies are installed
if [ ! -d "node_modules/tailwindcss" ] || [ ! -d "node_modules/next" ] || [ ! -d "node_modules/react" ]; then
  echo "⚠️  Essential dependencies missing, forcing full reinstall..."
  rm -rf node_modules
  npm install --legacy-peer-deps
else
  echo "✅ Dependencies already installed correctly"
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
