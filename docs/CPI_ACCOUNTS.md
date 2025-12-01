# CPI Accounts Documentation

## Jupiter CPI replay

The SwapBack router executes Jupiter swaps via **CPI replay**. This means:

1. The keeper builds a complete Jupiter swap instruction off-chain
2. The instruction data (`jupiter_swap_ix_data`) and accounts (`remaining_accounts`) are passed to `swap_toc`
3. The program reconstructs and invokes the Jupiter instruction via CPI

```rust
// From cpi_jupiter.rs
pub fn swap_with_balance_deltas<'info>(
    jupiter_program: &AccountInfo<'info>,
    remaining_accounts: &[AccountInfo<'info>],
    user_source_ata: &AccountInfo<'info>,
    user_dest_ata: &AccountInfo<'info>,
    amount_in: u64,
    min_out: u64,
    swap_ix_data: &[u8],
    signer_seeds: &[&[&[u8]]],
) -> Result<u64>
```

The program:
1. Snapshots token balances before CPI
2. Builds `AccountMeta` array from `remaining_accounts`
3. Invokes Jupiter program
4. Calculates `amount_out` from balance deltas
5. Verifies `amount_out >= min_out`

---

## Account ordering

**CRITICAL**: The `remaining_accounts` array must match the **exact order** expected by Jupiter's instruction.

### Convention

```
remaining_accounts[0] = Jupiter program ID (required first)
remaining_accounts[1] = First account from Jupiter route
remaining_accounts[2] = Second account from Jupiter route
...
remaining_accounts[N] = Last account from Jupiter route
```

Each entry must include:
- `pubkey`: The account's public key
- `is_signer`: Whether this account signs the transaction
- `is_writable`: Whether this account is modified

### Example structure

```typescript
interface AccountMeta {
  pubkey: string;      // Base58 encoded
  isSigner: boolean;
  isWritable: boolean;
}

// Example remaining_accounts for a Jupiter swap
const remainingAccounts: AccountMeta[] = [
  { pubkey: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", isSigner: false, isWritable: false },
  { pubkey: "<user_source_ata>", isSigner: false, isWritable: true },
  { pubkey: "<user_dest_ata>", isSigner: false, isWritable: true },
  { pubkey: "<pool_account>", isSigner: false, isWritable: true },
  // ... more accounts as required by the route
];
```

---

## Writable/Signer flags

### How to determine flags

1. **From Jupiter API**: The `/swap` response includes account metas with correct flags
2. **General rules**:
   - User's source ATA: `isWritable: true`, `isSigner: false`
   - User's destination ATA: `isWritable: true`, `isSigner: false`
   - Pool/AMM accounts: `isWritable: true`, `isSigner: false`
   - Program IDs: `isWritable: false`, `isSigner: false`
   - User authority: Usually `isSigner: true` at transaction level

### Why flags must match

The Solana runtime validates:
- Writable accounts must be marked writable in the transaction
- Signer accounts must actually sign
- Mismatches cause transaction failure

```rust
// The program reconstructs metas from AccountInfo
let metas: Vec<AccountMeta> = remaining_accounts
    .iter()
    .map(|ai| AccountMeta {
        pubkey: *ai.key,
        is_signer: ai.is_signer,
        is_writable: ai.is_writable,
    })
    .collect();
```

---

## Common pitfalls

### 1. ATA incorrect

**Problem**: Using wrong Associated Token Account (ATA)

**Solution**: Always derive ATAs correctly:
```typescript
import { getAssociatedTokenAddress } from "@solana/spl-token";

const userSourceAta = await getAssociatedTokenAddress(
  tokenMint,
  userPublicKey
);
```

### 2. Mint mismatch

**Problem**: Token mint doesn't match expected input/output

**Solution**: Verify mints before building transaction:
```typescript
const sourceAccount = await getAccount(connection, userSourceAta);
assert(sourceAccount.mint.equals(expectedInputMint));
```

### 3. Owner mismatch

**Problem**: ATA owner is not the expected user

**Solution**: Check ATA owner:
```typescript
const account = await getAccount(connection, ata);
assert(account.owner.equals(userPublicKey));
```

### 4. Missing sysvar/token program

**Problem**: Jupiter instruction requires system programs not included

**Solution**: Include standard programs:
```typescript
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
```

### 5. Account order mismatch

**Problem**: Accounts provided in wrong order

**Solution**: Preserve exact order from Jupiter API response

---

## Mock route

For offline testing without network access, we use a **mock route** based on SPL Token transfer:

```typescript
// Mock swap = SPL token transfer instruction
import { createTransferInstruction } from "@solana/spl-token";

const mockInstruction = createTransferInstruction(
  fromAta,      // source
  toAta,        // destination
  authority,    // owner/authority
  amount        // amount in smallest units
);

// Extract instruction data
const ixData = mockInstruction.data;  // Buffer

// Build remaining_accounts
const remainingAccounts = [
  { pubkey: TOKEN_PROGRAM_ID.toBase58(), isSigner: false, isWritable: false },
  { pubkey: fromAta.toBase58(), isSigner: false, isWritable: true },
  { pubkey: toAta.toBase58(), isSigner: false, isWritable: true },
  { pubkey: authority.toBase58(), isSigner: true, isWritable: false },
];
```

This allows:
- Testing account ordering logic
- Validating JSON schema compliance
- Running CI without network dependencies

See [scripts/prepare-mock-route.ts](../scripts/prepare-mock-route.ts) for implementation.
