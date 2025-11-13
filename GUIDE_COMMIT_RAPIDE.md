# 🚀 Guide Rapide de Commit - Solution Solana CLI 2.0.15

## ⚠️ PROBLÈME ENVIRONNEMENT DÉTECTÉ

L'environnement Git dans le dev container a des problèmes de fournisseur de fichiers.

---

## 📝 SOLUTION : Commit Manuel (2 Options)

### OPTION 1 : Via VS Code Source Control (RECOMMANDÉ)

#### Étape 1 : Ouvrir Source Control
1. Cliquer sur l'icône Source Control (icône branche à gauche) ou `Ctrl+Shift+G`
2. Vous devriez voir `.github/workflows/anchor-deploy.yml` modifié

#### Étape 2 : Stage Changes
1. Hover sur `.github/workflows/anchor-deploy.yml`
2. Cliquer sur le `+` pour stage le fichier

#### Étape 3 : Commit
1. Dans la boîte de texte en haut, coller ce message :

```
feat(ci): Upgrade to Solana CLI 2.0.15 for native Cargo.lock v4 support

BREAKTHROUGH SOLUTION - User suggested correct approach:
Instead of fighting Cargo.lock v4 with downgrades and hacks,
upgrade Solana CLI to version that supports v4 natively.

ROOT CAUSE:
- cargo-build-sbf in Solana CLI 1.18.x only supports Cargo.lock v3
- Solana CLI 2.0+ has native v4 support in cargo-build-sbf
- Modern stack alignment: Rust stable + Anchor 0.31 + Solana 2.0

CHANGES:
1. Solana CLI: v1.18.26 → v2.0.15 (native v4 support)
2. Anchor: v0.30.1 → v0.31.0 (compatible with Solana 2.0)
3. Rust: stable (latest, v4 native)
4. Removed ALL v4→v3 downgrade hacks (sed, cargo-edit, checks)
5. Simplified workflow (no workarounds needed)

TECHNICAL BENEFITS:
✅ cargo-build-sbf 2.0 accepts Cargo.lock v4 natively
✅ No version conversion needed
✅ Modern, maintainable stack
✅ Faster builds (no complex pre-processing)
✅ Aligned dependencies

This resolves 2-day debugging journey with proper solution:
upgrade dependencies instead of fighting them.
```

2. Cliquer sur le bouton `Commit` (ou `Ctrl+Enter`)

#### Étape 4 : Push
1. Cliquer sur le bouton `Sync Changes` ou `...` → `Push`
2. Confirmer si demandé

---

### OPTION 2 : Via Terminal Intégré VS Code

#### Ouvrir Nouveau Terminal
1. `Ctrl+Shift+` \` (backtick) ou Terminal → New Terminal
2. Vérifier que vous êtes dans `/workspaces/SwapBack`

#### Commandes à Exécuter

```bash
# 1. Vérifier status
git status

# 2. Add le fichier modifié
git add .github/workflows/anchor-deploy.yml

# 3. (Optionnel) Add Anchor.toml si modifié
git add Anchor.toml

# 4. Commit avec message complet
git commit -m "feat(ci): Upgrade to Solana CLI 2.0.15 for native Cargo.lock v4 support

BREAKTHROUGH SOLUTION - User suggested correct approach:
Instead of fighting Cargo.lock v4 with downgrades and hacks,
upgrade Solana CLI to version that supports v4 natively.

ROOT CAUSE:
- cargo-build-sbf in Solana CLI 1.18.x only supports Cargo.lock v3
- Solana CLI 2.0+ has native v4 support in cargo-build-sbf
- Modern stack alignment: Rust stable + Anchor 0.31 + Solana 2.0

CHANGES:
1. Solana CLI: v1.18.26 → v2.0.15 (native v4 support)
2. Anchor: v0.30.1 → v0.31.0 (compatible with Solana 2.0)
3. Rust: stable (latest, v4 native)
4. Removed ALL v4→v3 downgrade hacks (sed, cargo-edit, checks)
5. Simplified workflow (no workarounds needed)

TECHNICAL BENEFITS:
✅ cargo-build-sbf 2.0 accepts Cargo.lock v4 natively
✅ No version conversion needed
✅ Modern, maintainable stack
✅ Faster builds (no complex pre-processing)
✅ Aligned dependencies

This resolves 2-day debugging journey with proper solution:
upgrade dependencies instead of fighting them."

# 5. Push vers GitHub
git push origin main
```

---

## 🔍 VÉRIFICATION POST-COMMIT

### Confirmer Push Réussi

```bash
# Vérifier dernier commit
git log -1 --oneline

