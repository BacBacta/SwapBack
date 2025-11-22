#!/bin/bash
set -e

echo "🔨 Building latest programs..."
anchor build

echo "🚀 Deploying swapback_router to devnet..."
solana config set --url devnet
anchor deploy --provider.cluster devnet --program-name swapback_router

echo "✅ Deployment complete!"
solana program show 9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh --url devnet
