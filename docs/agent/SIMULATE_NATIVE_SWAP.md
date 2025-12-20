# Simulate Native Swap (Mainnet) — `scripts/simulate-native-swap.ts`

Ce script exécute des `simulateTransaction` mainnet pour valider le chemin **native swap** (router SwapBack + CPI DEX) sans dépendre de Jupiter.

## Prérequis

- Un RPC mainnet **fiable** (idéalement indexé) via `SOLANA_RPC_URL` (les RPC publics peuvent renvoyer beaucoup de 429).
- Une keypair Solana locale pour signer la transaction simulée.

Notes importantes:

- Le script force `user = feePayer` (même keypair). Si vous voulez simuler un autre wallet, exécutez avec sa keypair.
- Certains cas requièrent de détenir le token d’entrée (sinon le build peut retourner `SKIP`).

## Variables d’environnement

- `SOLANA_RPC_URL` (recommandé): URL RPC mainnet.
- `SOLANA_KEYPAIR` (optionnel): chemin vers la keypair JSON.
  - Si absent, le script tente `~/.config/solana/id.json`.
- `SWAPBACK_AUTO_CREATE_KEYPAIR=1` (optionnel): auto-crée un `~/.config/solana/id.json` si absent.
- `NEXT_PUBLIC_SWAPBACK_ALT_ADDRESS` (optionnel): adresse de l’ALT SwapBack.
  - Requis uniquement pour `--autoExtendAlt=1`.

## Modes

### 1) Single (une venue, une paire)

```bash
SOLANA_RPC_URL=https://… \
SOLANA_KEYPAIR=~/.config/solana/id.json \
npx tsx scripts/simulate-native-swap.ts --venue=ORCA_WHIRLPOOL \
  --inputMint=So11111111111111111111111111111111111111112 \
  --outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

### 2) Matrix (plusieurs paires par venue)

```bash
npx tsx scripts/simulate-native-swap.ts --matrix=true --venues=METEORA_DLMM,PHOENIX
```

### 2bis) Supported-only (DoD V1.1 sans Raydium CLMM)

Objectif: obtenir une revalidation **stable** (exit code 0) qui ne couvre que le périmètre explicitement supporté en swap natif.

- Le flag `--supportedOnly=true` filtre les venues à: `ORCA_WHIRLPOOL` + `METEORA_DLMM`.
- Les autres venues passées via `--venues=...` sont ignorées quand `--supportedOnly=true`.

Commande recommandée (mainnet `simulateTransaction`):

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

Critères de succès (DoD):

- Le résumé final contient uniquement `OK` pour `ORCA_WHIRLPOOL` et `METEORA_DLMM`.
- Les cas par défaut couvrent au minimum `SOL→USDC` et `SOL→USDT`.
- Aucune erreur de sérialisation/tx-size (l’ALT est utilisée en lecture si `NEXT_PUBLIC_SWAPBACK_ALT_ADDRESS` est défini).

### 3) Override de paires (`--pairs`)

Le format est: `MINT_IN:MINT_OUT[,MINT_IN:MINT_OUT]`.

```bash
npx tsx scripts/simulate-native-swap.ts \
  --venues=PHOENIX \
  --pairs=So11111111111111111111111111111111111111112:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

### 4) Best route (reproduit le chemin UI)

`--bestRoute=true`:

- Calcule `bestRoute` via le routeur natif (quotes)
- Dérive `minOut` avec `--slippageBps`
- Build la transaction (incluant multi-hop si présent)
- Simule la transaction

```bash
npx tsx scripts/simulate-native-swap.ts \
  --bestRoute=true \
  --pairs=BONK:WIF,BONK:JUP,BONK:ORCA \
  --amountIn=1000000 \
  --slippageBps=50
```

#### Best route sans simuler (`--quoteOnly`)

Utile pour valider uniquement la sélection de route (aucun build tx, aucune simulation).

```bash
npx tsx scripts/simulate-native-swap.ts \
  --bestRoute=true \
  --quoteOnly=true \
  --pairs=BONK:WIF \
  --amountIn=1000000
```

## Flags

- `--venue=...` ou `--venues=A,B,C`
- `--matrix=true` (si absent: mode single par défaut)
- `--pairs=...` (honoré même sans `--matrix=true`)
- `--supportedOnly=true` (optionnel): filtre les venues à `ORCA_WHIRLPOOL` + `METEORA_DLMM` pour un run DoD stable
- `--bestRoute=true` (ignore `--venues` et simule `BEST_ROUTE`)
- `--quoteOnly=true` (bestRoute uniquement, pas de tx)
- `--autoExtendAlt=1` (bestRoute uniquement): si la tx est trop grosse, étend l’ALT puis rebuild + re-simule
- `--amountIn=<number>` (unités “raw” du mint d’entrée; ex WSOL en lamports)
- `--slippageBps=<number>` (bps)
- `--rpc=<url|helius>` (override CLI du RPC)

## Interprétation des résultats

Le résumé final contient notamment:

- `OK`: simulation sans erreur.
- `FAIL`: erreur de build, de signature ou de simulation.
- `XFAIL`: échec attendu (ex: programme gelé / contraintes connues par venue).
- `SKIP`: prérequis manquant côté wallet (ex: pas de compte token initialisé / pas de balance du mint d’entrée).

## ⚠️ Sécurité / Side-effects (`--autoExtendAlt`)

`--autoExtendAlt=1` peut **envoyer de vraies transactions mainnet** pour étendre l’Address Lookup Table SwapBack.

- Le `feePayer` paye les frais.
- La keypair utilisée doit être **authority** de l’ALT (`NEXT_PUBLIC_SWAPBACK_ALT_ADDRESS`).
- À utiliser uniquement si vous comprenez l’impact (mainnet).
