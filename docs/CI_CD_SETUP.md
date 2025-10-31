# CI/CD Pipeline Documentation

## 📋 Table of Contents

- [Overview](#overview)
- [Workflows](#workflows)
- [Required Secrets](#required-secrets)
- [Environment Variables](#environment-variables)
- [Deployment Process](#deployment-process)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

SwapBack uses GitHub Actions for continuous integration and deployment. The CI/CD pipeline automates:

- ✅ Code quality checks (linting, formatting, type checking)
- 🔒 Security scanning (npm audit, OWASP dependency check)
- 🧪 Automated testing with coverage reporting
- 🏗️ Building frontend (Next.js) and on-chain programs (Anchor)
- 🚀 Deployments to Vercel (frontend) and Solana (programs)
- 📊 Performance monitoring (Lighthouse CI)
- 📝 Automated changelog generation

## 🔄 Workflows

### 1. Pull Request CI (`pr-ci.yml`)

**Triggers:** Pull requests to `main` or `develop` branches

**Jobs:**
1. **Quality** (10 min) - ESLint, TypeScript, Prettier
2. **Security** (10 min) - npm audit, OWASP dependency check
3. **Test** (15 min) - Unit tests with coverage
4. **Build** (15 min) - Next.js app + SDK (matrix)
5. **Build Programs** (20 min) - Rust fmt/clippy + Anchor build
6. **PR Summary** - Auto-comment with status table

**Features:**
- ⚡ Concurrent runs cancelled for same PR
- 📦 Artifacts: coverage, security reports, builds (7-day retention)
- ✅ PR status table with ready-to-merge indicator
- ⏱️ Total runtime: ~20-30 minutes

**Example PR Comment:**
```markdown
## ✅ CI/CD Status

| Job | Status | Duration |
|-----|--------|----------|
| Quality | ✅ Passed | 2m 34s |
| Security | ✅ Passed | 3m 12s |
| Test | ✅ Passed | 8m 45s |
| Build | ✅ Passed | 5m 23s |
| Programs | ✅ Passed | 12m 18s |

✅ **Ready to merge** - All checks passed!
```

### 2. Main Branch CI/CD (`main-ci.yml`)

**Triggers:** Push to `main` branch, manual trigger

**Jobs:**
1. **Test** (20 min) - Full test suite + coverage
2. **Build & Deploy** (20 min) - Next.js build + Vercel preview
3. **Build Programs** (25 min) - Anchor build + checksums
4. **Security Audit** (15 min) - Production dependency scan
5. **Performance** (10 min) - Lighthouse CI
6. **Release Notes** - Changelog + auto-tagging
7. **Notify** - Deployment status summary

**Features:**
- 🔄 No cancellation (deployments queued)
- 📦 30-day artifact retention
- 🏷️ Auto-tagging for semantic commits (`feat:`, `fix:`, `perf:`)
- 🔗 Vercel preview deployment
- 📊 Bundle size analysis
- 🔐 Program SHA256 checksums

**Auto-Tagging Logic:**
- `feat:` commits → Minor version bump (v1.2.0 → v1.3.0)
- `fix:` commits → Patch version bump (v1.2.0 → v1.2.1)
- `perf:` commits → Patch version bump
- Manual releases → Follows semantic versioning

### 3. Release & Deploy (`release-deploy.yml`)

**Triggers:** 
- GitHub release published
- Manual workflow dispatch (with environment choice)

**Jobs:**
1. **Pre-Deploy Checks** (15 min) - Critical tests + security
2. **Build Production** (20 min) - Production builds (app + SDK)
3. **Build Programs** (30 min) - Verifiable Anchor builds
4. **Deploy Vercel** (15 min) - Production deployment
5. **Deploy Programs** (20 min) - Solana deployment (manual)
6. **Post-Deploy Verify** (10 min) - Smoke tests + Lighthouse
7. **Release Notes** - Auto-generated changelog

**Features:**
- ✅ Verifiable builds (`anchor build --verifiable`)
- 📦 90-day artifact retention
- 🔒 SHA256 checksums for all programs
- 🌐 Environment selection (staging/production)
- 🚀 Optional Solana program deployment
- 📋 Automated release notes
- ✅ Post-deployment verification

**Manual Deployment:**
```bash
# Navigate to: Actions → Release & Deploy → Run workflow
# Select environment: staging OR production
# Click "Run workflow"
```

### 4. Dependency Management (`dependency-management.yml`)

**Triggers:** Weekly (Mondays at 9 AM UTC), manual

**Jobs:**
1. **Update NPM Dependencies** - Auto PR with weekly updates
2. **Security Audit** - Vulnerability scan + issue creation
3. **Update Rust Dependencies** - Cargo update + auto PR
4. **License Check** - License compliance report

**Features:**
- 📅 Weekly automated dependency updates
- 🚨 Auto-creates issues for security vulnerabilities
- 📜 License compliance tracking
- 🔄 Separate PRs for NPM and Cargo updates

### 5. Code Quality Checks (`code-quality.yml`)

**Triggers:** Daily (3 AM UTC), manual

**Jobs:**
1. **ESLint** - JavaScript/TypeScript linting
2. **TypeScript** - Type checking
3. **Prettier** - Code formatting
4. **Clippy** - Rust linting
5. **Rustfmt** - Rust formatting
6. **Report Issues** - Creates GitHub issue if failures

**Features:**
- 🕐 Daily automated checks
- 📊 Summary reports in job logs
- 🚨 Auto-creates issues for quality problems
- 📦 ESLint report artifacts

## 🔐 Required Secrets

Configure these secrets in GitHub: Settings → Secrets → Actions

### Critical Secrets

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `VERCEL_TOKEN` | Vercel deployment token | [Vercel Account Settings](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel organization ID | `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Vercel project ID | `.vercel/project.json` |
| `SOLANA_DEPLOYER_KEY` | Base58 deployer keypair | Generate with `solana-keygen` |
| `CODECOV_TOKEN` | Codecov upload token | [Codecov Settings](https://codecov.io) |

### Optional Secrets

| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `NEXT_PUBLIC_HELIUS_API_KEY` | Helius RPC API key | Production deployments |
| `NEXT_PUBLIC_RPC_ENDPOINT` | Solana RPC endpoint | Production deployments |
| `GITHUB_TOKEN` | Auto-provided by GitHub | All workflows |

### Generating Solana Deployer Keypair

```bash
# Generate new keypair
solana-keygen new --outfile deployer-keypair.json

# Convert to base58 (required format)
solana-keygen pubkey deployer-keypair.json

# Get the private key in base58 format
cat deployer-keypair.json | base58

# Add to GitHub Secrets as SOLANA_DEPLOYER_KEY
```

## 🌍 Environment Variables

### Frontend (Next.js)

```env
# Production
NEXT_PUBLIC_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_HELIUS_API_KEY=your_helius_key
NEXT_PUBLIC_NETWORK=mainnet-beta

# Staging
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_NETWORK=devnet
```

### On-Chain Programs (Anchor)

```toml
# Anchor.toml
[provider]
cluster = "mainnet"  # or "devnet" for staging
wallet = "~/.config/solana/id.json"

[programs.mainnet]
swap_back = "YOUR_PROGRAM_ID"
```

## 🚀 Deployment Process

### Frontend Deployment (Automatic)

1. **Merge to `main`** → Triggers `main-ci.yml`
2. **Build & Deploy** job runs
3. **Vercel preview** deployed automatically
4. **Create GitHub Release** → Triggers `release-deploy.yml`
5. **Production deployment** to Vercel

### Program Deployment (Manual)

1. **Create GitHub Release** with tag (e.g., `v1.0.0`)
2. **Wait for builds** to complete (verifiable builds)
3. **Navigate to Actions** → Release & Deploy → Workflow run
4. **Click "Re-run jobs"** → Select "deploy-programs" only
5. **Verify deployment** on Solana Explorer

**⚠️ Important:** Program deployment requires manual approval to prevent accidental mainnet deployments.

### Deployment Checklist

Before deploying to production:

- [ ] All tests passing (309/333 minimum)
- [ ] Security audit clean (no critical/high vulnerabilities)
- [ ] Performance metrics acceptable (Lighthouse score > 90)
- [ ] Verifiable builds generated
- [ ] Program checksums verified
- [ ] Environment variables configured
- [ ] Deployer wallet funded (minimum 5 SOL)
- [ ] Changelog reviewed
- [ ] Release notes complete

## 🐛 Troubleshooting

### Common Issues

#### 1. Vercel Deployment Fails

**Symptom:** `Error: Could not deploy to Vercel`

**Solutions:**
```bash
# Check token validity
vercel whoami --token=$VERCEL_TOKEN

# Verify project ID
cat .vercel/project.json

# Manual deployment test
vercel deploy --token=$VERCEL_TOKEN --prod
```

#### 2. Anchor Build Fails

**Symptom:** `Error: failed to build program`

**Solutions:**
```bash
# Update Rust toolchain
rustup update stable

# Clean build
cargo clean
anchor clean

# Rebuild
anchor build
```

#### 3. Test Failures

**Symptom:** `Tests failed with X failures`

**Solutions:**
```bash
# Run locally
npm test -- --run

# Check specific test
npm test -- --run --reporter=verbose app/src/path/to/test.tsx

# Update snapshots if needed
npm test -- --run -u
```

#### 4. CodeCov Upload Fails

**Symptom:** `Error uploading to Codecov`

**Solutions:**
- Verify `CODECOV_TOKEN` is set correctly
- Check Codecov service status
- Ensure coverage files exist: `ls coverage/`

#### 5. Program Deployment Unauthorized

**Symptom:** `Error: Deployer not authorized`

**Solutions:**
```bash
# Check deployer wallet balance
solana balance --keypair deployer.json

# Verify deployer is program authority
solana program show YOUR_PROGRAM_ID

# Update program authority
solana program set-upgrade-authority YOUR_PROGRAM_ID --new-upgrade-authority DEPLOYER_PUBKEY
```

### Workflow Debugging

#### Enable Debug Logging

Add to workflow YAML:
```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

#### Check Workflow Logs

1. Navigate to **Actions** tab
2. Select failed workflow run
3. Click on failed job
4. Expand failed step
5. Review error messages

#### Manual Workflow Trigger

All workflows support manual triggering:

1. Go to **Actions** → Select workflow
2. Click **"Run workflow"**
3. Select branch
4. Configure inputs (if any)
5. Click **"Run workflow"**

### Performance Optimization

#### Slow Builds

**Solutions:**
- Enable caching for dependencies
- Use matrix strategy for parallel builds
- Reduce artifact retention periods
- Skip unnecessary jobs with `if` conditions

**Example:**
```yaml
- uses: actions/cache@v3
  with:
    path: |
      ~/.cargo
      ~/.npm
      node_modules
    key: ${{ runner.os }}-deps-${{ hashFiles('**/Cargo.lock', '**/package-lock.json') }}
```

#### Rate Limiting

**GitHub Actions Rate Limits:**
- **Public repos:** 2,000 minutes/month (free tier)
- **Private repos:** 3,000 minutes/month (Team plan)

**Solutions:**
- Use caching extensively
- Skip redundant jobs
- Use workflow conditions (`if:`)
- Schedule non-critical workflows during off-peak hours

## 📊 Monitoring & Metrics

### Key Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Build Time | < 15 min | ~12 min |
| Test Coverage | > 80% | 92.8% (309/333) |
| Lighthouse Score | > 90 | TBD |
| Security Vulnerabilities | 0 critical/high | 0 |
| Bundle Size | < 500 KB | TBD |

### Monitoring Tools

- **Codecov:** Test coverage tracking
- **Lighthouse CI:** Performance monitoring
- **Vercel Analytics:** Frontend performance
- **GitHub Actions:** Build metrics

## 🔗 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana CLI Documentation](https://docs.solana.com/cli)
- [CodeQL Documentation](https://codeql.github.com/docs/)

## 📝 Release Process

### Creating a Release

1. **Update version** in `package.json` and `Cargo.toml`
2. **Update CHANGELOG.md** (auto-generated by workflow)
3. **Create Git tag:**
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```
4. **Create GitHub Release:**
   - Navigate to **Releases** → **Draft new release**
   - Select tag (v1.0.0)
   - Auto-generate release notes
   - Publish release
5. **Monitor deployment** in Actions tab
6. **Verify production** deployment

### Semantic Versioning

SwapBack follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (v1.0.0 → v2.0.0): Breaking changes
- **MINOR** (v1.0.0 → v1.1.0): New features (backwards compatible)
- **PATCH** (v1.0.0 → v1.0.1): Bug fixes

**Commit Prefixes:**
- `feat:` → Minor version bump
- `fix:` → Patch version bump
- `perf:` → Patch version bump
- `BREAKING CHANGE:` → Major version bump

---

**Last Updated:** 2025-01-20  
**Maintained by:** SwapBack Core Team
