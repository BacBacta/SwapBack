# Guide: Premier Buyback Réel - Déclenchement et Observation

**Processus complet pour tester le système buyback 100% burn sur devnet**

---

## 🎯 Objectif

Accumuler 100 USDC dans le vault, déclencher un buyback, et observer la réduction de supply du token $BACK.

---

## 📋 Prérequis

### 1. USDC Devnet

Vous avez besoin d'USDC sur devnet. Voici comment en obtenir :

```bash
# Option 1: Faucet SPL Token (si disponible)
spl-token create-account 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --url devnet

# Option 2: Utiliser un autre token de test
# Le vault peut accepter n'importe quel SPL token pour les tests

# Vérifier votre balance
spl-token balance 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --url devnet
```

### 2. SOL pour les frais

```bash
# Vérifier balance
solana balance --url devnet

# Si besoin, utiliser le faucet
solana airdrop 2 --url devnet
```

---

## 🚀 Méthode 1: Script Automatique (Recommandé)

### Étape 1: Déposer USDC dans le vault

```bash
# Déposer 150 USDC (au-dessus du minimum de 100)
node scripts/simulate-buyback-accumulation.js --amount=150
```

Le script va :
1. ✅ Vérifier vos balances (SOL + USDC)
2. ✅ Déposer USDC dans le buyback vault
3. ✅ Vérifier que le minimum (100 USDC) est atteint
4. ✅ Initier le buyback automatiquement
5. ✅ Afficher la supply actuelle $BACK

### Étape 2: Compléter le buyback manuellement

Après l'initiation, vous devez :

1. **Swap USDC → $BACK via Jupiter** (off-chain)
   - Utiliser Jupiter API ou interface
   - Montant: tout le USDC du vault
   - Destination: BACK Vault ATA

2. **Finaliser le buyback** (on-chain)
```bash
node scripts/finalize-buyback.js
```

3. **Brûler les tokens** (on-chain)
```bash
node scripts/burn-back-tokens.js
```

### Étape 3: Observer la supply reduction

```bash
# Avant burn
spl-token supply 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux --url devnet

# Après burn (devrait être inférieur)
spl-token supply 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux --url devnet

# Ou utiliser le script de test
node scripts/test-buyback-100burn.js
```

---

## 🔧 Méthode 2: Ligne de Commande Manuelle

### Étape 1: Dériver les PDAs

```javascript
// Dans Node.js REPL
const { PublicKey } = require('@solana/web3.js');
const programId = new PublicKey('7wCCwRXxWvMY2DJDRrnhFg3b8jVPb5vVPxLH5YAGL6eJ');

const [buybackState] = PublicKey.findProgramAddressSync(
  [Buffer.from('buyback_state')],
  programId
);
console.log('BuybackState:', buybackState.toString());
// Output: 7TiDwg4E4gmBiNS1FsNMKkbf1KyH1oDuWQugrh...

const [usdcVault] = PublicKey.findProgramAddressSync(
  [Buffer.from('usdc_vault')],
  programId
);
console.log('USDC Vault:', usdcVault.toString());
// Output: 8rCyi7Bu6eTFZrJ5VvAQV8FHWz7kLCCEJyXKcdCSHH2Y
```

### Étape 2: Déposer USDC avec Anchor CLI

```bash
# Créer un script deposit.js
cat > /tmp/deposit-usdc.js << 'EOF'
const anchor = require('@coral-xyz/anchor');
// ... (voir simulate-buyback-accumulation.js pour l'exemple complet)
EOF

# Exécuter
node /tmp/deposit-usdc.js
```

### Étape 3: Vérifier le vault

```bash
# Balance du vault
spl-token balance --address 8rCyi7Bu6eTFZrJ5VvAQV8FHWz7kLCCEJyXKcdCSHH2Y --url devnet
```

### Étape 4: Initier le buyback

```bash
# Via Anchor (créer un script)
anchor run initiate-buyback
```

---

## 📊 Monitoring et Vérifications

### Vérifier l'état du BuybackState

```bash
# Via RPC
solana account 7TiDwg4E4gmBiNS1FsNMKkbf1KyH1oDuWQugrh... --url devnet

# Via script
node scripts/check-buyback-state.js
```

### Vérifier la supply $BACK

```bash
# Commande directe
spl-token supply 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux --url devnet

# Via script avec historique
node scripts/test-buyback-100burn.js
```

### Explorer Solana

