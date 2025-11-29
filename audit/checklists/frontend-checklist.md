# Frontend Security Checklist

## Wallet Integration

### Connection Security
- [ ] Wallet adapter properly configured
- [ ] Connection state managed correctly
- [ ] Disconnect handling implemented
- [ ] Multiple wallet support tested

### Transaction Signing
- [ ] User confirms all transactions
- [ ] Transaction preview before signing
- [ ] Error handling for rejected transactions
- [ ] Timeout handling

### Address Validation
- [ ] Public key format validated
- [ ] User addresses not confused with program addresses

## Input Validation

### Amount Inputs
- [ ] Decimal places limited appropriately
- [ ] Maximum values enforced
- [ ] Negative values prevented
- [ ] Empty/zero handling

### Address Inputs
- [ ] Format validation
- [ ] Length validation
- [ ] Character set validation

### General Inputs
- [ ] XSS prevention (sanitization)
- [ ] Path traversal prevention

## State Management

### React State
- [ ] No sensitive data in component state
- [ ] Proper cleanup on unmount
- [ ] Race condition prevention
- [ ] Optimistic updates handle failures

### Global State (Zustand)
- [ ] State persistence security
- [ ] No sensitive data in persisted state
- [ ] State reset on logout/disconnect

### Local Storage
- [ ] No private keys stored
- [ ] Sensitive data encrypted
- [ ] Expiration implemented

## API Security

### RPC Calls
- [ ] Rate limiting awareness
- [ ] Error handling for RPC failures
- [ ] Fallback RPC endpoints
- [ ] Request validation

### External APIs
- [ ] HTTPS only
- [ ] API key protection
- [ ] Response validation
- [ ] Timeout handling

## Error Handling

### User-Facing Errors
- [ ] No sensitive data exposed
- [ ] Meaningful error messages
- [ ] Recovery options provided

### Silent Failures
- [ ] Critical operations never fail silently
- [ ] Fallbacks documented

## Dependencies

### npm Packages
- [ ] Regular security audits (npm audit)
- [ ] Pinned versions for critical packages
- [ ] No deprecated packages
- [ ] License compliance

## Build & Deploy

### Environment Variables
- [ ] No secrets in frontend code
- [ ] NEXT_PUBLIC_ prefix understood
- [ ] Different configs for dev/prod

### Build Process
- [ ] Source maps disabled in production
- [ ] Console.logs removed
- [ ] Debug code removed
