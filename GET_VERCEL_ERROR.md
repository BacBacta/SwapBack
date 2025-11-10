# 🚨 Comment récupérer l'erreur EXACTE de Vercel

## Méthode 1: Console Navigateur (RECOMMANDÉ)

### Étapes:
1. **Ouvre ton app sur Vercel** (par exemple: `https://swap-back.vercel.app`)
2. **Ouvre la console** : Appuie sur `F12` ou `Cmd+Option+J` (Mac)
3. **Va dans l'onglet "Console"**
4. **Rafraîchis la page** : `Ctrl+R` ou `Cmd+R`
5. **Connecte ton wallet** si l'erreur se produit à ce moment
6. **Copie TOUTE l'erreur rouge** y compris:
   - Le message d'erreur
   - Le stack trace (toutes les lignes qui suivent)
   - Le fichier/ligne où ça plante

### Exemple de ce que je cherche:
```
❌ Error: NEXT_PUBLIC_CNFT_PROGRAM_ID is not defined
    at getCnftProgramId (lockTokens.ts:45)
    at createLockTransaction (lockTokens.ts:123)
    at LockButton.tsx:67
    ...
```

## Méthode 2: Logs Vercel

### Étapes:
1. Va sur **Vercel Dashboard**
2. Clique sur ton projet **SwapBack**
3. Va dans **Deployments**
4. Clique sur le **dernier deployment**
5. Clique sur **"View Function Logs"** ou **"Runtime Logs"**
6. Cherche les erreurs en **rouge**
7. Copie l'erreur complète

## Méthode 3: Build Logs

### Étapes:
1. Va sur **Vercel Dashboard**
2. Clique sur ton projet **SwapBack**
3. Va dans **Deployments**
4. Clique sur le **dernier deployment**
5. Clique sur **"View Build Logs"**
6. Cherche les **erreurs** ou **warnings**
7. Copie tout ce qui est rouge ou jaune

## 🎯 Ce dont j'ai besoin:

**Copie-moi EXACTEMENT:**
1. ✅ Le message d'erreur complet
2. ✅ La stack trace (toutes les lignes)
3. ✅ Le fichier et la ligne où ça plante
4. ✅ Quand l'erreur se produit (au chargement? à la connexion wallet?)

## 📝 Template de réponse:

```
L'erreur se produit: [au chargement / à la connexion wallet / autre]

Message d'erreur:
[Copie ici l'erreur exacte de la console ou des logs]

Stack trace:
[Copie ici toutes les lignes du stack trace]
```

---

## 🔧 En attendant, teste localement:

Lance le script de debug pour simuler Vercel:
```bash
./debug-vercel-build.sh
```

Cela va me dire si le problème est dans le build ou au runtime.
