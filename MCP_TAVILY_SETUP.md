# 🎯 Configuration Tavily AI Search pour SwapBack

## 🌟 Pourquoi Tavily au lieu de Brave ?

- ✅ **Optimisé pour recherches techniques/développement**
- ✅ **Meilleure compréhension du contexte blockchain/Solana**
- ✅ **Résultats plus pertinents pour la documentation**
- ✅ **1000 requêtes/mois gratuites** (vs 2000 Brave mais qualité supérieure)
- ✅ **Serveur MCP officiel** bien maintenu

---

## 🚀 Configuration Complète

### Étape 1 : Obtenir votre clé API Tavily

1. **Allez sur :** https://tavily.com/
2. **Cliquez sur "Get API Key" ou "Sign Up"**
3. **Créez un compte** (email + mot de passe)
4. **Copiez votre clé API** (format : `tvly-...`)

📊 **Plan gratuit :**
- 1000 requêtes/mois
- Parfait pour développement
- Pas de carte bancaire nécessaire

---

### Étape 2 : Configuration VS Code

**Ouvrez :** `Ctrl+Shift+P` → "Preferences: Open User Settings (JSON)"

**Collez cette configuration complète :**

```json
{
  "cline.mcpServers": {
    "tavily": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-tavily"],
      "env": {
        "TAVILY_API_KEY": "VOTRE_CLE_TAVILY_ICI"
      }
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/workspaces/SwapBack"
      ]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "VOTRE_TOKEN_GITHUB"
      }
    }
  }
}
```

### Étape 3 : Remplacer les clés

- Remplacez `VOTRE_CLE_TAVILY_ICI` par votre vraie clé Tavily (format `tvly-...`)
- Remplacez `VOTRE_TOKEN_GITHUB` par votre token (si vous en avez un)

### Étape 4 : Redémarrer VS Code

`Ctrl+Shift+P` → "Developer: Reload Window"

---

## 🧪 Tests après configuration

### Test 1 : Recherche Tavily
```
Demandez à Claude : "Search on Tavily: Solana CLI latest version cargo lock support"
```

**Résultat attendu :** Claude pourra chercher et vous donner des infos récentes

### Test 2 : Fetch
```
Demandez à Claude : "Fetch: https://github.com/solana-labs/solana/releases/latest"
```

**Résultat attendu :** Claude récupère le contenu de la page

### Test 3 : Filesystem
```
Demandez à Claude : "Liste les fichiers dans .github/workflows/"
```

**Résultat attendu :** Claude liste les fichiers

### Test 4 : Memory
```
Demandez à Claude : "Souviens-toi : mon projet SwapBack a une erreur Cargo.lock v4 avec Solana CLI 2.0.15"
```

**Résultat attendu :** ✅ Mémorisé

---

## 📋 Exemples d'utilisation Tavily pour SwapBack

### Rechercher des infos sur Solana
```
"Search Tavily: Does Solana CLI 2.0.15 support Cargo.lock version 4?"
"Search Tavily: Anchor 0.31.0 compatible Rust versions"
"Search Tavily: cargo-build-sbf lockfile version error solution"
```

### Trouver de la documentation récente
```
"Search Tavily: Solana program deployment guide 2024"
"Search Tavily: Anchor framework latest best practices"
"Search Tavily: Rust BPF compilation Solana"
```

### Résoudre des erreurs
```
"Search Tavily: lock file version 4 requires Znext-lockfile-bump fix"
"Search Tavily: DeclaredProgramIdMismatch Solana error 0x1004"
```

---

## 🔐 Alternative : Variables d'environnement

Pour plus de sécurité, utilisez un fichier `.env` :

### 1. Créer `.env` dans votre workspace
```bash
# API Keys pour MCP
TAVILY_API_KEY=tvly-votre_cle_ici
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_votre_token_ici
```

### 2. Ajouter au .gitignore
```bash
echo ".env" >> .gitignore
```

### 3. Configuration VS Code simplifiée
```json
{
  "cline.mcpServers": {
    "tavily": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-tavily"],
      "env": {
        "TAVILY_API_KEY": "${env:TAVILY_API_KEY}"
      }
    }
  }
}
```

---

## 🆘 Dépannage

### Erreur : "Tavily API key is invalid"
- ✅ Vérifiez que la clé commence par `tvly-`
- ✅ Vérifiez qu'il n'y a pas d'espaces avant/après
- ✅ Vérifiez que votre compte Tavily est actif

### Erreur : "MCP server failed to start"
**Solution 1 :** Installer manuellement
```bash
npm install -g @modelcontextprotocol/server-tavily
```

**Solution 2 :** Vérifier npx
```bash
npx --version
```

**Solution 3 :** Redémarrer VS Code complètement (fermer et rouvrir)

### Erreur : "Network error"
- ✅ Vérifiez votre connexion Internet
- ✅ Vérifiez que vous n'avez pas atteint la limite (1000 req/mois)
- ✅ Allez sur https://tavily.com/dashboard pour voir votre usage

---

## 🎯 Avantages Tavily pour votre projet

### Pour Solana/Blockchain
- 🔍 Meilleure compréhension des termes techniques (cargo-build-sbf, BPF, etc.)
- 📚 Trouve les docs officielles plus rapidement
- 🐛 Meilleures solutions pour erreurs de compilation

### Pour Rust/Cargo
- 📦 Comprend les problèmes de dépendances
- 🔧 Trouve les solutions de workarounds
- 📖 Accès aux discussions GitHub/forums récentes

### Pour Anchor Framework
- 🎯 Docs Anchor spécifiques
- 💡 Exemples de code pertinents
- 🔄 Compatibilité des versions

---

## 📊 Comparaison : Recherche typique

### Requête : "Solana CLI Cargo.lock v4 support"

**Avec Brave Search :**
- Résultats généraux sur Cargo
- Articles blog obsolètes
- Forums généralistes

**Avec Tavily AI :**
- ✅ Docs officielles Solana
- ✅ Issues GitHub pertinentes
- ✅ Release notes récentes
- ✅ Solutions de workarounds actuelles

---

## ✅ Configuration Minimale Fonctionnelle

Si vous voulez juste commencer avec Tavily :

```json
{
  "cline.mcpServers": {
    "tavily": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-tavily"],
      "env": {
        "TAVILY_API_KEY": "VOTRE_CLE_TAVILY"
      }
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    }
  }
}
```

**Cette config minimale vous donne :**
- 🔍 Recherche AI optimisée (Tavily)
- 🌐 Accès direct aux URLs (Fetch)
- ✅ Pas besoin de clé pour Fetch

---

## 🎓 Ressources

- **Tavily API Docs :** https://docs.tavily.com/
- **Serveur MCP Tavily :** https://github.com/modelcontextprotocol/servers/tree/main/src/tavily
- **Dashboard usage :** https://tavily.com/dashboard

---

**Après configuration, testez immédiatement avec :**

```
"Search Tavily: Solana CLI latest version November 2024"
```

🚀 **Tavily est maintenant configuré pour améliorer mes capacités de recherche !**
