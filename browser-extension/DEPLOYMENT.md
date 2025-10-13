# Guide de Déploiement Chrome Web Store

## Prérequis

1. **Compte Google Developer**: $5 one-time fee
2. **Extension testée**: Fonctionnelle en mode développeur
3. **Assets préparés**: Icons, screenshots, description

## Préparation des Assets

### Icons (dossier `/icons/`)
- `icon16.png`: 16x16px
- `icon32.png`: 32x32px
- `icon48.png`: 48x48px
- `icon128.png`: 128x128px

### Screenshots
- 1-5 screenshots montrant l'extension en action
- Résolution: 1280x800px minimum
- Format: PNG ou JPG

### Description
- **Nom court**: SwapBack
- **Description**: Get automatic rebates and better swap routes on all Solana DEXes. Works with Phantom, Solflare, Jupiter, Raydium and more.
- **Description détaillée**: Texte marketing avec features clés

## Étapes de Déploiement

### 1. Empaqueter l'Extension
```bash
# Créer un ZIP de l'extension (sans node_modules)
cd browser-extension
zip -r ../swapback-extension.zip . -x "node_modules/*"
```

### 2. Upload sur Chrome Web Store
1. Aller sur [Chrome Web Store Developer](https://chrome.google.com/webstore/developer/dashboard)
2. Cliquer "Add new item"
3. Upload `swapback-extension.zip`
4. Remplir les informations:
   - Nom: SwapBack - Better Swaps for Solana
   - Description: [voir ci-dessus]
   - Catégorie: Productivity
   - Langues: English, French

### 3. Configuration
- **Visibility**: Public
- **Price**: Free
- **Regions**: All regions
- **Content Rating**: Everyone

### 4. Review et Publication
- Soumettre pour review (2-3 jours)
- Corriger les issues si rejeté
- Publier une fois approuvé

## Post-Déploiement

### Monitoring
- **Analytics**: Chrome Web Store dashboard
- **Feedback**: User reviews
- **Issues**: GitHub issues

### Mises à jour
- Préparer nouvelle version
- Upload ZIP mis à jour
- Review automatique (plus rapide)

## Checklist Pré-Déploiement

- [ ] Extension testée sur Chrome stable
- [ ] Manifest valide (pas d'erreurs)
- [ ] Toutes les permissions justifiées
- [ ] Privacy policy si nécessaire
- [ ] Terms of service
- [ ] Support email valide
- [ ] Icons de qualité
- [ ] Screenshots représentatifs
- [ ] Description claire et précise

## URLs Importantes

- **Store URL**: `https://chrome.google.com/webstore/detail/swapback/[extension-id]`
- **Support**: `support@swapback.app`
- **Privacy Policy**: `https://swapback.app/privacy`
- **Terms**: `https://swapback.app/terms`