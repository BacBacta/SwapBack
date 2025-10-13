# 🚀 Guide de Démarrage Rapide - SwapBack

## ✅ Problème Résolu : Application Opérationnelle

L'application SwapBack est maintenant **entièrement fonctionnelle** et accessible !

## 📊 État Actuel

| Service | Port | URL | État |
|---------|------|-----|------|
| **Application Next.js** | 3000 | http://localhost:3000 | ✅ **EN LIGNE** |
| **Oracle API** | 3003 | http://localhost:3003 | ✅ **EN LIGNE** |

## 🎯 Accès à l'Application

### Option 1 : Navigateur VS Code (Recommandé)

L'application est déjà ouverte dans le **Simple Browser** de VS Code !

Si elle n'est pas visible :
1. Ouvrez la palette de commandes (`Ctrl+Shift+P`)
2. Tapez "Simple Browser"
3. Entrez : `http://localhost:3000`

### Option 2 : Port Forwarding

VS Code Codespaces expose automatiquement les ports :
1. Cliquez sur l'onglet **"PORTS"** en bas
2. Recherchez le port **3000**
3. Cliquez sur l'icône **Globe** pour ouvrir dans un nouvel onglet

### Option 3 : Terminal

```bash
# L'application est accessible localement
curl http://localhost:3000
```

## 🔧 Gestion des Services

### Démarrage Automatique (Recommandé)

```bash
./start-services.sh
```

Ce script :
- ✅ Démarre l'Oracle API sur le port 3003
- ✅ Démarre l'application Next.js sur le port 3000
- ✅ Vérifie que tout fonctionne
- ✅ Surveille les services
- ✅ Affiche les URLs d'accès

### Démarrage Manuel

#### Oracle API

```bash
cd /workspaces/SwapBack/oracle
npm run build
nohup npm start > /tmp/oracle.log 2>&1 &
```

#### Application Next.js

```bash
cd /workspaces/SwapBack/app
nohup npm run dev > /tmp/nextjs.log 2>&1 &
```

### Vérification des Services

```bash
./test-services.sh
```

### Arrêt des Services

```bash
# Arrêter l'Oracle
pkill -f "node dist/index.js"

# Arrêter Next.js
pkill -f "next dev"

# Ou utiliser Ctrl+C dans start-services.sh
```

## 📝 Logs

### Voir les Logs en Temps Réel

```bash
# Oracle API
tail -f /tmp/oracle.log

# Application Next.js
tail -f /tmp/nextjs.log

# Les deux en même temps
tail -f /tmp/oracle.log /tmp/nextjs.log
```

### Avec le Script de Démarrage

```bash
./start-services.sh --logs
```

## 🧪 Tests

### Test Complet

```bash
./test-services.sh
```

Résultat attendu :
```
✅ Test 1: Oracle API Health Check (port 3003)... PASS
✅ Test 2: Oracle API Simulate Endpoint... PASS
✅ Test 3: Next.js Application (port 3000)... PASS
✅ Test 4: Vérification des processus... PASS
```

### Test Manuel de l'Oracle

```bash
# Health check
wget -qO- http://localhost:3003/health

# Simulation de route
wget -qO- --post-data='{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","inputAmount":"1000000"}' --header='Content-Type:application/json' http://localhost:3003/simulate
```

### Test Manuel de l'Application

```bash
# Vérifier que l'application répond
wget -qO- http://localhost:3000 | head -20
```

## 🐛 Dépannage

### L'application ne s'ouvre pas ?

1. **Vérifier les processus**
   ```bash
   ps aux | grep -E "(node|next)" | grep -v grep
   ```

2. **Vérifier les ports**
   ```bash
   netstat -tlnp | grep -E "(3000|3003)"
   ```

3. **Redémarrer les services**
   ```bash
   pkill -f "node dist/index.js"
   pkill -f "next dev"
   ./start-services.sh
   ```

4. **Vérifier les logs**
   ```bash
   tail -50 /tmp/oracle.log
   tail -50 /tmp/nextjs.log
   ```

### Port déjà utilisé ?

```bash
# Libérer le port 3000
lsof -ti:3000 | xargs kill -9

# Libérer le port 3003
lsof -ti:3003 | xargs kill -9
```

### Erreur de compilation Next.js ?

```bash
cd /workspaces/SwapBack/app
rm -rf .next node_modules
npm install
npm run dev
```

## 📁 Structure des Fichiers

```
SwapBack/
├── start-services.sh          ✅ Script de démarrage automatique
├── test-services.sh           ✅ Script de tests
├── app/                       ✅ Application Next.js (port 3000)
├── oracle/                    ✅ API Oracle (port 3003)
└── logs/
    ├── /tmp/oracle.log        📝 Logs Oracle
    └── /tmp/nextjs.log        📝 Logs Next.js
```

## ✨ Fonctionnalités Disponibles

### Dans l'Application (http://localhost:3000)

- ✅ **Interface de Swap** : Échange de tokens optimisé
- ✅ **Connexion Wallet** : Support multi-wallets Solana
- ✅ **Simulation de Routes** : Calcul automatique des meilleurs chemins
- ✅ **Affichage des Frais** : NPI, rebate, burn, fees
- ✅ **Interface Responsive** : Mobile et desktop

### API Oracle (http://localhost:3003)

- ✅ **GET /health** : Vérification de santé
- ✅ **POST /simulate** : Simulation de routes de swap

## 🎯 Prochaines Étapes

1. **Connecter un Wallet Solana** dans l'application
2. **Tester une simulation de swap** avec différents tokens
3. **Consulter les routes optimisées** par l'Oracle
4. **Intégrer l'API Jupiter** (actuellement en mode mock)

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs : `tail -f /tmp/*.log`
2. Relancez les services : `./start-services.sh`
3. Testez avec : `./test-services.sh`

---

## 🎉 Résumé

**✅ L'application SwapBack est maintenant OPÉRATIONNELLE !**

- 🌐 **Application** : http://localhost:3000
- 🔧 **Oracle API** : http://localhost:3003
- 📊 **Tous les tests** : Réussis
- 🚀 **Prêt à utiliser** : Oui !

**Pour démarrer rapidement :**
```bash
./start-services.sh
```

**Pour ouvrir l'application :**
- Utilisez le Simple Browser dans VS Code
- Ou l'onglet PORTS pour le port forwarding
