# TypeScript Fixes Required

## Issue 1: Line 266 - PublicKey assignment error
Location: `sdk/src/services/LiquidityDataCollector.ts:266`
Error: Argument of type 'PublicKey' is not assignable to parameter of type 'string'
Context: Function expects string but receiving PublicKey
Fix: Use `.toBase58()` to convert PublicKey to string

## Issue 2: Line 290 - Missing inputMint property
Location: `sdk/src/services/LiquidityDataCollector.ts:290`
Error: Property `inputMint` doesn't exist in type `LiquiditySource`
Context: LiquiditySource interface expects `tokenPair: [string, string]` not separate inputMint/outputMint
Fix: Use correct interface structure

## Issue 3: Line 293 - calculateTotalLiquidity doesn't exist
Location: `sdk/src/services/LiquidityDataCollector.ts:293`
Error: Method `calculateTotalLiquidity` doesn't exist on type `LiquidityDataCollector`
Context: Need to either create this method or calculate differently
Fix: Create the missing method or inline the calculation

