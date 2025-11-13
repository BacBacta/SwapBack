# 🚀 GUIDE DE DÉPANNAGE MCP TAVILY

## ⚡ Solutions Rapides

### 1. SOLUTION IMMÉDIATE
```bash
# Exécuter le script de réparation automatique
chmod +x fix-mcp-tavily.sh
./fix-mcp-tavily.sh
```

### 2. REDÉMARRAGE MANUEL
```
1. Sauvegardez mcp.json (Ctrl+S)
2. Rechargez VS Code (Ctrl+Shift+P → "Developer: Reload Window")
3. Attendez 30 secondes
4. Testez: "Search Tavily: test"
```

## 🔍 Diagnostic des Problèmes Courants

### ❌ Problème 1: VS Code pas rechargé
**Symptôme**: MCP ne répond pas du tout
**Solution**: 
- `Ctrl+Shift+P` → "Developer: Reload Window"
- Attendre 30 secondes après rechargement

### ❌ Problème 2: Node.js manquant
**Symptôme**: Erreurs de commande "npx not found"
**Solution**: 
```bash
# Installation Node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### ❌ Problème 3: Cache npm corrompu
**Symptôme**: Échec de téléchargement des packages
**Solution**:
```bash
npm cache clean --force
```

### ❌ Problème 4: API Key invalide
**Symptôme**: Erreurs 401 dans les logs
**Solution**: Vérifier la clé API Tavily:
```
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
```

### ❌ Problème 5: Extension Cline
**Symptôme**: Configuration mcp.json ignorée
**Solution**:
- Vérifier que l'extension Cline est installée
- Mettre à jour l'extension si nécessaire
- Redémarrer VS Code

## 🧪 Tests de Fonctionnement

### Test 1: Tavily Search
```
"Search Tavily: Solana CLI latest version"
```

### Test 2: Fetch URL
```
"Fetch: https://httpbin.org/get"
```

### Test 3: Memory
```
"Souviens-toi: MCP fonctionne correctement"
```

### Test 4: Filesystem
```
"Liste les fichiers dans le répertoire courant"
```

## 📋 Configuration Alternative

Si le problème persiste, essayez cette configuration simplifiée:

```json
{
  "cline.mcpServers": {
    "tavily": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-tavily"],
      "env": {
        "TAVILY_API_KEY": "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"
      }
    }
  }
}
```

## 🔧 Dépannage Avancé

### Vérification des logs Cline
1. `Ctrl+Shift+P` → "Output"
2. Sélectionner "Cline" dans le dropdown
3. Rechercher des erreurs de type:
   - "Failed to start MCP server"
   - "Command not found: npx"
   - "Invalid API key"

### Test manuel des serveurs
```bash
# Test direct du serveur Tavily
npx @modelcontextprotocol/server-tavily --help

# Vérifier les processus en cours
ps aux | grep tavily
```

### Réinstallation complète
```bash
# Suppression du cache
rm -rf ~/.npm
npm cache clean --force

# Réinstallation Node.js si nécessaire
sudo apt update
sudo apt install nodejs npm -y
```

## ✅ Indicateurs de Succès

MCP Tavily fonctionne correctement quand:
- ✅ Aucune erreur dans les logs Cline
- ✅ Réponse aux requêtes "Search Tavily:"
- ✅ Processus npx visibles avec `ps aux | grep tavily`
- ✅ Temps de réponse < 10 secondes

## 🆘 Support d'Urgence

Si rien ne fonctionne:
1. Redémarrer complètement VS Code
2. Redémarrer le conteneur/Codespace
3. Vérifier la connectivité internet
4. Tester avec une configuration MCP minimale

---
**Date**: Novembre 2024  
**Version**: 1.0  
**Statut**: Testé sur VS Code + Codespaces