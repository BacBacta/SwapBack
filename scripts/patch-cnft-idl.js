#!/usr/bin/env node

/**
 * Patch CNFT IDL to add complete account definitions
 * Anchor 0.30+ doesn't include account fields in IDL by default
 */

const fs = require('fs');
const path = require('path');

// Patch all CNFT IDL copies
const targetIdlPath = path.join(__dirname, '../target/idl/swapback_cnft.json');
const appIdlPath = path.join(__dirname, '../app/src/idl/swapback_cnft.json');

// Prefer target IDL (fresh anchor build). If missing, fall back to app copy.
const sourcePath = fs.existsSync(targetIdlPath) ? targetIdlPath : appIdlPath;
if (!fs.existsSync(sourcePath)) {
  console.error('❌ Unable to find source CNFT IDL. Run `anchor build` first.');
  process.exit(1);
}

const idl = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

// Complete account definitions based on Rust structs
const accountDefinitions = {
  GlobalState: {
    type: {
      kind: 'struct',
      fields: [
        { name: 'authority', type: 'pubkey' },
        { name: 'backToken', type: 'pubkey' },
        { name: 'backTokenDecimals', type: 'u8' },
        { name: 'usdcMint', type: 'pubkey' },
        { name: 'usdcDecimals', type: 'u8' },
        { name: 'feeRecipient', type: 'pubkey' },
        { name: 'baseFee', type: 'u16' },
        { name: 'nftBoostBps', type: 'u16' },
        { name: 'vipTierCount', type: 'u8' },
        { name: 'isPaused', type: 'bool' },
        { name: 'rebateVault', type: 'pubkey' },
        { name: 'buybackWallet', type: 'pubkey' },
        { name: 'lockVault', type: 'pubkey' },
        { name: 'lockVaultAuthority', type: 'pubkey' },
        { name: 'bump', type: 'u8' }
      ]
    }
  },
  
  CollectionConfig: {
    type: {
      kind: 'struct',
      fields: [
        { name: 'authority', type: 'pubkey' },
        { name: 'collectionMint', type: 'pubkey' },
        { name: 'boostBps', type: 'u16' },
        { name: 'isActive', type: 'bool' },
        { name: 'bump', type: 'u8' }
      ]
    }
  },

  UserLock: {
    type: {
      kind: 'struct',
      fields: [
        { name: 'user', type: 'pubkey' },
        { name: 'totalLocked', type: 'u64' },
        { name: 'npiBalance', type: 'u64' },
        { name: 'lastClaimAt', type: 'i64' },
        { name: 'lockStart', type: 'i64' },
        { name: 'lockEnd', type: 'i64' },
        { name: 'bump', type: 'u8' }
      ]
    }
  },

  UserNpiBalance: {
    type: {
      kind: 'struct',
      fields: [
        { name: 'user', type: 'pubkey' },
        { name: 'balance', type: 'u64' },
        { name: 'lastUpdated', type: 'i64' },
        { name: 'bump', type: 'u8' }
      ]
    }
  }
};

// Ensure accounts array exists
if (!idl.accounts) {
  idl.accounts = [];
}

// Merge definitions: keep discriminators, add/update type fields
let patchedCount = 0;
let totalCount = 0;

for (const [name, definition] of Object.entries(accountDefinitions)) {
  totalCount++;
  const existingIdx = idl.accounts.findIndex(acc => acc.name === name);
  
  if (existingIdx >= 0) {
    // Update existing entry
    const existing = idl.accounts[existingIdx];
    if (!existing.type || !existing.type.fields) {
      idl.accounts[existingIdx] = {
        ...existing,
        ...definition
      };
      patchedCount++;
    }
  } else {
    // Add new entry (should have discriminator from Rust)
    console.warn(`⚠️  Account ${name} not found in IDL, skipping`);
  }
}

// Write patched IDL to all locations
const destinations = [targetIdlPath, appIdlPath];
destinations.forEach(dest => {
  if (fs.existsSync(path.dirname(dest))) {
    fs.writeFileSync(dest, JSON.stringify(idl, null, 2));
  }
});

console.log(`✅ CNFT IDL patched successfully with account definitions`);
console.log(`   Written to: ${destinations.filter(d => fs.existsSync(path.dirname(d))).join(', ')}`);
console.log(`   Patched accounts (${patchedCount}/${totalCount}): ${Object.keys(accountDefinitions).join(', ')}`);
