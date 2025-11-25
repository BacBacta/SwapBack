# E2E Tests - Devnet

Scripts de tests end-to-end pour valider le flow complet SwapBack sur devnet.

## 📋 Prérequis

- Node.js v16+
- Solana CLI installé
- Wallet configuré (`solana-keygen new`)
- Balance devnet suffisante (`solana airdrop 2`)

## 🚀 Usage

### Test Complet (Recommandé)

```bash
./scripts/test-e2e-devnet.sh
```

Exécute tous les tests dans l'ordre :
1. Swap Test (10 swaps par défaut)
2. Buyback Test (vault + distribution)
3. Claim Test (rewards cNFT holders)

### Options

```bash
# Personnaliser le nombre de swaps
NUM_SWAPS=20 ./scripts/test-e2e-devnet.sh

# Personnaliser le montant par swap
SWAP_AMOUNT=0.05 ./scripts/test-e2e-devnet.sh

# RPC personnalisé
DEVNET_RPC="https://custom-rpc.com" ./scripts/test-e2e-devnet.sh
```

### Tests Individuels

#### 1. Swap Test

```bash
node scripts/test-swap-devnet.js --num-swaps=10 --amount=0.01
```

**Tests**:
- ✅ Connexion RPC
- ✅ Balance wallet
- ✅ Exécution swaps SOL → USDC
- ✅ Latency tracking
- ✅ Success rate ≥95%
- ✅ TPS measurement

**Métriques**:
- Total swaps
- Success rate (%)
- Average/Min/Max latency (ms)
- TPS (transactions per second)
- Résultats sauvés : `scripts/e2e-swap-results.json`

#### 2. Buyback Test

```bash
node scripts/test-buyback-devnet.js
```

**Tests**:
- ✅ Buyback vault existence
- ✅ Distribution ratio 50/50
- ✅ Buyback execution interval
- ✅ Vault balance check

#### 3. Claim Test

```bash
node scripts/test-claim-devnet.js
```

**Tests**:
- ✅ cNFT ownership verification
- ✅ Claimable rewards check
- ✅ Claim transaction execution
- ✅ Rewards distribution

## 📊 Résultats Attendus

### ✅ Success (Exit 0)
- Swap: Success rate ≥95%
- Buyback: Tous les checks passent
- Claim: Tous les checks passent

### ⚠️ Partial (Exit 1)
- Swap: Success rate <95%
- Buyback: Certains checks échouent
- Claim: Certains checks échouent

### ❌ Failure (Exit 1+)
- Erreurs fatales (RPC, wallet, etc.)

## 📁 Structure Fichiers

```
scripts/
├── test-e2e-devnet.sh          # Script principal (orchestrateur)
├── test-swap-devnet.js         # Test swaps individuels
├── test-buyback-devnet.js      # Test mécanisme buyback
├── test-claim-devnet.js        # Test claims rewards
└── e2e-swap-results.json       # Résultats (généré)
```

## 🔧 Configuration

### Variables d'Environnement

```bash
# RPC endpoint
export DEVNET_RPC="https://api.devnet.solana.com"

# Nombre de swaps
export NUM_SWAPS=10

# Montant par swap (SOL)
export SWAP_AMOUNT=0.01
```

### Program IDs (Devnet)

```javascript
BUYBACK_PROGRAM_ID = 'F8S1r81FXZ9wJkbQwp3ZfVfjmwx12f5NpfN4xrA3pump'
CNFT_PROGRAM_ID = '9MjuF4Vjxr6sYB2kFpjdwqyMcKgcAvkz7mQEaG2bvQRN'
```

## 🐛 Debugging

### Erreur: "Wallet not found"

```bash
solana-keygen new
```

### Erreur: "Insufficient balance"

```bash
solana airdrop 2 --url devnet
```

### Erreur: "RPC connection failed"

```bash
# Tester connexion RPC
solana cluster-version --url https://api.devnet.solana.com
```

### Voir logs détaillés

```bash
# Activer debug Node.js
NODE_DEBUG=* node scripts/test-swap-devnet.js
```

## 📈 Métriques Collectées

### Swap Metrics
```json
{
  "totalSwaps": 10,
  "successfulSwaps": 10,
  "failedSwaps": 0,
  "totalLatency": 4403,
  "minLatency": 367,
  "maxLatency": 562,
  "transactions": [...],
  "errors": []
}
```

### Performance Targets
- **Success Rate**: ≥95%
- **Average Latency**: <500ms
- **TPS**: >1 (swap par seconde)
- **Max Latency**: <1000ms

## 🚀 CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests Devnet

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install Solana CLI
        run: sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
      - name: Setup Wallet
        run: solana-keygen new --no-bip39-passphrase
      - name: Airdrop
        run: solana airdrop 2 --url devnet
      - name: Run E2E Tests
        run: ./scripts/test-e2e-devnet.sh
```

## 📝 Notes

- **Tests simulés**: Actuellement, les tests utilisent des transactions simulées (mock) car l'intégration complète avec SwapExecutor nécessite le SDK complet
- **Production**: Pour production, remplacer les mocks par de vraies transactions via SwapExecutor
- **Rate Limiting**: Délai de 1s entre swaps pour éviter rate limiting RPC

## 🎯 Prochaines Étapes

1. ✅ Intégration SwapExecutor réel
2. ✅ Tests avec vraies transactions blockchain
3. ✅ Monitoring temps réel (Grafana)
4. ✅ Alerting sur failures
5. ✅ Load testing (Phase 7.3)

## 📞 Support

Issues: https://github.com/BacBacta/SwapBack/issues
