# SwapBack Keeper Services

## Overview

SwapBack uses keeper services (off-chain bots) to orchestrate:
- **DCA Plan Execution**: Execute scheduled DCA swaps
- **TWAP Slice Scheduling**: Execute time-weighted swaps
- **Buyback Execution**: Execute buy & burn operations
- **Monitoring**: Track system health and send alerts

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Keeper Services                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  DCA Keeper  │  │ TWAP Keeper  │  │  Buyback     │          │
│  │              │  │              │  │  Keeper      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Jupiter V6 API                        │   │
│  │              https://quote-api.jup.ag/v6                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               Solana RPC (Transaction Submission)        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## DCA Keeper (`oracle/src/dca-keeper.ts`)

### Purpose
Execute scheduled DCA swaps when `next_execution` timestamp is reached.

### Flow

```
1. Poll active DCA plans every 30 seconds
2. Filter plans where: is_active && !is_completed && next_execution <= now
3. For each ready plan:
   a. Get Jupiter quote for amount_per_swap
   b. Build swap instruction
   c. Execute execute_dca_swap with Jupiter route
   d. Log results and update metrics
```

### Implementation

```typescript
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { createJupiterApiClient } from '@jup-ag/api';

interface DcaPlan {
  user: PublicKey;
  planId: number[];
  tokenIn: PublicKey;
  tokenOut: PublicKey;
  amountPerSwap: bigint;
  minOutPerSwap: bigint;
  nextExecution: bigint;
  isActive: boolean;
  executedSwaps: bigint;
  totalSwaps: bigint;
}

class DcaKeeper {
  private connection: Connection;
  private program: Program;
  private jupiter: ReturnType<typeof createJupiterApiClient>;
  private executorKeypair: Keypair;

  async pollAndExecute() {
    // 1. Fetch all active DCA plans
    const plans = await this.program.account.dcaPlan.all([
      { memcmp: { offset: 8 + 32 + 32, bytes: bs58.encode([1]) } } // is_active = true
    ]);

    const now = Math.floor(Date.now() / 1000);
    const readyPlans = plans.filter(p => 
      p.account.isActive && 
      !p.account.isCompleted() &&
      Number(p.account.nextExecution) <= now
    );

    for (const plan of readyPlans) {
      await this.executeDcaSwap(plan);
    }
  }

  async executeDcaSwap(plan: { publicKey: PublicKey; account: DcaPlan }) {
    try {
      // 2. Get Jupiter quote
      const quote = await this.jupiter.quoteGet({
        inputMint: plan.account.tokenIn.toString(),
        outputMint: plan.account.tokenOut.toString(),
        amount: Number(plan.account.amountPerSwap),
        slippageBps: 100, // 1% slippage for DCA
      });

      // 3. Get swap instruction
      const { swapInstruction, addressLookupTableAccounts } = 
        await this.jupiter.swapInstructionsPost({
          quoteResponse: quote,
          userPublicKey: plan.account.user.toString(),
        });

      // 4. Build and send transaction
      const args = {
        jupiterInstruction: Buffer.from(swapInstruction.data),
        expectedInput: plan.account.amountPerSwap,
        amountReceived: BigInt(quote.outAmount), // For validation
      };

      const tx = await this.program.methods
        .executeDcaSwap(args)
        .accounts({
          dcaPlan: plan.publicKey,
          state: this.routerState,
          userTokenIn: await this.getUserTokenAccount(plan.account.user, plan.account.tokenIn),
          userTokenOut: await this.getUserTokenAccount(plan.account.user, plan.account.tokenOut),
          user: plan.account.user,
          executor: this.executorKeypair.publicKey,
          jupiterProgram: JUPITER_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(swapInstruction.accounts.map(a => ({
          pubkey: new PublicKey(a.pubkey),
          isWritable: a.isWritable,
          isSigner: a.isSigner,
        })))
        .signers([this.executorKeypair])
        .rpc();

      console.log(`✅ DCA swap executed: ${tx}`);
      await this.notifySuccess(plan, quote.outAmount);

    } catch (error) {
      console.error(`❌ DCA swap failed for plan ${plan.publicKey}:`, error);
      await this.notifyFailure(plan, error);
    }
  }
}
```

