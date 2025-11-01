# 📡 Scripts de Monitoring API Vercel - SwapBack

Ce dossier contient des scripts pour surveiller et tester les APIs déployées sur Vercel.

## 📋 Scripts disponibles

### 1. `monitor-vercel-api.sh` - Test complet ponctuel

Exécute une suite complète de tests sur tous les endpoints API.

#### Usage

```bash
# Test avec URL par défaut
./monitor-vercel-api.sh

# Test avec URL personnalisée
./monitor-vercel-api.sh https://votre-app.vercel.app
```

#### Tests effectués

1. ✅ **Health Check** - `GET /api/swap`
2. ✅ **Test Endpoint** - `GET /api/test`
3. ✅ **Quote SOL → USDC** - `POST /api/swap/quote`
4. ✅ **Quote USDC → SOL** - `POST /api/swap/quote`
5. ✅ **Quote SOL → BONK** - `POST /api/swap/quote`
6. ✅ **Validation des erreurs** - Montant invalide
7. ✅ **Validation des erreurs** - Champs manquants
8. ✅ **Swap Health** - `GET /api/swap`
9. ✅ **Execute Validation** - `POST /api/execute`
10. ✅ **Beta Feedback** - `GET /api/beta/feedback`

#### Résultats

Le script génère deux fichiers :

- **`vercel-api-monitor-YYYYMMDD-HHMMSS.log`** - Logs détaillés de tous les tests
- **`vercel-api-results-YYYYMMDD-HHMMSS.json`** - Résultats au format JSON

#### Exemple de sortie

```
╔════════════════════════════════════════════════════════════════╗
║                    📊 RÉSUMÉ DES TESTS                        ║
╚════════════════════════════════════════════════════════════════╝

Total tests: 10
✅ Passed: 6
❌ Failed: 0
⚠️  Warnings: 4

⏱️  Response Times:
  Health Check - /api/swap: 1029ms (HTTP 200)
  Quote SOL → USDC (0.1 SOL): 507ms (HTTP 200)
  Quote USDC → SOL (100 USDC): 460ms (HTTP 200)
  ...
```

---

### 2. `watch-vercel-api.sh` - Surveillance continue

Surveille en continu les endpoints critiques avec des tests répétés.

#### Usage

```bash
# Surveillance avec intervalle par défaut (30s)
./watch-vercel-api.sh

# Intervalle personnalisé (ex: toutes les 60 secondes)
./watch-vercel-api.sh 60

# Intervalle et URL personnalisés
./watch-vercel-api.sh 60 https://votre-app.vercel.app
```

#### Endpoints surveillés

- `GET /api/swap` - Health check
- `POST /api/swap/quote` - Quote SOL → USDC
- `POST /api/swap/quote` - Quote USDC → SOL

#### Exemple de sortie

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 Iteration #1 - Fri Nov  1 19:37:36 UTC 2025
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ [19:37:36] GET /api/swap - 1029ms HTTP 200, status=ok
✅ [19:37:37] POST /api/swap/quote (SOL→USDC) - 507ms HTTP 200, success=true
✅ [19:37:38] POST /api/swap/quote (USDC→SOL) - 460ms HTTP 200, success=true

📊 Stats: 3 OK | 0 ERR | Success rate: 100%
⏳ Next check in 30s...
```

#### Arrêt

Appuyez sur `Ctrl+C` pour arrêter la surveillance.

---

## 🔍 Vérifications effectuées

Les scripts vérifient automatiquement :

- ✅ **Codes HTTP** - 200, 400, 500, etc.
- ✅ **Temps de réponse** - Performance des endpoints
- ✅ **Champs obligatoires** - `success`, `status`, `quote`, etc.
- ✅ **Erreurs ENOTFOUND** - Problèmes DNS/réseau
- ✅ **Token validation** - Détection des appels à `token.jup.ag`
- ✅ **TypeError** - Erreurs JavaScript
- ✅ **Validation des inputs** - Gestion des erreurs 400

---

## 📊 Format des résultats JSON

### Structure du fichier `vercel-api-results-*.json`

```json
{
  "timestamp": "2025-11-01T19:37:36.000Z",
  "baseUrl": "https://swap-back-app-4ewf.vercel.app",
  "tests": [
    {
      "name": "Health Check - /api/swap",
      "method": "GET",
      "endpoint": "/api/swap",
      "httpCode": 200,
      "duration": 1029,
      "status": "PASS",
      "timestamp": "2025-11-01T19:37:37.000Z"
    }
  ],
  "completed": "2025-11-01T19:37:40.000Z"
}
```

### Statuts possibles

- **`PASS`** - Test réussi (HTTP 200 + champs attendus présents)
- **`WARN`** - Avertissement (HTTP 400, champ manquant, etc.)
- **`FAIL`** - Échec (HTTP 500, erreur réseau, etc.)

---

## 🛠️ Utilisation dans CI/CD

### GitHub Actions

```yaml
- name: Test Vercel Deployment
  run: |
    chmod +x ./monitor-vercel-api.sh
    ./monitor-vercel-api.sh ${{ secrets.VERCEL_URL }}
    
