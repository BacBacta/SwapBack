# 🧪 Guide de Test End-to-End - SwapBack cNFT System

**Date:** 12 octobre 2025  
**Objectif:** Tester le flux complet Lock → Mint cNFT → Affichage → Unlock

---

## ✅ Pré-requis Validés

- [x] **Programmes déployés** (3/3 sur devnet)
  - Router: `FPK46poe53iX6Bcv3q8cgmc1jm7dJKQ9Qs9oESFxGN55`
  - Buyback: `75nEwGH4cpRq13PG2eEioQE1wBqSvxvK9bhWfvpvZvP7`
  - cNFT: `FPNibu4RhrTt9yLDxcc8nQuHiVkFCfLVJ7DZUn6yn8K8`

- [x] **UI Composants créés**
  - LevelBadge.tsx (🥉🥈🥇)
  - CNFTCard.tsx (card détaillée)
  - useCNFT.ts (hook blockchain)

- [x] **Test automatisé passé**
  - Script: `tests/e2e-cnft-test.ts`
  - Résultat: ✅ 5/5 tests réussis (100%)

- [x] **Serveur Next.js lancé**
  - URL: http://localhost:3000
  - Status: ✅ Ready

---

## 📋 Plan de Test Complet

### Phase 1: Vérification UI de Base ✅

**Objectif:** Vérifier que l'interface charge correctement

**Étapes:**
1. Ouvrir http://localhost:3000
2. Vérifier que la page s'affiche sans erreurs console
3. Vérifier les éléments présents:
   - ✅ Navigation header
   - ✅ Statistiques globales
   - ✅ Message "Connectez votre wallet"

**Critères de réussite:**
- Pas d'erreurs 404 ou 500
- Pas d'erreurs JavaScript dans la console
- Design cohérent avec Tailwind CSS

---

### Phase 2: Connexion Wallet 🔌

**Objectif:** Connecter un wallet Phantom/Solflare sur devnet

**Étapes:**
1. Installer Phantom Wallet (si pas déjà fait)
   - Extension Chrome: https://phantom.app/
   
2. Configurer Phantom sur **Devnet**:
   - Ouvrir Phantom
   - Settings → Developer Settings
   - Change Network → **Devnet** ✅

3. Ajouter des SOL de test:
   - Wallet address: Copier depuis Phantom
   - Faucet: https://faucet.solana.com/
   - Demander: 2 SOL

4. Dans SwapBack UI, cliquer "Connect Wallet"
   - Sélectionner Phantom
   - Approuver la connexion

**Critères de réussite:**
- ✅ Wallet connecté affiché dans header
- ✅ Dashboard affiche "Vos Statistiques"
- ✅ Solde visible dans Phantom (~2 SOL)

---

### Phase 3: Vérification État Initial 🔍

**Objectif:** Confirmer qu'aucun cNFT n'existe encore

**Étapes:**
1. Vérifier le Dashboard:
   - Section "Vos Statistiques" visible
   - Pas de CNFTCard affiché (normal, pas encore de lock)

2. Ouvrir la console navigateur (F12)
   - Vérifier les logs du hook useCNFT
   - Devrait afficher: "Aucun cNFT existant"

3. Vérifier sur Solana Explorer:
   - Aller sur: https://explorer.solana.com/address/[VOTRE_WALLET]?cluster=devnet
   - Onglet "Tokens": Devrait être vide (pas encore de $BACK)

**Critères de réussite:**
- ✅ Pas de CNFTCard affiché
- ✅ useCNFT hook retourne `exists: false`
- ✅ Dashboard charge sans erreur

---

### Phase 4: Test Lock (Simulation) 🔒

**Note:** Pour le moment, comme nous n'avons pas encore créé l'interface de Lock dans SwapInterface.tsx, nous allons **simuler** un lock via un script TypeScript.

**Option A - Script de simulation (RECOMMANDÉ pour MVP):**

```bash
# Créer un script de simulation
cd /workspaces/SwapBack
npx tsx tests/simulate-lock.ts --amount 1000 --boost 35
```

**Script à créer (`tests/simulate-lock.ts`):**
```typescript
// TODO: Script qui appelle directement le programme router
// avec lock_back(amount: 1000, boost: 35)
// Devrait déclencher CPI vers swapback_cnft
```

**Option B - Attendre UI complète:**
- Créer composant LockInterface.tsx
- Formulaire: Montant + Durée → Calcul boost
- Bouton "Lock $BACK"
- Transaction Solana

**Pour ce test, nous utiliserons l'Option A (simulation CLI)**

**Critères de réussite:**
- ✅ Transaction réussie sur devnet
- ✅ Log du router affiche: "cNFT sera minté avec boost 35%"
- ✅ Signature transaction visible sur Explorer

---

### Phase 5: Vérification cNFT Créé 🎨

**Objectif:** Confirmer que le cNFT a été minté et affiché dans l'UI

**Étapes:**
1. Rafraîchir la page http://localhost:3000
   
2. Vérifier le Dashboard:
   - ✅ CNFTCard devrait maintenant s'afficher
   - ✅ Badge Silver (🥈) pour boost 35%
   - ✅ Montant: 1,000 $BACK
   - ✅ Countdown actif
   - ✅ Boost: +35%

3. Vérifier dans la console:
   ```javascript
   // Le hook useCNFT devrait retourner:
   {
     exists: true,
     level: 1, // Silver
     boost: 35,
     lockedAmount: 1000,
     isActive: true
   }
   ```

4. Vérifier sur Explorer:
   - UserNft PDA: `6C3QvuVEWBbYxgYYjReG6jjVpqkJLcsfwABXTtY6tz2R`
   - Account data devrait contenir les valeurs lockées

