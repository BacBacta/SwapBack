# 🛠️ Scripts SwapBack

## `remove_swapback_bg.mjs`

### Description
Script Node.js pour générer automatiquement une version transparente du logo texte SwapBack.

### Fonctionnalités
- ✅ Détection automatique de la couleur de fond (pixel [0,0])
- ✅ Suppression intelligente du fond avec tolérance configurable
- ✅ Recadrage automatique des marges transparentes
- ✅ Compression PNG optimisée

### Utilisation

```bash
# 1. S'assurer que le fichier source existe
# app/public/icons/swapback_text_with_bg.png

# 2. Installer les dépendances (si nécessaire)
cd app
npm install

# 3. Lancer le script
node scripts/remove_swapback_bg.mjs
```

### Résultat
Génère `app/public/icons/swapback_text_no_bg.png` avec :
- Fond transparent
- Texte blanc préservé
- Marges supprimées
- Taille optimisée

### Configuration

Modifier dans le script :
```javascript
const COLOR_TOLERANCE = 30; // Seuil de détection (0-255)
```

### Commit Git

```bash
git add app/public/icons/swapback_text_no_bg.png
git add app/scripts/remove_swapback_bg.mjs
git commit -m "chore(assets): generate transparent SwapBack text logo"
```
