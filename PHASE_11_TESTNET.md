# 🔒 Phase 11 - Testnet Deployment & Security

**Date de début**: 26 Octobre 2025  
**Statut**: 🔄 EN COURS  
**Objectif**: Sécuriser, tester et déployer sur Testnet

---

## 📋 Vue d'ensemble

La Phase 11 se concentre sur la sécurisation des smart contracts, les tests d'intégration complets, et le déploiement sur Solana Testnet avant le lancement mainnet.

### Objectifs Principaux

1. ✅ **Security Audit** - Audit de sécurité complet des smart contracts
2. ⏳ **Tests E2E** - Tests end-to-end sur devnet
3. ⏳ **Upload IDL** - Upload des fichiers IDL sur chain
4. ⏳ **Initialisation** - Initialiser les états des programmes
5. ⏳ **Testnet Deploy** - Déploiement sur testnet-beta
6. ⏳ **UAT** - User Acceptance Testing avec beta users

---

## 🔒 1. Security Audit

### 1.1 Checklist de Sécurité

#### Smart Contracts - Général

- [ ] **Access Control**
  - [ ] Vérifier tous les modificateurs `#[access_control]`
  - [ ] Valider les vérifications de signer/owner
  - [ ] Tester les tentatives d'accès non autorisé
  - [ ] Audit des permissions admin

- [ ] **Integer Overflow/Underflow**
  - [ ] Vérifier tous les calculs arithmétiques
  - [ ] Utilisation de `checked_add`, `checked_sub`, `checked_mul`, `checked_div`
  - [ ] Validation des montants max/min
  - [ ] Tests avec valeurs extrêmes

- [ ] **Reentrancy Protection**
  - [ ] Pas de calls externes avant state updates
  - [ ] Pattern "checks-effects-interactions"
  - [ ] Locks appropriés si nécessaire

- [ ] **Account Validation**
  - [ ] Tous les accounts ont des contraintes appropriées
  - [ ] Vérification des PDAs (seeds, bumps)
  - [ ] Validation des owner/authority
  - [ ] Checks des account types

#### CNFT Program (swapback_cnft)

- [ ] **Merkle Tree Security**
  - [ ] Validation des preuves Merkle
  - [ ] Protection contre replay attacks
  - [ ] Vérification de l'autorité du tree
  - [ ] Checks de depth/buffer size

- [ ] **Boost Calculations**
  - [ ] Formule de boost sécurisée (overflow checks)
  - [ ] Validation amount_score + duration_score ≤ 100%
  - [ ] Protection contre manipulation du temps
  - [ ] Validation des niveaux de lock

- [ ] **Token Lock/Unlock**
  - [ ] Validation des montants
  - [ ] Checks de durée minimale/maximale
  - [ ] Protection contre unlock prématuré
  - [ ] Validation de l'owner du lock

#### Router Program (swapback_router)

- [ ] **Swap Security**
  - [ ] Slippage protection
  - [ ] Validation des token accounts
  - [ ] Price manipulation protection
  - [ ] MEV protection appropriée

- [ ] **Jupiter Integration**
  - [ ] Validation des routes Jupiter
  - [ ] Checks des program IDs
  - [ ] Validation des instructions CPI
  - [ ] Protection contre malicious routes

- [ ] **Fee Distribution**
  - [ ] Calcul précis des fees (0.25% swap + routing)
  - [ ] Allocation correcte 40% → buyback
  - [ ] Pas de loss de precision
  - [ ] Protection contre manipulation

- [ ] **Oracle Integration**
  - [ ] Validation des prix Pyth/Switchboard
  - [ ] Staleness checks
  - [ ] Confidence interval checks
  - [ ] Fallback mechanisms

#### Buyback Program (swapback_buyback)

- [ ] **Buyback Execution**
  - [ ] Validation des montants USDC
  - [ ] Checks du swap USDC → BACK
  - [ ] Protection contre front-running
  - [ ] Validation du slippage

- [ ] **Distribution Logic**
  - [ ] Formule: `(user_boost / total_boost) × 50%` correcte
  - [ ] Pas de division by zero
  - [ ] Precision handling
  - [ ] Protection contre manipulation du total_boost

- [ ] **Burn Mechanism**
  - [ ] 50% des tokens achetés sont burn
  - [ ] Validation du burn token account
  - [ ] Checks de l'authority
  - [ ] Irreversibilité du burn

### 1.2 Outils d'Audit

