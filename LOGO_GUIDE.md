# Guide d'ajout du logo SwapBack

## ✅ Modifications effectuées

### 1. **Fichier logo créé**
- **Emplacement** : `/app/public/logo-swapback.svg`
- Logo SVG vectoriel avec :
  - Éclair (⚡) représentant le "Swap"
  - Flèche circulaire (↻) représentant le "Back"
  - Style terminal vert phosphorescent (#00FF41, #39FF14)

### 2. **Composant Logo réutilisable**
- **Fichier** : `/app/src/components/SwapBackLogo.tsx`
- **Props disponibles** :
  - `size` : Taille du logo (défaut: 40px)
  - `className` : Classes CSS additionnelles
  - `showText` : Afficher/masquer "SWAPBACK" (défaut: true)
  - `onClick` : Callback optionnel (défaut: undefined)

### 3. **Intégration dans la page d'accueil**
- **Fichier modifié** : `/app/src/components/home-concepts/Option3Scrollytelling.tsx`
- Logo ajouté dans la barre de navigation fixe
- Effet de survol et animation terminal-glow
- Click pour retourner en haut de page (smooth scroll)

## 🎨 Personnalisation du logo

### Option 1 : Remplacer le fichier SVG
Remplacez `/app/public/logo-swapback.svg` par votre propre logo :
```bash
# Formats supportés : .svg, .png, .jpg, .webp
cp votre-logo.svg /workspaces/SwapBack/app/public/logo-swapback.svg
```

### Option 2 : Utiliser une image PNG/JPG
Si vous préférez une image bitmap :
```tsx
<Image 
  src="/logo-swapback.png" 
  alt="SwapBack Logo" 
  width={40} 
  height={40}
  className="terminal-glow"
/>
```

### Option 3 : Modifier les couleurs du SVG actuel
Éditez `/app/public/logo-swapback.svg` et changez les attributs `fill` et `stroke` :
```svg
<!-- Exemple : Logo bleu -->
<path ... fill="#0099FF" stroke="#0099FF" />
```

## 🚀 Utilisation du composant Logo ailleurs

### Dans n'importe quel composant Next.js :

```tsx
import SwapBackLogo from "@/components/SwapBackLogo";

// Logo simple (40px par défaut)
<SwapBackLogo />

// Logo grand sans texte
<SwapBackLogo size={60} showText={false} />

// Logo cliquable avec callback
<SwapBackLogo 
  size={50}
  onClick={() => router.push('/')}
  className="hover:opacity-80"
/>
```

## 📍 Emplacements où ajouter le logo

Le logo est maintenant sur la **page d'accueil (/)** dans la navigation fixe.

Pour l'ajouter ailleurs :

### Dashboard
```tsx
// /app/src/app/dashboard/page.tsx
import SwapBackLogo from "@/components/SwapBackLogo";

<SwapBackLogo onClick={() => router.push('/')} />
```

### Page Swap
```tsx
// /app/src/app/swap/page.tsx
import SwapBackLogo from "@/components/SwapBackLogo";

<SwapBackLogo size={32} />
```

### Footer
```tsx
<footer>
  <SwapBackLogo showText={true} />
  <p>© 2025 SwapBack. All rights reserved.</p>
</footer>
```

## 🔧 Tester les modifications

Le serveur de développement est déjà en cours d'exécution :
```
✓ Ready in 3.5s
Local: http://localhost:3000
```

Ouvrez http://localhost:3000 pour voir le logo en action !

## 💡 Conseils supplémentaires

1. **Favicon** : Le logo peut aussi servir de favicon
   ```tsx
   // /app/src/app/layout.tsx
   <link rel="icon" href="/logo-swapback.svg" type="image/svg+xml" />
   ```

2. **SEO** : Le logo utilise déjà `priority` pour optimiser le chargement

3. **Accessibilité** : L'attribut `alt` est déjà configuré pour les lecteurs d'écran

4. **Performance** : Next.js Image component optimise automatiquement le logo

## 📦 Fichiers créés/modifiés

- ✅ `/app/public/logo-swapback.svg` (nouveau)
- ✅ `/app/src/components/SwapBackLogo.tsx` (nouveau)
- ✅ `/app/src/components/home-concepts/Option3Scrollytelling.tsx` (modifié)
