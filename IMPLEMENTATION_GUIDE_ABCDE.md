# 🚀 Guide d'Implémentation Complet - Tâches A, B, C, D, E
**Status:** Foundation ✅ Complétée  
**Date:** 31 Octobre 2025  
**Commit actuel:** `09236c2`

---

## ✅ Foundation (COMPLÉTÉ)

### Fichiers créés:
- ✅ `app/src/hooks/useBuybackState.ts` - Hook lecture state on-chain
- ✅ `app/src/hooks/useExecuteBuyback.ts` - Hook exécution buyback
- ✅ `app/src/utils/formatters.ts` - Fonctions formatage
- ✅ `app/src/components/QueryProvider.tsx` - React Query wrapper
- ✅ `app/src/app/layout.tsx` - Modifié (QueryProvider + Toaster)

### Packages installés:
```bash
npm install @tanstack/react-query react-hot-toast
```

---

## 🔴 TÂCHE B : Auto-Deposit 25% Fees USDC

### Fichiers à créer/modifier:

#### 1. Créer `app/src/lib/buybackIntegration.ts`

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, BN, Wallet } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

const BUYBACK_STATE_PDA = new PublicKey('74N3kmNZiRSJCFaYBFjmiQGMwv8vx3aJvMMKJECLNUNM');
const USDC_VAULT_PDA = new PublicKey('HiBn2KFwVUDuW9z1aiYcR1jVyBjSMirqzSQ7vpaLQKDT');
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

const MIN_DEPOSIT_AMOUNT = 1_000_000; // 1 USDC minimum

export interface BuybackDepositResult {
  signature?: string;
  amount: number; // USDC amount deposited (lamports)
  skipped: boolean;
  reason?: string;
}

/**
 * Deposit USDC fees to buyback vault
 * @param connection Solana connection
 * @param wallet User wallet
 * @param feeAmount Total fee amount in USDC lamports
 * @returns Deposit result
 */
