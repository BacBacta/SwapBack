#!/bin/bash
echo "🔍 Testing lock_tokens instruction simulation..."

# Simuler une transaction avec anchor
cd /workspaces/SwapBack
anchor test --skip-deploy --skip-local-validator 2>&1 | grep -A 20 "lock_tokens" || echo "No test found"
