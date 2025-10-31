# 🪙 $BACK Tokenomics

**Token Name:** SwapBack  
**Symbol:** $BACK  
**Total Supply:** 1,000,000,000 (1 Billion)  
**Decimals:** 9  
**Blockchain:** Solana  
**Token Standard:** SPL Token  
**Created:** October 31, 2025

---

## 📊 Distribution

| Category | Allocation | Amount | Vesting | Details |
|----------|-----------|--------|---------|---------|
| 💧 **Liquidity Pools** | 30% | 300,000,000 | None | Initial DEX liquidity on Raydium, Orca, Jupiter |
| 👥 **Team** | 20% | 200,000,000 | 2 years | Linear vesting over 24 months, 6-month cliff |
| 🎁 **Community Rewards** | 20% | 200,000,000 | 4 years | Distributed via trading rebates and staking |
| 📢 **Marketing & Partnerships** | 15% | 150,000,000 | 18 months | Growth campaigns, integrations, airdrops |
| 🏦 **Protocol Reserve** | 15% | 150,000,000 | None | Treasury for future development, buybacks |

**Total:** 100% = 1,000,000,000 $BACK

---

## 🔥 Deflationary Mechanism

### Buyback & Burn

SwapBack implements a **continuous deflationary mechanism** through automated buyback and burn:

1. **Revenue Collection:**
   - **30% of routing fees** → Buyback allocation
   - **20% of NPI (routing profit)** → Buyback allocation

2. **Automatic Buyback:**
   - USDC accumulated → Swapped to $BACK via Jupiter
   - Triggered when buyback vault reaches threshold (100 USDC minimum)

3. **Permanent Burn:**
   - **100% of bought $BACK** is permanently burned
   - Reduces circulating supply over time
   - Creates upward price pressure

### Burn Rate Projection

Based on projected volume:

| Daily Volume | Daily Surplus | Daily Buyback USDC | Annual Burn % |
|-------------|---------------|-------------------|---------------|
| $10,000 | $250 | $62.50 | ~2.3% |
| $100,000 | $2,500 | $625 | ~23% |
| $1,000,000 | $25,000 | $6,250 | ~230%* |

*Note: High volume scenarios may result in significant deflation over time.

---

## 🚀 Utility

### 1. Trading Rebates (Primary Use Case)

- **Base Rebates:** 60% of routing profit returned to users
- **Boosted Rebates:** Up to +20% bonus with $BACK locked

**Example:**
- Swap generates 50 USDC routing profit
- Base rebate: 30 USDC (60%)
- With 1M $BACK locked for 180 days → **+8.65 USDC bonus** (17.3% boost)
- **Total rebate: 38.65 USDC**

### 2. Boost System (Lock & Earn)

Lock $BACK to earn boosted rebates on every swap:

**Dynamic Boost Formula:**
```
amount_score = min((tokens / 10,000) × 100, 1000 BP)  // Max 10%
duration_score = min((days / 5) × 10, 1000 BP)        // Max 10%
total_boost = min(amount_score + duration_score, 2000 BP)  // Max 20%
```

**Boost Tiers (Examples):**

| Tokens Locked | Duration | Boost % | Example Rebate Increase |
|--------------|----------|---------|------------------------|
| 50,000 | 30 days | 1.1% | $50 → $50.55 |
| 500,000 | 90 days | 6.8% | $50 → $53.40 |
| 2,000,000 | 180 days | 17.3% | $50 → $58.65 |
| 10,000,000 | 365 days | 20% (max) | $50 → $60 |

### 3. Governance (Future)

- Vote on protocol parameters
- Propose new features
- Allocate treasury funds

### 4. Protocol Benefits

- Reduced trading fees (planned)
- Priority routing (planned)
- Exclusive features access

---

## 💎 Value Accrual

$BACK captures value through multiple mechanisms:

### 1. **Continuous Buyback Pressure**
- 20-30% of all protocol revenue buys $BACK
- Creates consistent buy pressure regardless of market conditions
- Automated and transparent on-chain