### Configuration

```typescript
const DCA_KEEPER_CONFIG = {
  pollIntervalMs: 30_000,        // Check every 30 seconds
  maxRetries: 3,                 // Retry failed swaps
  retryDelayMs: 5_000,          // Wait between retries
  slippageBps: 100,             // 1% default slippage
  priorityFeeMicroLamports: 100_000, // Priority fee for inclusion
};
```

## TWAP Keeper

### Purpose
Execute remaining TWAP slices after the first slice is executed on-chain.

### Event Listening

Listen for `TwapSlicesRequired` events:

```typescript
interface TwapSlicesRequired {
  user: PublicKey;
  totalAmount: bigint;
  sliceAmount: bigint;
  sliceMinOut: bigint;
  remainingSlices: number;
  intervalSeconds: bigint;
  firstSliceExecuted: boolean;
  firstSliceOutput: bigint;
  timestamp: bigint;
}

class TwapKeeper {
  async onTwapSlicesRequired(event: TwapSlicesRequired) {
    const { user, sliceAmount, sliceMinOut, remainingSlices, intervalSeconds } = event;
    
    // Schedule remaining slices
    for (let i = 0; i < remainingSlices; i++) {
      const executeAt = Date.now() + (i + 1) * Number(intervalSeconds) * 1000;
      
      this.scheduler.schedule(executeAt, async () => {
        await this.executeSlice(user, sliceAmount, sliceMinOut, i + 2);
      });
    }
  }

  async executeSlice(user: PublicKey, amount: bigint, minOut: bigint, sliceNumber: number) {
    // Similar to DCA execution
    const quote = await this.jupiter.quoteGet({
      inputMint: this.tokenIn.toString(),
      outputMint: this.tokenOut.toString(),
      amount: Number(amount),
      slippageBps: 50,
    });

    // Execute swap...
    console.log(`🕐 TWAP slice ${sliceNumber} executed`);
  }
}
```

## Buyback Keeper (`oracle/src/buyback-keeper.ts`)

### Purpose
Execute buy & burn operations when threshold is reached.

### Configuration

```typescript
const BUYBACK_CONFIG = {
  minUsdcThreshold: 1000_000_000, // 1000 USDC minimum
  checkIntervalMs: 300_000,       // Check every 5 minutes
  targetToken: BACK_MINT,
  slippageBps: 100,
  burnAddress: 'burnBack111111111111111111111111111111111111',
};
```

### Flow

```
1. Check buyback vault balance every 5 minutes
2. If balance >= threshold:
   a. Get Jupiter quote for USDC → BACK
   b. Execute swap
   c. Burn received BACK tokens
   d. Send notification
```

## Monitoring & Alerts

### Webhook Integration

```typescript
interface AlertConfig {
  discord?: string;    // Discord webhook URL
  slack?: string;      // Slack webhook URL
  telegram?: {
    botToken: string;
    chatId: string;
  };
}

class KeeperMonitor {
  async sendAlert(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const payload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    if (this.config.discord) {
      await this.sendDiscordAlert(payload);
    }
    if (this.config.slack) {
      await this.sendSlackAlert(payload);
    }
    if (this.config.telegram) {
      await this.sendTelegramAlert(payload);
    }
  }

  private async sendDiscordAlert(payload: AlertPayload) {
    const color = { info: 0x00ff00, warn: 0xffff00, error: 0xff0000 }[payload.level];
    
    await fetch(this.config.discord!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `SwapBack Keeper - ${payload.level.toUpperCase()}`,
          description: payload.message,
          color,
          fields: payload.data ? [
            { name: 'Details', value: JSON.stringify(payload.data, null, 2) }
          ] : [],
          timestamp: payload.timestamp,
        }],
      }),
    });
  }
}
```

### Health Metrics

