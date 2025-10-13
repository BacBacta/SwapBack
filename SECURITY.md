# Guide de Sécurité - SwapBack

## 🛡️ Analyse de Sécurité avec CodeQL

### Configuration

Le projet SwapBack utilise CodeQL pour l'analyse automatique de sécurité du code. CodeQL analyse :

- **JavaScript/TypeScript** : Code frontend (Next.js) et backend (Oracle API)
- **Rust** : Smart contracts Solana (programmes Anchor)

### Exécution Locale

#### Installation de CodeQL CLI

```bash
# Télécharger CodeQL CLI
wget https://github.com/github/codeql-cli-binaries/releases/latest/download/codeql-linux64.zip
unzip codeql-linux64.zip
export PATH="$PATH:$(pwd)/codeql"

# Vérifier l'installation
codeql --version
```

#### Analyser le Code TypeScript/JavaScript

```bash
# Créer la base de données CodeQL
codeql database create /tmp/swapback-js-db \
  --language=javascript \
  --source-root=/workspaces/SwapBack \
  --command="npm run build"

# Exécuter l'analyse
codeql database analyze /tmp/swapback-js-db \
  javascript-security-and-quality.qls \
  --format=sarif-latest \
  --output=/tmp/swapback-js-results.sarif

# Voir les résultats
codeql sarif-to-csv /tmp/swapback-js-results.sarif \
  --output=/tmp/swapback-js-results.csv
```

#### Analyser le Code Rust

```bash
# Créer la base de données CodeQL pour Rust
codeql database create /tmp/swapback-rust-db \
  --language=rust \
  --source-root=/workspaces/SwapBack \
  --command="cargo build --release"

# Exécuter l'analyse
codeql database analyze /tmp/swapback-rust-db \
  rust-security-and-quality.qls \
  --format=sarif-latest \
  --output=/tmp/swapback-rust-results.sarif
```

### GitHub Actions

L'analyse CodeQL s'exécute automatiquement sur GitHub :

- **À chaque push** sur `main` ou `develop`
- **À chaque Pull Request** vers `main`
- **Tous les lundis** (analyse planifiée)

Les résultats sont disponibles dans l'onglet **Security** → **Code scanning alerts** du repository GitHub.

## 🔍 Catégories de Vulnérabilités Détectées

### JavaScript/TypeScript

1. **Injection de code** (Code injection)
2. **XSS** (Cross-site scripting)
3. **CSRF** (Cross-site request forgery)
4. **Path traversal** (Traversée de répertoire)
5. **SQL Injection** (si applicable)
6. **Prototype pollution**
7. **ReDoS** (Regular expression denial of service)
8. **Informations sensibles exposées**

### Rust

1. **Buffer overflow**
2. **Integer overflow/underflow**
3. **Use after free**
4. **Double free**
5. **Race conditions**
6. **Unsafe code patterns**
7. **Panics non gérés**

## 🛠️ Bonnes Pratiques de Sécurité

### Smart Contracts Solana (Rust)

#### ✅ Validation des Comptes

```rust
#[derive(Accounts)]
pub struct SwapContext<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == token_mint.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,
}
```

#### ✅ Gestion des Erreurs

```rust
#[error_code]
pub enum SwapBackError {
    #[msg("Montant invalide")]
    InvalidAmount,
    #[msg("Slippage trop élevé")]
    SlippageTooHigh,
    #[msg("Compte non autorisé")]
    Unauthorized,
}
```

#### ✅ Vérification des Calculs

```rust
pub fn swap(ctx: Context<SwapContext>, amount: u64) -> Result<()> {
    // Utiliser checked_* pour éviter les overflows
    let output_amount = amount
        .checked_mul(995)
        .ok_or(SwapBackError::CalculationOverflow)?
        .checked_div(1000)
        .ok_or(SwapBackError::CalculationOverflow)?;
    
    // Vérifier les bounds
    require!(
        output_amount >= ctx.accounts.min_output_amount,
        SwapBackError::SlippageTooHigh
    );
    
    Ok(())
}
```

### Oracle API (TypeScript)

#### ✅ Validation des Entrées

```typescript
import { z } from 'zod';

const SimulateRequestSchema = z.object({
  inputMint: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
  outputMint: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
  inputAmount: z.string().regex(/^\d+$/),
});

app.post('/simulate', async (req, res) => {
  try {
    const validated = SimulateRequestSchema.parse(req.body);
    // Traiter la requête validée
  } catch (error) {
    return res.status(400).json({ error: 'Invalid input' });
  }
});
```

#### ✅ Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requêtes par IP
  message: 'Too many requests from this IP',
});

app.use('/api/', limiter);
```

#### ✅ Sécurité des Headers

```typescript
import helmet from 'helmet';

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
  },
}));
```

### Frontend (Next.js)

#### ✅ Protection XSS

```tsx
// Éviter dangerouslySetInnerHTML
// Utiliser les composants React de manière sécurisée
function UserProfile({ userName }: { userName: string }) {
  // React échappe automatiquement les valeurs
  return <div>Welcome, {userName}</div>;
}
```

#### ✅ Validation des Wallet

```typescript
import { PublicKey } from '@solana/web3.js';

function validateWalletAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
```

## 🚨 Checklist de Sécurité

### Avant Déploiement

- [ ] CodeQL analysis réussie sans alertes critiques
- [ ] Tests de sécurité unitaires passés
- [ ] Audit manuel du code sensible
- [ ] Variables d'environnement sécurisées
- [ ] Secrets non commités dans Git
- [ ] Rate limiting configuré
- [ ] CORS correctement configuré
- [ ] Headers de sécurité activés
- [ ] Validation des entrées côté backend
- [ ] Gestion des erreurs sans fuite d'informations

### Smart Contracts

- [ ] Tous les comptes validés avec `constraint`
- [ ] Utilisation de `checked_*` pour les calculs
- [ ] Gestion d'erreurs explicite
- [ ] Pas de `unwrap()` ou `expect()` sans vérification
- [ ] Tests de fuzzing exécutés
- [ ] Audit externe réalisé (pour production)
- [ ] Program upgrade authority sécurisée
- [ ] Freeze authority configurée correctement

## 📊 Métriques de Sécurité

### Objectifs

- **0** vulnérabilité critique
- **< 5** vulnérabilités moyennes
- **< 20** vulnérabilités mineures
- **100%** de couverture de tests sur le code critique

## 🔗 Ressources

- [GitHub CodeQL Documentation](https://codeql.github.com/docs/)
- [Solana Security Best Practices](https://docs.solana.com/developing/on-chain-programs/developing-rust#security)
- [Anchor Security](https://book.anchor-lang.com/anchor_in_depth/security.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## 📞 Signaler une Vulnérabilité

Si vous découvrez une vulnérabilité de sécurité, **NE LA PUBLIEZ PAS** publiquement.

Contactez-nous en privé :
- Email: security@swapback.io
- GitHub Security Advisory: [Créer un advisory](https://github.com/BacBacta/SwapBack/security/advisories/new)

Nous nous engageons à répondre sous 48h et à corriger les vulnérabilités critiques sous 7 jours.
