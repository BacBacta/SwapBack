#!/bin/bash
# Script to commit and push changes
cd /workspaces/SwapBack

git add -A

git commit -m "feat(native-router): Add Meteora/Phoenix support, isFallback flag, real-time prices

- Extend /api/native-quote with fetchMeteoraQuote and fetchPhoenixQuote
- Add slippageBps parameter passthrough to all venue APIs
- Implement /api/price fallback with isFallback=true flag
- Remove all hardcoded prices, use real-time data only
- Add ALLOWED_DOMAINS env variable to cors-proxy
- Unify synthetic quote spreads to 0.997 (conservative)
- Add comprehensive tests for native-quote and cors-proxy
- Add CORS headers to all API routes with OPTIONS handlers

Fixes: CORS issues, hardcoded values, partial API implementation"

git push origin main

echo "Done! Changes pushed to origin/main"