```bash
# Analyse statique avec Anchor verify
anchor verify

# Scan de vulnérabilités
cargo audit

# Analyse avec Soteria (si disponible)
# soteria analyze programs/

# Tests fuzzing (optionnel mais recommandé)
# cargo fuzz run <target>
```

### 1.3 Tests de Sécurité

Créer des tests spécifiques pour chaque vulnérabilité potentielle :

```bash
# Tests d'attaque
npm run test:security

# Tests avec valeurs extrêmes
npm run test:edge-cases

# Tests de permission
npm run test:access-control
```

---

## 🧪 2. Tests d'Intégration E2E

### 2.1 Scénarios de Test

#### Scenario 1: Swap Flow Complet

```typescript
// Test: User swap SOL → USDC avec boost
1. User lock 10,000 BACK pour 90 jours
2. Calculer boost attendu (~43%)
3. Effectuer swap: 1 SOL → USDC
4. Vérifier rebate reçu (avec boost)
5. Vérifier allocation buyback vault (40% fees)
```

#### Scenario 2: Buyback Distribution

```typescript
// Test: Execution buyback et distribution
1. Accumuler 1000 USDC dans buyback vault
2. Exécuter buyback (swap USDC → BACK via Jupiter)
3. Vérifier 50% distribué aux users selon boost
4. Vérifier 50% burn
5. Calculer share de chaque user
```

#### Scenario 3: Lock & Boost System

```typescript
// Test: Progression des niveaux de boost
1. Lock 1,000 BACK pour 30 jours → Bronze (faible boost)
2. Lock 50,000 BACK pour 180 jours → Gold (bon boost)
3. Lock 100,000 BACK pour 365 jours → Diamond (max boost)
4. Vérifier calculs de boost à chaque étape
5. Test unlock après expiration
```

#### Scenario 4: Jupiter Integration

```typescript
// Test: Routing via Jupiter
1. Comparer route SwapBack vs Jupiter direct
2. Vérifier que SwapBack est compétitif
3. Tester avec différentes paires de tokens
4. Vérifier MEV protection
```

### 2.2 Scripts de Test

```bash
# Test E2E complet
npm run test:e2e

# Test specific scenario
npm test -- --grep "Swap Flow Complet"

# Test avec vrais programmes devnet
CLUSTER=devnet npm test -- tests/integration/
```

---

## 📤 3. Upload IDL Files

### 3.1 Génération des IDL

```bash
# Les IDL devraient déjà être générés après build
ls -la target/idl/

# Vérifier le contenu
cat target/idl/swapback_cnft.json | jq '.instructions | length'
cat target/idl/swapback_router.json | jq '.instructions | length'
cat target/idl/swapback_buyback.json | jq '.instructions | length'
```

### 3.2 Upload sur Devnet

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Upload IDL CNFT
anchor idl init \
  --filepath target/idl/swapback_cnft.json \
  9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw

# Upload IDL Router
anchor idl init \
  --filepath target/idl/swapback_router.json \
  GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt

# Upload IDL Buyback
anchor idl init \
  --filepath target/idl/swapback_buyback.json \
  EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
```

### 3.3 Vérification

```bash
# Vérifier que les IDL sont on-chain
anchor idl fetch 9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw
anchor idl fetch GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt
anchor idl fetch EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
```

---

## 🔧 4. Initialisation des États

### 4.1 Router State Initialization

```typescript
// Script: scripts/init-router-state.ts
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SwapbackRouter } from "../target/types/swapback_router";

