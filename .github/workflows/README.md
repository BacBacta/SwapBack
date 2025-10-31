# GitHub Actions Workflows

This directory contains all GitHub Actions workflows for the SwapBack project.

## 📁 Workflow Files

### Core CI/CD Workflows

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| **Pull Request CI** | `pr-ci.yml` | PR to main/develop | Quality gates, tests, builds |
| **Main Branch CI/CD** | `main-ci.yml` | Push to main | Deploy previews, monitoring |
| **Release & Deploy** | `release-deploy.yml` | Release published | Production deployment |

### Maintenance Workflows

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| **Dependency Management** | `dependency-management.yml` | Weekly (Mon 9 AM) | Update deps, security scan |
| **Code Quality** | `code-quality.yml` | Daily (3 AM) | Linting, formatting checks |
| **CodeQL Analysis** | `codeql-analysis.yml` | Weekly, PRs | Security scanning |

### Legacy Workflows (Deprecated)

| Workflow | File | Status | Notes |
|----------|------|--------|-------|
| **Test** | `test.yml` | ⚠️ Replaced | Use `pr-ci.yml` instead |
| **Build** | `build.yml` | ⚠️ Replaced | Use `pr-ci.yml` instead |

## 🔄 Workflow Execution Flow

### Pull Request Flow

```
PR Created → pr-ci.yml
├─ Quality Check (ESLint, TypeScript, Prettier)
├─ Security Scan (npm audit, OWASP)
├─ Tests (with coverage)
├─ Build (app + sdk)
├─ Build Programs (Rust + Anchor)
└─ PR Comment (status summary)
```

### Main Branch Flow

```
Merge to Main → main-ci.yml
├─ Test (full suite)
├─ Build & Deploy (Vercel preview)
├─ Build Programs (with checksums)
├─ Security Audit
├─ Performance (Lighthouse)
├─ Release Notes (auto-tag)
└─ Notify (deployment status)
```

### Release Flow

```
Create Release → release-deploy.yml
├─ Pre-Deploy Checks (tests + security)
├─ Build Production (app + SDK)
├─ Build Programs (verifiable)
├─ Deploy Vercel (production)
├─ Deploy Programs (manual, optional)
├─ Post-Deploy Verify (smoke tests)
└─ Release Notes (auto-generated)
```

## 🔐 Required Secrets

See [GITHUB_SECRETS_SETUP.md](../../docs/GITHUB_SECRETS_SETUP.md) for complete setup instructions.

**Critical Secrets:**
- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID
- `SOLANA_DEPLOYER_KEY` - Base58 deployer private key
- `CODECOV_TOKEN` - Codecov upload token

## 📊 Workflow Badges

Add these badges to your README.md:

```markdown
![CI/CD Status](https://github.com/yourusername/SwapBack/actions/workflows/pr-ci.yml/badge.svg)
![Main CI/CD](https://github.com/yourusername/SwapBack/actions/workflows/main-ci.yml/badge.svg)
![Security](https://github.com/yourusername/SwapBack/actions/workflows/codeql-analysis.yml/badge.svg)
![Code Quality](https://github.com/yourusername/SwapBack/actions/workflows/code-quality.yml/badge.svg)
```

## 🚀 Manual Workflow Triggers

### Trigger via GitHub UI

1. Go to **Actions** tab
2. Select workflow from left sidebar
3. Click **"Run workflow"** button
4. Select branch and configure inputs
5. Click **"Run workflow"**

### Trigger via GitHub CLI

```bash
# Install GitHub CLI
brew install gh  # macOS
# or visit https://cli.github.com/

# Trigger workflow
gh workflow run pr-ci.yml --ref develop
gh workflow run main-ci.yml --ref main
gh workflow run release-deploy.yml --ref main -f environment=staging
```

### Trigger via API

```bash
# Using curl
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/actions/workflows/main-ci.yml/dispatches \
  -d '{"ref":"main"}'
```

## 🔍 Monitoring Workflows

### View Workflow Runs

