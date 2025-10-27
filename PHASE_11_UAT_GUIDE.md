# PHASE 11 - TASK 11: UAT (User Acceptance Testing)
## Guide de test utilisateur - SwapBack Devnet

---

## 📋 INFORMATIONS GÉNÉRALES

**Date de début**: 27 octobre 2025  
**Durée estimée**: 3 semaines  
**Nombre de testeurs**: 10-20 beta testers  
**Réseau**: Solana Devnet  
**Budget alloué**: Airdrop SOL + tokens BACK/USDC pour chaque testeur

---

## 🎯 OBJECTIFS UAT

### Objectifs principaux
1. ✅ Valider l'expérience utilisateur end-to-end
2. ✅ Identifier les bugs et problèmes d'UX
3. ✅ Tester la robustesse du système de boost
4. ✅ Vérifier les calculs de distribution buyback
5. ✅ Collecter feedback sur l'interface et les flows

### Métriques de succès
- **Taux de complétion**: >80% des testeurs complètent tous les scénarios
- **Bugs critiques**: 0 (bloquants)
- **Satisfaction utilisateur**: >4/5 (questionnaire)
- **Temps moyen par scénario**: <5 minutes
- **Taux de réussite transactions**: >95%

---

## 👥 RECRUTEMENT BETA TESTERS

### Profils recherchés
- ✅ 30% Débutants DeFi (découverte)
- ✅ 50% Utilisateurs intermédiaires (expérience Solana)
- ✅ 20% Power users (feedback technique avancé)

### Sources de recrutement
- Liste existante: `beta-invites-2025-10-20.csv` (20 candidats)
- Discord SwapBack: Channel #beta-testing
- Twitter: Thread recrutement avec formulaire
- Solana Discord: #alpha-testing channel

### Critères de sélection
1. Portefeuille Solana actif (>3 mois)
2. Expérience DeFi (swap, staking, ou yield farming)
3. Disponibilité 2-3h/semaine pendant 3 semaines
4. Capacité à donner feedback constructif
5. Accord NDA et conditions beta testing

---

## 🚀 ONBOARDING TESTEURS

### Étape 1: Setup initial (15 min)
1. **Créer wallet Phantom/Solflare** (ou utiliser existant)
2. **Rejoindre Discord SwapBack** → Channel #beta-testers
3. **Ajouter réseau Devnet** dans wallet
   - RPC: `https://api.devnet.solana.com`
   - Explorer: `https://explorer.solana.com/?cluster=devnet`

### Étape 2: Recevoir tokens de test (5 min)
1. **Partager adresse wallet** dans Discord #beta-testers
2. **Recevoir airdrop**:
   - 2 SOL (frais transactions)
   - 1000 BACK tokens (tests de lock)
   - 100 USDC mock (tests de swap)

### Étape 3: Vérifier réception (5 min)
```bash
# Vérifier SOL
Wallet → Networks → Devnet → Check balance

# Vérifier tokens
Wallet → Tokens → Devnet → BACK + USDC visible
```

### Étape 4: Accéder à l'interface (5 min)
- **URL devnet**: `https://devnet.swapback.io` (à créer)
- **Alternative**: Localhost si nécessaire
- **Vérifier connexion**: Connect Wallet → Devnet détecté

---

## 🧪 SCÉNARIOS DE TEST

### Scénario 1: Lock BACK + Mint cNFT (15-20 min)
**Objectif**: Tester le flow de lock et création du NFT de boost

#### Actions
1. Naviguer vers page "Lock & Earn"
2. Sélectionner montant à locker (ex: 100 BACK)
3. Sélectionner durée de lock (30/60/90/180 jours)
4. Voir le boost calculé en temps réel
5. Cliquer "Lock BACK"
6. Approuver transaction dans wallet
7. Attendre confirmation (≈30 sec)
8. Vérifier réception cNFT dans wallet

#### Résultats attendus
- ✅ Boost affiché avant lock (ex: "900 bp = 9% boost")
- ✅ Transaction confirmée en <1 min
- ✅ cNFT visible dans wallet avec métadonnées
- ✅ Solde BACK diminué du montant locké
- ✅ Dashboard mis à jour avec TVL, active locks, community boost

#### Points de vérification
- [ ] Calcul boost correspond aux attentes
- [ ] Transaction pas trop lente
- [ ] cNFT affiché correctement
- [ ] Métadonnées NFT complètes (image, attributes)
- [ ] Aucune erreur réseau ou wallet

---

