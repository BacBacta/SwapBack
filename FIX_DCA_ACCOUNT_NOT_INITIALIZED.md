# Fix pour l'erreur "AccountNotInitialized" dans DCA

## Problèmes résolus

### 1. Erreur `fs__WEBPACK_IMPORTED_MODULE_2__.existsSync is not a function`

**Cause**: Le module Node.js `fs` était importé dans le code client React (`useExecuteBuyback.ts`), ce qui ne fonctionne pas dans le navigateur car `fs` n'existe que côté serveur.

**Solution**: Remplacé l'import `fs` par l'API `fetch` pour charger les fichiers IDL depuis le dossier `public/idl/`.

**Fichiers modifiés**:
- `app/src/hooks/useExecuteBuyback.ts`

### 2. Erreur `AccountNotInitialized` lors de la création de plans DCA

**Cause**: Le compte Router State global n'était pas initialisé avant la création de plans DCA. Ce compte est requis par le programme Solana pour stocker la configuration globale.

**Solutions appliquées**:

a) **Fix de l'allocation mémoire dans le programme Rust**:
   - Fichier: `programs/swapback_router/src/lib.rs`
   - Changement: `space = 8 + 32 + 1` → `space = RouterState::LEN`
   - Raison: L'espace alloué (41 bytes) était trop petit pour la structure RouterState (87 bytes)

b) **Amélioration de la gestion des erreurs**:
   - Fichier: `app/src/lib/dca.ts`
   - Ajout de la fonction `isRouterStateInitialized()`
   - Amélioration de `ensureRouterStateInitialized()` pour afficher une erreur claire au lieu d'essayer d'initialiser automatiquement

c) **Script d'initialisation**:
   - Nouveau fichier: `scripts/init-router-state-simple.js`
   - Usage: `node scripts/init-router-state-simple.js`
   - Note: Doit être exécuté par le wallet qui a déployé le programme

### 3. Erreur de build avec Google Fonts

**Cause**: Impossible d'accéder à Google Fonts depuis l'environnement de build.

**Solution**: Utilisation de polices système au lieu de Google Fonts.

**Fichier modifié**:
- `app/src/app/layout.tsx`

### 4. Incohérence des Program IDs

**Cause**: Deux Program IDs différents étaient utilisés dans différents fichiers.

**Solution**: Standardisation sur `BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz` (celui défini dans Anchor.toml).

**Fichiers modifiés**:
- `app/src/lib/dca.ts`
- `app/src/components/SwapBackDashboard.tsx`
- `app/src/components/SwapBackInterface.tsx`
- `app/src/config/tokens.ts`
- `app/src/config/testnet.ts`
- `app/src/config/constants.ts`

## Instructions pour initialiser le Router State

Si vous obtenez l'erreur "Router State is not initialized", suivez ces étapes:

### Option 1: Utiliser le script d'initialisation (Recommandé)

```bash
# Depuis le répertoire racine du projet
node scripts/init-router-state-simple.js
```

Le script:
- Vérifie si le Router State est déjà initialisé
- Si non, l'initialise avec les valeurs par défaut
- Affiche les détails de l'état initialisé

### Option 2: Redéployer le programme avec le fix

Si le programme a déjà été déployé avec la mauvaise allocation mémoire:

```bash
# 1. Build le programme avec le fix
anchor build

# 2. Déployer sur devnet
anchor deploy --provider.cluster devnet

# 3. Initialiser le Router State
node scripts/init-router-state-simple.js
```

## Vérification

Pour vérifier que tout fonctionne:

1. **Build de l'application**:
```bash
cd app
npm run build
```

2. **Démarrer le serveur de développement**:
```bash
npm run dev
```

3. **Tester la création de plan DCA**:
   - Connecter un wallet avec du SOL devnet
   - Aller sur `/dca`
   - Créer un nouveau plan DCA
   - Si le Router State n'est pas initialisé, un message d'erreur clair s'affichera

## Fichiers créés ou modifiés

### Nouveaux fichiers:
- `scripts/init-router-state-simple.js` - Script d'initialisation du Router State

### Fichiers modifiés:
- `programs/swapback_router/src/lib.rs` - Fix allocation mémoire Router State
- `app/src/hooks/useExecuteBuyback.ts` - Suppression import fs
- `app/src/lib/dca.ts` - Amélioration gestion d'erreurs + mise à jour Program ID
- `app/src/app/layout.tsx` - Utilisation polices système
- `app/src/components/SwapBackDashboard.tsx` - Mise à jour Program ID
- `app/src/components/SwapBackInterface.tsx` - Mise à jour Program ID
- `app/src/config/*.ts` - Mise à jour Program IDs

## État après les fixes

✅ L'application se build et démarre correctement
✅ Plus d'erreur `fs.existsSync` dans le navigateur
✅ Les Program IDs sont cohérents partout
✅ L'allocation mémoire du Router State est correcte
✅ Messages d'erreur clairs si le Router State n'est pas initialisé
✅ Script simple pour initialiser le Router State

## Prochaines étapes

1. **Exécuter le script d'initialisation** (si pas déjà fait):
   ```bash
   node scripts/init-router-state-simple.js
   ```

2. **Tester la création de plans DCA** via l'interface

3. **Vérifier que les swaps DCA fonctionnent** correctement
