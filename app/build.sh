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

echo "📦 Installing dependencies..."
npm install --ignore-scripts
echo "✅ Dependencies installed"
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
