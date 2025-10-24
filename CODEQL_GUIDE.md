# 🔐 Guide d'Analyse de Sécurité CodeQL pour SwapBack

## 📋 Vue d'ensemble

CodeQL est maintenant configuré pour analyser automatiquement le code SwapBack à chaque commit et pull request. L'analyse couvre :

- **JavaScript/TypeScript** : App, SDK, Oracle, Tests
- **Rust** : Programmes Solana (swapback_router, swapback_buyback, swapback_cnft, common_swap)

## 🚀 Méthodes d'Analyse

### 1. Analyse Automatique (Recommandé)

L'analyse s'exécute automatiquement :
- ✅ À chaque push sur `main` ou `develop`
- ✅ À chaque pull request vers `main`
- ✅ Tous les lundis à 9h00 UTC (scan programmé)

**Voir les résultats** : GitHub → Security → Code scanning alerts

### 2. Analyse via VS Code (Interface Graphique)

#### Étape 1 : Ouvrir la vue CodeQL
1. Cliquez sur l'icône CodeQL dans la barre latérale gauche
2. Ou utilisez `Ctrl+Shift+P` → "CodeQL: View Databases"

#### Étape 2 : Créer une base de données
1. Cliquez sur "Add Database"
2. Sélectionnez "Create database from workspace"
3. Choisissez le langage (JavaScript ou Rust)
4. Attendez la création (peut prendre plusieurs minutes)

#### Étape 3 : Exécuter des requêtes
1. Dans le panneau "Queries", parcourez les requêtes disponibles
2. Clic droit sur une requête → "Run Query on Selected Database"
3. Les résultats apparaissent dans le panneau "Results"

**Requêtes recommandées** :
- `javascript/security-extended` - Toutes les vulnérabilités JS/TS
- `rust/security-extended` - Toutes les vulnérabilités Rust
- `javascript/injection` - Injections SQL/XSS
- `rust/integer-overflow` - Dépassements d'entiers

### 3. Analyse en Ligne de Commande

#### Analyse rapide JavaScript/TypeScript
```bash
./quick-codeql-scan.sh
```

#### Analyse complète (JS + Rust)
```bash
./run-codeql-analysis.sh
```

#### Analyse complète avec nettoyage
```bash
./run-codeql-analysis.sh --clean
```

#### Résultats
- **SARIF** : `.codeql-results/*.sarif` (pour GitHub)
- **CSV** : `.codeql-results/*.csv` (lisible humain)

## 🔍 Types de Vulnérabilités Détectées

### JavaScript/TypeScript
- ❌ Injection SQL/NoSQL
- ❌ Cross-Site Scripting (XSS)
- ❌ Prototypes pollution
- ❌ Path traversal
- ❌ Regular expression DoS (ReDoS)
- ❌ Gestion incorrecte des erreurs
- ❌ Mots de passe en clair
- ❌ Cryptographie faible
- ❌ Désérialisation non sécurisée
- ❌ Race conditions

### Rust (Programmes Solana)
- ❌ Dépassements d'entiers
- ❌ Buffer overflows
- ❌ Références non valides
- ❌ Use-after-free
- ❌ Double-free
- ❌ Race conditions
- ❌ Unwrap sur None/Err sans vérification
- ❌ Division par zéro
- ❌ Conversions de types dangereuses
- ❌ Fuites de mémoire

### Spécifique Solana/DeFi
- ❌ Vérifications de compte manquantes
- ❌ Attaques de réentrance
- ❌ Prix manipulables
- ❌ Dépassements arithmétiques dans les calculs financiers
- ❌ Privilèges mal configurés
- ❌ Validation de signature manquante

## 📊 Interpréter les Résultats

### Niveaux de Sévérité
- 🔴 **Critical** : Correction immédiate requise
- 🟠 **High** : Correction prioritaire
- 🟡 **Medium** : Correction recommandée
- 🟢 **Low** : Amélioration suggérée
- ⚪ **Note** : Information

### Actions Recommandées par Niveau

#### 🔴 Critical
1. Créer un patch immédiat
2. Déployer en urgence
3. Auditer le code similaire
4. Ajouter des tests de régression

#### 🟠 High
1. Planifier la correction dans le sprint en cours
2. Revoir l'architecture si nécessaire
3. Ajouter des tests de sécurité

#### 🟡 Medium
1. Ajouter à la backlog
2. Corriger dans les 2-3 sprints
3. Documenter la vulnérabilité

#### 🟢 Low
1. Amélioration continue
2. Refactoring opportuniste
3. Documentation des bonnes pratiques

## 🛠️ Résoudre les Problèmes Courants

### "No queries found"
```bash
# Installer les packs de requêtes
codeql pack install codeql/javascript-queries
codeql pack install codeql/rust-queries
```

### "Database creation failed"
```bash
# Nettoyer et recommencer
rm -rf .codeql-databases
./quick-codeql-scan.sh
```

### "Out of memory"
```bash
# Limiter les threads
export CODEQL_RAM=8192  # 8GB max
./run-codeql-analysis.sh
```

### Analyse trop lente
```bash
# Analyse JavaScript uniquement (plus rapide)
./quick-codeql-scan.sh
```

## 📈 Métriques de Sécurité

### Objectifs
- 🎯 0 vulnérabilités Critical
- 🎯 < 5 vulnérabilités High
- 🎯 < 20 vulnérabilités Medium
- 🎯 Réduction de 50% tous les 3 mois

### Suivi
Consultez le tableau de bord GitHub Security :
1. GitHub → Security tab
2. Code scanning alerts
3. Filtrer par sévérité, langage, état

## 🔗 Ressources

- [CodeQL Documentation](https://codeql.github.com/docs/)
- [CodeQL for JavaScript](https://codeql.github.com/docs/codeql-language-guides/codeql-for-javascript/)
- [CodeQL for Rust](https://codeql.github.com/docs/codeql-language-guides/codeql-for-rust/)
- [Security Queries](https://github.com/github/codeql/tree/main/javascript/ql/src/Security)

## 🆘 Support

En cas de problème :
1. Vérifier les logs : `.codeql-databases/*/log/`
2. Consulter la documentation : [CodeQL Troubleshooting](https://codeql.github.com/docs/codeql-cli/troubleshooting-codeql-cli/)
3. Ouvrir une issue : GitHub → Issues → New issue

## 📝 Checklist avant Déploiement

- [ ] Analyse CodeQL exécutée
- [ ] 0 vulnérabilités Critical
- [ ] < 5 vulnérabilités High
- [ ] Toutes les vulnérabilités documentées
- [ ] Plan de correction établi
- [ ] Tests de sécurité ajoutés
- [ ] Code review de sécurité effectué

---

**Dernière mise à jour** : 24 octobre 2025
