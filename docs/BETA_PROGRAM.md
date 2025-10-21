# 🎫 BETA TESTING PROGRAM - SwapBack

## 📋 Programme Beta Devnet

SwapBack cherche **50 beta testeurs** pour valider le protocole sur Solana devnet avant le lancement mainnet.

### 🎯 Objectifs Beta

- Valider l'interface utilisateur et l'UX
- Tester les plans DCA en conditions réelles (devnet)
- Identifier bugs et edge cases
- Collecter feedback pour améliorations pré-mainnet
- Construire une communauté early adopters

### 🎁 Avantages Beta Testeurs

- **Accès early** à la plateforme avant mainnet
- **NFT Beta Tester** exclusif (mint sur mainnet)
- **Airdrop $BACK** : allocation spéciale pour early supporters
- **Discord role** : Beta Tester badge
- **Influence produit** : votre feedback compte

## 📝 Comment Participer

### Pré-requis

- [x] Wallet Solana (Phantom ou Solflare)
- [x] Compréhension basique de DeFi et DCA
- [x] Disponible pour 2-3h de tests
- [x] Feedback constructif

### Étapes d'Inscription

1. **Remplir le formulaire**:
   - Nom/Pseudo
   - Email
   - Wallet address (devnet)
   - Expérience DeFi (débutant/intermédiaire/expert)
   - Motivation (pourquoi rejoindre beta?)