### 2. **Supply Reduction**
- 100% of bought tokens permanently burned
- Circulating supply decreases over time
- Remaining tokens become more scarce

### 3. **Utility Demand**
- Users need $BACK to access boosted rebates
- Higher volume = more incentive to lock $BACK
- Creates natural demand from power users

### 4. **Protocol Growth**
- As SwapBack grows, more revenue → more buybacks
- Network effects: better routes → more users → higher revenue
- Positive feedback loop

---

## 📈 Launch Strategy

### Phase 1: Token Creation (Week 1)
- ✅ Create $BACK token on Solana
- ✅ Initialize metadata
- ✅ Distribute to allocation wallets

### Phase 2: Liquidity Bootstrap (Week 2)
- Create BACK/USDC pool on Raydium
- Create BACK/SOL pool on Orca
- Seed initial liquidity (300M $BACK)
- Enable trading

### Phase 3: Integration (Week 2-3)
- Update SwapBack contracts with $BACK address
- Enable boost system
- Deploy buyback mechanism
- Test end-to-end

### Phase 4: Marketing Launch (Week 4)
- Public announcement
- Trading competitions
- Airdrop campaign (from Marketing allocation)
- Beta user rewards

---

## 🔐 Security Measures

### Mint Authority
- **Devnet:** Developer wallet (testing)
- **Mainnet:** Multisig (2/3) or **Revoked** after distribution

### Token Accounts
- **Team:** Time-locked with Streamflow
- **Community Rewards:** Controlled by protocol smart contracts
- **Marketing:** Multisig for approvals
- **Treasury:** DAO-controlled (future)

### Audits
- Tokens follow standard SPL Token program (battle-tested)
- Smart contracts audited by [TBD]
- Continuous monitoring via Sentry

---

## 📅 Vesting Schedule

### Team (200M, 2-year vesting)

| Month | Unlock | Tokens Released | Cumulative |
|-------|--------|----------------|-----------|
| 0-6 | 0% (Cliff) | 0 | 0 |
| 7 | 4.17% | 8,340,000 | 8,340,000 |
| 8-24 | 4.17%/mo | 8,340,000/mo | 200,000,000 |

**Example:**
- Month 6: 0 tokens
- Month 12: 50M tokens (~25%)
- Month 24: 200M tokens (100%)

### Marketing (150M, 18-month distribution)

| Quarter | Campaign | Tokens | Purpose |
|---------|----------|--------|---------|
| Q1 | Launch | 30M | Airdrops, competitions, early adopters |
| Q2 | Growth | 30M | Integrations, partnerships, liquidity incentives |
| Q3 | Expansion | 30M | New markets, ambassadors, events |
| Q4 | Sustainability | 30M | Ongoing campaigns, retention |
| Q5-Q6 | Reserve | 30M | Strategic opportunities |

---

## 🎯 Success Metrics

### Year 1 Targets

| Metric | Target | Impact on $BACK |
|--------|--------|----------------|
| Daily Volume | $1M+ | High buyback pressure |
| Total Burned | 5-10% | Supply reduction |
| Active Lockers | 1,000+ | Demand for boost |
| Circulating Supply | <900M | Scarcity increase |

### Long-term Vision

- **Year 2:** 20-30% of supply burned
- **Year 3:** Deflationary equilibrium (burns > inflation)
- **Year 5:** $BACK becomes primary value capture mechanism for DeFi routing

---

## ⚠️ Disclaimer

$BACK is a utility token for the SwapBack protocol. It is not an investment vehicle, security, or promise of returns. Value is derived solely from protocol utility and market dynamics. Cryptocurrency investments carry risk. DYOR (Do Your Own Research).

---

## 📞 Resources

- **Website:** https://swapback.io
- **Documentation:** https://docs.swapback.io
- **Twitter:** [@SwapBackDEX](https://twitter.com/SwapBackDEX)
- **Discord:** https://discord.gg/swapback
- **GitHub:** https://github.com/BacBacta/SwapBack

---

**Last Updated:** October 31, 2025  
**Version:** 1.0  
**Author:** SwapBack Team
