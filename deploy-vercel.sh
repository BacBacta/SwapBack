#!/bin/bash

# 🚀 SWAPBACK MVP - VERCEL DEPLOYMENT SCRIPT
# Deploy Next.js frontend to Vercel with one command

set -e

echo "🚀 =========================================="
echo "  SWAPBACK MVP - VERCEL DEPLOYMENT"
echo "=========================================="
echo ""

# Step 1: Check if Vercel CLI is installed
echo "📦 Step 1: Checking Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
    echo "✅ Vercel CLI installed"
else
    echo "✅ Vercel CLI already installed"
    vercel --version
fi
echo ""

# Step 2: Check if app is built
echo "📦 Step 2: Checking frontend build..."
if [ -d "app/.next" ]; then
    echo "✅ Frontend already built (app/.next exists)"
    echo "   Size: $(du -sh app/.next 2>/dev/null | awk '{print $1}')"
else
    echo "⚠️  Frontend not built. Building now..."
    npm run app:build
    echo "✅ Frontend built successfully"
fi
echo ""

# Step 3: Deploy to Vercel
echo "📦 Step 3: Deploying to Vercel..."
echo ""

if [ -z "$VERCEL_TOKEN" ]; then
    echo "⚠️  VERCEL_TOKEN not set. Using interactive mode..."
    echo ""
    echo "You will be prompted to:"
    echo "  1. Link your Vercel account"
    echo "  2. Confirm project settings"
    echo "  3. Deploy to production"
    echo ""
    
    # Interactive deployment
    cd app
    vercel --prod --confirm
    cd ..
else
    echo "✅ VERCEL_TOKEN found. Deploying with token..."
    cd app
    vercel deploy --prod --confirm --token "$VERCEL_TOKEN"
    cd ..
fi

echo ""
echo "=========================================="
echo "  ✅ DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Check your Vercel dashboard"
echo "  2. Visit your live URL"
echo "  3. Share with beta testers!"
echo ""
echo "Live URL will be shown above 👆"
echo ""
