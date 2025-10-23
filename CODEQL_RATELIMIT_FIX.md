# 🔧 Fix: Erreur CodeQL 403 Rate Limit Exceeded

## Problème

```
Unable to install CodeQL CLI. API call failed with status code 403
API rate limit exceeded for 4.210.177.128
```

## ✅ Solutions Appliquées

### 1. Workflow GitHub Actions optimisé

Fichier : `.github/workflows/codeql-analysis.yml`

- ✅ Ajout du `GITHUB_TOKEN` dans la variable d'environnement
- ✅ Token utilisé pour tous les appels API
- ✅ Cela augmente le rate limit de 60 req/h → 5000 req/h

### 2. Script d'installation CodeQL avec token

Fichier : `install-codeql.sh`

```bash
bash install-codeql.sh
```

- ✅ Télécharge CodeQL CLI avec authentification
- ✅ Utilise le token pour éviter le rate limit
- ✅ Place CodeQL dans `~/.local/bin/`

### 3. Guide de configuration token

Fichier : `fix-codeql-ratelimit.sh`

```bash
bash fix-codeql-ratelimit.sh
```

- ✅ Vérifie si le token est défini
- ✅ Affiche le rate limit actuel
- ✅ Donne les instructions de configuration

## 🚀 Solution Immédiate

### Option A : Installer CodeQL CLI (recommandé)

```bash
export GITHUB_TOKEN='votre_token'
bash install-codeql.sh
```

### Option B : Utiliser sans CodeQL CLI

Si vous n'avez pas besoin de CodeQL localement, les analyses se feront automatiquement sur GitHub Actions (où le token est déjà configuré).

### Option C : Configurer le token dans Codespaces

Pour éviter de le redéfinir à chaque session :

1. **Créer un Personal Access Token (PAT)**
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token
   - Scopes: `repo`, `workflow`, `read:packages`
   - Copier le token

2. **Ajouter le token à Codespaces secrets**
   - GitHub → Settings → Codespaces → Secrets
   - Créer un secret nommé `GITHUB_TOKEN`
   - Valeur: collez votre PAT
   - **Résultat**: Token auto-injecté dans tous les Codespaces

3. **Ou ajouter au shell (temporaire)**

   ```bash
   echo 'export GITHUB_TOKEN="ghp_xxxxxxxxxxx"' >> ~/.zshrc
   source ~/.zshrc
   ```

## 📊 Vérification

### Vérifier le rate limit

```bash
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit | jq '.rate_limit'
```

### Vérifier que CodeQL fonctionne

```bash
codeql --version
codeql resolve queries --format=csv
```

## 🔗 Ressources

- [GitHub CodeQL Documentation](https://codeql.github.com/docs/)
- [API Rate Limiting](https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting)
- [Creating Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

## 📌 État actuel

- ✅ **GitHub Actions**: Token configuré dans le workflow
- ❓ **Codespace**: Utilisez `bash install-codeql.sh` ou configurez le secret
- ✅ **Scripts**: Prêts à l'emploi

---

**Commits appliqués:**
- Fix workflow CodeQL avec token authentifié
- Script installation CodeQL avec rate limit fix
- Guide complet de configuration
