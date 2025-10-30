# 🧪 Guide de Test Testnet SwapBack

**Date**: 29 Octobre 2025  
**Environnement**: GitHub Codespaces + Testnet Solana

---

## 🎯 Configuration Actuelle

### ✅ MOCK Mode Activé (Recommandé pour Codespaces)

```bash
# .env.local
USE_MOCK_QUOTES=true
NEXT_PUBLIC_SOLANA_NETWORK=testnet
```

**Pourquoi MOCK ?**
- ❌ Codespaces bloque l'accès à `quote-api.jup.ag` (restriction DNS)
- ✅ MOCK simule des prix réalistes (SOL=150 USDC)
- ✅ Permet de tester toute l'UI/UX sans réseau externe

---

## 📊 Comparaison MOCK vs RÉEL

| Aspect | MOCK (Codespaces) | RÉEL (Machine Locale) |
|--------|-------------------|----------------------|
| **Accès réseau** | ❌ Pas besoin | ✅ Requis (Jupiter API) |
| **Prix** | 🎭 Simulés (SOL=150) | 💰 Marché réel (variable) |
| **Transactions** | 🎬 Simulées | ⛓️ On-chain testnet |
| **Wallet** | 🚫 Pas nécessaire | ✅ Phantom/Solflare requis |
| **SOL testnet** | 🚫 Pas besoin | ✅ Faucet requis |
| **Tests UI** | ✅✅✅ Parfait | ✅✅✅ Parfait |
| **Tests Smart Contracts** | ❌ Impossible | ✅ Possible |
| **Vitesse** | ⚡ Instantané | 🐢 ~2-3s par quote |

---

## 🧪 Tests en Mode MOCK (Codespaces)

### Ce que vous POUVEZ tester

✅ **Interface utilisateur**
- Sélection des tokens
- Saisie des montants
- Affichage des routes
- Calcul du output amount
- Slippage settings
- Route details display

✅ **Logique frontend**
- Store Zustand (swapStore)
- State management
- Error handling
- Loading states

✅ **API endpoints**
- `/api/swap/quote` (mode MOCK)
- Parsing des réponses
- Transformation des données

### Ce que vous NE POUVEZ PAS tester

❌ **Transactions blockchain**
- Swap réel on-chain
- Wallet signature
- Smart contract execution
- Token transfers

❌ **Prix de marché réels**
- Variations de prix
- Slippage réel
- Liquidité actuelle des DEX

---

## 🚀 Tests en Mode RÉEL (Machine Locale)

### Prérequis

1. **Machine locale** (pas Codespaces)
2. **Wallet Solana**
   - Phantom: https://phantom.app
   - Solflare: https://solflare.com
3. **SOL Testnet** (gratuit)
   - Faucet: https://faucet.solana.com
   - Quantité: ~0.5 SOL pour tests

### Configuration

```bash
# 1. Cloner le repo sur votre machine
git clone https://github.com/BacBacta/SwapBack.git
cd SwapBack/app

# 2. Installer les dépendances
npm install

# 3. Configurer .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_SOLANA_NETWORK=testnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.testnet.solana.com

# Désactiver MOCK pour mode RÉEL
USE_MOCK_QUOTES=false

# Program IDs (copier depuis votre .env.local actuel)
NEXT_PUBLIC_ROUTER_PROGRAM_ID=GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt
# ... etc
EOF

# 4. Démarrer le serveur
npm run dev
```

### Tests Recommandés (Mode RÉEL)

1. **Obtenir SOL testnet**
   ```
   https://faucet.solana.com
   → Entrer votre adresse wallet
   → Recevoir 1-2 SOL testnet
   ```

2. **Tester un swap simple**
   - Input: 0.1 SOL
   - Output: USDC
   - Vérifier le prix réel (devrait être ~$15 selon marché)

3. **Vérifier Jupiter routing**
   - Comparer avec Jupiter UI: https://jup.ag
   - Même paire de tokens
   - Prix similaires (±2%)

4. **Tester les erreurs**
   - Montant trop grand (insuffisient liquidity)
   - Slippage trop bas
   - Token pair inexistant

---

## 🎭 Améliorer les Données MOCK

Si vous voulez des simulations plus réalistes, modifiez `/app/src/app/api/swap/quote/route.ts` :

