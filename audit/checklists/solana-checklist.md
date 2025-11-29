# Solana/Anchor Security Checklist

## Account Validation

### Signer Verification

- [ ] All user-initiated actions require proper signer
- [ ] Admin functions have appropriate access controls
- [ ] Multi-sig requirements where appropriate

### Account Ownership

- [ ] Token accounts verified to be owned by expected program
- [ ] System accounts validated
- [ ] PDA ownership verified

### PDA Security

- [ ] Seeds are deterministic and unique
- [ ] Bump seed stored and reused correctly
- [ ] No seed collision possibilities

### Account Data Validation

- [ ] Account discriminators checked
- [ ] Data size validated before deserialization
- [ ] Null/default value checks

## Arithmetic Safety

### Overflow/Underflow

- [ ] All arithmetic uses checked_* or saturating_* operations
- [ ] Token amounts handle decimals correctly
- [ ] Large number calculations verified

### Precision Loss

- [ ] Division operations ordered correctly (multiply before divide)
- [ ] Rounding behavior is documented and intentional
- [ ] Percentage calculations maintain precision

## State Management

### Initialization

- [ ] Accounts can only be initialized once
- [ ] Default values are safe
- [ ] Required fields are properly set

### State Transitions

- [ ] All state changes are validated
- [ ] Impossible states are unreachable
- [ ] State machine logic is correct

### Finalization

- [ ] Accounts can be properly closed
- [ ] Rent returned to correct address
- [ ] No data left in closed accounts

## Token Operations

### Transfer Safety

- [ ] Transfer amounts validated
- [ ] Sufficient balance checks
- [ ] Correct source/destination accounts

### Mint/Burn

- [ ] Mint authority properly verified
- [ ] Burn amounts validated
- [ ] Supply tracking accurate

## Time-Based Logic

### Clock Usage

- [ ] Clock account validated
- [ ] Timestamp manipulation resistance
- [ ] Timezone considerations (UTC)

### Duration Calculations

- [ ] Lock periods calculated correctly
- [ ] No off-by-one errors

## Cross-Program Invocations (CPI)

### CPI Safety

- [ ] Return values checked
- [ ] Called program verified
- [ ] Signer seeds correct

### Reentrancy

- [ ] State updated before CPI
- [ ] No unexpected callbacks
- [ ] Invariants maintained across calls

## Error Handling

### Error Messages

- [ ] Meaningful error codes
- [ ] No sensitive data in errors
- [ ] Consistent error handling
