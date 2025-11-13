# 🔧 Guide Configuration MCP pour SwapBack

## 📋 Configuration Brave Search MCP

### Étape 1 : Obtenir votre clé API Brave

1. **Allez sur :** https://brave.com/search/api/
2. **Créez un compte** (gratuit)
3. **Obtenez votre API Key**
   - Plan gratuit : 2000 requêtes/mois
   - Format : `BSA...`

### Étape 2 : Configurer l'extension Claude/Cline

#### Option A : Configuration VS Code (Recommandé)

1. **Ouvrir les paramètres VS Code :**
   ```
   Ctrl+Shift+P → "Preferences: Open User Settings (JSON)"
   ```

2. **Ajouter la configuration MCP :**
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

3. **Remplacer `VOTRE_CLE_ICI`** par votre vraie clé Brave

4. **Redémarrer VS Code**

#### Option B : Fichier de configuration global

1. **Créer le fichier :**
   ```bash
   mkdir -p ~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings
   ```

2. **Éditer :**
   ```bash
   nano ~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
   ```

3. **Coller le contenu** du fichier `.mcp-config.json` de ce repo (avec votre clé)

4. **Sauvegarder et redémarrer VS Code**

### Étape 3 : Vérifier l'activation

Après redémarrage, demandez à Claude :
```
"Recherche sur Brave : dernière version Solana CLI compatible Cargo.lock v4"
```

Si configuré correctement, Claude pourra chercher sur le web en temps réel ! 🎉

## 🎯 Avantages pour le projet SwapBack

### Avec Brave Search MCP activé :

✅ **Rechercher les dernières docs Solana/Anchor**
```
"Brave search: Solana CLI 2.0 cargo.lock version 4 support"
```

✅ **Trouver des solutions aux erreurs récentes**
```
"Brave search: cargo-build-sbf lock file version 4 requires Znext-lockfile-bump"
```

✅ **Vérifier les versions compatibles**
```
"Brave search: Anchor 0.31.0 Rust version compatibility"
```

✅ **Accéder aux release notes**
```
"Brave search: Solana CLI releases after October 2024"
```

### Avec Fetch MCP activé :

✅ **Lire directement les docs GitHub**
```
"Fetch: https://github.com/solana-labs/solana/releases/latest"
```

✅ **Accéder aux changelogs Anchor**
```
"Fetch: https://github.com/coral-xyz/anchor/blob/master/CHANGELOG.md"
```

## 🔐 Sécurité

⚠️ **Important :**
- Ne commitez JAMAIS votre clé API dans Git
- Ajoutez `.mcp-config.json` au `.gitignore` si vous y mettez votre vraie clé
- Utilisez plutôt les paramètres VS Code (méthode recommandée)

## 🆘 Dépannage

### "MCP server not found"
- Vérifiez que `npx` est installé : `npx --version`
- Vérifiez votre connexion Internet
- Redémarrez VS Code

### "Invalid API Key"
- Vérifiez que la clé commence par `BSA`
- Vérifiez qu'il n'y a pas d'espaces avant/après
- Vérifiez que votre compte Brave Search API est actif

### "Module not found"
```bash
# Installer manuellement le serveur MCP
npm install -g @modelcontextprotocol/server-brave-search
```

## 📚 Ressources

- **Brave Search API :** https://brave.com/search/api/
- **MCP Documentation :** https://modelcontextprotocol.io/
- **Serveurs MCP officiels :** https://github.com/modelcontextprotocol/servers

---

**Une fois configuré, Claude pourra chercher des infos récentes sur Solana/Anchor pour vous aider !** 🚀
