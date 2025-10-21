# Configuration CI/CD - Guide de Déploiement

## 📋 Checklist Setup

### 1. GitHub Actions Workflows ✅ FAIT

- [x] `.github/workflows/test.yml` créé
- [x] `.github/workflows/build.yml` créé
- [ ] Workflows testés en push
- [ ] Secrets configurés

### 2. Codecov Integration

- [ ] Créer compte sur https://codecov.io
- [ ] Ajouter repository SwapBack
- [ ] Copier upload token
- [ ] Ajouter secret `CODECOV_TOKEN` dans GitHub

### 3. Pre-commit Hooks ✅ FAIT

- [x] `.husky/pre-commit` créé
- [ ] Husky installé (`npm install --save-dev husky`)
- [ ] Testé avec commit local

### 4. README Badges

- [ ] Codecov badge
- [ ] GitHub Actions Test badge
- [ ] GitHub Actions Build badge

---

## 🚀 Instructions Étape par Étape

### Étape 1: Tester les Workflows

```bash
# Commit et push les workflows
git add .github/workflows/
git commit -m "feat: Add GitHub Actions CI/CD workflows"
git push origin main

# Vérifier dans GitHub
# → Actions tab → voir "Tests & Coverage" et "Build Verification"
```

**Résultat attendu**:

- `build.yml` devrait passer ✅
- `test.yml` échouera sur Codecov (token manquant) ⚠️

---

### Étape 2: Setup Codecov

#### 2.1 Créer Compte Codecov

1. Aller sur https://codecov.io
2. "Sign Up with GitHub"
3. Autoriser Codecov

#### 2.2 Ajouter Repository

1. Dashboard Codecov → "Add Repository"
2. Chercher "SwapBack"
3. Activer integration

#### 2.3 Obtenir Token

```
Settings → Repository Settings → Upload Token
Copier: ccov_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 2.4 Ajouter Secret GitHub

1. GitHub repo → `Settings` → `Secrets and variables` → `Actions`
2. "New repository secret"
3. Name: `CODECOV_TOKEN`
4. Value: `ccov_...` (token copié)
5. "Add secret"

#### 2.5 Re-run Workflow

```bash
# Option 1: Re-run failed job dans GitHub Actions UI
# Option 2: Push dummy commit
git commit --allow-empty -m "chore: Trigger CI with Codecov token"
git push origin main
```

**Résultat attendu**: `test.yml` passe ✅, coverage visible sur Codecov

---

### Étape 3: Installer Husky

```bash
cd /workspaces/SwapBack

# Installer Husky
npm install --save-dev husky

# Initialiser Husky
npx husky install

# Le hook .husky/pre-commit existe déjà (créé par script)
# Vérifier permissions
chmod +x .husky/pre-commit

# Ajouter prepare script dans package.json
npm pkg set scripts.prepare="husky install"
```

#### Tester Pre-commit Hook

```bash
# Créer changement de test
echo "// test" >> sdk/src/index.ts

# Tenter commit
git add sdk/src/index.ts
git commit -m "test: pre-commit hook"

# Devrait:
# 1. Lancer npm test (178 tests)
# 2. Lancer npm run lint
# 3. Si succès → commit autorisé
# 4. Si échec → commit bloqué
```

---

### Étape 4: Ajouter Badges au README

#### 4.1 Identifier Repository

- Repository: `BacBacta/SwapBack` (remplacer par votre username/org)
- Branch: `main`

#### 4.2 Créer Badges

Ajouter en haut du `README.md`:

```markdown
# SwapBack

