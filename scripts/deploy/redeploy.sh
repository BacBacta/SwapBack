#!/bin/bash
set -e
echo "Building..."
anchor build
echo "Configuring devnet..."
solana config set --url devnet
echo "Deploying swapback_router..."
anchor deploy --provider.cluster devnet --program-name swapback_router
echo "Done!"