```typescript
function generateMockQuote(...) {
  // Prix réalistes selon la paire
  const mockPrices: Record<string, number> = {
    // SOL → USDC
    'So11111111111111111111111111111111111111112_EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 150,
    
    // SOL → USDT
    'So11111111111111111111111111111111111111112_Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 150,
    
    // USDC → USDT
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v_Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.001,
    
    // BACK → USDC (votre token)
  '862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux_EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 0.004,
  };
  
  const pairKey = `${inputMint}_${outputMint}`;
  const mockPrice = mockPrices[pairKey] || 1.0;
  
  // Ajouter variation aléatoire ±1%
  const variation = 1 + (Math.random() - 0.5) * 0.02;
  const finalPrice = mockPrice * variation;
  
  // Simuler slippage réaliste
  const slippageMultiplier = 1 - (amount / 1000000000) * 0.001; // 0.1% par SOL
  const outAmount = Math.floor(amount * finalPrice * slippageMultiplier);
  
  // Simuler plusieurs routes
  const routePlan = [
    {
      swapInfo: {
        ammKey: "MOCK_ORCA_WHIRLPOOL",
        label: "Orca Whirlpool (60%)",
        inAmount: Math.floor(amount * 0.6).toString(),
        outAmount: Math.floor(outAmount * 0.6).toString(),
        feeAmount: Math.floor(amount * 0.0025).toString(), // 0.25%
      },
      percent: 60,
    },
    {
      swapInfo: {
        ammKey: "MOCK_RAYDIUM_CLMM",
        label: "Raydium CLMM (40%)",
        inAmount: Math.floor(amount * 0.4).toString(),
        outAmount: Math.floor(outAmount * 0.4).toString(),
        feeAmount: Math.floor(amount * 0.003).toString(), // 0.3%
      },
      percent: 40,
    },
  ];
  
  return {
    // ... reste du code
    routePlan,
  };
}
```

---

## 📈 Roadmap de Tests

### Phase 1: MOCK (Codespaces) ✅ ACTUEL
- [x] UI/UX complète
- [x] Store Zustand
- [x] Routes display
- [x] Error handling

### Phase 2: RÉEL Local (Votre Machine)
- [ ] Clone repo en local
- [ ] Configurer wallet
- [ ] Obtenir SOL testnet
- [ ] Tester swaps réels
- [ ] Valider prix de marché

### Phase 3: Tests Smart Contracts (Avancé)
- [ ] Déployer programmes sur testnet
- [ ] Tester buyback mechanism
- [ ] Tester cNFT minting
- [ ] Tester rebates

### Phase 4: Mainnet (Production)
- [ ] Audit de sécurité
- [ ] Tests finaux
- [ ] Déploiement mainnet

---

## 🔧 Commandes Utiles

### Mode MOCK (Codespaces)
```bash
# Activer MOCK
echo "USE_MOCK_QUOTES=true" >> /workspaces/SwapBack/app/.env.local

# Redémarrer serveur
pkill -f "next dev"
cd /workspaces/SwapBack/app && npm run dev
```

### Mode RÉEL (Local)
```bash
# Désactiver MOCK
echo "USE_MOCK_QUOTES=false" >> .env.local

# Tester API Jupiter
curl "https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000&slippageBps=50"
```

### Debug
```bash
# Logs serveur
tail -f /tmp/nextjs-dev.log

# Test endpoint
curl -X POST http://localhost:3000/api/swap/quote \
  -H "Content-Type: application/json" \
  -d '{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","amount":1000000000,"slippageBps":50}'
```

---

## 🎯 Recommandation Finale

### Pour Codespaces (ACTUEL)
✅ **Garder MOCK activé**
- Tests UI/UX complets
- Développement rapide
- Pas de dépendance réseau

### Pour Tests Réels
✅ **Cloner en local**
- Tester Jupiter API réel
- Valider transactions on-chain
- Expérience complète testnet

### Meilleure Approche
🎯 **Hybride**:
1. **Dev quotidien**: Codespaces + MOCK
2. **Tests hebdo**: Local + RÉEL
3. **Validation finale**: Local + Testnet complet
4. **Production**: Mainnet après audit

---

**Configuration actuelle**: ✅ MOCK Mode (optimale pour Codespaces)  
**Prochaine étape**: Tester l'UI avec données MOCK, puis valider en local avec données réelles