2. **Rejoindre Discord**:
   - [discord.gg/swapback](https://discord.gg/swapback)
   - Canal #beta-testers
   - Présentation dans #introductions

3. **Setup Wallet Devnet**:
   - Installer Phantom/Solflare
   - Passer en mode Devnet
   - Obtenir SOL devnet: [faucet.solana.com](https://faucet.solana.com/)

4. **Recevoir l'Invitation**:
   - Notification par email
   - Role Discord activé
   - URL privée vers app beta

## 🧪 Scénarios de Test

### Test 1: Connexion Wallet (5 min)

**Objectif**: Valider la connexion wallet multi-provider

- [ ] Ouvrir l'app beta
- [ ] Cliquer "Connect Wallet"
- [ ] Tester Phantom
- [ ] Déconnecter et tester Solflare
- [ ] Vérifier auto-reconnect au refresh

**Feedback attendu**:
- La connexion est-elle fluide ?
- Y a-t-il des erreurs ?
- Le bouton est-il bien placé ?

### Test 2: Création Plan DCA Simple (10 min)

**Objectif**: Créer un plan DCA basique SOL → USDC

**Paramètres**:
- Montant: 0.5 SOL
- Destination: USDC
- Intervalle: 1 heure
- Nombre de swaps: 5

**Steps**:
- [ ] Remplir le formulaire
- [ ] Vérifier l'aperçu (per-swap amount, durée totale)
- [ ] Cliquer "Create Plan"
- [ ] Signer la transaction dans wallet
- [ ] Vérifier la confirmation

**Feedback attendu**:
- Le formulaire est-il clair ?
- Les calculs sont-ils corrects ?
- La transaction a-t-elle réussi ?

### Test 3: Dashboard & Suivi (5 min)

**Objectif**: Visualiser les plans actifs

- [ ] Naviguer vers Dashboard
- [ ] Vérifier l'affichage du plan créé
- [ ] Vérifier les infos: montant restant, prochaine exec, statut
- [ ] Tester le bouton "Cancel Plan" (optionnel)

**Feedback attendu**:
- Les infos sont-elles complètes ?
- Le design est-il intuitif ?
- Manque-t-il des données ?

### Test 4: Plans Multiples (10 min)

**Objectif**: Créer plusieurs plans simultanés

**Créer**:
1. Plan SOL → USDC (quotidien)
2. Plan SOL → BONK (hebdomadaire)
3. Plan SOL → JUP (horaire)

**Vérifier**:
- [ ] Tous les plans apparaissent au Dashboard
- [ ] Pas de confusion entre les plans
- [ ] Tri/filtre fonctionne (si disponible)

### Test 5: Edge Cases (15 min)

**Objectif**: Tester les limites et erreurs

**Tests**:
- [ ] Créer plan avec montant > balance (devrait fail)
- [ ] Créer plan avec interval < 60s (devrait fail)
- [ ] Créer plan avec montant 0 (devrait fail)
- [ ] Déconnecter wallet pendant création
- [ ] Refresh page pendant transaction

**Feedback attendu**:
- Les erreurs sont-elles bien gérées ?
- Les messages sont-ils clairs ?
- Y a-t-il des bugs critiques ?

### Test 6: Mobile/Responsive (10 min)

**Objectif**: Valider l'expérience mobile

**Tester sur**:
- [ ] Mobile iOS (si possible)
- [ ] Mobile Android (si possible)
- [ ] Tablet
- [ ] Desktop petite résolution

**Feedback attendu**:
- L'interface est-elle utilisable sur mobile ?
- Y a-t-il des éléments cassés ?
- Le wallet mobile connect fonctionne ?

## 📊 Formulaire de Feedback

Après tests, remplir:

### Questionnaire Détaillé

**1. Expérience Générale** (1-10):
- Design/Esthétique: __/10
- Facilité d'utilisation: __/10
- Vitesse/Performance: __/10
- Clarté des informations: __/10

**2. Fonctionnalités**:
- Quelle feature avez-vous préférée ?
- Quelle feature manque-t-il ?
- Y a-t-il des bugs majeurs ?

**3. Suggestions**:
- 3 améliorations prioritaires
- Ce qui devrait changer avant mainnet
- Idées de nouvelles features

**4. Technique**:
- Browser utilisé:
- Wallet utilisé:
- Erreurs rencontrées:
- Screenshots (si bugs):

## 🐛 Reporting de Bugs

### Template Issue GitHub

```markdown
**Description du bug**:
Décrivez clairement le problème

**Steps to reproduce**:
1. Aller sur...
2. Cliquer sur...
3. Voir l'erreur...

**Expected behavior**:
Ce qui devrait se passer

**Actual behavior**:
Ce qui se passe vraiment

**Screenshots**:
(si applicable)

**Environment**:
- OS: [Windows/Mac/Linux]
- Browser: [Chrome/Firefox/Safari]
- Wallet: [Phantom/Solflare]

**Severity**:
- [ ] Critical (app crash)
- [ ] Major (feature broken)
- [ ] Minor (visual bug)
```

### Canaux de Support

- **GitHub Issues**: Bugs techniques
- **Discord #beta-bugs**: Discussion rapide
- **Email**: beta@swapback.io (critique uniquement)

## 📅 Timeline Beta

### Semaine 1: Onboarding
- Inscription beta testeurs (50 slots)
- Setup wallets devnet
- Premier contact Discord

### Semaine 2-3: Tests Actifs
- Tests quotidiens app
- Collecte feedback continue
- Fix bugs critiques en temps réel

### Semaine 4: Consolidation
- Analyse feedback
- Implémentation améliorations
- Tests finaux

### Semaine 5: Pré-Mainnet
- Audit sécurité
- Optimisations finales
- Communication lancement

## 🏆 Rewards Beta Testeurs

### NFT Beta Tester

Mint exclusif pour les 50 premiers testeurs:
- Design unique "SwapBack Early Supporter"
- Metadata on-chain avec badge
- Utilities futures (governance, perks)

### Airdrop $BACK

Allocation basée sur participation:
- **Testeur Actif** (>10h tests): 10,000 $BACK
- **Contributeur** (bugs reportés): +5,000 $BACK
- **Community Builder** (invite amis): +2,000 $BACK per referral

### Discord Roles

- 🥇 **Beta Legend**: Top 10 contributors
- 🥈 **Beta Hero**: Top 50%
- 🥉 **Beta Supporter**: Tous participants

## 📞 Contact

- **Discord**: [discord.gg/swapback](https://discord.gg/swapback)
- **Twitter**: [@SwapBackDeFi](https://twitter.com/SwapBackDeFi)
- **Email**: beta@swapback.io

---

**Merci de nous aider à construire le meilleur protocole DCA sur Solana ! 🚀**