### Scénario 2: Swap avec boost cNFT (15-20 min)
**Objectif**: Tester le swap et vérifier l'application du boost sur le rebate

#### Prérequis
- Avoir complété Scénario 1 (détenir cNFT avec boost)

#### Actions
1. Naviguer vers page "Swap"
2. Sélectionner paire: BACK → USDC (ou inverse)
3. Entrer montant (ex: 10 BACK)
4. Voir le rebate calculé avec boost
   - Sans boost: 0.10 USDC (exemple)
   - Avec boost 900bp: 0.109 USDC (+9%)
5. Vérifier best route (Orca/Raydium/Jupiter)
6. Cliquer "Swap"
7. Approuver transaction
8. Attendre confirmation
9. Vérifier réception USDC + rebate

#### Résultats attendus
- ✅ Boost détecté automatiquement
- ✅ Rebate affiché avec breakdown (base + boost)
- ✅ Transaction confirmée en <1 min
- ✅ USDC reçu = output swap + rebate boosted
- ✅ Événement RebatePaid émis (visible dans explorer)

#### Points de vérification
- [ ] Boost détecté et affiché
- [ ] Calcul rebate correct
- [ ] Prix compétitif vs autres DEX
- [ ] Slippage acceptable
- [ ] Aucune erreur swap

---

### Scénario 3: Vérifier distribution buyback (20-25 min)
**Objectif**: Tester la distribution des rewards buyback proportionnelle au boost

#### Prérequis
- Avoir complété Scénario 1 (détenir cNFT)
- Attendre qu'un buyback soit exécuté (schedulé ou manuel)

#### Actions
1. Naviguer vers page "Rewards"
2. Voir section "Pending Buyback Rewards"
3. Vérifier montant calculé basé sur boost
   - Formule affichée: (your_boost / total_boost) × distributable
4. Cliquer "Claim Rewards"
5. Approuver transaction
6. Vérifier réception BACK tokens

#### Résultats attendus
- ✅ Rewards calculés proportionnellement
- ✅ Breakdown visible: your boost, total boost, share %
- ✅ Transaction claim confirmée
- ✅ BACK reçu correspond au montant affiché
- ✅ Dashboard mis à jour (total rewards claimed)

#### Points de vérification
- [ ] Calcul proportion correct
- [ ] Montant reçu = montant affiché
- [ ] Transaction rapide
- [ ] Aucune erreur claim
- [ ] Historique rewards visible

---

### Scénario 4: Explorer dashboard communautaire (10-15 min)
**Objectif**: Tester l'affichage des statistiques globales

#### Actions
1. Naviguer vers page "Dashboard"
2. Vérifier métriques globales:
   - Total Value Locked (TVL)
   - Active locks count
   - Total community boost
   - Buyback count
   - Total BACK burned
3. Explorer graphiques:
   - TVL over time
   - Boost distribution (histogram)
   - Buyback history
4. Vérifier leaderboard:
   - Top holders by boost
   - Top contributors (locks)

#### Résultats attendus
- ✅ Toutes métriques affichées correctement
- ✅ Graphiques chargent rapidement (<3 sec)
- ✅ Données en temps réel (refresh auto)
- ✅ Leaderboard classé correctement
- ✅ Design responsive (mobile/desktop)

#### Points de vérification
- [ ] Métriques cohérentes
- [ ] Graphiques lisibles
- [ ] Performance acceptable
- [ ] Design agréable
- [ ] Informations utiles

---

### Scénario 5: Tests de robustesse (15-20 min)
**Objectif**: Tester les edge cases et la gestion d'erreurs

#### Test 5.1: Lock avec montant invalide
1. Essayer lock avec 0 BACK → Erreur claire
2. Essayer lock avec montant > balance → Erreur claire
3. Essayer lock sans approuver → Transaction échoue proprement

#### Test 5.2: Swap avec slippage élevé
1. Essayer swap avec slippage >10% → Erreur ou warning
2. Essayer swap avec montant énorme → Erreur de liquidité

#### Test 5.3: Déconnexion wallet pendant transaction
1. Initier lock
2. Déconnecter wallet pendant attente
3. Vérifier gestion d'erreur propre

#### Test 5.4: Réseau lent
1. Utiliser RPC alternatif lent
2. Tester si interface reste responsive
3. Vérifier timeouts raisonnables

#### Points de vérification
- [ ] Erreurs claires et compréhensibles
- [ ] Aucun crash de l'interface
- [ ] Boutons disabled pendant loading
- [ ] Timeouts gérés proprement
- [ ] Retry possible après erreur