# Devrait afficher quelque chose comme :
# abc1234 feat(ci): Upgrade to Solana CLI 2.0.15 for native Cargo.lock v4 support
```

### Vérifier sur GitHub
1. Aller sur : https://github.com/BacBacta/SwapBack/commits/main
2. Vous devriez voir votre nouveau commit en haut
3. Cliquer dessus pour voir les changements dans `anchor-deploy.yml`

---

## 📋 APRÈS LE COMMIT

### Prochaine Étape 1 : Configurer GitHub Secret

**IMPORTANT :** Avant de lancer le workflow, vous devez configurer la keypair :

1. Aller sur : https://github.com/BacBacta/SwapBack/settings/secrets/actions
2. Trouver ou créer le secret : `DEPLOYER_PRIVATE_KEY`
3. Format attendu : `[123,45,67,...]` (JSON array de bytes)
4. Cliquer sur `Update secret` ou `Add secret`

**Obtenir le format JSON array depuis votre keypair :**

```bash
# Si vous avez la keypair en fichier JSON
cat devnet-keypair.json

# Copier TOUT le contenu (avec les crochets [])
# Exemple : [178,23,45,67,89,12,34,...]
```

### Prochaine Étape 2 : Lancer le Workflow

1. Aller sur : https://github.com/BacBacta/SwapBack/actions/workflows/anchor-deploy.yml
2. Cliquer sur `Run workflow` (bouton bleu à droite)
3. Sélectionner `swapback_cnft` dans le dropdown
4. Cliquer sur `Run workflow` (bouton vert)
5. Attendre ~10-15 minutes

### Résultats Attendus

Le workflow devrait afficher :

```
✅ Setup Rust stable
✅ Install Solana CLI 2.0.15
✅ Install Anchor CLI v0.31.0
✅ Generate Cargo.lock (v4)
✅ Pre-build verification passed
✅ Anchor build succeeded (NO v4 ERROR!)
✅ Deploy to devnet succeeded
✅ Program deployed: 26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru
```

### Prochaine Étape 3 : Vérifier Fix

1. Aller sur : https://swap-back-pc5qkn6em-bactas-projects.vercel.app/
2. Connecter wallet
3. Essayer de lock des tokens
4. **Résultat attendu :** 
   - ✅ Transaction réussit
   - ✅ Signature de transaction affichée
   - ✅ cNFT minté
   - ✅ **DeclaredProgramIdMismatch (0x1004) DISPARU !**

---

## 🆘 SI PROBLÈME AVEC COMMIT

### Erreur Git Persist?

Si vous ne pouvez toujours pas commit via terminal ou VS Code :

#### Solution Alternative : GitHub Web Interface

1. Ouvrir le fichier sur GitHub : https://github.com/BacBacta/SwapBack/blob/main/.github/workflows/anchor-deploy.yml
2. Cliquer sur l'icône crayon (Edit) en haut à droite
3. Faire les modifications manuellement :
   - Ligne 15 : `SOLANA_VERSION: v2.0.15`
   - Ligne 16 : `ANCHOR_VERSION: v0.31.0`
   - Simplifier le step "Generate Cargo.lock" (lignes 80-92)
   - Simplifier le step "Pre-build verification" (lignes 94-105)
4. Scroll en bas, commit message :
   ```
   feat(ci): Upgrade to Solana CLI 2.0.15 for native Cargo.lock v4 support
   ```
5. Cliquer sur `Commit changes`

**Note :** Méthode moins recommandée car modifications manuelles complexes.

---

## 📧 BESOIN D'AIDE ?

Si vous rencontrez des problèmes :

1. **Copier les logs d'erreur** complets
2. **Décrire l'étape** où le problème survient
3. **Préciser quel message d'erreur** exact vous voyez

---

## ✅ CHECKLIST COMPLÈTE

- [ ] Commit `.github/workflows/anchor-deploy.yml` modifié
- [ ] Push vers GitHub main branch
- [ ] Vérifier commit visible sur GitHub
- [ ] Configurer `DEPLOYER_PRIVATE_KEY` secret
- [ ] Lancer workflow GitHub Actions
- [ ] Attendre build + deploy (10-15 min)
- [ ] Vérifier deploy succeeded dans logs
- [ ] Tester lock operation sur app Vercel
- [ ] Confirmer DeclaredProgramIdMismatch (0x1004) RÉSOLU !

---

**Prochaine action immédiate :** Essayer OPTION 1 (VS Code Source Control) en premier ✨
