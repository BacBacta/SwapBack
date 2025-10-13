# 🔄 SwapBack - Intégration Wallet & Meilleurs Swaps

## 📋 Vue d'Ensemble

SwapBack s'intègre aux wallets existants (Phantom, Solflare, Backpack) pour offrir **automatiquement de meilleurs swaps** avec rebates boostés, sans que l'utilisateur ait à changer ses habitudes.

---

## 🎯 Concept: "Swap Comme D'Habitude, Gagnez Plus"

### Parcours Utilisateur Actuel (Sans SwapBack)
```
1. User ouvre Phantom
2. Clique sur "Swap"
3. Sélectionne USDC → SOL
4. Entre montant: 1000 USDC
5. Phantom route via Jupiter
6. Swap exécuté
7. User reçoit ~10.5 SOL
8. Frais payés: 3 USDC (0.3%)
9. Aucun rebate
```

### Parcours Utilisateur Avec SwapBack ✨
```
1. User ouvre Phantom (extension SwapBack active)
2. Clique sur "Swap"
3. 🔄 Badge "SwapBack Active" apparaît
4. Sélectionne USDC → SOL
5. Entre montant: 1000 USDC
6. SwapBack intercepte → Route optimisée
7. Swap exécuté via SwapBack Router
8. User reçoit ~10.5 SOL
9. Frais payés: 3 USDC
10. 🎁 Rebate de 3 USDC enregistré (100% des frais)
11. Si Gold cNFT: Rebate boosté à 3.60 USDC (+20%)
```

**Résultat: Même UX, meilleurs gains !**

---

## 🏗️ Architecture Technique

### 1. Extension Browser (Chrome/Firefox/Edge)

#### Components
```
browser-extension/
├── manifest.json          # Configuration extension
├── background.js          # Service worker (routing logic)
├── content.js             # Script injecté (détection swaps)
├── injected.js            # Script page (interception)
├── popup.html             # Popup extension
├── popup.js               # UI popup
└── icons/                 # Assets
```

#### Flow Technique

```typescript
┌─────────────────────────────────────────────────────────────┐
│                     PAGE WEB (phantom.app)                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │  injected.js (dans la page)                         │    │
│  │  - Détecte click sur "Swap"                         │    │
│  │  - Intercepte la transaction                        │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │ postMessage()                          │
└─────────────────────┼──────────────────────────────────────┘
                      │
┌─────────────────────▼──────────────────────────────────────┐
│                  content.js (content script)                │
│  - Reçoit les détails du swap                              │
│  - Communique avec background.js                           │
└─────────────────────┬──────────────────────────────────────┘
                      │ chrome.runtime.sendMessage()
┌─────────────────────▼──────────────────────────────────────┐
│             background.js (service worker)                  │
│  1. Récupère niveau cNFT user (Bronze/Silver/Gold)        │
│  2. Appelle Jupiter API pour quote                         │
│  3. Construit transaction SwapBack avec rebate             │
│  4. Retourne transaction optimisée                         │
└─────────────────────┬──────────────────────────────────────┘
                      │
┌─────────────────────▼──────────────────────────────────────┐
│                  SOLANA BLOCKCHAIN                          │
│  ┌──────────────────────────────────────────────┐          │
│  │  SwapBack Router Program                     │          │
│  │  - Exécute swap via Jupiter                  │          │
│  │  - Enregistre rebate (UserState PDA)         │          │
│  │  - Applique boost si cNFT présent            │          │
│  └──────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

### 2. Intégration Directe dans Phantom (Option Alternative)

#### A. Plugin Phantom Natif

Phantom permet aux développeurs de créer des plugins :

```typescript
// phantom-plugin/swapback-plugin.ts

import { PhantomPlugin } from '@phantom/plugin-sdk';

export class SwapBackPlugin extends PhantomPlugin {
  name = 'SwapBack';
  version = '1.0.0';
  
  // Hook avant chaque swap
  async onBeforeSwap(swapParams) {
    console.log('SwapBack: Optimizing swap...');
    
    // 1. Check if user has cNFT
    const cnftLevel = await this.getUserCNFTLevel(swapParams.walletAddress);
    
    // 2. Get SwapBack route with rebate
    const swapbackRoute = await this.getSwapBackRoute({
      ...swapParams,
      boost: cnftLevel?.boost || 0,
    });
    
    // 3. Compare with original route
    if (swapbackRoute.estimatedOutput > swapParams.estimatedOutput) {
      // SwapBack route is better!
      return {
        useCustomRoute: true,
        route: swapbackRoute,
        notification: {
          title: '🔄 SwapBack Route Active',
          message: `Rebate estimé: ${swapbackRoute.estimatedRebate} USDC`,
        },
      };
    }
    
    // Fallback to original route
    return { useCustomRoute: false };
  }
  