```bash
# List recent workflow runs
gh run list --limit 10

# View specific run
gh run view RUN_ID

# Watch a running workflow
gh run watch RUN_ID

# View logs
gh run view RUN_ID --log
```

### Workflow Status

Check workflow status in:
- GitHub Actions tab
- PR checks section
- Commit status badges
- Email notifications (configure in Settings)

## 🐛 Troubleshooting

### Common Issues

#### Workflow Not Triggering

**Check:**
- Branch protection rules
- Workflow file syntax (YAML validation)
- Workflow permissions in Settings
- Trigger conditions (`on:` section)

**Fix:**
```bash
# Validate YAML syntax
yamllint .github/workflows/pr-ci.yml

# Test workflow locally (using act)
act -l  # List jobs
act pull_request  # Simulate PR trigger
```

#### Secret Not Found

**Check:**
- Secret name matches exactly (case-sensitive)
- Secret is set at repository level (not environment)
- You have admin access to view secrets

**Fix:**
```bash
# List secrets (names only)
gh secret list

# Set missing secret
gh secret set SECRET_NAME
```

#### Build Failures

**Check workflow logs:**
```bash
gh run view --log-failed
```

**Common causes:**
- Missing dependencies (check cache)
- Environment mismatch
- Timeout (increase `timeout-minutes`)
- Resource limits (use smaller matrix)

### Debug Mode

Enable debug logging:

```yaml
# Add to workflow file
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

Or via secrets:
```bash
gh secret set ACTIONS_STEP_DEBUG --body "true"
gh secret set ACTIONS_RUNNER_DEBUG --body "true"
```

## 📈 Performance Optimization

### Cache Strategy

```yaml
# Example: Effective caching
- uses: actions/cache@v3
  with:
    path: |
      ~/.cargo
      ~/.npm
      node_modules
    key: ${{ runner.os }}-${{ hashFiles('**/Cargo.lock', '**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-
```

### Matrix Builds

```yaml
# Example: Parallel builds
strategy:
  matrix:
    target: [app, sdk]
  max-parallel: 2
```

### Job Dependencies

```yaml
# Run jobs in parallel when possible
jobs:
  test:
    runs-on: ubuntu-latest
    # No dependencies
  
  build:
    runs-on: ubuntu-latest
    # No dependencies (runs parallel with test)
  
  deploy:
    runs-on: ubuntu-latest
    needs: [test, build]  # Waits for both
```

## 📝 Best Practices

### ✅ Do

- Use semantic commit messages (`feat:`, `fix:`, etc.)
- Keep workflows under 20 minutes when possible
- Use caching for dependencies
- Set appropriate timeouts
- Use `continue-on-error` for non-critical steps
- Add step summaries (`$GITHUB_STEP_SUMMARY`)
- Use workflow status badges

### ❌ Don't

- Hardcode secrets or credentials
- Use `always()` without good reason
- Create too many concurrent jobs (rate limits)
- Ignore security warnings
- Skip tests to speed up CI
- Use outdated actions (keep versions updated)

## 🔄 Updating Workflows

### Adding a New Workflow

1. Create file: `.github/workflows/new-workflow.yml`
2. Define trigger and jobs
3. Test with `act` or workflow_dispatch
4. Create PR with new workflow
5. Document in this README

### Modifying Existing Workflow

1. Create feature branch
2. Edit workflow file
3. Test changes (workflow_dispatch)
4. Create PR for review
5. Merge only after successful test

### Deprecating Workflow

1. Add deprecation notice to file
2. Update this README
3. Disable workflow in GitHub Settings
4. Remove file in next major version

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Action Marketplace](https://github.com/marketplace?type=actions)
- [CI/CD Setup Guide](../../docs/CI_CD_SETUP.md)
- [Deployment Guide](../../docs/DEPLOYMENT.md)

## 📞 Support

For workflow issues:

1. Check workflow logs in Actions tab
2. Review this README and documentation
3. Test locally with `act`
4. Create issue with `ci/cd` label
5. Contact DevOps team

---

**Last Updated:** 2025-01-20  
**Maintained by:** SwapBack DevOps Team
