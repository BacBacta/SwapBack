# GitHub Secrets Configuration

This document lists all required and optional secrets for the SwapBack CI/CD pipeline.

## 🔐 Required Secrets

These secrets **must** be configured for the CI/CD pipeline to work properly.

### Vercel Deployment

Configure in: **Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Description | How to Obtain |
|-------------|-------------|---------------|
| `VERCEL_TOKEN` | Vercel API authentication token | 1. Go to https://vercel.com/account/tokens<br>2. Click "Create Token"<br>3. Name: "GitHub Actions CI/CD"<br>4. Scope: Full Account<br>5. Copy the token |
| `VERCEL_ORG_ID` | Your Vercel organization/team ID | 1. Run `vercel link` in project<br>2. Check `.vercel/project.json`<br>3. Copy `orgId` value |
| `VERCEL_PROJECT_ID` | Your Vercel project ID | 1. Run `vercel link` in project<br>2. Check `.vercel/project.json`<br>3. Copy `projectId` value |

### Solana Program Deployment

| Secret Name | Description | How to Obtain |
|-------------|-------------|---------------|
| `SOLANA_DEPLOYER_KEY` | Base58-encoded deployer private key | See [Generating Deployer Key](#generating-deployer-key) below |

### Code Coverage

| Secret Name | Description | How to Obtain |
|-------------|-------------|---------------|
| `CODECOV_TOKEN` | Codecov upload authentication token | 1. Go to https://codecov.io<br>2. Sign in with GitHub<br>3. Add your repository<br>4. Settings → Copy upload token |

## 🎯 Optional Secrets

These secrets enhance functionality but are not strictly required.

### Production Environment Variables

| Secret Name | Description | Default/Fallback |
|-------------|-------------|------------------|
| `NEXT_PUBLIC_HELIUS_API_KEY` | Helius RPC API key for enhanced RPC | Falls back to public RPC |
| `NEXT_PUBLIC_RPC_ENDPOINT` | Custom Solana RPC endpoint | Uses default Solana RPC |

### Analytics & Monitoring

| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `SENTRY_DSN` | Sentry error tracking DSN | Error monitoring (future) |
| `MIXPANEL_TOKEN` | Mixpanel analytics token | User analytics (future) |

## 🔑 Generating Deployer Key

The `SOLANA_DEPLOYER_KEY` must be in **Base58 format** (not JSON array).

### Method 1: New Keypair (Recommended for CI/CD)

```bash
# Generate new keypair
solana-keygen new --outfile deployer-keypair.json --no-bip39-passphrase

# Get the public key (save this!)
PUBKEY=$(solana-keygen pubkey deployer-keypair.json)
echo "Public Key: $PUBKEY"

# Convert to Base58 format
# The keypair file contains a JSON array like [1,2,3,...]
# We need to convert it to Base58

# Using bs58 CLI tool (install if needed: cargo install bs58)
cat deployer-keypair.json | jq -r '.' | tr -d '[],' | xxd -r -p | bs58

# OR using a simple Node.js script:
node -e "
const fs = require('fs');
const bs58 = require('bs58');
const keypair = JSON.parse(fs.readFileSync('deployer-keypair.json'));
const secretKey = Uint8Array.from(keypair);
console.log(bs58.encode(secretKey));
"

# Copy the output and add it to GitHub Secrets as SOLANA_DEPLOYER_KEY
```

### Method 2: Using Existing Keypair

```bash
# If you have an existing keypair (e.g., ~/.config/solana/id.json)
# Convert it to Base58 format using the same method above

cat ~/.config/solana/id.json | jq -r '.' | tr -d '[],' | xxd -r -p | bs58
```

### Fund the Deployer Wallet

```bash
# Get the public key
solana-keygen pubkey deployer-keypair.json
# Output: YourDeployerPublicKeyHere

# For DEVNET (testing):
solana airdrop 10 YourDeployerPublicKeyHere --url devnet

# For MAINNET (production):
# Transfer SOL from your main wallet
solana transfer YourDeployerPublicKeyHere 5 --from ~/.config/solana/id.json
```

**Minimum Balances:**
- **Devnet:** 10 SOL (use airdrop)
- **Mainnet:** 5 SOL (for program deployment + rent)

## 📝 Adding Secrets to GitHub

### Via GitHub Web UI

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter:
   - **Name:** Secret name (e.g., `VERCEL_TOKEN`)
   - **Secret:** The secret value (paste the token/key)
5. Click **Add secret**

### Via GitHub CLI (Alternative)

```bash
# Install GitHub CLI if needed
# https://cli.github.com/

# Login
gh auth login

# Add secrets
gh secret set VERCEL_TOKEN --body "your_vercel_token_here"
gh secret set VERCEL_ORG_ID --body "your_org_id_here"
gh secret set VERCEL_PROJECT_ID --body "your_project_id_here"
gh secret set SOLANA_DEPLOYER_KEY --body "your_base58_key_here"
gh secret set CODECOV_TOKEN --body "your_codecov_token_here"

# Verify secrets are set
gh secret list
```

## 🔍 Verifying Configuration

### Test Vercel Token

```bash
# Install Vercel CLI
npm install -g vercel

# Test authentication
vercel whoami --token="your_vercel_token"
# Should output your Vercel username/email
```

### Test Solana Deployer Key

```bash
# Save Base58 key to temporary file
echo "your_base58_key" > temp-key.txt

# Convert back to keypair format for testing
# (This is what the CI/CD workflow does)
node -e "
const bs58 = require('bs58');
const fs = require('fs');
const key = fs.readFileSync('temp-key.txt', 'utf8').trim();
const decoded = bs58.decode(key);
const keypair = Array.from(decoded);
fs.writeFileSync('test-keypair.json', JSON.stringify(keypair));
"

# Get public key to verify
solana-keygen pubkey test-keypair.json
# Should match your deployer public key

# Check balance
solana balance $(solana-keygen pubkey test-keypair.json)

# Clean up
rm temp-key.txt test-keypair.json
```

### Test Codecov Token

```bash
# Install Codecov uploader
curl -Os https://uploader.codecov.io/latest/linux/codecov
chmod +x codecov

# Test upload (dry run)
./codecov -t your_codecov_token -f coverage/coverage-final.json --dry-run
# Should show upload would succeed
```

## 🔄 Rotating Secrets

### When to Rotate

- **Immediately:** If a secret is compromised or exposed
- **Regularly:** Every 90 days for production secrets
- **After team changes:** When team members leave

### How to Rotate

1. **Generate new secret** (e.g., new Vercel token)
2. **Update GitHub secret** with new value
3. **Test the workflow** to ensure it works
4. **Revoke old secret** in the service (Vercel, etc.)

### Emergency Rotation

If a secret is compromised:

```bash
# 1. Immediately revoke the old secret in the service
# 2. Generate a new one
# 3. Update GitHub secret
gh secret set SECRET_NAME --body "new_value"

# 4. Trigger a test workflow to verify
gh workflow run pr-ci.yml
```

## 📊 Secret Usage by Workflow

| Secret | pr-ci.yml | main-ci.yml | release-deploy.yml | dependency-management.yml |
|--------|-----------|-------------|--------------------|-----------------------------|
| VERCEL_TOKEN | ❌ | ✅ | ✅ | ❌ |
| VERCEL_ORG_ID | ❌ | ✅ | ✅ | ❌ |
| VERCEL_PROJECT_ID | ❌ | ✅ | ✅ | ❌ |
| SOLANA_DEPLOYER_KEY | ❌ | ✅ (optional) | ✅ | ❌ |
| CODECOV_TOKEN | ✅ | ✅ | ✅ | ❌ |
| HELIUS_API_KEY | ❌ | ✅ | ✅ | ❌ |
| GITHUB_TOKEN | ✅ (auto) | ✅ (auto) | ✅ (auto) | ✅ (auto) |

**Legend:**
- ✅ Required
- ✅ (auto) Auto-provided by GitHub
- ✅ (optional) Optional/conditional
- ❌ Not used

## 🛡️ Security Best Practices

### DO ✅

- Use dedicated service accounts for CI/CD
- Use read-only tokens where possible
- Rotate secrets regularly (every 90 days)
- Use scoped tokens (limit permissions)
- Monitor secret usage in audit logs
- Use GitHub environments for sensitive deployments

### DON'T ❌

- Commit secrets to git (use .gitignore)
- Share secrets in plain text (Slack, email)
- Use personal accounts for CI/CD
- Reuse secrets across projects
- Log secret values in workflows
- Use overly permissive tokens

### Monitoring

```yaml
# Example: Add to workflow to detect secret exposure
- name: Check for secrets in logs
  run: |
    if grep -r "VERCEL_TOKEN" logs/; then
      echo "⚠️ Secret potentially exposed in logs!"
      exit 1
    fi
```

## 🔗 Additional Resources

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [Solana CLI Documentation](https://docs.solana.com/cli)
- [Codecov Documentation](https://docs.codecov.com/docs)

## 📞 Support

If you encounter issues with secrets configuration:

1. **Verify secret format** - Ensure no extra whitespace or newlines
2. **Check permissions** - Ensure you have admin access to the repository
3. **Test locally** - Verify secrets work outside of GitHub Actions
4. **Check workflow logs** - Look for authentication errors

---

**Last Updated:** 2025-01-20  
**Maintained by:** SwapBack Core Team

## Quick Setup Checklist

- [ ] Created Vercel account and project
- [ ] Generated Vercel token
- [ ] Obtained Vercel org and project IDs
- [ ] Generated Solana deployer keypair
- [ ] Converted deployer key to Base58
- [ ] Funded deployer wallet (devnet/mainnet)
- [ ] Created Codecov account
- [ ] Obtained Codecov upload token
- [ ] Added all required secrets to GitHub
- [ ] Verified secrets with test commands
- [ ] Tested a workflow run
- [ ] Documented deployer public key for team