async function initRouterState() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SwapbackRouter as Program<SwapbackRouter>;

  // Derive Router State PDA
  const [routerState] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    program.programId
  );

  console.log("Router State PDA:", routerState.toString());

  // Initialize
  try {
    const tx = await program.methods
      .initializeRouterState()
      .accounts({
        authority: provider.wallet.publicKey,
        routerState,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Router State initialized:", tx);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

initRouterState();
```

### 4.2 Buyback State Initialization

```typescript
// Script: scripts/init-buyback-state.ts
async function initBuybackState() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SwapbackBuyback as Program<SwapbackBuyback>;

  // Derive Buyback State PDA
  const [buybackState] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("buyback_state")],
    program.programId
  );

  console.log("Buyback State PDA:", buybackState.toString());

  // Initialize
  const tx = await program.methods
    .initializeBuybackState()
    .accounts({
      authority: provider.wallet.publicKey,
      buybackState,
      usdcVault: /* USDC vault account */,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("✅ Buyback State initialized:", tx);
}
```

### 4.3 CNFT Merkle Tree Creation

```typescript
// Script: scripts/create-merkle-tree.ts
import { createTree } from "@solana/spl-account-compression";

async function createCNFTTree() {
  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;

  // Configuration du Merkle tree
  const maxDepth = 14; // 2^14 = 16,384 cNFTs max
  const maxBufferSize = 64;

  const tree = await createTree(
    connection,
    provider.wallet.publicKey, // payer
    provider.wallet.publicKey, // tree creator
    provider.wallet.publicKey, // tree authority
    maxDepth,
    maxBufferSize
  );

  console.log("✅ Merkle Tree créé:", tree.toString());
  console.log("   Capacité:", Math.pow(2, maxDepth), "cNFTs");
  
  // Sauvegarder l'adresse du tree
  // TODO: Update config with tree address
}
```

### 4.4 Script d'Initialisation Complet

```bash
# Créer script all-in-one
cat > scripts/initialize-all.sh << 'EOF'
#!/bin/bash

export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
export ANCHOR_WALLET="~/.config/solana/id.json"

echo "🔧 Initialisation des états SwapBack..."

# 1. Router State
echo ""
echo "📍 [1/3] Initialisation Router State..."
npx ts-node scripts/init-router-state.ts

# 2. Buyback State
echo ""
echo "📍 [2/3] Initialisation Buyback State..."
npx ts-node scripts/init-buyback-state.ts

# 3. Merkle Tree
echo ""
echo "📍 [3/3] Création Merkle Tree pour cNFTs..."
npx ts-node scripts/create-merkle-tree.ts

echo ""
echo "✅ Initialisation complète !"
EOF

chmod +x scripts/initialize-all.sh
```

---

## 🚀 5. Déploiement Testnet

### 5.1 Préparation

```bash
# 1. Vérifier le solde testnet
solana config set --url https://api.testnet.solana.com
solana balance

# 2. Si besoin d'un airdrop testnet
solana airdrop 5

# 3. Mettre à jour Anchor.toml pour testnet
```

### 5.2 Configuration Anchor.toml

```toml
[programs.testnet]
swapback_cnft = "TBD_AFTER_DEPLOY"
swapback_router = "TBD_AFTER_DEPLOY"
swapback_buyback = "TBD_AFTER_DEPLOY"
```

### 5.3 Déploiement

```bash
# Build pour testnet
anchor build

# Deploy sur testnet
solana config set --url https://api.testnet.solana.com

# Deploy CNFT
solana program deploy \
  target/deploy/swapback_cnft.so \
  --program-id target/deploy/swapback_cnft-keypair.json

# Deploy Router
solana program deploy \
  target/deploy/swapback_router.so \
  --program-id target/deploy/swapback_router-keypair.json

# Deploy Buyback
solana program deploy \
  target/deploy/swapback_buyback.so \
  --program-id target/deploy/swapback_buyback-keypair.json
```

### 5.4 Post-Deployment

1. Mettre à jour `Anchor.toml` avec les vrais Program IDs
2. Mettre à jour `app/config/programIds.ts`
3. Upload IDL files sur testnet
4. Initialiser les états
5. Vérifier sur Explorer

---

## 👥 6. User Acceptance Testing (UAT)

### 6.1 Recrutement Beta Testers

```markdown
# Profil des Beta Testers
- 10-20 utilisateurs
- Familiers avec Solana/DeFi
- Diversité de use cases (traders, holders, arbitrageurs)
- Disponibles pour feedback détaillé
```

### 6.2 Plan de Test UAT

**Semaine 1: Tests Basiques**
- [ ] Connexion wallet
- [ ] Swap simple (SOL → USDC, USDC → SOL)
- [ ] Lock de tokens
- [ ] Visualisation du boost

**Semaine 2: Tests Avancés**
- [ ] Swaps avec boost activé
- [ ] Vérification des rebates
- [ ] Claim de buyback tokens
- [ ] Unlock après expiration

**Semaine 3: Tests Intensifs**
- [ ] Volume de swaps élevé
- [ ] Multiples locks simultanés
- [ ] Tests de différentes paires de tokens
- [ ] Tests sur mobile/desktop

### 6.3 Collecte de Feedback

```typescript
// Formulaire de feedback
interface BetaFeedback {
  testerId: string;
  date: Date;
  scenario: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comments: string;
  bugs: Bug[];
  suggestions: string[];
}

interface Bug {
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  steps: string[];
  screenshot?: string;
}
```

### 6.4 Métriques de Succès UAT

- [ ] 90%+ des swaps réussis
- [ ] 0 bugs critiques
- [ ] < 5 bugs high severity
- [ ] Rating moyen ≥ 4/5
- [ ] Temps de réponse UI < 2s
- [ ] Confirmation tx < 30s

---

## 📊 7. Métriques & Monitoring

### 7.1 Dashboards à Créer

```typescript
// Analytics Dashboard
interface TestnetMetrics {
  // Volume
  totalSwaps: number;
  totalVolume: number; // en USDC
  uniqueUsers: number;
  
  // Boost System
  totalLocked: number; // BACK tokens
  averageBoost: number; // %
  lockDistribution: Record<CNFTLevel, number>;
  
  // Buyback
  buybackAccumulated: number; // USDC
  buybackExecuted: number; // fois
  tokensBurned: number; // BACK
  tokensDistributed: number; // BACK
  
  // Performance
  averageSwapTime: number; // ms
  successRate: number; // %
  errorRate: number; // %
}
```

### 7.2 Monitoring Alerts

```yaml
# alerts.yml
alerts:
  - name: High Error Rate
    condition: errorRate > 5%
    action: notify_team
    
  - name: Low Success Rate
    condition: successRate < 90%
    action: investigate
    
  - name: Slow Swaps
    condition: averageSwapTime > 5000ms
    action: optimize
    
  - name: Buyback Vault Full
    condition: buybackAccumulated > 10000 USDC
    action: execute_buyback
```

---

## ✅ 8. Checklist de Validation Phase 11

### Sécurité
- [ ] Security audit complet effectué
- [ ] Toutes les vulnérabilités critiques corrigées
- [ ] Tests de sécurité passent à 100%
- [ ] Code review par 2+ développeurs

### Tests
- [ ] Tests E2E passent sur devnet
- [ ] 100% des scénarios critiques testés
- [ ] Performance acceptable (< 3s par swap)
- [ ] Pas de bugs bloquants

### Déploiement
- [ ] IDL files uploadés sur devnet
- [ ] États initialisés correctement
- [ ] Programmes déployés sur testnet
- [ ] Configuration testnet validée

### UAT
- [ ] 10+ beta testers recrutés
- [ ] Tests UAT complétés (3 semaines)
- [ ] Feedback collecté et analysé
- [ ] Bugs corrigés

### Documentation
- [ ] Guide utilisateur final
- [ ] Documentation technique complète
- [ ] Runbook pour incidents
- [ ] Guide de déploiement

---

## 📅 Timeline Phase 11

```
Semaine 1 (26 Oct - 1 Nov)
├── Security Audit (3 jours)
├── Upload IDL files (1 jour)
├── Tests E2E devnet (2 jours)
└── Fixes bugs critiques (1 jour)

Semaine 2 (2 Nov - 8 Nov)
├── Initialisation états (1 jour)
├── Déploiement testnet (1 jour)
├── Validation testnet (2 jours)
└── Setup UAT (2 jours)

Semaine 3-5 (9 Nov - 29 Nov)
├── UAT Semaine 1: Tests basiques
├── UAT Semaine 2: Tests avancés
├── UAT Semaine 3: Tests intensifs
└── Collecte feedback + corrections

Semaine 6 (30 Nov - 6 Dec)
├── Corrections finales (3 jours)
├── Validation finale (2 jours)
└── Préparation Phase 12 (2 jours)
```

**Durée totale estimée: 6 semaines**

---

## 🎯 Critères de Succès

### Must-Have (Bloquants)
✅ 0 bugs critiques  
✅ Security audit validé  
✅ Tous les programmes déployés sur testnet  
✅ États initialisés correctement  
✅ Tests E2E passent à 100%  

### Should-Have (Importants)
⭐ Rating UAT ≥ 4/5  
⭐ Success rate swaps ≥ 95%  
⭐ Performance < 3s par swap  
⭐ < 5 bugs high severity  

### Nice-to-Have (Bonus)
💎 100 swaps testnet sans erreur  
💎 10 beta testers actifs  
💎 Documentation complète  

---

## 📞 Support & Escalation

### Contacts
- **Security Lead**: [À définir]
- **DevOps Lead**: [À définir]
- **Product Lead**: [À définir]

### Escalation Path
1. **Bugs Critiques**: Immediate fix, deploy hotfix
2. **Bugs High**: Fix within 24h
3. **Bugs Medium**: Fix within 1 week
4. **Bugs Low**: Backlog pour post-launch

---

_Document créé le 26 Octobre 2025 - Phase 11 Testnet Deployment_  
_Dernière mise à jour: 26 Octobre 2025_