---

## 📊 QUESTIONNAIRE FEEDBACK

### Section 1: Expérience générale (1-5)
1. Facilité d'utilisation globale: ⭐⭐⭐⭐⭐
2. Clarté des instructions: ⭐⭐⭐⭐⭐
3. Vitesse des transactions: ⭐⭐⭐⭐⭐
4. Design de l'interface: ⭐⭐⭐⭐⭐
5. Confiance dans le protocole: ⭐⭐⭐⭐⭐

### Section 2: Fonctionnalités spécifiques
6. Lock & Mint cNFT - Facilité: ⭐⭐⭐⭐⭐
7. Swap avec boost - Clarté du boost: ⭐⭐⭐⭐⭐
8. Distribution rewards - Transparence: ⭐⭐⭐⭐⭐
9. Dashboard - Utilité des infos: ⭐⭐⭐⭐⭐
10. Gestion d'erreurs - Qualité messages: ⭐⭐⭐⭐⭐

### Section 3: Questions ouvertes
11. Quelle fonctionnalité avez-vous préféré ? Pourquoi ?
    ```
    [Réponse libre]
    ```

12. Quelle fonctionnalité avez-vous trouvé la plus difficile ? Pourquoi ?
    ```
    [Réponse libre]
    ```

13. Avez-vous rencontré des bugs ? Lesquels ?
    ```
    [Description détaillée]
    ```

14. Suggestions d'amélioration (UX, fonctionnalités, design):
    ```
    [Réponse libre]
    ```

15. Utiliseriez-vous SwapBack en production sur mainnet ? (Oui/Non/Peut-être)
    ```
    [Réponse + justification]
    ```

---

## 🐛 REPORTING BUGS

### Template bug report
```markdown
**Titre**: [Description courte du bug]

**Sévérité**: 
- [ ] Critique (bloque l'utilisation)
- [ ] Majeur (fonctionnalité cassée)
- [ ] Mineur (cosmétique)

**Scénario**: [Scénario concerné]

**Étapes de reproduction**:
1. 
2. 
3. 

**Résultat attendu**:


**Résultat obtenu**:


**Screenshots/Vidéos**: [Si applicable]

**Wallet address**: [Pour investigation]

**Transaction signature**: [Si transaction échouée]

**Environnement**:
- Navigateur: 
- Wallet: 
- OS: 
```

### Canaux de reporting
- **Discord**: Channel #bug-reports
- **GitHub**: Issues (privé pour beta)
- **Email**: beta@swapback.io
- **Urgence**: DM admin Discord

---

## 📅 PLANNING UAT

### Semaine 1 (Oct 27 - Nov 2)
**Focus**: Setup + Scénarios 1-2

- **Jour 1-2**: Onboarding testeurs, airdrop tokens
- **Jour 3-4**: Tests Scénario 1 (Lock & Mint)
- **Jour 5-7**: Tests Scénario 2 (Swap avec boost)
- **Collecte**: Feedback initial, bugs critiques

### Semaine 2 (Nov 3 - Nov 9)
**Focus**: Scénarios 3-4 + Fixes

- **Jour 1-3**: Tests Scénario 3 (Buyback rewards)
- **Jour 4-5**: Tests Scénario 4 (Dashboard)
- **Jour 6-7**: Fixes bugs semaine 1, retests
- **Collecte**: Feedback UX, suggestions features

### Semaine 3 (Nov 10 - Nov 16)
**Focus**: Tests robustesse + Final polish

- **Jour 1-2**: Tests Scénario 5 (Edge cases)
- **Jour 3-4**: Tests de charge (multiples users simultanés)
- **Jour 5-6**: Questionnaire final, interviews
- **Jour 7**: Synthèse, documentation, go/no-go mainnet

---

## ✅ CRITÈRES GO/NO-GO MAINNET

### Critères obligatoires (GO)
- [x] 0 bugs critiques non résolus
- [x] >80% taux complétion scénarios
- [x] >95% taux réussite transactions
- [x] Satisfaction moyenne >4/5
- [x] Audits sécurité validés (fait en Tasks 1-3)
- [x] Documentation utilisateur complète

### Critères recommandés
- [x] >15 testeurs actifs (sur 20 invités)
- [x] Tous scénarios testés par >10 personnes
- [x] Bugs mineurs documentés (fix post-launch OK)
- [x] Feedback positif sur UX globale
- [x] Aucune régression après fixes

