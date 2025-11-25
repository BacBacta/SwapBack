# SwapBack Security Audit Package

**Project**: SwapBack DEX Aggregator  
**Blockchain**: Solana  
**Programs**: 3 (swapback_cnft, swapback_router, swapback_buyback)  
**Total LOC**: 2,225 lines  
**Audit Type**: Pre-Mainnet Security Review  
**Date**: November 2025

---

## 📋 Project Overview

**SwapBack** is a next-generation DEX aggregator on Solana featuring:

- **Intelligent Routing**: Aggregates liquidity from Jupiter V6, Orca Whirlpools, Raydium, and Lifinity
- **Compressed NFT Locking**: Users lock BACK tokens to receive fee discounts (up to 66% reduction)
- **100% Burn Tokenomics**: All collected fees buy back BACK tokens and burn them permanently
- **DCA Automation**: Dollar-Cost Averaging with configurable frequencies and amounts

### Key Innovations

1. **Fee Reduction via cNFT Locking**
   - Lock BACK tokens for 7 days to 3 years
   - Boost multiplier: 1.0x → 2.7x based on duration + amount
   - Reduces swap fees from 0.3% to as low as 0.1%

2. **Sustainable Deflationary Model**
   - 40% of swap fees → buyback & burn
   - 60% of swap fees → protocol treasury
   - No mint authority = true burn

3. **MEV Protection**
   - Jito bundle integration for atomic execution
   - Oracle-based price validation (Switchboard V2)
   - Slippage protection (max 10%)

---

## 🎯 Audit Scope

### In-Scope Programs

#### 1. swapback_cnft (395 LOC)
**File**: `programs/swapback_cnft/src/lib.rs`  
**Purpose**: Compressed NFT minting with token locking mechanism

**Key Functions**:
- `mint_level_nft`: Mint cNFT with locked BACK tokens
- `update_nft_status`: Activate/deactivate NFT
- `unlock_tokens`: Unlock BACK after expiration
- `calculate_boost_multiplier`: Compute fee reduction based on lock

**Critical Areas**:
- Boost calculation math (time + amount factors)
- Lock duration validation (7 days - 3 years)
- NFT ownership verification
- Token unlock authorization

**Program ID (Devnet)**: `9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw`

---

#### 2. swapback_router (1,250 LOC) 🔴 **PRIORITY**
**File**: `programs/swapback_router/src/lib.rs`  
**Purpose**: Main swap aggregation and routing logic

**Key Functions**:
- `process_swap_toc`: Execute swap with token accounts
- `calculate_fee`: Compute swap fees with boost reduction
- `query_jupiter_route`: Get best route from Jupiter V6
- `execute_cpi_swap`: Execute CPI to DEX programs
- DCA functions: `create_dca_plan`, `execute_dca_swap`, etc.

**Critical Areas**:
- **CPI Security**: Validate all calls to Jupiter, Orca, Raydium
- **Token Account Validation**: Ensure proper ownership/mint checks
- **Fee Calculation**: Verify overflow protection and correctness
- **Access Control**: Authorization checks for all state mutations
- **Oracle Integration**: Price validation and staleness checks
- **Slippage Protection**: Enforce max 10% slippage

**Program ID (Devnet)**: `GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt`

---

#### 3. swapback_buyback (580 LOC)
**File**: `programs/swapback_buyback/src/lib.rs`  
**Purpose**: Token buyback from collected fees and permanent burn

**Key Functions**:
- `initialize_buyback_state`: Setup buyback system
- `distribute_to_community_boost`: Distribute fees to locked NFT holders
- `execute_buyback`: Buy BACK tokens with collected USDC (via Jupiter)
- `burn_back_tokens`: Permanently burn bought tokens

**Critical Areas**:
- **Distribution Math**: Verify fee allocation (40% buyback, 60% treasury)
- **Buyback Execution**: Secure CPI to Jupiter for token purchase
- **Burn Verification**: Ensure tokens are permanently removed
- **Access Control**: Only admin can trigger buyback/burn
- **Overflow Protection**: All arithmetic uses `checked_*`

**Program ID (Devnet)**: `EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf`

---

### Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| anchor-lang | 0.30.1 | Solana framework |
| anchor-spl | 0.30.1 | SPL token integration |
| solana-program | 1.18.26 | Solana runtime |
| switchboard-v2 | Latest | Oracle price feeds |

---

## 🚨 Known Issues & Fixes

### ✅ Resolved (Internal Audit - Oct 26, 2025)

1. **CRITICAL - Buyback unwrap() crashes** (Score impact: 7.3 → 8.0)
   - **Issue**: 3× `unwrap()` in production code could panic
   - **Fix**: Replaced with `.ok_or(ErrorCode::MathOverflow)?`
   - **Status**: ✅ Fixed

2. **CRITICAL - Router missing input validation** (Score impact: 6.0 → 7.5)
   - **Issue**: No `require!` checks on swap parameters
   - **Fix**: Added validation for `amount_in`, `min_out`, `slippage`
   - **Status**: ✅ Fixed