- name: Upload Test Results
  uses: actions/upload-artifact@v3
  with:
    name: api-test-results
    path: vercel-api-results-*.json
```

### Cron Job

```bash
# Surveillance toutes les 5 minutes
*/5 * * * * /path/to/watch-vercel-api.sh 300 https://votre-app.vercel.app >> /var/log/vercel-api.log 2>&1
```

---

## 🔧 Dépendances

Les scripts nécessitent :

- **bash** (version 4+)
- **curl** - Pour les requêtes HTTP
- **jq** - Pour parser le JSON (optionnel mais recommandé)
- **date** - Pour les timestamps

### Installation des dépendances

```bash
# Ubuntu/Debian
sudo apt-get install curl jq

# macOS
brew install curl jq

# Alpine Linux (Docker)
apk add curl jq bash
```

---

## 📝 Exemples d'utilisation

### Test rapide après déploiement

```bash
./monitor-vercel-api.sh https://swap-back-app-4ewf.vercel.app
```

### Surveillance pendant un incident

```bash
# Surveillance toutes les 10 secondes
./watch-vercel-api.sh 10
```

### Test de charge (simple)

```bash
# Lancer plusieurs instances en parallèle
for i in {1..5}; do
  ./monitor-vercel-api.sh &
done
wait
```

### Extraction des temps de réponse

```bash
# Après un test complet
jq -r '.tests[] | "\(.name): \(.duration)ms"' vercel-api-results-*.json | sort -t: -k2 -n
```

---

## 🐛 Debugging

### Voir les logs détaillés

```bash
tail -f vercel-api-monitor-*.log
```

### Chercher des erreurs spécifiques

```bash
# ENOTFOUND errors
grep "ENOTFOUND" vercel-api-monitor-*.log

# HTTP 500 errors
grep "HTTP 500" vercel-api-monitor-*.log

# Token validation
grep "token.jup.ag" vercel-api-monitor-*.log
```

### Analyser les temps de réponse

```bash
# Moyenne des temps de réponse
jq '[.tests[].duration] | add / length' vercel-api-results-*.json

# Max response time
jq '[.tests[].duration] | max' vercel-api-results-*.json
```

---

## ✅ Checklist de déploiement

Après chaque déploiement Vercel, exécuter :

1. ✅ `./monitor-vercel-api.sh` - Test complet
2. ✅ Vérifier qu'il n'y a **aucune erreur FAIL**
3. ✅ Vérifier les temps de réponse (< 1000ms pour quotes)
4. ✅ Vérifier qu'il n'y a **pas d'erreur ENOTFOUND**
5. ✅ Vérifier qu'il n'y a **pas d'appel à token.jup.ag**
6. ✅ Optionnel : Lancer `./watch-vercel-api.sh 60` pendant 5-10 minutes

---

## 📞 Support

Pour toute question ou problème :

1. Vérifier les logs : `vercel-api-monitor-*.log`
2. Vérifier les résultats JSON : `vercel-api-results-*.json`
3. Vérifier les logs Vercel : https://vercel.com/dashboard → Logs
4. Consulter la documentation API : `/workspaces/SwapBack/app/src/app/api/`

---

## 📜 Changelog

### 2025-11-01 - v1.0.0

- ✅ Script de monitoring complet
- ✅ Script de surveillance continue
- ✅ 10 tests automatisés
- ✅ Génération de logs et JSON
- ✅ Détection automatique d'erreurs
- ✅ Statistiques de performance