  async getUserCNFTLevel(walletAddress) {
    // Fetch from Solana
    const connection = new Connection(SOLANA_RPC);
    const [userNftPda] = await PublicKey.findProgramAddress(
      [Buffer.from('user_nft'), walletAddress.toBuffer()],
      CNFT_PROGRAM_ID
    );
    
    const accountInfo = await connection.getAccountInfo(userNftPda);
    // Decode and return level
  }
  
  async getSwapBackRoute(params) {
    // Call SwapBack API
    const response = await fetch('https://api.swapback.app/v1/quote', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return response.json();
  }
}
```

**Avantages:**
- ✅ Intégration native dans Phantom
- ✅ Pas besoin d'extension séparée
- ✅ UX parfaitement seamless

**Inconvénients:**
- ❌ Nécessite partenariat avec Phantom
- ❌ Temps de développement plus long

---

### 3. API SwapBack (Backend)

#### Endpoints

```typescript
// API pour l'extension et les partenaires

POST /v1/quote
Body: {
  inputMint: string,
  outputMint: string,
  amount: number,
  walletAddress: string,
  slippage?: number
}
Response: {
  route: JupiterRoute,
  estimatedOutput: number,
  estimatedRebate: number,
  boost: number,
  cNFTLevel: 'Bronze' | 'Silver' | 'Gold' | null,
  transaction: SerializedTransaction
}

GET /v1/user/:walletAddress/cnft
Response: {
  hasCNFT: boolean,
  level: 'Bronze' | 'Silver' | 'Gold',
  boost: number,
  lockedAmount: number,
  unlockDate: number
}

POST /v1/swap
Body: {
  transaction: SerializedTransaction,
  signature: string
}
Response: {
  success: boolean,
  txId: string,
  rebateAmount: number
}

GET /v1/user/:walletAddress/rebates
Response: {
  totalRebates: number,
  claimableRebates: number,
  rebateHistory: Array<{
    date: number,
    amount: number,
    swapVolume: number,
    boost: number
  }>
}
```

---

### 4. Widget SwapBack Intégrable

Pour les sites qui veulent intégrer SwapBack directement :

```html
<!-- Sur n'importe quel site Solana -->
<div id="swapback-widget"></div>

<script src="https://cdn.swapback.app/widget.js"></script>
<script>
  SwapBack.init({
    container: '#swapback-widget',
    theme: 'dark',
    defaultInputToken: 'USDC',
    defaultOutputToken: 'SOL',
    showRebates: true,
    showBoost: true,
  });
</script>
```

**Résultat:**
```
┌─────────────────────────────────────┐
│     🔄 SwapBack Widget              │
├─────────────────────────────────────┤
│  From: [1000 USDC ▼]                │
│  To:   [≈10.5 SOL ▼]                │
│                                     │
│  💰 Rebate: 3.60 USDC               │
│  🥇 Gold Boost: +20%                │
│                                     │
│  [      Swap & Earn Rebate     ]   │
└─────────────────────────────────────┘
```

---

## 🎯 Stratégies d'Intégration

### Stratégie 1: Extension Browser (Court Terme)
**Timeframe:** 2-3 semaines

1. ✅ Créer extension Chrome/Firefox
2. ✅ Détecter swaps sur Phantom/Solflare
3. ✅ Intercepter et router via SwapBack
4. ✅ Afficher notifications de rebates
5. ✅ Publier sur Chrome Web Store

**Avantages:**
- Rapide à développer
- Contrôle total
- Fonctionne avec tous les wallets web

### Stratégie 2: Partenariat Phantom (Moyen Terme)
**Timeframe:** 2-3 mois

1. Contact Phantom team
2. Proposition de plugin natif
3. Développement selon leur SDK
4. Testing & approval
5. Déploiement dans Phantom

**Avantages:**
- Visibilité massive (millions d'users)
- Crédibilité instantanée
- UX native

### Stratégie 3: API Publique (Long Terme)
**Timeframe:** 1-2 mois

1. ✅ Créer API REST SwapBack
2. ✅ Documentation développeurs
3. ✅ SDK JavaScript/TypeScript
4. ✅ Partenariats avec wallets
5. ✅ Intégration dans agregateurs

**Avantages:**
- Scalable
- Intégrations multiples
- Revenue partnerships

---

## 💡 Features Uniques

### 1. Smart Route Comparison

SwapBack compare **automatiquement** avec Jupiter :

```typescript
const routes = await Promise.all([
  getJupiterRoute(params),
  getSwapBackRoute(params), // Inclut rebate estimé
]);

const bestRoute = routes.reduce((best, current) => {
  const jupiterOutput = best.estimatedOutput;
  const swapbackOutput = current.estimatedOutput + current.estimatedRebate;
  
  return swapbackOutput > jupiterOutput ? current : best;
});

// Toujours choisir la meilleure option pour l'user
return bestRoute;
```

### 2. Rebate Preview

Avant chaque swap, afficher :

```
┌─────────────────────────────────┐
│  Swap: 1000 USDC → ~10.5 SOL   │
│                                 │
│  💰 Instant Rebate Preview:     │
│  ├─ Base rebate: 3.00 USDC      │
│  └─ Gold boost:  +0.60 USDC     │
│  ═══════════════════════════     │
│  Total rebate: 3.60 USDC ✨     │
│                                 │
│  Your effective rate: -0.36%    │
│  (Better than any CEX!)         │
└─────────────────────────────────┘
```

### 3. Rebate Tracking

Dashboard personnel :

```
Your SwapBack Stats (Last 30 days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Swaps:        47
Total Volume:       $125,430
Total Rebates:      $452.15
Average Boost:      +18% (Gold)

Top Swapped Pairs:
1. USDC → SOL    (24 swaps, $85k)
2. SOL → USDC    (15 swaps, $32k)
3. USDC → JUP    (8 swaps, $8.4k)

Claimable Rebates:  $127.80
[   Claim All Rebates   ]
```

---

## 🚀 Roadmap d'Implémentation

### Phase 1: Extension Browser (Semaines 1-3) ✅
- [x] Manifest.json configuré
- [x] content.js (détection swaps)
- [x] background.js (routing logic)
- [ ] popup.html (UI extension)
- [ ] Tests sur Phantom devnet
- [ ] Publication Chrome Web Store

### Phase 2: API Backend (Semaines 3-6)
- [ ] API REST endpoints
- [ ] Intégration Jupiter
- [ ] Calcul rebates on-chain
- [ ] Historique swaps
- [ ] Dashboard analytics

### Phase 3: Widget Intégrable (Semaines 6-8)
- [ ] Widget SDK
- [ ] Documentation
- [ ] Examples sites
- [ ] NPM package

### Phase 4: Partenariats (Mois 3-4)
- [ ] Contact Phantom team
- [ ] Contact Solflare team
- [ ] Contact Backpack team
- [ ] Plugin natif development

---

## 📊 Métriques de Succès

### KPIs Extension

```
Downloads:           Target: 10,000 en 3 mois
Active Users:        Target: 3,000 DAU
Swaps Routed:        Target: 500/jour
Volume Routé:        Target: $500k/jour
Rebates Distribués:  Target: $1,500/jour
User Retention:      Target: 60% à 30 jours
```

### Comparaison Compétitive

```
                  Jupiter   Raydium   SwapBack
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Meilleur Prix      ✅        ❌         ✅
Rebates            ❌        ❌         ✅
Boost Fidélité     ❌        ❌         ✅
Extension Wallet   ❌        ❌         ✅
API Publique       ✅        ✅         ✅
Integration        Moyenne   Faible     Élevée
```

---

## 🎯 Conclusion

### Proposition de Valeur

**Pour l'Utilisateur:**
```
Utilise ton wallet préféré (Phantom, Solflare...)
    ↓
Swap normalement
    ↓
SwapBack optimise en arrière-plan
    ↓
Tu reçois des rebates automatiquement
    ↓
Plus tu lock $BACK, plus tu gagnes
    ↓
Profit! 💰
```

**Différenciation Clé:**
- ✅ **Zéro friction** : Fonctionne avec wallets existants
- ✅ **Meilleurs prix** : Toujours comparer avec Jupiter
- ✅ **Rebates réels** : 100% des frais en rebates
- ✅ **Boost progressif** : Reward la fidélité
- ✅ **Transparent** : Preview avant swap

---

## 📞 Prochaines Actions

### Immédiatement
1. ✅ Finaliser extension (popup.html)
2. ✅ Tester sur Phantom devnet
3. ✅ Créer vidéo démo

### Court Terme (1-2 semaines)
1. Publier extension Chrome Store
2. Marketing initial (Twitter, Discord)
3. Recueillir feedback users

### Moyen Terme (1 mois)
1. API backend en production
2. Dashboard analytics
3. Contact partenaires wallets

**Le futur du swap sur Solana commence maintenant ! 🚀**

---

**Auteur:** SwapBack Team  
**Date:** Octobre 2025  
**Version:** 1.0
