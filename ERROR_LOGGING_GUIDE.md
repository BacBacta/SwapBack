# 🔍 Guide du Système de Logging des Erreurs

## Vue d'ensemble

Un système complet de logging des erreurs a été mis en place pour capturer et diagnostiquer toutes les erreurs de l'application, côté client et serveur.

## 🎯 Fonctionnalités

### 1. Capture Automatique des Erreurs

- ✅ Erreurs React (via Error Boundary)
- ✅ Erreurs JavaScript non gérées (window.error)
- ✅ Promesses rejetées (unhandledRejection)
- ✅ Erreurs serveur Next.js
- ✅ Erreurs API Routes

### 2. Informations Capturées

Chaque erreur enregistre :
- **Error details**: message, nom, stack trace
- **Context**: composant, action, pathname, URL
- **Environment**: client/serveur, réseau, wallet connecté
- **Additional data**: données spécifiques au contexte
- **Timestamp**: date/heure exacte

### 3. Visualisation des Logs

#### Option 1: Panneau de Debug (Interface Graphique)

**Raccourci clavier**: `Ctrl + Shift + L`

Le panneau affiche :
- Liste de toutes les erreurs en temps réel
- Auto-refresh activable
- Détails complets (stack trace, contexte, données)
- Boutons pour télécharger ou effacer les logs

#### Option 2: Console Développeur

```javascript
// Voir tous les logs
window.errorLogger.getLogs()

// Voir les 10 derniers logs
window.errorLogger.getRecentLogs(10)

// Exporter en JSON
window.errorLogger.exportLogs()

// Télécharger les logs
window.errorLogger.downloadLogs()

// Effacer les logs
window.errorLogger.clearLogs()
```

### 4. Logs Serveur

Les erreurs client sont automatiquement envoyées au serveur via `/api/log-error`.

Les logs serveur sont :
- ✅ Affichés dans la console avec formatage détaillé
- ✅ Sauvegardés dans `logs/error-YYYY-MM-DD.jsonl`

## 📋 Comment Utiliser

### Lors d'une Erreur

1. **Si l'erreur s'affiche** :
   - L'Error Boundary affiche une page d'erreur détaillée
   - Cliquez sur "Télécharger les logs" pour sauvegarder

2. **Si l'application semble cassée** :
   - Appuyez sur `Ctrl + Shift + L` pour ouvrir le panneau
   - OU ouvrez F12 > Console
   - Tapez `window.errorLogger.getLogs()`

3. **Envoyer les logs pour debug** :
   - Téléchargez le fichier JSON
   - Ou copiez le contenu de la console
   - Partagez avec les développeurs

### En Développement

#### Ajouter du logging personnalisé

```typescript
import { logError } from "@/lib/errorLogger";

try {
  // Code risqué
  await someRiskyOperation();
} catch (error) {
  logError(error, {
    component: "MonComposant",
    action: "someRiskyOperation",
    additionalData: {
      userId: user.id,
      // Autres données pertinentes
    },
  });
  throw error; // Re-throw si nécessaire
}
```

#### Wrapper automatique pour fonctions async

```typescript
import { withErrorLogging } from "@/lib/errorLogger";

const myFunction = withErrorLogging(
  async (param1, param2) => {
    // Votre code
  },
  { component: "MonComposant", action: "myFunction" }
);
```

## 🔧 Configuration

### Désactiver le Panneau de Debug en Production

Dans `app/src/app/layout.tsx` :

```typescript
{process.env.NODE_ENV === "development" && <DebugLogPanel />}
```

### Changer le Nombre Maximum de Logs en Mémoire

Dans `app/src/lib/errorLogger.ts` :

```typescript
private maxLogs = 100; // Modifier cette valeur
```

### Désactiver l'Envoi au Serveur

Dans `app/src/lib/errorLogger.ts`, commenter :

```typescript
// this.sendToServer(errorLog).catch(console.error);
```

## 📁 Structure des Fichiers

```
app/src/
├── lib/
│   └── errorLogger.ts          # Système de logging principal
├── components/
│   ├── GlobalErrorBoundary.tsx # Capture erreurs React
│   └── DebugLogPanel.tsx       # Interface de visualisation
└── app/
    ├── error.tsx               # Page erreur Next.js
    └── api/
        └── log-error/
            └── route.ts        # API pour recevoir logs client

logs/
├── .gitignore                  # Ignore les fichiers logs
├── README.md                   # Description du dossier
└── error-2025-11-12.jsonl      # Fichiers de logs (générés)
```

## 🎨 Format des Logs

```json
{
  "timestamp": "2025-11-12T15:30:45.123Z",
  "error": {
    "message": "Cannot read property 'publicKey' of undefined",
    "name": "TypeError",
    "stack": "TypeError: Cannot read property...\n  at Dashboard.tsx:42:15\n  ...",
    "cause": null
  },
  "context": {
    "component": "Dashboard",
    "action": "fetchUserStats",
    "userAgent": "Mozilla/5.0...",
    "url": "https://swapback.vercel.app/dashboard",
    "pathname": "/dashboard"
  },
  "environment": {
    "isClient": true,
    "isServer": false,
    "network": "devnet",
    "hasWallet": true
  },
  "additionalData": {
    "walletConnected": false,
    "publicKey": null
  }
}
```

## 🚀 Déploiement

Les logs sont automatiquement actifs en production.

### Vérifier les logs sur Vercel

1. Dashboard Vercel > Deployments
2. Sélectionner le dernier déploiement
3. Onglet "Functions"
4. Voir les logs de `/api/log-error`

### Accéder aux fichiers logs

Les fichiers sont créés dans `/logs/` mais ne sont pas commités dans Git.

En production, vous pouvez :
- Utiliser le panneau de debug client
- Consulter les logs Vercel Functions
- Implémenter un stockage externe (S3, CloudWatch, etc.)

## 💡 Conseils

### Pour Débugger Rapidement

1. Reproduire l'erreur
2. `Ctrl + Shift + L` pour ouvrir le panneau
3. Cliquer sur "Download" pour sauvegarder
4. Analyser le stack trace et le contexte

### Surveiller en Temps Réel

```javascript
// Dans la console
setInterval(() => {
  const logs = window.errorLogger.getRecentLogs(5);
  if (logs.length > 0) {
    console.table(logs.map(l => ({
      time: l.timestamp,
      error: l.error.name,
      message: l.error.message,
      component: l.context.component
    })));
  }
}, 5000);
```

## 🔒 Sécurité

⚠️ **Important** : Les logs peuvent contenir des informations sensibles.

- Ne pas logger de clés privées, tokens, ou données personnelles
- Les logs sont stockés côté client dans la mémoire du navigateur
- Les fichiers serveur ne sont pas exposés publiquement
- Nettoyer régulièrement les logs en production

## 📞 Support

Si l'erreur persiste :

1. Téléchargez les logs (`window.errorLogger.downloadLogs()`)
2. Vérifiez la console serveur (Vercel Functions)
3. Partagez les informations avec l'équipe de développement

---

**Dernière mise à jour** : 12 Novembre 2025
