# 🔴 URGENT : Mettre à Jour la Variable Vercel

## Problème

L'application sur Vercel utilise encore l'**ancien Program ID CNFT** :

```
❌ NEXT_PUBLIC_CNFT_PROGRAM_ID=FsD6D5yakUipRtFXXbgBf5YaE1ABVEocFDTLB3z2MxnB
```

Mais le code et l'IDL utilisent maintenant le **bon Program ID** :

```
✅ 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
```

Cela cause l'erreur : **"CRITICAL: Program ID mismatch!"**

---

## ✅ Solution 1 : Mettre à Jour sur Vercel (RECOMMANDÉ)

### Étapes :

1. 🌐 Aller sur : https://vercel.com/bacbacta/swapback
2. ⚙️ **Settings** → **Environment Variables**
3. 🔍 Trouver `NEXT_PUBLIC_CNFT_PROGRAM_ID`
4. ✏️ Cliquer **Edit**
5. 📝 Remplacer par : `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq`
6. 💾 Cliquer **Save**
7. 🔄 **Deployments** → Dernier deployment → **Redeploy**

### Valeur Correcte :

```bash
NEXT_PUBLIC_CNFT_PROGRAM_ID=9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
```

---

## ✅ Solution 2 : Supprimer la Variable (ALTERNATIVE)

Si vous **supprimez** complètement `NEXT_PUBLIC_CNFT_PROGRAM_ID` sur Vercel, le code utilisera automatiquement le fallback correct défini dans `app/src/config/constants.ts` :

```typescript
process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || '9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq'
```

### Étapes :

1. 🌐 Aller sur : https://vercel.com/bacbacta/swapback
2. ⚙️ **Settings** → **Environment Variables**
3. 🔍 Trouver `NEXT_PUBLIC_CNFT_PROGRAM_ID`
4. 🗑️ Cliquer **Remove**
5. 💾 Confirmer
6. 🔄 **Deployments** → Dernier deployment → **Redeploy**

**Avantage** : Plus besoin de maintenir cette variable, le code utilise toujours la valeur correcte.

---

## 📋 Toutes les Variables à Vérifier

Pendant que vous y êtes, vérifiez que ces variables sont correctes :

| Variable | Valeur Correcte | Status |
|----------|-----------------|--------|
| `NEXT_PUBLIC_CNFT_PROGRAM_ID` | `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq` | ❌ À CORRIGER |
| `NEXT_PUBLIC_ROUTER_PROGRAM_ID` | `opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx` | ✅ Normalement OK |
| `NEXT_PUBLIC_BUYBACK_PROGRAM_ID` | `EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf` | ✅ Normalement OK |
| `NEXT_PUBLIC_BACK_MINT` | `862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux` | ✅ Normalement OK |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` | ✅ Normalement OK |

---

## 🔍 Vérification Post-Déploiement

Après avoir mis à jour et redéployé :

1. **Ouvrir l'application** : https://swapback-app.vercel.app (ou votre URL)
2. **Ouvrir la Console** (F12)
3. **Connecter le wallet**
4. **Aller sur Dashboard**
5. **Chercher dans les logs** :

```
✅ Devrait afficher :
   CNFT Program: 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq

❌ NE DEVRAIT PAS afficher :
   CRITICAL: Program ID mismatch!
```

---

## 🆘 Si le Problème Persiste

Si après le redéploiement l'erreur persiste :

1. **Vider le cache du navigateur** (Ctrl+Shift+Delete)
2. **Forcer un hard refresh** (Ctrl+Shift+R)
3. **Vérifier dans la console Vercel** que le build a réussi
4. **Vérifier les logs du déploiement** pour voir si la variable est bien prise en compte

---

## 📚 Contexte Technique

### Pourquoi Deux Program IDs ?

- **`FsD6D5...`** : Ancienne clé générée en local (jamais déployée sur devnet)
- **`9oGffD...`** : Programme réellement déployé sur devnet avec les instructions `lock_tokens`/`unlock_tokens`

### Fichiers Déjà Mis à Jour (Commits récents)

✅ `app/src/idl/swapback_cnft.json` - Address corrigée
✅ `app/src/config/constants.ts` - Fallback corrigé
✅ `app/src/config/tokens.ts` - PROGRAM_IDS_DEVNET corrigé
✅ `app/src/config/testnet.ts` - TESTNET_PROGRAM_IDS corrigé
✅ `app/src/lib/lockTokens.ts` - Instructions lock/unlock corrigées

**Seule chose restante** : Mettre à jour Vercel !

---

## ✅ Résultat Attendu

Après la mise à jour :

- ✅ Dashboard charge sans erreur
- ✅ Lock tokens fonctionne
- ✅ Unlock tokens fonctionne
- ✅ Plus de message "CRITICAL: Program ID mismatch!"

---

**Date** : 2025-11-10  
**Priority** : 🔴 URGENT  
**Action Required** : Mettre à jour `NEXT_PUBLIC_CNFT_PROGRAM_ID` sur Vercel
