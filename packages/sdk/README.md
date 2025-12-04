# @swapback/sdk

SDK TypeScript pour interagir avec SwapBack sur Solana : cotations et exécution de swaps.

## Installation

```bash
npm install @swapback/sdk @solana/web3.js
```

## Utilisation rapide

```ts
import { Connection } from "@solana/web3.js";
import { SwapBackClient } from "@swapback/sdk";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const client = new SwapBackClient({ connection });

// Obtenir une cotation
const quote = await client.getQuote({
  inputMint: "So11111111111111111111111111111111111111112",
  outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  amount: 1_000_000_000, // 1 SOL en lamports
  slippageBps: 50,
});

console.log("Output:", quote.outAmount);
console.log("Route:", quote.route);
```

## Exécution

```ts
import { executeSwap } from "@swapback/sdk";

// transactionBase64 obtenu depuis l'API /api/swap/execute
const result = await executeSwap(connection, { transactionBase64 });

console.log("Signature:", result.signature);
```

## API Référence

### `getQuote(params, options?)`

Récupère une cotation via l'API SwapBack.

| Paramètre        | Type     | Description                           |
| ---------------- | -------- | ------------------------------------- |
| inputMint        | string   | Mint du token d'entrée                |
| outputMint       | string   | Mint du token de sortie               |
| amount           | number   | Montant en plus petite unité          |
| slippageBps      | number?  | Slippage en bps (défaut 50)           |
| routingStrategy  | string?  | `smart`, `aggressive`, `defensive`    |

### `executeSwap(connection, params)`

Soumet une transaction signée au réseau.

| Paramètre          | Type       | Description                        |
| ------------------ | ---------- | ---------------------------------- |
| transactionBase64  | string     | Transaction sérialisée (base64)    |
| signer             | Keypair?   | Signataire optionnel               |

## License

MIT