3. **HIGH - Missing error codes**
   - **Issue**: Custom errors not defined
   - **Fix**: Added `InvalidAmount`, `SlippageTooHigh`, `MathOverflow`
   - **Status**: ✅ Fixed

### ⚠️ Remaining Issues (High Priority)

1. **HIGH - Token account constraints** (Router)
   - **Issue**: Missing `constraint = token_account.owner == user.key()`
   - **Risk**: Unauthorized token drain
   - **Recommendation**: Add explicit ownership checks

2. **HIGH - CPI security validations** (Buyback)
   - **Issue**: Jupiter CPI not fully validated
   - **Risk**: Malicious program could exploit
   - **Recommendation**: Validate all CPI accounts

3. **MEDIUM - Lock expiration enforcement** (CNFT)
   - **Issue**: No automatic expiration check
   - **Risk**: Users might lock indefinitely
   - **Recommendation**: Add time-based expiration

---

## 🔍 Focus Areas for External Audit

### 1. CPI Security (CRITICAL)

**Questions**:
- Are all CPI accounts properly validated?
- Can a malicious program be substituted for Jupiter/Orca?
- Are account seeds and bumps verified correctly?
- Is reentrancy possible via CPI callbacks?

**Test Scenarios**:
```rust
// Test 1: CPI to fake Jupiter program
// Test 2: CPI with incorrect accounts
// Test 3: CPI with mismatched mints
// Test 4: Reentrancy via malicious program
```

---

### 2. Access Control (CRITICAL)

**Questions**:
- Can users modify other users' NFTs?
- Can non-admin trigger buyback/burn?
- Are PDA ownership checks complete?
- Are signer checks enforced everywhere?

**Test Scenarios**:
```rust
// Test 1: User A tries to unlock User B's tokens
// Test 2: Non-admin calls execute_buyback
// Test 3: Fake PDA with correct seeds
// Test 4: Missing signer on critical operations
```

---

### 3. Arithmetic Safety (HIGH)

**Questions**:
- Are all arithmetic operations checked?
- Can any calculation overflow/underflow?
- Are divisions protected against zero?
- Are conversions (u64 ↔ i64) safe?

**Test Scenarios**:
```rust
// Test 1: Max u64 values in fee calculation
// Test 2: Boost calculation with extreme values
// Test 3: Division by zero scenarios
// Test 4: Negative durations
```

---

### 4. Oracle Manipulation (MEDIUM)

**Questions**:
- Can oracle prices be manipulated?
- Is staleness checked (<60s)?
- What happens if oracle fails?
- Is there a fallback mechanism?

**Test Scenarios**:
```rust
// Test 1: Stale price (> 60s old)
// Test 2: Oracle unavailable
// Test 3: Confidence interval too wide
// Test 4: Negative price
```

---

### 5. Business Logic (MEDIUM)

**Questions**:
- Is boost calculation mathematically correct?
- Do fees add up to 100%?
- Is burn truly permanent?
- Are invariants maintained?

**Invariants to Verify**:
```rust
// 1. total_fees_collected = sum(all swap fees) - fees_distributed
// 2. boost_multiplier ∈ [100, 270]
// 3. longer_lock => higher_boost
// 4. slippage <= 10%
// 5. user_balance_before - amount_in == user_balance_after - amount_out
```

---

## 📊 Internal Audit Results

### Security Scores

| Program | Score | Status | Comment |
|---------|-------|--------|---------|
| swapback_cnft | 8.6/10 | ✅ GOOD | Minor improvements needed |
| swapback_router | 7.5/10 | ⚠️ IMPROVED | Was 6.0, fixed critical issues |
| swapback_buyback | 8.0/10 | ⚠️ IMPROVED | Was 7.3, fixed unwrap()s |
| **AVERAGE** | **8.0/10** | **GOOD** | Ready for external review |

### Vulnerabilities Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | ✅ All fixed |
| 🟡 HIGH | 3 | ⏳ In progress |
| 🟢 MEDIUM | 4 | 📋 Tracked |
| 🟢 LOW | 5 | 📋 Nice-to-have |

### Test Coverage

- **Unit Tests**: 25/25 passing ✅
- **Integration Tests**: 4 oracle tests passing ✅
- **Fuzzing Tests**: Setup complete, ready to run ⏳
- **E2E Tests**: In progress on devnet ⏳

---

## 🧪 Testing Evidence

### Automated Tools

```bash
# Cargo audit
cargo audit
# Result: No vulnerabilities found ✅

# Clippy (strict)
cargo clippy -- -D warnings
# Result: 0 warnings ✅

# Security-specific clippy
cargo clippy -- \
  -W clippy::unwrap_used \
  -W clippy::expect_used \
  -W clippy::panic
# Result: All in test code only ✅

# Build with overflow checks
RUSTFLAGS="-C overflow-checks=on" cargo build-sbf
# Result: Build successful ✅
```

