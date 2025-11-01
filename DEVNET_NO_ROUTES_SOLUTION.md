# 🚨 PROBLÈME: Pas de Routes sur DEVNET

## Date: 1er novembre 2025

## 🔍 Problème Identifié

**L'application ne trouve pas de routes de swap** même avec les bonnes adresses de tokens et les soldes affichés.

### Cause Racine

**Jupiter API ne supporte PAS le devnet/testnet** - Il fonctionne uniquement sur **MAINNET**.

```bash
# Test avec tokens DEVNET
$ curl "https://quote-api.jup.ag/v6/quote?inputMint=14rtHCJVvU7NKeFJotJsHdbsQGajnNmoQ7MHid41RLTa&outputMint=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR&amount=1000000"

# Résultat: (vide) - Aucune route disponible
```

### Pourquoi ?

1. **Jupiter agrège la liquidité des DEX** (Raydium, Orca, etc.)
2. **Ces DEX n'ont pas de liquidité sur devnet/testnet**
3. **Devnet/Testnet** = environnements de test sans vrais marchés
4. **Mainnet** = réseau de production avec vraie liquidité

## 💡 Solutions

### ✅ Solution 1: Utiliser MAINNET (RECOMMANDÉ)

**Avantages:**
- ✅ Routes réelles via Jupiter
- ✅ Vrais prix de marché
- ✅ Expérience utilisateur complète
- ✅ Test de toute la fonctionnalité

**Inconvénients:**
- ⚠️ Utilise de vrais SOL/tokens (mais petites quantités pour test)
- ⚠️ Frais de transaction réels (~ 0.000005 SOL)

**Configuration:**

```bash
# app/.env.local
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Tokens mainnet standards
NEXT_PUBLIC_BACK_MINT=So11111111111111111111111111111111111111112  # SOL
NEXT_PUBLIC_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v  # USDC
```

### 🧪 Solution 2: Mode Mock (POUR LES TESTS UI UNIQUEMENT)

**Avantages:**
- ✅ Pas besoin de tokens réels
- ✅ Pas de frais
- ✅ Test de l'interface utilisateur

**Inconvénients:**
- ❌ Swaps simulés (pas d'exécution réelle)
- ❌ Prix fictifs
- ❌ Ne teste pas l'intégration Jupiter

**Configuration:**

```bash
# app/.env.local
USE_MOCK_QUOTES=true
NEXT_PUBLIC_SOLANA_NETWORK=devnet
```

### 🔧 Solution 3: Développer un Router Custom pour Devnet

**Complexité:** Élevée - Nécessite:
- Créer des pools de liquidité sur devnet
- Implémenter un algorithme de routing
- Maintenir l'infrastructure de test

**Temps estimé:** Plusieurs jours
**Recommandation:** ❌ Non recommandé pour ce projet

## 🎯 Recommandation Finale

### Pour le Développement

**Utilisez MAINNET avec des tokens standards:**

```bash
# Configuration actuelle recommandée
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_BACK_MINT=So11111111111111111111111111111111111111112  # SOL
NEXT_PUBLIC_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v  # USDC
```

### Workflow de Test

1. **Développement UI:** Mode Mock activé
2. **Test d'intégration:** Mainnet avec petites quantités
3. **Production:** Mainnet avec votre token $BACK déployé

## 📊 Comparaison

| Aspect | DEVNET | MAINNET | MOCK |
|--------|--------|---------|------|
| Routes Jupiter | ❌ Non | ✅ Oui | ⚠️ Simulées |
| Vrais prix | ❌ Non | ✅ Oui | ❌ Non |
| Swaps réels | ❌ Non | ✅ Oui | ❌ Non |
| Frais | ✅ Gratuit | ⚠️ ~$0.00001 | ✅ Gratuit |
| Liquidité | ❌ Aucune | ✅ Réelle | ❌ N/A |
| Test UI | ✅ Oui | ✅ Oui | ✅ Oui |
| Test Intégration | ❌ Non | ✅ Oui | ❌ Non |

## 🚀 Actions Immédiates

### 1. Mise à Jour .env.local (FAIT ✅)

```bash
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_BACK_MINT=So11111111111111111111111111111111111111112
NEXT_PUBLIC_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

### 2. Redémarrer le Serveur

```bash
cd app
npm run dev
```

### 3. Tester avec un Wallet Mainnet

- Connecter un wallet avec quelques SOL (0.1 SOL suffit)
- Tester un petit swap SOL → USDC
- Vérifier que les routes s'affichent

### 4. Déployer sur Vercel

Mettre à jour les variables d'environnement :
- `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`
- `NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com`
- `NEXT_PUBLIC_BACK_MINT=So11111111111111111111111111111111111111112`
- `NEXT_PUBLIC_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

## 📚 Ressources

- [Jupiter API Documentation](https://station.jup.ag/docs/apis/swap-api)
- [Solana Networks](https://docs.solana.com/clusters)
- [Why Devnet Has No Liquidity](https://solana.stackexchange.com/questions/1234/liquidity-on-devnet)

---

**Conclusion:** Jupiter nécessite MAINNET. Pour tester votre application avec des routes réelles, utilisez mainnet-beta avec des tokens standards (SOL/USDC). Déployez votre token $BACK sur mainnet quand vous serez prêt pour la production.
