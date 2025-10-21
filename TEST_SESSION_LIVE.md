# 🧪 Test en Direct - SwapBack Devnet

**Statut:** Application ouverte sur http://localhost:3000  
**Date:** 14 octobre 2025  
**Objectif:** Tester l'intégration Jupiter V6 avec les tokens devnet

---

## ✅ Checklist de Test Rapide

### Étape 1: Vérification Visuelle de l'Interface

**Ce que tu devrais voir:**

- [ ] Header avec logo SwapBack
- [ ] Navigation (Swap, Lock & Earn, Stats, Docs)
- [ ] Toggle entre "⚡ SwapBack" et "🪐 Jupiter V6"
- [ ] Deux dropdowns de tokens (Input / Output)
- [ ] Champ pour entrer un montant
- [ ] Slider pour le slippage
- [ ] Bouton "Find Best Route" ou "Connect Wallet"

**Si tout est visible → Passer à l'Étape 2 ✅**

---

### Étape 2: Vérifier la Liste des Tokens

**Actions:**

1. Clique sur le dropdown "You pay" (premier token selector)
2. Vérifie que tu vois ces tokens dans l'ordre:
   - [ ] **SOL** - Solana
   - [ ] **BACK** 🆕 - SwapBack Token (NOUVEAU!)
   - [ ] **USDC** - USD Coin (Test)
   - [ ] **BONK** - Bonk
   - [ ] Autres tokens...

**Test critique:**

- [ ] Le token **BACK** apparaît dans la liste
- [ ] L'adresse commence par `BH8thpW...`
- [ ] Il a 9 decimals

**Si BACK est visible → Passer à l'Étape 3 ✅**

---

### Étape 3: Configuration du Wallet (IMPORTANT)

**⚠️ Tu dois être en mode DEVNET**

**Si tu utilises Phantom:**

1. Ouvrir Phantom
2. Cliquer sur Settings (⚙️)
3. Developer Settings
4. Change Network → **Devnet**
5. Redémarrer Phantom

**Si tu utilises Solflare:**

1. Ouvrir Solflare
2. Settings → Network
3. Sélectionner **Devnet**

**Vérification:**

- [ ] Wallet en mode Devnet
- [ ] Adresse du wallet: `578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf`
- [ ] Balance SOL visible (~6 SOL)

**Important:** Si tu n'as pas ce wallet, tu peux:

- Option A: Importer la clé privée (fichier `~/.config/solana/id.json`)
- Option B: Utiliser ton propre wallet et demander des tokens test

---

### Étape 4: Connecter le Wallet

**Actions:**

1. Clique sur "Connect Wallet" (bouton en haut à droite)
2. Sélectionne Phantom ou Solflare
3. Approuve la connexion
4. Vérifie que l'adresse s'affiche

**Résultat attendu:**

- [ ] Bouton devient "Connected" ou montre l'adresse (tronquée)
- [ ] L'interface devient interactive
- [ ] Les balances des tokens s'affichent

---

### Étape 5: Premier Test - Vérifier les Balances

**Si tu as le wallet de test `578DGN...`:**

**Tu devrais voir:**

- [ ] SOL: ~6 SOL
- [ ] BACK: 1,000,000 BACK
- [ ] USDC: 10,000 USDC

**Comment vérifier:**

1. Sélectionne BACK comme token input
2. Regarde en dessous du dropdown
3. Tu devrais voir "Balance: 1000000 BACK"

**Si les balances sont visibles → Passer à l'Étape 6 ✅**

---

### Étape 6: Test Jupiter Quote (USDC → SOL)

**Configuration du swap:**

1. **Toggle:** Bascule sur "🪐 Jupiter V6" (à droite)
2. **Input Token:** USDC
3. **Output Token:** SOL
4. **Montant:** 10 (USDC)
5. **Slippage:** Laisser à 0.5%

**Action:**

- [ ] Clique sur "Find Best Route"

**Résultat attendu (dans 2-5 secondes):**

- [ ] Un encadré apparaît avec les détails:
  - Route Jupiter
  - Prix estimé
  - Montant SOL à recevoir (environ 0.0X SOL)
  - Price impact
  - Fee
- [ ] Le bouton devient "Execute Swap"

**Si le quote apparaît → Jupiter fonctionne ! ✅**

**Si erreur:**

- Vérifie la console (F12) pour les logs
- Vérifie que tu es bien en devnet
- Essaie avec un montant plus petit (1 USDC)

---

### Étape 7: Exécuter le Swap (Optionnel mais Recommandé)

