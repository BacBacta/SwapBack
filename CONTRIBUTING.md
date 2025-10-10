# Guide de Contribution SwapBack

Merci de votre intérêt pour contribuer à SwapBack ! 🎉

## Code de Conduite

En participant à ce projet, vous acceptez de respecter notre code de conduite :

- Soyez respectueux et inclusif
- Acceptez les critiques constructives
- Concentrez-vous sur ce qui est meilleur pour la communauté
- Faites preuve d'empathie envers les autres membres

## Comment Contribuer

### Signaler des Bugs

Si vous trouvez un bug, veuillez créer une issue avec :

- **Titre clair** : Décrivez le problème en une phrase
- **Description détaillée** : Étapes pour reproduire, comportement attendu vs. actuel
- **Environnement** : OS, versions de Node/Rust/Solana/Anchor
- **Logs** : Incluez les messages d'erreur pertinents
- **Screenshots** : Si applicable

### Proposer des Fonctionnalités

Pour suggérer une nouvelle fonctionnalité :

1. Vérifiez qu'elle n'est pas déjà proposée
2. Créez une issue avec le tag `enhancement`
3. Expliquez le cas d'usage et la valeur ajoutée
4. Proposez une implémentation si possible

### Pull Requests

#### Workflow

1. **Fork** le repository
2. **Créez une branche** : `git checkout -b feature/ma-fonctionnalite`
3. **Committez** vos changements : `git commit -m 'feat: ajoute ma fonctionnalité'`
4. **Push** vers votre fork : `git push origin feature/ma-fonctionnalite`
5. **Ouvrez une PR** vers `main`

#### Standards de Code

**Rust (Programmes Anchor)**

- Utilisez `cargo fmt` avant de committer
- Passez `cargo clippy` sans warnings
- Ajoutez des tests unitaires
- Documentez les fonctions publiques

```bash
cargo fmt
cargo clippy -- -D warnings
anchor test
```

**TypeScript (SDK/Frontend/Oracle)**

- Utilisez Prettier pour le formatage
- Respectez les règles ESLint
- Ajoutez des types explicites
- Documentez les fonctions exportées

```bash
npm run lint
npm run format
npm test
```

#### Commits Conventionnels

Nous suivons la convention [Conventional Commits](https://www.conventionalcommits.org/) :

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types :**
- `feat`: Nouvelle fonctionnalité
- `fix`: Correction de bug
- `docs`: Documentation
- `style`: Formatage (pas de changement de code)
- `refactor`: Refactoring
- `test`: Ajout/modification de tests
- `chore`: Maintenance (dépendances, config)

**Exemples :**

```bash
feat(router): ajoute support pour les bundles Jito
fix(sdk): corrige le calcul du NPI
docs(readme): met à jour le guide d'installation
test(buyback): ajoute tests pour burn_back
```

#### Checklist PR

Avant de soumettre une PR, vérifiez que :

- [ ] Le code compile sans erreurs
- [ ] Les tests passent (`anchor test`, `npm test`)
- [ ] Le formatage est correct (`cargo fmt`, `npm run format`)
- [ ] Pas de warnings ESLint/Clippy
- [ ] La documentation est à jour
- [ ] Les changements sont couverts par des tests
- [ ] La PR a un titre descriptif
- [ ] La description explique le "pourquoi"

### Structure des Branches

- `main` : Production stable
- `develop` : Développement actif
- `feature/*` : Nouvelles fonctionnalités
- `fix/*` : Corrections de bugs
- `docs/*` : Documentation

### Tests

#### Tests Anchor

```bash
# Tests locaux
anchor test

# Tests sur devnet
anchor test --provider.cluster devnet
```

#### Tests SDK

```bash
cd sdk
npm test
npm run test:coverage
```

#### Tests Frontend

```bash
cd app
npm test
npm run test:e2e  # Tests end-to-end (si configurés)
```

### Documentation

- Mettez à jour le README si vous ajoutez des fonctionnalités
- Documentez les nouvelles API dans `docs/TECHNICAL.md`
- Ajoutez des exemples dans `docs/EXAMPLES.md`
- Commentez le code complexe

### Sécurité

⚠️ **Important** : Ne commitez JAMAIS de clés privées ou secrets !

Si vous trouvez une vulnérabilité de sécurité :

1. **NE créez PAS d'issue publique**
2. Contactez-nous en privé : security@swapback.io
3. Donnez-nous le temps de corriger avant divulgation

### Review Process

1. Un mainteneur review votre PR
2. Des changements peuvent être demandés
3. Une fois approuvée, la PR sera mergée
4. Votre contribution sera ajoutée aux release notes

### Obtenir de l'Aide

- **Discord** : [discord.gg/swapback](https://discord.gg/swapback)
- **Twitter** : [@SwapBackProtocol](https://twitter.com/SwapBackProtocol)
- **Email** : dev@swapback.io

## Domaines de Contribution

### Programmes Solana

- Optimisations de performance
- Tests de sécurité
- Nouvelles fonctionnalités (après discussion)

### SDK

- Support de nouveaux wallets
- Amélioration de l'API
- Documentation et exemples

### Frontend

- Améliorations UI/UX
- Nouvelles visualisations
- Support mobile

### Infrastructure

- Monitoring et alertes
- CI/CD
- Docker/Kubernetes

### Documentation

- Guides et tutoriels
- Traductions
- Vidéos explicatives

## Reconnaissance

Tous les contributeurs seront listés dans :

- Le fichier `CONTRIBUTORS.md`
- Les release notes
- Le site web

Les contributeurs réguliers peuvent recevoir :

- Badge Discord spécial
- Airdrop de $BACK
- Accès early à de nouvelles fonctionnalités

---

**Merci de contribuer à SwapBack ! 🚀**
