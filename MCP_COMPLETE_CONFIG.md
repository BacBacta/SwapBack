# 🎯 Configuration Complète MCP pour SwapBack

## 📦 Configuration VS Code (Méthode Recommandée)

### Étape 1 : Ouvrir les paramètres VS Code

```
Ctrl+Shift+P → "Preferences: Open User Settings (JSON)"
```

### Étape 2 : Ajouter cette configuration complète

```json
{
  "cline.mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "VOTRE_CLE_BRAVE_ICI"
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
        "GITHUB_PERSONAL_ACCESS_TOKEN": "VOTRE_TOKEN_GITHUB_ICI"
      }
    }
  }
}
```

### Étape 3 : Obtenir les clés API

#### 1. Brave Search API (Gratuit) 🔍
- **URL :** https://brave.com/search/api/
- **Plan gratuit :** 2000 requêtes/mois
- **Format clé :** `BSA...`

**Instructions :**
1. Créez un compte sur Brave Search API
2. Allez dans Dashboard → API Keys
3. Copiez votre clé
4. Remplacez `VOTRE_CLE_BRAVE_ICI` dans la config

#### 2. GitHub Personal Access Token 🐙
- **URL :** https://github.com/settings/tokens
- **Accès nécessaire :** `repo`, `read:org`

**Instructions :**
1. Allez sur GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Sélectionnez les scopes :
   - ✅ `repo` (Full control of private repositories)
   - ✅ `read:org` (Read org and team membership)
4. Generate token
5. Copiez le token (format : `ghp_...`)
6. Remplacez `VOTRE_TOKEN_GITHUB_ICI` dans la config

⚠️ **Note :** Vous avez peut-être déjà un token configuré vu que GitHub MCP fonctionne.

#### 3. Fetch MCP ✅
- **Pas de clé nécessaire** - Fonctionne directement

#### 4. Filesystem MCP ✅
- **Pas de clé nécessaire** - Utilise le chemin local

#### 5. Memory MCP ✅
- **Pas de clé nécessaire** - Stockage local

## 🔐 Alternative : Variables d'environnement (Plus sécurisé)

### Option A : Fichier .env local

1. **Créer `.env` dans votre workspace :**
```bash
# API Keys pour MCP
BRAVE_API_KEY=votre_clé_brave_ici
GITHUB_PERSONAL_ACCESS_TOKEN=votre_token_github_ici
```

2. **Ajouter au .gitignore :**
```bash
echo ".env" >> .gitignore
```

3. **Configuration VS Code simplifiée :**
```json
{
  "cline.mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${env:BRAVE_API_KEY}"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${env:GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

### Option B : Variables d'environnement shell

```bash
# Ajouter à ~/.zshrc ou ~/.bashrc
export BRAVE_API_KEY="votre_clé_brave"
export GITHUB_PERSONAL_ACCESS_TOKEN="votre_token_github"

# Recharger
source ~/.zshrc
```

## 📋 Configuration par priorité

### ⭐ Priorité HAUTE (Installation immédiate)

```json
{
  "cline.mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "VOTRE_CLE_ICI"
      }
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    }
  }
}
```

**Pourquoi :** Permet de chercher des solutions en temps réel pour Cargo.lock v4

### ⭐ Priorité MOYENNE (Optionnel mais utile)

```json
{
  "cline.mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/workspaces/SwapBack"
      ]
    }
  }
}
```

**Pourquoi :** Améliore le contexte et l'accès aux fichiers

### ⭐ Priorité BASSE (Si GitHub MCP ne fonctionne pas)

```json
{
  "cline.mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "VOTRE_TOKEN_ICI"
      }
    }
  }
}
```

**Pourquoi :** Vous l'avez probablement déjà configuré

## ✅ Vérification de l'installation

### Test 1 : Brave Search
```
Demandez à Claude : "Brave search: Solana CLI latest version"
```

### Test 2 : Fetch
```
Demandez à Claude : "Fetch: https://github.com/solana-labs/solana/releases/latest"
```

### Test 3 : Memory
```
Demandez à Claude : "Souviens-toi que mon projet s'appelle SwapBack"
Puis plus tard : "De quoi te souviens-tu sur mon projet ?"
```

### Test 4 : Filesystem
```
Demandez à Claude : "Lis le fichier Cargo.toml"
```

### Test 5 : GitHub
```
Demandez à Claude : "Liste les derniers commits du repo"
```

## 🆘 Dépannage

### Erreur : "MCP server failed to start"

**Solution 1 : Installer manuellement**
```bash
npm install -g @modelcontextprotocol/server-brave-search
npm install -g @modelcontextprotocol/server-fetch
npm install -g @modelcontextprotocol/server-memory
npm install -g @modelcontextprotocol/server-filesystem
npm install -g @modelcontextprotocol/server-github
```

**Solution 2 : Vérifier npx**
```bash
npx --version
```

**Solution 3 : Redémarrer VS Code**
```
Ctrl+Shift+P → "Developer: Reload Window"
```

### Erreur : "Invalid API Key"

- Brave : Vérifiez que la clé commence par `BSA`
- GitHub : Vérifiez que le token commence par `ghp_` ou `github_pat_`
- Vérifiez qu'il n'y a pas d'espaces avant/après

### Erreur : "Permission denied"

```bash
# Donner les permissions d'exécution
chmod +x ~/.local/share/npm-global/bin/*
```

## 🎯 Configuration Minimale Recommandée

Pour commencer rapidement avec le strict minimum :

```json
{
  "cline.mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "VOTRE_CLE_BRAVE"
      }
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    }
  }
}
```

**Cette config minimale permet déjà :**
- ✅ Recherche web en temps réel
- ✅ Accès direct aux docs en ligne
- ✅ Trouver les solutions Solana/Anchor récentes

---

**Après configuration, redémarrez VS Code et testez !** 🚀