```typescript
interface KeeperMetrics {
  dcaSwapsExecuted: number;
  dcaSwapsFailed: number;
  twapSlicesExecuted: number;
  buybacksExecuted: number;
  totalVolumeProcessed: bigint;
  averageLatencyMs: number;
  lastHeartbeat: Date;
}

class MetricsCollector {
  private metrics: KeeperMetrics = {
    dcaSwapsExecuted: 0,
    dcaSwapsFailed: 0,
    twapSlicesExecuted: 0,
    buybacksExecuted: 0,
    totalVolumeProcessed: 0n,
    averageLatencyMs: 0,
    lastHeartbeat: new Date(),
  };

  recordDcaExecution(success: boolean, volume: bigint, latencyMs: number) {
    if (success) {
      this.metrics.dcaSwapsExecuted++;
      this.metrics.totalVolumeProcessed += volume;
    } else {
      this.metrics.dcaSwapsFailed++;
    }
    this.updateAverageLatency(latencyMs);
  }

  getHealthStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const failureRate = this.metrics.dcaSwapsFailed / 
      (this.metrics.dcaSwapsExecuted + this.metrics.dcaSwapsFailed);
    
    if (failureRate > 0.2) return 'unhealthy';
    if (failureRate > 0.05) return 'degraded';
    return 'healthy';
  }
}
```

## Transaction Construction

### Priority Fees

```typescript
import { ComputeBudgetProgram } from '@solana/web3.js';

function addPriorityFee(transaction: Transaction, microLamports: number) {
  transaction.add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports,
    }),
    ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000, // Adjust based on instruction complexity
    })
  );
}
```

### Versioned Transactions

```typescript
import { 
  VersionedTransaction, 
  TransactionMessage,
  AddressLookupTableAccount,
} from '@solana/web3.js';

async function buildVersionedTransaction(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  lookupTables: AddressLookupTableAccount[],
) {
  const blockhash = await connection.getLatestBlockhash();
  
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash.blockhash,
    instructions,
  }).compileToV0Message(lookupTables);

  return new VersionedTransaction(message);
}
```

## Deployment

### Environment Variables

```bash
# RPC Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
COMMITMENT=confirmed

# Keeper Wallet
KEEPER_PRIVATE_KEY=<base58-encoded-private-key>

# Program IDs
ROUTER_PROGRAM_ID=9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh
BUYBACK_PROGRAM_ID=7wCCwRXxWvMY2DJDRrnhFg3b8jVPb5vVPxLH5YAGL6eJ

# Alert Configuration
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_CHAT_ID=<chat-id>

# Keeper Config
DCA_POLL_INTERVAL_MS=30000
BUYBACK_CHECK_INTERVAL_MS=300000
PRIORITY_FEE_MICRO_LAMPORTS=100000
```

### Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/

ENV NODE_ENV=production
CMD ["node", "dist/keeper.js"]
```

### Systemd Service

```ini
[Unit]
Description=SwapBack Keeper Service
After=network.target

[Service]
Type=simple
User=swapback
WorkingDirectory=/opt/swapback-keeper
ExecStart=/usr/bin/node dist/keeper.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Error Handling

### Retry Strategy

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error.message?.includes('insufficient funds')) {
        throw error;
      }
      
      console.warn(`Attempt ${i + 1} failed, retrying in ${delayMs}ms...`);
      await sleep(delayMs * (i + 1)); // Exponential backoff
    }
  }
  
  throw lastError;
}
```

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `SlippageExceeded` | Price moved too much | Increase slippage or retry |
| `InsufficientBalance` | User lacks tokens | Skip this execution |
| `NotReadyForExecution` | Time not reached | Wait for next_execution |
| `PlanExpired` | DCA plan expired | Mark as completed |
| `TransactionExpiredBlockheightExceeded` | RPC lag | Retry with fresh blockhash |

## Security Considerations

1. **Keeper Wallet**: Use a separate wallet with limited funds
2. **Rate Limiting**: Implement rate limits to prevent abuse
3. **Input Validation**: Validate all parameters before execution
4. **Monitoring**: Alert on unusual patterns
5. **Access Control**: Keeper can only execute, not modify plans