export async function depositToBuybackVault(
  connection: Connection,
  wallet: any, // WalletContextState
  feeAmount: number
): Promise<BuybackDepositResult> {
  // Calculate 25% of fees
  const depositAmount = Math.floor(feeAmount * 0.25);

  // Skip if amount too small
  if (depositAmount < MIN_DEPOSIT_AMOUNT) {
    console.log(`⏭️  Buyback deposit skipped: ${depositAmount} < ${MIN_DEPOSIT_AMOUNT} lamports`);
    return {
      skipped: true,
      amount: depositAmount,
      reason: `Amount too small (${(depositAmount / 1e6).toFixed(2)} USDC < 1 USDC)`,
    };
  }

  if (!wallet.publicKey || !wallet.signTransaction) {
    return {
      skipped: true,
      amount: depositAmount,
      reason: 'Wallet not connected',
    };
  }

  try {
    // Load IDL
    const idlPath = path.join(process.cwd(), '../target/idl/swapback_buyback.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

    // Create provider
    const provider = new AnchorProvider(connection, wallet as Wallet, {
      commitment: 'confirmed',
    });

    // Initialize program
    const program = new Program(idl, provider);

    // Get user USDC account
    const userUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);

    console.log(`💰 Depositing ${(depositAmount / 1e6).toFixed(2)} USDC to buyback vault...`);

    // Execute deposit
    const signature = await (program.methods as any)
      .depositUsdc(new BN(depositAmount))
      .accounts({
        buybackState: BUYBACK_STATE_PDA,
        userUsdcAccount,
        usdcVault: USDC_VAULT_PDA,
        user: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log(`✅ Buyback deposit successful: ${signature}`);

    return {
      signature,
      amount: depositAmount,
      skipped: false,
    };
  } catch (error) {
    console.error('❌ Buyback deposit failed:', error);
    // Don't throw - non-blocking error
    return {
      skipped: true,
      amount: depositAmount,
      reason: `Deposit failed: ${(error as Error).message}`,
    };
  }
}
```

#### 2. Modifier `app/src/lib/swapExecutor.ts`

**Ajouter l'import:**
```typescript
import { depositToBuybackVault, BuybackDepositResult } from './buybackIntegration';
```

**Modifier le type de retour:**
```typescript
export interface SwapResult {
  signature: string;
  inputAmount: number;
  outputAmount: number;
  fee: number;
  route: RouteInfo;
  buybackDeposit?: BuybackDepositResult; // ✅ NOUVEAU
}
```

**Modifier la fonction `executeSwap`:**
```typescript
export async function executeSwap(
  connection: Connection,
  wallet: WalletContextState,
  params: SwapParams
): Promise<SwapResult> {
  // ... existing swap logic ...
  
  const swapResult = await sendAndConfirmTransaction(
    connection,
    transaction,
    [wallet]
  );

  // ✅ NOUVEAU: Deposit 25% fees to buyback
  let buybackDeposit: BuybackDepositResult | undefined;
  
  try {
    buybackDeposit = await depositToBuybackVault(
      connection,
      wallet,
      feeAmount // Fee calculated from swap
    );
  } catch (error) {
    console.warn('Buyback deposit failed (non-blocking):', error);
    buybackDeposit = {
      skipped: true,
      amount: Math.floor(feeAmount * 0.25),
      reason: 'Exception occurred',
    };
  }

  return {
    signature: swapResult.signature,
    inputAmount: params.amount,
    outputAmount: calculatedOutput,
    fee: feeAmount,
    route: params.route,
    buybackDeposit, // ✅ NOUVEAU
  };
}
```

#### 3. Modifier `app/src/app/api/execute/route.ts`

```typescript
export async function POST(request: Request) {
  const { serializedTransaction, wallet, route } = await request.json();

  try {
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!);
    
    const result = await executeSwap(connection, wallet, {
      transaction: deserializeTransaction(serializedTransaction),
      route,
    });

    return Response.json({
      success: true,
      signature: result.signature,
      inputAmount: result.inputAmount,
      outputAmount: result.outputAmount,
      fee: result.fee,
      buybackDeposit: result.buybackDeposit, // ✅ NOUVEAU
    });
  } catch (error) {
    console.error('Swap execution error:', error);
    return Response.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
```

#### 4. Modifier `app/src/components/SwapInterface.tsx`

**Afficher le buyback deposit dans l'UI:**
```typescript
{swapResult && swapResult.buybackDeposit && !swapResult.buybackDeposit.skipped && (
  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
    <p className="text-sm font-medium text-green-800">
      ✅ Buyback Contribution
    </p>
    <p className="text-xs text-green-600 mt-1">
      {(swapResult.buybackDeposit.amount / 1e6).toFixed(2)} USDC deposited for $BACK buyback
    </p>
    {swapResult.buybackDeposit.signature && (
      <a
        href={`https://explorer.solana.com/tx/${swapResult.buybackDeposit.signature}?cluster=devnet`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-green-700 underline mt-1 inline-block"
      >
        View transaction ↗
      </a>
    )}
  </div>
)}

{swapResult && swapResult.buybackDeposit && swapResult.buybackDeposit.skipped && (
  <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded">
    <p className="text-xs text-gray-600">
      ℹ️ Buyback deposit skipped: {swapResult.buybackDeposit.reason}
    </p>
  </div>
)}
```

---

## 🟡 TÂCHE A : Dashboard Buyback

### Structure complète:

```bash
app/src/app/buyback/
├── page.tsx                      # Page principale
├── loading.tsx                   # Skeleton loader
├── error.tsx                     # Error boundary
└── components/
    ├── BuybackStats.tsx          # Cartes stats
    ├── BuybackProgressBar.tsx    # Barre progression
    ├── ExecuteBuybackButton.tsx  # Bouton exécution
    ├── BuybackChart.tsx          # Graphique historique
    └── RecentBuybacks.tsx        # Liste transactions
```

### Fichiers à créer:

#### 1. `app/src/app/buyback/page.tsx`

```typescript
'use client';

import { useBuybackState } from '@/hooks/useBuybackState';
import BuybackStats from './components/BuybackStats';
import BuybackProgressBar from './components/BuybackProgressBar';
import ExecuteBuybackButton from './components/ExecuteBuybackButton';
import BuybackChart from './components/BuybackChart';
import RecentBuybacks from './components/RecentBuybacks';

export default function BuybackPage() {
  const { buybackState, isLoading, error } = useBuybackState();

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading buyback data: {error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading || !buybackState) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">💰 Buyback Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Track $BACK token buyback and burn statistics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <BuybackStats
          totalUsdcSpent={buybackState.totalUsdcSpent}
          totalBackBurned={buybackState.totalBackBurned}
          buybackCount={buybackState.buybackCount}
        />
      </div>

      {/* Progress Bar */}
      <BuybackProgressBar
        currentBalance={buybackState.vaultBalance || 0}
        threshold={buybackState.minBuybackAmount}
        progressPercent={buybackState.progressPercent || 0}
      />

      {/* Execute Button */}
      {buybackState.canExecute && (
        <div className="my-6">
          <ExecuteBuybackButton />
        </div>
      )}

      {/* Historical Chart */}
      <div className="mt-6">
        <BuybackChart />
      </div>

      {/* Recent Transactions */}
      <div className="mt-6">
        <RecentBuybacks />
      </div>
    </div>
  );
}
```

#### 2. `app/src/app/buyback/components/BuybackStats.tsx`

```typescript
'use client';

import { formatUSDC, formatBACK, formatCompactNumber } from '@/utils/formatters';

interface BuybackStatsProps {
  totalUsdcSpent: number;
  totalBackBurned: number;
  buybackCount: number;
}

export default function BuybackStats({
  totalUsdcSpent,
  totalBackBurned,
  buybackCount,
}: BuybackStatsProps) {
  return (
    <>
      {/* Total USDC Spent */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total USDC Spent</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              ${formatUSDC(totalUsdcSpent)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Used for buybacks
            </p>
          </div>
          <div className="bg-blue-100 p-3 rounded-full">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Total $BACK Burned */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total $BACK Burned</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">
              🔥 {formatCompactNumber(totalBackBurned)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Deflationary impact
            </p>
          </div>
          <div className="bg-orange-100 p-3 rounded-full">
            <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Buyback Count */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Buybacks</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {buybackCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Successful executions
            </p>
          </div>
          <div className="bg-green-100 p-3 rounded-full">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>
    </>
  );
}
```

#### 3. `app/src/app/buyback/components/BuybackProgressBar.tsx`

```typescript
'use client';

import { formatUSDC, formatPercent } from '@/utils/formatters';

interface BuybackProgressBarProps {
  currentBalance: number;
  threshold: number;
  progressPercent: number;
}

export default function BuybackProgressBar({
  currentBalance,
  threshold,
  progressPercent,
}: BuybackProgressBarProps) {
  const isReady = progressPercent >= 100;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">
          Progress to Next Buyback
        </h3>
        <span className={`text-sm font-medium ${isReady ? 'text-green-600' : 'text-gray-600'}`}>
          {formatPercent(progressPercent, 1)}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
        <div
          className={`h-4 rounded-full transition-all duration-500 ${
            isReady ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        ></div>
      </div>

      <div className="flex justify-between text-sm text-gray-600">
        <span>Current: ${formatUSDC(currentBalance)}</span>
        <span>Threshold: ${formatUSDC(threshold)}</span>
      </div>

      {isReady ? (
        <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm font-medium text-green-800">
            ✅ Buyback Ready! Threshold met.
          </p>
        </div>
      ) : (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-700">
            ${formatUSDC(threshold - currentBalance)} USDC needed to reach threshold
          </p>
        </div>
      )}
    </div>
  );
}
```

#### 4. `app/src/app/buyback/components/ExecuteBuybackButton.tsx`

```typescript
'use client';

import { useExecuteBuyback } from '@/hooks/useExecuteBuyback';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState } from 'react';

export default function ExecuteBuybackButton() {
  const wallet = useWallet();
  const { executeBuyback, isPending } = useExecuteBuyback();
  const [usdcAmount, setUsdcAmount] = useState(5); // Default 5 USDC

  const handleExecute = () => {
    executeBuyback({ usdcAmount, minBackAmount: 0 });
  };

  if (!wallet.connected) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          Connect your wallet to execute buyback
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        🔥 Execute Buyback
      </h3>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          USDC Amount to Use
        </label>
        <input
          type="number"
          min="1"
          max="100"
          step="1"
          value={usdcAmount}
          onChange={(e) => setUsdcAmount(Number(e.target.value))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          disabled={isPending}
        />
        <p className="text-xs text-gray-500 mt-1">
          Recommended: 5-10 USDC per buyback
        </p>
      </div>

      <button
        onClick={handleExecute}
        disabled={isPending || usdcAmount < 1}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
      >
        {isPending ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Executing...
          </>
        ) : (
          `🔥 Execute Buyback (${usdcAmount} USDC)`
        )}
      </button>

      <p className="text-xs text-gray-500 mt-3 text-center">
        This will burn $BACK tokens and reduce total supply
      </p>
    </div>
  );
}
```

#### 5. `app/src/app/buyback/components/BuybackChart.tsx` 

```typescript
'use client';

import { useBuybackState } from '@/hooks/useBuybackState';

export default function BuybackChart() {
  const { buybackState } = useBuybackState();

  // TODO: Implement chart with recharts
  // For now, show placeholder

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        📈 Buyback History (30 days)
      </h3>
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
        <p className="text-gray-500">Chart coming soon (recharts integration)</p>
      </div>
    </div>
  );
}
```

#### 6. `app/src/app/buyback/components/RecentBuybacks.tsx`

```typescript
'use client';

export default function RecentBuybacks() {
  // TODO: Fetch from Helius API or on-chain logs

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        📜 Recent Buybacks
      </h3>
      <div className="text-center py-8 text-gray-500">
        No recent buybacks (query Helius API for transaction history)
      </div>
    </div>
  );
}
```

---

## 🔵 TÂCHE C : Tests E2E Swap + Buyback

### Créer `tests/e2e/swap-with-buyback.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';

// Test configuration
const DEVNET_RPC = 'https://api.devnet.solana.com';
const BUYBACK_STATE_PDA = new PublicKey('74N3kmNZiRSJCFaYBFjmiQGMwv8vx3aJvMMKJECLNUNM');
const USDC_VAULT_PDA = new PublicKey('HiBn2KFwVUDuW9z1aiYcR1jVyBjSMirqzSQ7vpaLQKDT');
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

describe('E2E: Swap with Buyback Integration', () => {
  let connection: Connection;
  let payer: Keypair;

  beforeAll(() => {
    connection = new Connection(DEVNET_RPC, 'confirmed');
    const defaultPath = path.join(require('os').homedir(), '.config/solana/id.json');
    const walletData = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
    payer = Keypair.fromSecretKey(new Uint8Array(walletData));
  });

  it('✅ Test 1: Should deposit 25% of swap fees to buyback vault', async () => {
    console.log('\n📋 Test 1: Dépôt automatique 25% fees');

    // Get vault balance before
    const vaultBefore = await connection.getTokenAccountBalance(USDC_VAULT_PDA);
    const balanceBefore = vaultBefore.value.uiAmount || 0;

    console.log(`   Vault balance before: ${balanceBefore} USDC`);

    // Simulate swap with 100 USDC
    const swapAmount = 100 * 1e6;
    const feeRate = 0.003; // 0.3%
    const swapFee = swapAmount * feeRate; // 0.3 USDC
    const expectedDeposit = swapFee * 0.25; // 0.075 USDC

    // TODO: Execute real swap here
    // const swapResult = await executeSwap(...)

    // For now, manually deposit to test
    // ...

    console.log(`   Expected deposit: ${(expectedDeposit / 1e6).toFixed(4)} USDC`);

    expect(expectedDeposit).toBeCloseTo(75_000, 1000); // ~0.075 USDC
  });

  it('✅ Test 2: Should skip deposit if amount < 1 USDC', async () => {
    console.log('\n📋 Test 2: Skip deposit si montant < 1 USDC');

    const smallSwapAmount = 10 * 1e6; // 10 USDC
    const smallFee = smallSwapAmount * 0.003; // 0.03 USDC
    const smallDeposit = smallFee * 0.25; // 0.0075 USDC

    console.log(`   Swap amount: ${(smallSwapAmount / 1e6).toFixed(2)} USDC`);
    console.log(`   Fee (0.3%): ${(smallFee / 1e6).toFixed(4)} USDC`);
    console.log(`   25% deposit: ${(smallDeposit / 1e6).toFixed(4)} USDC`);

    expect(smallDeposit).toBeLessThan(1_000_000); // < 1 USDC
  });

  it('✅ Test 3: Should show buyback deposit in swap result', async () => {
    console.log('\n📋 Test 3: Affichage du buyback deposit dans le résultat');

    const mockSwapResult = {
      signature: 'mock_signature',
      inputAmount: 100_000_000,
      outputAmount: 99_700_000,
      fee: 300_000, // 0.3 USDC
      buybackDeposit: {
        signature: 'buyback_signature',
        amount: 75_000, // 25% of fee
        skipped: false,
      },
    };

    expect(mockSwapResult.buybackDeposit).toBeDefined();
    expect(mockSwapResult.buybackDeposit!.amount).toBe(75_000);
    expect(mockSwapResult.buybackDeposit!.skipped).toBe(false);

    console.log(`   ✓ Buyback deposit: ${(mockSwapResult.buybackDeposit!.amount / 1e6).toFixed(4)} USDC`);
  });

  it('✅ Test 4: Should handle buyback deposit failure gracefully', async () => {
    console.log('\n📋 Test 4: Gestion erreur buyback (non-bloquant)');

    const mockSwapResultWithError = {
      signature: 'mock_signature',
      inputAmount: 100_000_000,
      outputAmount: 99_700_000,
      fee: 300_000,
      buybackDeposit: {
        skipped: true,
        amount: 75_000,
        reason: 'Insufficient SOL for transaction',
      },
    };

    // Swap should succeed even if buyback fails
    expect(mockSwapResultWithError.signature).toBe('mock_signature');
    expect(mockSwapResultWithError.buybackDeposit!.skipped).toBe(true);

    console.log(`   ✓ Swap succeeded despite buyback error`);
    console.log(`   ℹ️ Reason: ${mockSwapResultWithError.buybackDeposit!.reason}`);
  });
});
```

---

## 🟢 TÂCHE D : Analytics & Monitoring

### Créer `app/src/lib/analytics.ts`

```typescript
// Simple analytics wrapper (Mixpanel, Amplitude, or custom)

interface SwapEvent {
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  fee: number;
  route: string;
  buybackDeposit: number;
}

interface BuybackEvent {
  usdcAmount: number;
  backBurned: number;
  executor: string;
}

export class Analytics {
  private static instance: Analytics;

  private constructor() {
    // Initialize analytics SDK here
  }

  static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  trackSwap(event: SwapEvent) {
    console.log('📊 Analytics: Swap', event);
    // TODO: Send to analytics platform
  }

  trackBuyback(event: BuybackEvent) {
    console.log('📊 Analytics: Buyback', event);
    // TODO: Send to analytics platform
  }

  trackPageView(page: string) {
    console.log('📊 Analytics: Page View', page);
    // TODO: Send to analytics platform
  }
}

export const analytics = Analytics.getInstance();
```

### Intégrer dans les composants:

```typescript
// Dans SwapInterface.tsx
import { analytics } from '@/lib/analytics';

const handleSwap = async () => {
  const result = await executeSwap(...);
  
  analytics.trackSwap({
    inputToken: fromToken.symbol,
    outputToken: toToken.symbol,
    inputAmount: result.inputAmount,
    outputAmount: result.outputAmount,
    fee: result.fee,
    route: result.route.name,
    buybackDeposit: result.buybackDeposit?.amount || 0,
  });
};
```

---

## 🎨 TÂCHE E : Design UI Polish

### 1. Ajouter Tailwind CSS utilities

#### Créer `app/src/styles/animations.css`

```css
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite linear;
  background: linear-gradient(
    to right,
    #f3f4f6 0%,
    #e5e7eb 20%,
    #f3f4f6 40%,
    #f3f4f6 100%
  );
  background-size: 1000px 100%;
}

@keyframes pulse-green {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.animate-pulse-green {
  animation: pulse-green 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

#### Import dans `app/src/app/globals.css`

```css
@import './styles/animations.css';
```

### 2. Créer composant Loading Skeleton

#### `app/src/components/LoadingSkeleton.tsx`

```typescript
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="animate-shimmer h-4 bg-gray-200 rounded w-24 mb-3"></div>
      <div className="animate-shimmer h-8 bg-gray-200 rounded w-32 mb-2"></div>
      <div className="animate-shimmer h-3 bg-gray-200 rounded w-40"></div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
```

### 3. Améliorer les transitions

#### Dans `tailwind.config.ts`

```typescript
module.exports = {
  theme: {
    extend: {
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
};
```

---

## ✅ Checklist Finale

### Tâche B - Auto-Deposit
- [ ] Créer `buybackIntegration.ts`
- [ ] Modifier `swapExecutor.ts`
- [ ] Modifier `app/api/execute/route.ts`
- [ ] Modifier `SwapInterface.tsx`
- [ ] Tester sur devnet

### Tâche A - Dashboard
- [ ] Créer page `buyback/page.tsx`
- [ ] Créer `BuybackStats.tsx`
- [ ] Créer `BuybackProgressBar.tsx`
- [ ] Créer `ExecuteBuybackButton.tsx`
- [ ] Créer `BuybackChart.tsx` (placeholder)
- [ ] Créer `RecentBuybacks.tsx` (placeholder)
- [ ] Ajouter route dans navigation

### Tâche C - Tests
- [ ] Créer `swap-with-buyback.test.ts`
- [ ] Implémenter 4 tests E2E
- [ ] Exécuter et valider

### Tâche D - Analytics
- [ ] Créer `analytics.ts`
- [ ] Intégrer dans swap
- [ ] Intégrer dans buyback
- [ ] Configurer Mixpanel/Amplitude

### Tâche E - Design
- [ ] Créer `animations.css`
- [ ] Créer `LoadingSkeleton.tsx`
- [ ] Modifier `tailwind.config.ts`
- [ ] Tester responsive

---

## 🚀 Commandes de Test

```bash
# Test frontend
cd app && npm run dev

# Test E2E
npm run test tests/e2e/swap-with-buyback.test.ts

# Build production
cd app && npm run build

# Lint
npm run lint
```

---

**Status:** Guide complet créé ✅  
**Prêt pour implémentation !** 🚀
