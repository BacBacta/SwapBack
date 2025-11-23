#!/usr/bin/env node

/**
 * Patch IDL to add complete account definitions
 * Anchor 0.30+ doesn't include account fields in IDL by default
 */

const fs = require('fs');
const path = require('path');

// Patch both target IDL (source) and app IDL (deployed)
const targetIdlPath = path.join(__dirname, '../target/idl/swapback_router.json');
const appIdlPath = path.join(__dirname, '../app/src/idl/swapback_router.json');

// Read from target (build output)
const idl = JSON.parse(fs.readFileSync(targetIdlPath, 'utf8'));

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
  SwapPlan: {
    type: {
      kind: 'struct',
      fields: [
        { name: 'planId', type: { array: ['u8', 32] } },
        { name: 'user', type: 'pubkey' },
        { name: 'tokenIn', type: 'pubkey' },
        { name: 'tokenOut', type: 'pubkey' },
        { name: 'amountIn', type: 'u64' },
        { name: 'minOut', type: 'u64' },
        { name: 'venues', type: { vec: { defined: 'VenueWeight' } } },
        { name: 'fallbackPlans', type: { vec: { defined: 'FallbackPlan' } } },
        { name: 'expiresAt', type: 'i64' },
        { name: 'createdAt', type: 'i64' },
        { name: 'bump', type: 'u8' }
      ]
    }
  },
  OracleCache: {
    type: {
      kind: 'struct',
      fields: [
        { name: 'tokenPair', type: { array: ['pubkey', 2] } },
        { name: 'cachedPrice', type: 'u64' },
        { name: 'cachedAt', type: 'i64' },
        { name: 'cacheDuration', type: 'i64' },
        { name: 'bump', type: 'u8' }
      ]
    }
  },
  VenueScore: {
    type: {
      kind: 'struct',
      fields: [
        { name: 'venue', type: 'pubkey' },
        { name: 'venueType', type: { defined: 'VenueType' } },
        { name: 'totalSwaps', type: 'u64' },
        { name: 'totalVolume', type: 'u64' },
        { name: 'totalNpiGenerated', type: 'i64' },
        { name: 'avgLatencyMs', type: 'u32' },
        { name: 'avgSlippageBps', type: 'u16' },
        { name: 'qualityScore', type: 'u16' },
        { name: 'lastUpdated', type: 'i64' },
        { name: 'windowStart', type: 'i64' }
      ]
    }
  },
  UserNft: {
    type: {
      kind: 'struct',
      fields: [
        { name: 'user', type: 'pubkey' },
        { name: 'level', type: { defined: 'LockLevel' } },
        { name: 'amountLocked', type: 'u64' },
        { name: 'lockDuration', type: 'i64' },
        { name: 'boost', type: 'u16' },
        { name: 'mintTime', type: 'i64' },
        { name: 'isActive', type: 'bool' }
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

// Patch accounts - copy definitions from types if missing
if (idl.accounts && Array.isArray(idl.accounts)) {
  idl.accounts = idl.accounts.map(account => {
    // Try manual definitions first
    let definition = accountDefinitions[account.name];
    
    // If no manual definition, check if it exists in types[]
    if (!definition && idl.types) {
      const typeDefinition = idl.types.find(t => t.name === account.name);
      if (typeDefinition) {
        definition = { type: typeDefinition.type };
      }
    }
    
    if (definition) {
      return {
        ...account,
        ...definition
      };
    }
    return account;
  });
}

// Write patched IDL to both locations
fs.writeFileSync(targetIdlPath, JSON.stringify(idl, null, 2));
fs.writeFileSync(appIdlPath, JSON.stringify(idl, null, 2));
console.log('✅ IDL patched successfully with account definitions');
console.log(`   Written to: target/idl/ and app/src/idl/`);

// Verify all accounts have type definitions
const patchedAccounts = idl.accounts.filter(acc => acc.type && acc.type.fields);
const missingAccounts = idl.accounts.filter(acc => !acc.type || !acc.type.fields);
console.log(`Patched accounts (${patchedAccounts.length}/${idl.accounts.length}): ${patchedAccounts.map(a => a.name).join(', ')}`);
if (missingAccounts.length > 0) {
  console.warn(`⚠️  Still missing: ${missingAccounts.map(a => a.name).join(', ')}`);
}