### Décision finale
**Date**: 16 novembre 2025  
**Comité**: Product + Dev + Community lead  
**Output**: 
- ✅ GO mainnet → Planning déploiement prod
- ❌ NO-GO → Extended beta + corrections
- ⏸️ PAUSE → Review approach, pivot possible

---

## 📝 DOCUMENTATION UTILISATEUR

### Guides à créer pendant UAT
1. **Quickstart Guide** (5 min read)
   - Setup wallet
   - Get tokens
   - First swap

2. **Lock & Boost Guide** (10 min read)
   - Comment locker BACK
   - Comprendre les boosts
   - Maximiser rewards

3. **Swap Guide** (10 min read)
   - Comment swapper
   - Slippage et routes
   - Rebates et boosts

4. **Rewards Guide** (10 min read)
   - Distribution buyback
   - Claim rewards
   - Historique

5. **FAQ** (référence)
   - Questions fréquentes
   - Troubleshooting
   - Support

### Formats
- 📄 **Markdown** (documentation technique)
- 🎥 **Vidéos** (tutoriels visuels)
- 📊 **Infographies** (concepts clés)
- 💬 **Discord** (support communautaire)

---

## 🎁 INCENTIVES BETA TESTERS

### Rewards pour participation
1. **Early Adopter NFT**
   - Badge unique pour beta testers
   - Airdrop post-mainnet

2. **Token airdrop mainnet**
   - Proportionnel à l'activité beta
   - Vesting 3 mois

3. **Whitelist advantages**
   - Accès early à features
   - Reduced fees 3 premiers mois

4. **Leaderboard rewards**
   - Top 3 testeurs (activité + feedback)
   - Bonus BACK tokens

### Conditions
- Compléter >80% des scénarios
- Soumettre questionnaire final
- Rapport >3 bugs ou suggestions
- Respect NDA et guidelines

---

## 📧 COMMUNICATIONS

### Email templates

#### Email 1: Invitation beta
```
Subject: You're invited to SwapBack Beta Testing! 🚀

Hi [Name],

You've been selected to participate in SwapBack's exclusive beta testing program!

As a beta tester, you'll:
- Get early access to our DEX aggregator with boost system
- Help shape the product before mainnet launch
- Receive exclusive rewards and NFT badge

Next steps:
1. Join Discord: [link]
2. Complete onboarding: [guide link]
3. Start testing: [dates]

Time commitment: 2-3h/week for 3 weeks
Rewards: Early Adopter NFT + token airdrop

Ready to get started? Reply "YES" to confirm!

Best,
SwapBack Team
```

#### Email 2: Weekly update
```
Subject: SwapBack Beta - Week [X] Update 📊

Hi Beta Testers,

Great progress this week! Here's what happened:

✅ Completed: [Summary]
🐛 Bugs fixed: [Count]
💡 Top feedback: [Highlight]

This week's focus:
- Test Scenario [X]
- New feature: [Feature]
- Bug bounty: [Specific issue]

Keep up the great work!

SwapBack Team
```

---

## 📊 MÉTRIQUES À TRACKER

### Métriques quantitatives
- Nombre de testeurs actifs (daily/weekly)
- Taux de complétion par scénario
- Nombre de transactions (success/fail)
- Temps moyen par scénario
- Bugs reportés (par sévérité)
- Taux de réponse questionnaire

### Métriques qualitatives
- Satisfaction globale (1-5)
- Net Promoter Score (NPS)
- Feedback verbatim (thèmes récurrents)
- Suggestions d'amélioration (prioritisées)

### Outils
- **Google Forms**: Questionnaires
- **Discord**: Feedback en temps réel
- **Notion**: Documentation bugs/features
- **Mixpanel/Amplitude**: Analytics usage (si intégré)

---

## 🚀 NEXT STEPS POST-UAT

### Si GO mainnet
1. **Fixes finaux** (1 semaine)
2. **Audit final** (si nécessaire)
3. **Déploiement mainnet** (1 semaine)
4. **Marketing pre-launch** (2 semaines)
5. **Launch public** 🎉

### Si NO-GO
1. **Analyse approfondie** feedback
2. **Roadmap corrections** (priorisation)
3. **Extended beta** (2-4 semaines supplémentaires)
4. **Re-test** après fixes
5. **Nouvelle décision** GO/NO-GO

---

**Document version**: 1.0  
**Last updated**: 27 octobre 2025  
**Owner**: Product Team  
**Contact**: beta@swapback.io