Consultez les transactions sur [Solana Explorer](https://explorer.solana.com/?cluster=devnet) :

- BuybackState: `7TiDwg4E4gmBiNS1FsNMKkbf1KyH1oDuWQugrhAGk73x`
- USDC Vault: `8rCyi7Bu6eTFZrJ5VvAQV8FHWz7kLCCEJyXKcdCSHH2Y`
- BACK Vault ATA: `5oLYee2wgD9S5LKgEKtG8Q23hhBmGXeQ58SbKY7Kgv4S`

---

## 🧪 Exemple de Test Complet

```bash
# 1. Vérifier la supply AVANT
echo "Supply AVANT burn:"
spl-token supply 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux --url devnet

# 2. Déposer et initier buyback
node scripts/simulate-buyback-accumulation.js --amount=150

# 3. Attendre confirmation (quelques secondes)
sleep 5

# 4. Simuler le swap Jupiter (pour tests, on peut skip cette étape
#    et juste transférer des tokens $BACK manuellement au vault)

# 5. Finaliser et brûler
node scripts/finalize-buyback.js
node scripts/burn-back-tokens.js

# 6. Vérifier la supply APRÈS
echo "Supply APRÈS burn:"
spl-token supply 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux --url devnet

# 7. Calculer la différence
echo "La supply devrait avoir DIMINUÉ ! 🔥"
```

---

## ⚠️ Conditions et Contraintes

### Cooldown de 1 heure

Entre chaque buyback, un délai minimum de 1 heure est requis :

```
Dernier buyback : 2025-11-24 10:00:00
Prochain possible: 2025-11-24 11:00:00
```

Si vous essayez avant :
```
Error: TimeLockNotElapsed
Solution: Attendre la fin du cooldown
```

### Montant minimum 100 USDC

Le buyback ne peut se déclencher que si :
```
USDC Vault balance ≥ 100 USDC (100,000,000 lamports)
```

Si inférieur :
```
Error: InsufficientBuybackAmount
Solution: Déposer plus d'USDC
```

---

## 📈 Métriques à Observer

### Avant le buyback

```json
{
  "supply": 1001494000,
  "usdcVault": 150,
  "backVault": 0,
  "totalBurned": 0,
  "buybackCount": 0
}
```

### Après le buyback (exemple avec 1500 $BACK achetés et brûlés)

```json
{
  "supply": 1001492500,  // ⬇️ Diminué de 1500
  "usdcVault": 0,         // ⬇️ Tout utilisé
  "backVault": 0,         // ⬇️ Tout brûlé (100%)
  "totalBurned": 1500,    // ⬆️ Cumulé augmenté
  "buybackCount": 1       // ⬆️ Compteur incrémenté
}
```

### Calcul de l'impact

```
Supply reduction = (1500 / 1001494000) × 100 = 0.00015%
```

Avec 1 buyback quotidien de 1500 $BACK pendant 1 an :
```
Annual burn = 1500 × 365 = 547,500 $BACK
Annual impact = (547,500 / 1001494000) × 100 = 0.055%
```

---

## 🎉 Validation de Succès

Votre buyback est réussi si :

1. ✅ Transaction `deposit_usdc()` confirmée
2. ✅ Transaction `initiate_buyback()` confirmée
3. ✅ Swap Jupiter exécuté (USDC → $BACK)
4. ✅ Transaction `finalize_buyback()` confirmée
5. ✅ Transaction `burn_back()` confirmée
6. ✅ Supply $BACK a diminué
7. ✅ USDC Vault balance = 0
8. ✅ BACK Vault balance = 0
9. ✅ `totalBackBurned` augmenté
10. ✅ `buybackCount` incrémenté

---

## 🐛 Troubleshooting

### Erreur: "Insufficient USDC balance"

```bash
# Solution: Obtenir des USDC devnet
# 1. Utilisez un autre wallet avec USDC
# 2. Ou utilisez un autre token SPL pour tester
# 3. Ou attendez l'accumulation naturelle via des swaps
```

### Erreur: "TimeLockNotElapsed"

```bash
# Solution: Attendre 1 heure ou modifier le code (pour tests)
# Dans programs/swapback_buyback/src/lib.rs:
# const MIN_TIME_BETWEEN_BUYBACKS: i64 = 60; // 60 secondes au lieu de 3600
```

### Erreur: "Account not found"

```bash
# Solution: Réinitialiser les comptes
node scripts/init-buyback-state-new.js
node scripts/initialize-back-vault-new.js
```

---

## 📚 Scripts Disponibles

| Script | Description |
|--------|-------------|
| `simulate-buyback-accumulation.js` | Dépose USDC et initie buyback |
| `test-buyback-100burn.js` | Teste la configuration et affiche métriques |
| `init-buyback-state-new.js` | Initialise BuybackState |
| `initialize-back-vault-new.js` | Initialise BACK Vault ATA |
| `check-buyback-state.js` | Affiche l'état actuel du système |

---

## 🚀 Prochaine Étape

Une fois le premier buyback réussi avec supply reduction observée, vous pouvez :

1. 📊 Intégrer les métriques au dashboard frontend
2. 🤖 Automatiser le processus complet (keeper bot)
3. 🔒 Passer à la Phase 6: Lock & Boost
4. 📈 Déployer sur mainnet

---

**🔥 Happy Burning! Réduisons cette supply ensemble ! 🚀**

