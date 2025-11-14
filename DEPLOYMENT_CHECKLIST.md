# 🚀 CHECKLIST DÉPLOIEMENT PRODUCTION

**Date**: 14 Novembre 2025  
**Solution**: Option A - Program ID 9oGffDQP (Workaround)

---

## ✅ PRÉ-DÉPLOIEMENT

- [x] IDL régénéré avec unlock_tokens
- [x] Code frontend mis à jour (unlockTokens method)
- [x] Program ID 9oGffDQP vérifié (HAS unlock_tokens)
- [x] .env.local mis à jour localement
- [x] Script de test préparé

---

## 🎯 ÉTAPES DE DÉPLOIEMENT

### 1. Mise à jour Vercel (5 minutes)

**URL**: https://vercel.com/bacbacta/swap-back-app/settings/environment-variables

**Action**:
```
Variable: NEXT_PUBLIC_CNFT_PROGRAM_ID
Ancienne valeur: 26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru
Nouvelle valeur: 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
```

- [ ] Variable mise à jour
- [ ] Redéploiement déclenché
- [ ] Build réussi
- [ ] Déploiement en ligne

### 2. Tests Production (10 minutes)

**URL App**: https://swap-back-app.vercel.app (ou votre domaine)

**Tests à effectuer**:

- [ ] **Test 1: Interface**
  - Page charge correctement
  - Wallet peut se connecter
  - NFTs s'affichent
  
- [ ] **Test 2: Lock**
  - Lock d'un NFT fonctionne
  - Transaction confirmée sur-chain
  - État du NFT mis à jour

- [ ] **Test 3: Unlock** ⭐
  - Unlock d'un NFT fonctionne
  - Pas d'erreur "Account `userNft` not provided"
  - Transaction confirmée sur-chain
  - Tokens retournés au wallet
  - État du NFT mis à jour

### 3. Monitoring (15 minutes)

**Vérifier les logs**:

- [ ] Vercel Logs: https://vercel.com/bacbacta/swap-back-app/logs
  - Pas d'erreurs JavaScript
  - Requêtes RPC réussies
  
- [ ] Solana Explorer: https://explorer.solana.com/?cluster=devnet
  - Transactions unlock visibles
  - Status: Success
  - Pas d'erreur critique

**Erreurs attendues** (à surveiller):
```
⚠️  Error 4100: DeclaredProgramIdMismatch
   → Connu, voir si ça bloque les transactions
   → Si bloque: Rollback immédiat
   
❌ Error 101: InstructionFallbackNotFound
   → NE DOIT PAS arriver
   → Si arrive: Rollback immédiat
   
❌ Account not provided
   → NE DOIT PAS arriver
   → Si arrive: IDL pas à jour
```

---

## 🔄 ROLLBACK (si problème)

**En cas d'erreur bloquante**:

1. **Rollback Vercel** (2 minutes):
```
Variable: NEXT_PUBLIC_CNFT_PROGRAM_ID
Valeur: 26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru (ancien)
```

2. **Redéployer**

3. **Notification utilisateurs**:
   - Désactiver temporairement unlock
   - Message: "Fonction en maintenance"

---

## 📊 MÉTRIQUES DE SUCCÈS

### Critères de validation:

- ✅ **Fonctionnalité**: Lock/Unlock fonctionnent à 100%
- ✅ **Performance**: Temps de réponse < 3s
- ✅ **Fiabilité**: Taux de réussite transactions > 95%
- ✅ **Erreurs**: Pas d'erreurs bloquantes

### Métriques à suivre (24h):

- Nombre de locks
- Nombre de unlocks
- Taux d'échec de transactions
- Erreurs 4100 (fréquence et impact)

---

## 🎯 PROCHAINES ÉTAPES

### Court terme (si Option A fonctionne):
- [x] Déploiement rapide avec 9oGffDQP
- [ ] Monitoring intensif 24h
- [ ] Documentation erreurs 4100
- [ ] Évaluation impact utilisateurs

### Moyen terme (Option B - Solution propre):
- [ ] Planifier upgrade Solana 1.19+
- [ ] Tester build sur environnement de test
- [ ] Recompiler programme avec declare_id correct
- [ ] Déployer programme propre
- [ ] Migration transparente vers nouveau Program ID

### Long terme:
- [ ] CI/CD pour builds automatiques
- [ ] Tests automatisés lock/unlock
- [ ] Monitoring avancé (Datadog, Sentry)
- [ ] Documentation complète

---

## 📝 NOTES IMPORTANTES

**⚠️ Limitations connues**:
- Program ID 9oGffDQP a Error 4100 (DeclaredProgramIdMismatch)
- Cette erreur peut causer des problèmes imprévisibles
- Solution temporaire en attendant Option B

**✅ Avantages**:
- Déploiement immédiat possible
- Pas de compilation nécessaire
- unlock_tokens instruction présente

**🔧 Solution définitive requise**:
- Upgrade Solana CLI vers 1.19+
- Rebuild avec Rust 1.76+
- Deploy avec declare_id correct
- **Timeline estimée**: 1-2 heures de travail

---

## 📞 CONTACTS URGENCE

**En cas de problème critique**:
1. Rollback immédiat (voir section Rollback)
2. Désactiver fonctionnalité unlock
3. Notifier les utilisateurs

**Support**:
- GitHub Issues: https://github.com/BacBacta/SwapBack/issues
- Vercel Support: https://vercel.com/support

---

## ✅ VALIDATION FINALE

**Avant de marquer comme complet**:

- [ ] Tous les tests passent
- [ ] Monitoring en place
- [ ] Aucune erreur bloquante
- [ ] Documentation à jour
- [ ] Équipe notifiée

**Signature déploiement**:
- Date: _______________
- Validé par: _______________
- Status: ⏳ En cours / ✅ Succès / ❌ Rollback

---

**🎉 Bonne chance pour le déploiement !**