### Fuzzing Setup

We have prepared 5 fuzzing targets:

1. **fuzz_swap**: Input validation (amount, slippage)
2. **fuzz_fee_calculation**: Fee math with boost
3. **fuzz_oracle_price**: Oracle price validation
4. **fuzz_boost**: cNFT boost calculation
5. **fuzz_lock_duration**: Lock/unlock logic

**Status**: Ready to run 24h+ fuzzing campaign

---

## 💰 Budget & Timeline

### Proposed Budget

| Audit Type | Cost Estimate | Timeframe |
|------------|---------------|-----------|
| **Standard Audit** | $30k - $40k | 2-3 weeks |
| **Comprehensive Audit** | $40k - $50k | 3-4 weeks |
| **Re-Audit (post-fixes)** | $5k - $10k | 3-5 days |

**Our Budget**: **$35,000 - $50,000 USD**

### Timeline

| Phase | Duration | Notes |
|-------|----------|-------|
| Audit kickoff | 1 day | Share access, Q&A |
| Initial review | 1 week | Code analysis |
| Deep dive | 1-2 weeks | Manual testing |
| Report draft | 2-3 days | Findings compilation |
| Fixes & re-review | 1-2 weeks | Our team fixes |
| Final report | 2-3 days | Public report |
| **TOTAL** | **4-6 weeks** | End-to-end |

**Target Mainnet Launch**: Q1 2026

---

## 📞 Contact Information

### Development Team

- **Lead Developer**: [Your Name]
- **Email**: [your-email@swapback.io]
- **Discord**: [your-discord-handle]
- **GitHub**: https://github.com/BacBacta/SwapBack

### Availability

- **Timezone**: UTC+1 (Europe)
- **Availability**: 9am-6pm weekdays, emergency contact 24/7
- **Response Time**: <4 hours for critical questions
- **Communication**: Discord (preferred), Email, Telegram

---

## 📚 Documentation Included

This package contains:

- ✅ **README.md** (this file)
- ✅ **ARCHITECTURE.md** - System architecture and data flow
- ✅ **THREAT_MODEL.md** - Attack vectors and mitigations
- ✅ **INVARIANTS.md** - Critical program invariants
- ✅ **SCOPE.md** - Detailed audit scope
- ✅ **SECURITY_AUDIT_CNFT.md** - Internal audit report (51 pages)
- ✅ **SECURITY_AUDIT_ROUTER.md** - Internal audit report (826 lines)
- ✅ **SECURITY_AUDIT_BUYBACK.md** - Internal audit report (805 lines)
- ✅ **SECURITY_AUDIT_CONSOLIDATED.md** - Summary report
- ✅ **programs/** - Full source code
- ✅ **tests/** - All test files
- ✅ **questions.md** - Questions for auditors

---

## 🎯 Expected Deliverables

We expect the audit to include:

1. **Detailed Report** (PDF + Markdown)
   - Executive summary
   - Severity-ranked findings
   - Code snippets with issues
   - Recommendations for fixes

2. **Test Evidence**
   - Proof-of-concept exploits (if any)
   - Fuzzing results
   - Edge case scenarios

3. **Recommendations**
   - Best practices
   - Architecture improvements
   - Gas optimizations (if applicable)

4. **Re-Audit**
   - Review of fixes
   - Final approval for mainnet

5. **Public Report** (optional)
   - Marketing-friendly summary
   - Permission to use auditor's name

---

## ✅ Pre-Audit Checklist

- [x] All critical issues from internal audit fixed
- [x] Code freeze (no changes during audit)
- [x] Test suite passing 100%
- [x] Documentation complete
- [x] Fuzzing infrastructure ready
- [x] Devnet deployment stable
- [ ] Auditeur selected and contracted
- [ ] Audit timeline agreed
- [ ] Payment terms confirmed

---

## 🚀 Post-Audit Plan

After successful audit:

1. **Fix Issues** (1-2 weeks)
   - Implement all recommendations
   - Re-test thoroughly

2. **Re-Audit** (3-5 days)
   - Verify fixes
   - Get final approval

3. **Testnet Beta** (2-3 weeks)
   - UAT with 10+ beta testers
   - Monitor for issues

4. **Mainnet Launch** (Q1 2026)
   - Deploy to mainnet
   - Gradual rollout
   - 24/7 monitoring

---

## 📝 Questions for Auditors

See `questions.md` for our full list of questions, including:

- Your Solana audit experience
- Tools and methodologies used
- Timeline and team composition
- Deliverables and report format
- Post-audit support
- Public report and marketing

---

## 🔐 Confidentiality

This audit package contains proprietary code and should be treated as confidential until mainnet launch. Please do not share with third parties without written permission.

---

**Thank you for considering auditing SwapBack!**

We believe in building secure, transparent, and sustainable DeFi infrastructure. Your expertise will help us achieve that goal.

_Last updated: November 24, 2025_