**⚠️ ATTENTION:** Ceci va exécuter une vraie transaction sur devnet

**Actions:**

1. Vérifie que le quote est correct
2. Clique sur "Execute Swap"
3. Approuve la transaction dans ton wallet
4. Attends la confirmation (5-15 secondes)

**Résultat attendu:**

- [ ] Popup de signature du wallet apparaît
- [ ] Transaction signée et envoyée
- [ ] Alert avec la signature s'affiche
- [ ] Tu peux voir la transaction sur Solscan

**Vérification du succès:**

```bash
# Dans le terminal, vérifie les nouvelles balances
spl-token balance 3y4dCqwWuYx1B97YEDmgq9qjuNE1eyEwGx2eLgz6Rc6G --url devnet
# Devrait montrer ~9990 USDC (10 en moins)

solana balance --url devnet
# Devrait montrer légèrement plus de SOL
```

**Si la transaction est confirmée → TEST RÉUSSI ! 🎉**

---

### Étape 8: Test du Token BACK (Bonus)

**Objectif:** Tester un swap avec le token $BACK

**Configuration:**

1. **Toggle:** Jupiter V6
2. **Input:** SOL (0.5 SOL)
3. **Output:** BACK
4. Clique "Find Best Route"

**2 scénarios possibles:**

**Scénario A - Pas de route:**

```
"No route found" ou erreur
```

→ **C'est NORMAL !** $BACK est un nouveau token sans liquidité Jupiter.
→ Il faudrait créer un pool Raydium ou Orca d'abord.

**Scénario B - Route trouvée:**

```
Quote reçu avec prix estimé
```

→ **Super !** Quelqu'un a peut-être créé un pool.
→ Tu peux exécuter le swap si tu veux.

---

### Étape 9: Test du Toggle SwapBack vs Jupiter

**Objectif:** Comparer les deux routers

**Actions:**

1. Configure: SOL → USDC, 0.1 SOL
2. **Toggle sur ⚡ SwapBack**
3. Clique "Find Best Route"

**2 scénarios possibles:**

**Scénario A - SwapBack API fonctionne:**

- Route s'affiche avec rebates/burn
- Prix légèrement différent de Jupiter
- Détails du routing SwapBack

**Scénario B - Erreur (localhost:3003):**

```
"Erreur lors de la simulation de route"
```

→ **C'est OK !** Le backend SwapBack n'est pas lancé.
→ Jupiter seul suffit pour valider Phase 10.

4. **Toggle sur 🪐 Jupiter**
5. Clique "Find Best Route"
6. Compare avec SwapBack (si disponible)

---

## 📊 Résultats du Test

### ✅ Test Minimum Réussi Si:

- [ ] Interface charge correctement
- [ ] Token BACK visible dans la liste
- [ ] Wallet connecté en devnet
- [ ] Quote Jupiter reçu pour USDC → SOL
- [ ] Toggle fonctionne (changement visuel)

### 🎉 Test Complet Réussi Si:

- [ ] Tout le test minimum +
- [ ] Transaction exécutée avec succès
- [ ] Signature visible sur Solscan
- [ ] Balances mises à jour
- [ ] Aucune erreur console

---

## 🐛 Problèmes Courants

### "Wallet not connected"

→ Vérifie que Phantom/Solflare est installé et en devnet

### "Insufficient SOL balance"

→ Demande un airdrop: `solana airdrop 2 --url devnet`

### "No route found" pour BACK

→ Normal, pas de liquidité. Teste avec SOL/USDC/BONK

### Jupiter timeout

→ L'API Jupiter peut être lente sur devnet. Réessaye.

### Page blanche

→ Vérifie les logs: `tail -f /tmp/nextjs.log`

---

## 📝 Notes pour le Rapport

**Prends des screenshots de:**

1. Interface avec token BACK visible
2. Quote Jupiter affiché
3. Transaction confirmée (si exécutée)
4. Toggle en action

**Logs importants:**

```bash
# Logs Next.js
tail -50 /tmp/nextjs.log

# Logs navigateur
F12 → Console → Copier les messages
```

---

## 🎯 Conclusion

**Si tu as réussi au moins le test minimum:**
→ **Phase 10 = COMPLÈTE ! 🚀**

**Next steps:**

- Créer un rapport final
- Documenter les résultats
- Planifier Phase 11

**Besoin d'aide ?**

- Partage les erreurs que tu vois
- Montre les logs de la console
- Décris ce qui ne fonctionne pas

---

**Bon test ! 🧪**
