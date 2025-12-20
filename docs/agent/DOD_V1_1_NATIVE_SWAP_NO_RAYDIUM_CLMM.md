# DoD — V1.1 Native Swap (Mainnet) — Sans Raydium CLMM

Ce document verrouille la **Definition of Done** pour la validation V1.1 du routeur natif (SwapBack RouterSwap) sur **Solana mainnet**, **sans Raydium CLMM**.

## Scope (périmètre supporté)

- Venues DoD (swap natif direct DEX):
  - `ORCA_WHIRLPOOL`
  - `METEORA_DLMM`
- Paires DoD (matrix par défaut):
  - `SOL→USDC`
  - `SOL→USDT`

Tout ce qui sort de ce périmètre (autres venues, paires non résolues) n’entre pas dans le signal DoD et ne doit pas faire échouer la revalidation “DoD-run”.

## Commande de revalidation (simulateTransaction)

Prérequis:
- Un wallet local financé (pour signer) via `SOLANA_KEYPAIR`.
- Un RPC mainnet (idéalement indexé) via `SOLANA_RPC_URL`.
- (Recommandé) ALT SwapBack en lecture via `NEXT_PUBLIC_SWAPBACK_ALT_ADDRESS`.

Commande:

```bash
export SOLANA_KEYPAIR=~/.config/solana/id.json
export SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
export NEXT_PUBLIC_SWAPBACK_ALT_ADDRESS=C1eKfdYffn2JeLBnfat7vqQQgpgMf9gPvcpEf568cP9x

npx tsx scripts/simulate-native-swap.ts \
  --matrix=true \
  --venues=ORCA_WHIRLPOOL,METEORA_DLMM,LIFINITY,SABER \
  --supportedOnly=true \
  --slippageBps=50
```

Notes:
- `--supportedOnly=true` force un run stable en filtrant les venues à `ORCA_WHIRLPOOL` + `METEORA_DLMM`.
- L’ALT est utilisée **en lecture uniquement** (tant que `--autoExtendAlt` n’est pas activé).

## Critères de réussite

- Exit code: `0`.
- Le résumé final contient uniquement:
  - `OK | ORCA_WHIRLPOOL | SOL→USDC`
  - `OK | ORCA_WHIRLPOOL | SOL→USDT`
  - `OK | METEORA_DLMM | SOL→USDC`
  - `OK | METEORA_DLMM | SOL→USDT`
- Aucune erreur de type “tx too large / encoding overruns Uint8Array”.
- Les logs montrent un oracle explicite (ex: Pyth V2) et une staleness cohérente avec la policy.

## Références

- docs/ai/solana-native-router-a2z.md
- docs/agent/SIMULATE_NATIVE_SWAP.md
