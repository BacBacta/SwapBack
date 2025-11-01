#!/bin/bash

# Remove set -e to prevent script from exiting on first error
# set -e  # Exit on error - COMMENTED OUT FOR DEBUGGING

echo "🔍 SwapBack Build Script - Detailed Logging"
echo "=========================================="
echo ""

echo "📂 Initial directory:"
pwd
echo ""

echo " Node version:"
node --version
echo ""

echo "📋 npm version:"
npm --version
echo ""

echo "📦 Package.json location:"
if [ ! -f "app/package.json" ]; then
  echo "❌ ERROR: package.json not found in app directory"
  exit 1
fi
ls -la app/package.json
echo ""

echo "🧹 Cleaning previous build..."
rm -rf app/.next
rm -rf node_modules/.cache
echo "✅ Clean complete"
echo ""

echo "📦 Checking dependencies..."
# Check if essential dependencies are installed
if [ ! -d "node_modules/tailwindcss" ] || [ ! -d "node_modules/next" ] || [ ! -d "node_modules/react" ]; then
  echo "⚠️  Essential dependencies missing, forcing full reinstall..."
  rm -rf node_modules
  echo "📦 Running npm install --legacy-peer-deps..."
  if ! npm install --legacy-peer-deps; then
    echo "❌ ERROR: npm install failed"
    exit 1
  fi
  echo "✅ npm install completed"
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
if ! npm run build --prefix app; then
  echo "❌ ERROR: Next.js build failed"
  exit 1
fi
echo "✅ Build complete!"
echo ""

echo "📊 Build output:"
ls -la app/.next || echo "❌ .next directory not found!"