**Critères de réussite:**
- ✅ CNFTCard visible avec bonnes données
- ✅ Badge correspond au niveau (Silver pour 35%)
- ✅ Gradient de couleur correct
- ✅ Countdown fonctionne
- ✅ Account visible sur Explorer

---

### Phase 6: Test Niveaux Different 🏆

**Objectif:** Tester les 3 niveaux de cNFT

**Tests à effectuer:**

| Test | Boost | Niveau Attendu | Badge | Couleur |
|------|-------|----------------|-------|---------|
| 1 | 15% | Bronze (0) | 🥉 | Orange |
| 2 | 35% | Silver (1) | 🥈 | Silver |
| 3 | 55% | Gold (2) | 🥇 | Gold |

**Pour chaque test:**
1. Unlock le cNFT précédent (si existe)
2. Lock avec nouveau boost
3. Vérifier badge et couleurs
4. Screenshot pour documentation

**Critères de réussite:**
- ✅ Chaque niveau affiche le bon badge
- ✅ Gradients de couleur corrects
- ✅ Calcul boost précis
- ✅ Transitions smooth

---

### Phase 7: Test Unlock 🔓

**Objectif:** Vérifier que le unlock désactive le cNFT

**Étapes:**
1. Attendre que unlock_time soit passé
   - OU modifier le smart contract pour unlock immédiat (dev only)

2. Appeler unlock_back()
   - Via script OU interface UI

3. Vérifier Dashboard:
   - ✅ CNFTCard devrait disparaître
   - ✅ is_active = false dans les données

4. Vérifier sur Explorer:
   - Account UserNft toujours présent
   - Mais is_active = 0 (false)

**Critères de réussite:**
- ✅ CNFTCard n'est plus affiché
- ✅ useCNFT retourne exists: true mais isActive: false
- ✅ Message "Aucun cNFT actif" dans Dashboard

---

### Phase 8: Tests de Robustesse 💪

**Objectif:** Tester les cas limites

**Tests:**

1. **Wallet non connecté**
   - Déconnecter wallet
   - Vérifier message "Connectez votre wallet"

2. **Changement de wallet**
   - Changer de compte dans Phantom
   - Vérifier que les données se mettent à jour

3. **Erreurs réseau**
   - Désactiver Wi-Fi temporairement
   - Vérifier gestion erreur gracieuse

4. **Double lock**
   - Essayer de lock alors qu'un lock existe
   - Vérifier message d'erreur approprié

**Critères de réussite:**
- ✅ Aucun crash de l'UI
- ✅ Messages d'erreur clairs
- ✅ Loading states affichés
- ✅ Récupération après reconnexion

---

## 📊 Checklist Finale

### Infrastructure ✅
- [x] Programmes déployés sur devnet
- [x] UI Next.js fonctionnelle
- [x] Hook useCNFT intégré
- [x] Composants visuels créés

### Tests Fonctionnels ⏳
- [ ] Connexion wallet Phantom
- [ ] Fetch PDA initial (vide)
- [ ] Simulation lock Bronze (15%)
- [ ] Simulation lock Silver (35%)
- [ ] Simulation lock Gold (55%)
- [ ] Affichage CNFTCard correct
- [ ] Countdown temps réel
- [ ] Unlock et désactivation
- [ ] Changement de wallet
- [ ] Gestion erreurs

### Documentation ✅
- [x] Guide de test (ce fichier)
- [x] Architecture documentée
- [x] Scripts de test créés
- [x] Explorer links fournis

---

## 🚀 Commandes Rapides

```bash
# Lancer UI
cd /workspaces/SwapBack/app && npm run dev

# Test automatisé
cd /workspaces/SwapBack && npx tsx tests/e2e-cnft-test.ts

# Voir logs router (dans terminal séparé)
export PATH="/home/codespace/.local/share/solana/install/active_release/bin:$PATH"
solana logs FPK46poe53iX6Bcv3q8cgmc1jm7dJKQ9Qs9oESFxGN55

# Voir logs cNFT
solana logs FPNibu4RhrTt9yLDxcc8nQuHiVkFCfLVJ7DZUn6yn8K8

# Vérifier balance
solana balance

# Vérifier un PDA spécifique
solana account <PDA_ADDRESS> --url devnet
```

---

## 🔗 Liens Utiles

- **UI:** http://localhost:3000
- **Faucet:** https://faucet.solana.com/
- **Explorer Router:** https://explorer.solana.com/address/FPK46poe53iX6Bcv3q8cgmc1jm7dJKQ9Qs9oESFxGN55?cluster=devnet
- **Explorer cNFT:** https://explorer.solana.com/address/FPNibu4RhrTt9yLDxcc8nQuHiVkFCfLVJ7DZUn6yn8K8?cluster=devnet
- **Phantom:** https://phantom.app/

---

## 📝 Notes Importantes

### État Actuel (MVP)
- ✅ Programmes déployés et fonctionnels
- ✅ UI affiche les cNFT existants
- ⏳ Interface de Lock manuelle (à créer)
- ⏳ CPI utilise msg!() (Bubblegum Phase 2)

### Limitations MVP
1. **Pas de vraie compression Merkle** (Bubblegum Phase 2)
2. **Interface Lock simplifiée** (formulaire à créer)
3. **Données swap mockées** (à connecter plus tard)

### Prochains Développements
1. Créer LockInterface.tsx (formulaire complet)
2. Intégrer vraies transactions lock_back()
3. Ajouter unlock UI
4. Implémenter Bubblegum CPI réel
5. Tests automatisés complets (Playwright/Cypress)

---

**État:** ✅ **PRÊT POUR LES TESTS MANUELS**

**Prochain TODO:** Tester manuellement avec Phantom wallet sur http://localhost:3000

---

*Généré le 12 octobre 2025 - SwapBack cNFT Testing Guide*
