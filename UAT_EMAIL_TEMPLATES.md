# 📧 Templates Email - UAT Beta Testing

## Template 1: Invitation Initiale

**Sujet**: 🎉 You're invited to SwapBack Beta Testing on Devnet!

---

Hi {{NAME}},

Great news! You've been selected as one of our **exclusive beta testers** for SwapBack on Solana devnet.

### What is SwapBack?

SwapBack is a revolutionary DeFi protocol combining:
- 💎 **Compressed NFT Rewards** with Metaplex Bubblegum
- 🔄 **Boosted Token Swaps** with dynamic rebates
- 💰 **Community-Driven Buybacks** with proportional distribution

### Your Beta Testing Mission

Over the next **3 weeks** (Nov 1-21, 2025), you'll help us:
- ✅ Test all core features (Lock, Swap, Buyback, Dashboard)
- 🐛 Report bugs and UX friction
- 💡 Share feedback to improve the protocol
- 🏆 Compete for early adopter rewards!

### What's in it for you?

As a beta tester, you'll receive:
- 🎁 **Early Adopter cNFT** (exclusive design, on-chain proof)
- 💸 **$BACK Token Airdrop** (mainnet launch bonus)
- 🚀 **Whitelist Access** to future drops and features
- 🏅 **Leaderboard Rewards** for top contributors

### Getting Started (30 minutes)

