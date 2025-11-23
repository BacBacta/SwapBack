#!/usr/bin/env node

/**
 * Patch IDL to add complete account definitions
 * Anchor 0.30+ doesn't include account fields in IDL by default
 */

const fs = require('fs');
const path = require('path');

const idlPath = path.join(__dirname, '../target/idl/swapback_router.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

// Complete account definitions based on Rust structs
const accountDefinitions = {
  DcaPlan: {
    type: {
      kind: 'struct',
      fields: [
        { name: 'planId', type: { array: ['u8', 32] } },
        { name: 'user', type: 'pubkey' },
        { name: 'tokenIn', type: 'pubkey' },
        { name: 'tokenOut', type: 'pubkey' },
        { name: 'amountPerSwap', type: 'u64' },
        { name: 'totalSwaps', type: 'u32' },
        { name: 'executedSwaps', type: 'u32' },
        { name: 'intervalSeconds', type: 'i64' },
        { name: 'nextExecution', type: 'i64' },
        { name: 'minOutPerSwap', type: 'u64' },
        { name: 'createdAt', type: 'i64' },
        { name: 'expiresAt', type: 'i64' },
        { name: 'isActive', type: 'bool' },
        { name: 'totalInvested', type: 'u64' },
        { name: 'totalReceived', type: 'u64' },
        { name: 'bump', type: 'u8' }
      ]
    }
  },
  RouterState: {
    type: {
      kind: 'struct',
      fields: [
        { name: 'authority', type: 'pubkey' },
        { name: 'rebatePercentage', type: 'u16' },
        { name: 'treasuryPercentage', type: 'u16' },
        { name: 'boostVaultPercentage', type: 'u16' },
        { name: 'totalSwaps', type: 'u64' },
        { name: 'totalVolume', type: 'u64' },
        { name: 'totalFees', type: 'u64' },
        { name: 'totalRebates', type: 'u64' },
        { name: 'bump', type: 'u8' }
      ]
    }
  },
  UserRebate: {
    type: {
      kind: 'struct',
      fields: [
        { name: 'user', type: 'pubkey' },
        { name: 'totalRebates', type: 'u64' },
        { name: 'claimedRebates', type: 'u64' },
        { name: 'lastClaimAt', type: 'i64' },
        { name: 'bump', type: 'u8' }
      ]
    }
  },
  RouterConfig: {
    type: {
      kind: 'struct',
      fields: [
        { name: 'authority', type: 'pubkey' },
        { name: 'pendingAuthority', type: { option: 'pubkey' } },
        { name: 'rebateBps', type: 'u16' },
        { name: 'treasuryBps', type: 'u16' },
        { name: 'boostVaultBps', type: 'u16' },
        { name: 'treasuryFromFeesBps', type: 'u16' },
        { name: 'buyburnFromFeesBps', type: 'u16' },
        { name: 'dynamicSlippageEnabled', type: 'bool' },
        { name: 'npiBenchmarkingEnabled', type: 'bool' },
        { name: 'bump', type: 'u8' }
      ]
    }
  }
};

// Patch accounts
if (idl.accounts && Array.isArray(idl.accounts)) {
  idl.accounts = idl.accounts.map(account => {
    const definition = accountDefinitions[account.name];
    if (definition) {
      return {
        ...account,
        ...definition
      };
    }
    return account;
  });
}

// Write patched IDL
fs.writeFileSync(idlPath, JSON.stringify(idl, null, 2));
console.log('✅ IDL patched successfully with account definitions');
console.log(`Patched accounts: ${Object.keys(accountDefinitions).join(', ')}`);