[![Tests & Coverage](https://github.com/BacBacta/SwapBack/actions/workflows/test.yml/badge.svg)](https://github.com/BacBacta/SwapBack/actions/workflows/test.yml)
[![Build](https://github.com/BacBacta/SwapBack/actions/workflows/build.yml/badge.svg)](https://github.com/BacBacta/SwapBack/actions/workflows/build.yml)
[![codecov](https://codecov.io/gh/BacBacta/SwapBack/branch/main/graph/badge.svg)](https://codecov.io/gh/BacBacta/SwapBack)

> Plateforme de swap automatisé avec protection MEV sur Solana
```

#### 4.3 Options de Badge Codecov

**Badge Simple**:

```markdown
[![codecov](https://codecov.io/gh/BacBacta/SwapBack/branch/main/graph/badge.svg)](https://codecov.io/gh/BacBacta/SwapBack)
```

**Badge avec Token (privé)**:

```markdown
[![codecov](https://codecov.io/gh/BacBacta/SwapBack/branch/main/graph/badge.svg?token=YOUR_BADGE_TOKEN)](https://codecov.io/gh/BacBacta/SwapBack)
```

**Badge Personnalisé**:

```markdown
[![codecov](https://codecov.io/gh/BacBacta/SwapBack/branch/main/graphs/badge.svg?flag=sdk)](https://codecov.io/gh/BacBacta/SwapBack)
```

---

## 📊 Vérification Post-Setup

### Checklist Finale

- [ ] Push déclenche workflows automatiquement
- [ ] `test.yml` exécute 178 tests
- [ ] `test.yml` upload coverage sur Codecov
- [ ] `build.yml` compile app + SDK
- [ ] Pre-commit hook bloque commits avec tests failing
- [ ] Badges affichés correctement sur GitHub
- [ ] Codecov dashboard montre coverage trends

### Commandes de Vérification

```bash
# Vérifier Husky
ls -la .husky/
cat .husky/pre-commit

# Vérifier npm scripts
npm run | grep -E "(test|lint|build)"

# Tester localement
npm test          # 178 tests
npm run lint      # ESLint + markdownlint
npm run build     # Build SDK + App

# Vérifier coverage local
npm test -- --coverage
# Check: sdk/ coverage >85%, app/ coverage >60%
```

### URLs à Vérifier

- **GitHub Actions**: `https://github.com/BacBacta/SwapBack/actions`
- **Codecov Dashboard**: `https://codecov.io/gh/BacBacta/SwapBack`
- **README Badges**: `https://github.com/BacBacta/SwapBack#readme`

---

## 🔧 Troubleshooting

### Problème: test.yml échoue sur coverage threshold

**Solution**: Vérifier que coverage >70% localement

```bash
npm test -- --coverage | grep "All files"
# Si <70% → ajouter tests
```

### Problème: build.yml échoue sur dependencies

**Solution**: Vérifier package-lock.json est commit

```bash
git add package-lock.json app/package-lock.json sdk/package-lock.json
git commit -m "chore: Add package-lock.json"
```

### Problème: Pre-commit hook ne s'exécute pas

**Solution**: Réinstaller Husky

```bash
rm -rf .husky
npx husky install
chmod +x .husky/pre-commit
git commit --amend --no-edit  # Re-trigger hook
```

### Problème: Codecov badge ne s'affiche pas

**Solution**: Vérifier repository visibility

- Repository public → badge marche automatiquement
- Repository privé → utiliser badge token

```markdown
[![codecov](https://codecov.io/gh/BacBacta/SwapBack/branch/main/graph/badge.svg?token=BADGE_TOKEN)](...)
```

### Problème: Workflows ne se déclenchent pas

**Solution**: Vérifier triggers et permissions

```yaml
# .github/workflows/test.yml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

permissions:
  contents: read
  checks: write
```

---

## 📈 Monitoring

### Métriques à Surveiller

1. **Coverage Trends** (Codecov)
   - Target: maintenir >80% SDK, >60% Frontend
   - Alert si drop >5%

2. **Test Success Rate** (GitHub Actions)
   - Target: 100% passing
   - Alert si failure >2 builds consécutifs

3. **Build Time** (GitHub Actions)
   - Baseline: test.yml ~2-3min, build.yml ~1-2min
   - Alert si >5min

4. **Pre-commit Hook Time**
   - Baseline: ~1-2s
   - Si >10s → optimiser tests locaux

### Commandes Monitoring

```bash
# Voir derniers builds GitHub
gh run list --limit 10

# Voir détails d'un build
gh run view <run-id>

# Codecov trends
curl -s https://codecov.io/api/gh/BacBacta/SwapBack/commits \
  | jq '.commits[0].totals.coverage'
```

---

## ✅ Conclusion

Une fois setup complet:

- ✅ CI/CD automatique sur push/PR
- ✅ Coverage monitoring avec Codecov
- ✅ Pre-commit hooks préviennent regressions
- ✅ Badges montrent statut projet

**SwapBack est prêt pour développement collaboratif professionnel** 🚀