1. **Join our Discord** beta testing channel:
   👉 [discord.gg/swapback-beta](#) (use code: BETA2025)

2. **Receive your test tokens** (automated airdrop):
   - 2 SOL (transaction fees)
   - 1,000 BACK (locking tests)
   - 100 USDC (swap tests)
   
   Your wallet: `{{WALLET_ADDRESS}}`

3. **Access the UAT Guide**:
   📖 Complete testing scenarios and instructions
   👉 [View UAT Guide](https://github.com/swapback/uat-guide.md)

4. **Access the Devnet App**:
   🌐 https://app-devnet.swapback.io
   (Connect with Phantom/Solflare on devnet)

### Timeline

- **Week 1 (Nov 1-7)**: Lock BACK + Mint cNFT, Swap with Boost
- **Week 2 (Nov 8-14)**: Buyback Distribution, Dashboard
- **Week 3 (Nov 15-21)**: Robustness Tests, Final Feedback

### Need Help?

- 💬 Discord: #beta-testers channel
- 📧 Email: beta@swapback.io
- 📚 Docs: docs.swapback.io/beta

We're thrilled to have you on board! Your feedback will shape the future of SwapBack.

Let's build something amazing together 🚀

---

The SwapBack Team

P.S. If you can't participate, please let us know ASAP so we can invite someone from the waitlist. Thank you!

---

## Template 2: Weekly Update (Weeks 1, 2, 3)

**Sujet**: 📊 SwapBack Beta - Week {{WEEK_NUMBER}} Update & Priorities

---

Hey Beta Testers! 👋

We're now in **Week {{WEEK_NUMBER}}** of our UAT program. Here's what's happening:

### 📈 Progress So Far

- **Active Testers**: {{ACTIVE_TESTERS}} / {{TOTAL_TESTERS}}
- **Scenarios Completed**: {{COMPLETED_SCENARIOS}} / {{TOTAL_SCENARIOS}}
- **Bugs Reported**: {{BUGS_REPORTED}} ({{BUGS_FIXED}} fixed!)
- **Transaction Success Rate**: {{TX_SUCCESS_RATE}}%

{{#if WEEK_1}}
### 🎯 This Week's Focus: Lock & Swap

**Scenario 1: Lock BACK + Mint cNFT** (15-20 min)
- Lock between 50-500 BACK for 30-365 days
- Receive a compressed NFT with boost
- Verify boost appears in dashboard

**Scenario 2: Swap with Boost cNFT** (15-20 min)
- Execute a BACK → USDC swap
- Verify your cNFT boost is applied (+X%)
- Compare rebate with/without boost

**Priority Feedback**:
- How intuitive is the lock duration selector?
- Is the boost calculation clear?
- Any issues with cNFT minting?

{{/if}}

{{#if WEEK_2}}
### 🎯 This Week's Focus: Buyback & Dashboard

**Scenario 3: Buyback Distribution** (20-25 min)
- View pending buyback rewards
- Claim your proportional $BACK rewards
- Verify distribution formula

**Scenario 4: Dashboard Exploration** (10-15 min)
- Explore TVL, APY, leaderboard
- Check your stats and rankings
- Test graphs and filters

**Priority Feedback**:
- Are buyback calculations transparent?
- Is the dashboard informative?
- Any missing metrics or data?

{{/if}}

{{#if WEEK_3}}
### 🎯 This Week: Final Push & Robustness

**Scenario 5: Robustness Tests** (15-20 min)
- Test edge cases (invalid amounts, high slippage)
- Try disconnecting wallet during transactions
- Simulate slow network conditions

**Final Questionnaire** (5 min):
👉 [Fill out satisfaction survey]({{SURVEY_LINK}})

**Priority**:
- Critical bugs: Report ASAP!
- Final UX polish: What would you improve?
- Go/No-Go: Are we ready for mainnet?

{{/if}}

### 🏆 Leaderboard Update

Top 5 contributors this week:

1. 🥇 {{TOP_1_NAME}} - {{TOP_1_SCORE}} points
2. 🥈 {{TOP_2_NAME}} - {{TOP_2_SCORE}} points
3. 🥉 {{TOP_3_NAME}} - {{TOP_3_SCORE}} points
4. {{TOP_4_NAME}} - {{TOP_4_SCORE}} points
5. {{TOP_5_NAME}} - {{TOP_5_SCORE}} points

**How to earn points**:
- Complete scenarios: 10 pts each
- Report bugs: 5-20 pts (by severity)
- Detailed feedback: 3-10 pts
- Help other testers: 5 pts

### 🐛 Known Issues & Fixes

{{KNOWN_ISSUES_LIST}}

### 📣 Community Highlights

{{COMMUNITY_HIGHLIGHTS}}

### 🆘 Need Help?

- Stuck on a scenario? Ask in #beta-testers
- Found a critical bug? DM @mods immediately
- General questions? Check #faq

Keep up the amazing work! Your testing is invaluable 🙏

---

The SwapBack Team

---

## Template 3: Airdrop Confirmation

**Sujet**: ✅ Your SwapBack Beta Testing Tokens Have Arrived!

---

Hi {{NAME}},

Your beta testing tokens have been airdropped! 🎉

### Your Devnet Wallet

**Address**: `{{WALLET_ADDRESS}}`

### Tokens Received

- ✅ **2 SOL** (for transaction fees)
- ✅ **1,000 BACK** (for locking tests)
- ✅ **100 USDC** (for swap tests)

### Verify Your Balance

1. **Switch to Devnet** in your wallet (Phantom/Solflare)
2. **View your tokens**:
   - Check SOL balance: Should show ~2 SOL
   - Check SPL tokens: 1,000 BACK + 100 USDC

**Transaction Signatures**:
- SOL: `{{SOL_SIGNATURE}}`
- BACK: `{{BACK_SIGNATURE}}`
- USDC: `{{USDC_SIGNATURE}}`

### Next Steps

1. **Join Discord** (if not done): [discord.gg/swapback-beta](#)
2. **Read UAT Guide**: [Complete scenarios]({{UAT_GUIDE_LINK}})
3. **Access App**: https://app-devnet.swapback.io
4. **Start Testing**: Begin with Scenario 1 (Lock BACK)

### Important Notes

⚠️ **These are DEVNET tokens** (no real value)
- Only usable on Solana devnet
- For testing purposes only
- Cannot be transferred to mainnet

🔧 **Need more tokens?** Let us know in #beta-testers

### Troubleshooting

**Don't see your tokens?**
- Ensure wallet is on **Devnet** (not mainnet)
- Check "Unknown tokens" section
- Refresh wallet or reconnect

**Still stuck?** DM @mods with your wallet address.

Happy testing! 🚀

---

The SwapBack Team

---

## Template 4: Reminder (Non-Active Testers)

**Sujet**: 👋 We miss you! SwapBack Beta Testing Reminder

---

Hi {{NAME}},

We noticed you haven't started testing SwapBack yet. No worries! 😊

### Quick Recap

You were invited to our **exclusive beta testing program** with:
- 🎁 2 SOL + 1,000 BACK + 100 USDC (already airdropped!)
- 🏆 Early adopter rewards
- 🚀 Whitelist for mainnet launch

**Your wallet**: `{{WALLET_ADDRESS}}`

### We Need Your Help!

We're currently in **Week {{WEEK_NUMBER}}** of 3. There's still time to:
- ✅ Complete test scenarios (15-25 min each)
- 🐛 Report any bugs you find
- 💡 Share your feedback

### Getting Started (15 min)

1. Join Discord: [discord.gg/swapback-beta](#)
2. Read UAT Guide: [View scenarios]({{UAT_GUIDE_LINK}})
3. Access app: https://app-devnet.swapback.io
4. Start with Scenario 1: Lock BACK + Mint cNFT

### Can't Participate?

No problem! Please reply to this email so we can:
- Invite someone from our waitlist
- Remove you from future reminders

We'd love to have your input! Let us know if you have any questions.

Thanks,
The SwapBack Team

---

## Template 5: UAT Completion & Thank You

**Sujet**: 🎉 UAT Complete! Thank You + Next Steps

---

Hi {{NAME}},

Wow! Our 3-week UAT program is officially complete. **THANK YOU** for being part of this journey! 🙏

### By the Numbers

- 📊 **{{TOTAL_TESTERS}}** beta testers participated
- ✅ **{{TOTAL_SCENARIOS_COMPLETED}}** scenarios completed
- 🐛 **{{TOTAL_BUGS_REPORTED}}** bugs reported ({{BUGS_FIXED}} fixed!)
- 💬 **{{TOTAL_FEEDBACK}}** feedback submissions
- ⭐ **{{AVG_SATISFACTION}}/5** average satisfaction score

### Your Contribution

{{#if USER_COMPLETED_ALL}}
🏆 **You completed ALL scenarios!** Amazing work!
{{else}}
✅ You completed {{USER_SCENARIOS_COMPLETED}} / 5 scenarios
{{/if}}

- Bugs reported: {{USER_BUGS}}
- Feedback submissions: {{USER_FEEDBACK}}
- Total points: {{USER_POINTS}}
- Leaderboard rank: **#{{USER_RANK}}** / {{TOTAL_TESTERS}}

### Your Rewards (Coming Soon!)

Based on your participation, you'll receive:

{{#if USER_COMPLETED_ALL}}
1. 🎨 **Platinum Early Adopter cNFT** (exclusive tier)
2. 💰 **{{AIRDROP_AMOUNT}} $BACK Airdrop** (mainnet launch)
3. 🌟 **VIP Whitelist** (all future drops + features)
4. 🏅 **Discord "OG Tester" role**

{{else}}
1. 🎨 **Early Adopter cNFT** (standard tier)
2. 💰 **{{AIRDROP_AMOUNT}} $BACK Airdrop** (mainnet launch)
3. ⚡ **Whitelist Access** (mainnet priority)

{{/if}}

**Distribution date**: Within 48h of mainnet launch

### Go/No-Go Decision: {{GO_NO_GO_RESULT}}

{{#if MAINNET_GO}}
✅ **We're going to MAINNET!**

Based on UAT results:
- ✅ 0 critical bugs remaining
- ✅ {{TX_SUCCESS_RATE}}% transaction success rate
- ✅ {{AVG_SATISFACTION}}/5 user satisfaction
- ✅ All go/no-go criteria met

**Mainnet Launch**: **{{MAINNET_LAUNCH_DATE}}** 🚀

{{else}}
⏸️ **Additional testing needed**

Based on UAT results, we need to:
- 🔧 Fix {{REMAINING_ISSUES}} remaining issues
- 🧪 Extended testing period ({{EXTENSION_DURATION}})
- 📊 Re-evaluation date: {{REEVALUATION_DATE}}

We'll keep you posted on progress!
{{/if}}

### What's Next?

1. **Mainnet Preparation**:
   - Final audits and fixes
   - Liquidity setup
   - Marketing launch
   
2. **Your Rewards Distribution**:
   - Early Adopter cNFTs minted
   - Airdrops sent to your wallet
   - Whitelist activated

3. **Stay Connected**:
   - Discord: Join #announcements for updates
   - Twitter: Follow [@SwapBackHQ](#) 
   - Newsletter: Weekly updates via email

### Share Your Experience

We'd love to hear about your beta testing journey:
- 🐦 Tweet about it: Use #SwapBackBeta
- 📝 Write a thread about your experience
- 💬 Share in Discord #testimonials

**Referral Bonus**: Each referred mainnet user = +50 $BACK bonus!

### Final Thoughts

Building SwapBack with your feedback has been incredible. Your insights helped us:
- 🐛 Fix {{BUGS_FIXED}} bugs before mainnet
- 💡 Improve UX based on {{TOTAL_FEEDBACK}} suggestions
- 🎯 Validate product-market fit

You're not just beta testers—you're **SwapBack founding members**. 

We can't wait to launch on mainnet with you! 🚀

---

With gratitude,
The SwapBack Team

P.S. Keep an eye on your wallet for the **Early Adopter cNFT**—it's coming soon! 🎨

---

**Join our launch event**: {{LAUNCH_EVENT_LINK}}  
**Mainnet countdown**: {{COUNTDOWN_LINK}}

