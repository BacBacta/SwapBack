# SwapBack Router - Update Guide (December 8, 2025)

## ✅ New Program IDs

| Component | Address | Status |
|-----------|---------|--------|
| **Router Program** | `FuzLkp1G7v39XXxobvr5pnGk7xZucBUroa215LrCjsAg` | ✅ DEPLOYED |
| **RouterState PDA** | `F1iDHhX7SPKCdZWex5JPV3dJ2KUKEsdRCbhDBGSgyK7k` | ✅ CONFIGURED |
| **RouterConfig PDA** | `2XTFRGtGBJVd3Hptky75KSwJyohAzNseTSnX1EJew348` | ✅ INITIALIZED |
| **Rebate Vault** | `G1epdUBUm152UkWZVbs8kAvEaJcKKbVYZJMjc9ofn8r1` | ✅ READY |

## 🔧 Configuration

### NPI Distribution (100%)
- **70%** → User Rebates
- **15%** → Protocol Treasury
- **15%** → Boost Vault (Lock Rewards)

### Platform Fee (0.2%)
- **85%** → Treasury
- **15%** → Buy & Burn BACK

---

## 📋 VERCEL UPDATE REQUIRED

### Step 1: Update Environment Variable

Go to: **Vercel Dashboard → Project Settings → Environment Variables**

Update this variable for **Production**:
```
NEXT_PUBLIC_ROUTER_PROGRAM_ID=FuzLkp1G7v39XXxobvr5pnGk7xZucBUroa215LrCjsAg
```

### Step 2: Trigger Redeploy

```bash
# Option A: From CLI
vercel --prod

# Option B: From Dashboard
# Go to Deployments → Click "Redeploy" on latest deployment
```

### Step 3: Verify Deployment

After redeploy, check:
1. Open browser dev tools (F12)
2. Go to Network tab
3. Look for any API calls to check the program ID being used
4. Or check the Console for any wallet connection logs

---

## 🧪 Test Checklist

After Vercel update:

- [ ] Visit https://your-app.vercel.app
- [ ] Connect wallet
- [ ] Go to /swap page
- [ ] Try a small test swap
- [ ] Check /rebates page for rebate data
- [ ] Check /admin page (if admin) for RouterState info

---

## 📁 Updated Files

The following files have been updated with the new Program ID:

### Frontend
- `app/src/lib/alt/config.ts`
- `app/src/lib/native-router/index.ts`
- `app/src/components/SimpleRebatesCard.tsx`
- `app/src/components/SimpleAdminPanel.tsx`
- `app/src/components/AdminConfigPanel.tsx`
- `app/src/app/api/native-quote/route.ts`
- `app/config/programIds.ts`

### Config
- `app/.env.production.mainnet`
- `oracle/.env.flyio.production`

---

## ⚠️ Old Program IDs (CLOSED)

These programs have been closed and should NOT be used:
- ~~`GEdKdZRVZHLUKGCX8swwLn7BJUciDFgf2edkjq4M31mJ`~~ (closed)
- ~~`5K7kKoYd1E2S2gycBMeAeyXnxdbVgAEqJWKERwW8FTMf`~~ (closed)

---

## 🚀 Quick Vercel Update Commands

```bash
# From project root
cd /workspaces/SwapBack/app

# Update the environment variable (requires Vercel CLI logged in)
vercel env rm NEXT_PUBLIC_ROUTER_PROGRAM_ID production
echo "FuzLkp1G7v39XXxobvr5pnGk7xZucBUroa215LrCjsAg" | vercel env add NEXT_PUBLIC_ROUTER_PROGRAM_ID production

# Redeploy
vercel --prod
```

Or update manually in the Vercel Dashboard.
