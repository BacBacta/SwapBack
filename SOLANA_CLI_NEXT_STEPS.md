# 🚀 PROCHAINES ÉTAPES SELON SOLANA CLI

## 📊 ÉTAT ACTUEL (26 Oct 2025)

**Wallet**: 3PiZ1xdHbPbj1UaPS8pfzKnHpmQQLfR8zrhy5RcksqAt
**Solde**: 0.538 SOL ✅ (suffisant)

**Programmes Déployés**:
✅ CNFT: 9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw (260 KB)
✅ Router: GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt (296 KB)
✅ Buyback: EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf (356 KB)

**IDL Files**: 3/3 ✅ (CNFT, Buyback, Router)

---

## 🎯 ORDRE D'EXÉCUTION - COMMANDES SOLANA CLI

### 1️⃣ CRÉER TOKEN $BACK (5 min, ~0.004 SOL)

```bash
# Créer le token mint avec 9 décimales
spl-token create-token --decimals 9

# ⚠️ SAUVEGARDER l'adresse retournée!
# Exemple: Creating token 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
export BACK_MINT=<adresse_retournée>

# Créer token account pour le wallet
spl-token create-account $BACK_MINT

# Mint 1 milliard de tokens pour tests
spl-token mint $BACK_MINT 1000000000

# Vérifier
spl-token balance $BACK_MINT
# Output: 1000000000
```

**Coût**: ~0.00348 SOL  
**Résultat**: Token $BACK créé et prêt

---

### 2️⃣ CRÉER VAULTS POUR BUYBACK (5 min, ~0.006 SOL)

```bash
# Option A: Utiliser USDC Devnet officiel (si disponible)
USDC_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
spl-token create-account $USDC_MINT
export USDC_VAULT=<adresse_retournée>

# Option B: Créer Mock USDC (plus simple pour devnet)
spl-token create-token --decimals 6
export USDC_MOCK=<adresse_retournée>
spl-token create-account $USDC_MOCK
export USDC_VAULT=<adresse_retournée>
spl-token mint $USDC_MOCK 1000000  # 1M USDC mock

# Créer BACK vault pour buyback
spl-token create-account $BACK_MINT
export BACK_VAULT=<adresse_retournée>

# Vérifier les vaults
spl-token accounts
```

**Coût**: ~0.00608 SOL  
**Résultat**: 2 vaults créés (USDC + BACK)

---

### 3️⃣ INITIALISER ROUTER STATE (30 min, ~0.001 SOL)

```bash
# D'abord fixer les erreurs TypeScript
cd /workspaces/SwapBack

# Vérifier erreurs
npx tsc scripts/init-router-state.ts --noEmit

# Après correction, exécuter
ts-node scripts/init-router-state.ts

# Vérifier sur blockchain
# Le script affichera: Router State PDA: <address>
solana account <ROUTER_STATE_PDA>
```

**Blocker**: Erreurs TypeScript à corriger  
**Coût**: ~0.00089 SOL  
**Résultat**: Router State initialisé

---

### 4️⃣ INITIALISER BUYBACK STATE (20 min, ~0.001 SOL)

```bash
# Mettre à jour scripts/init-buyback-state.ts avec:
# - BACK_MINT (de étape 1)
# - USDC_VAULT (de étape 2)
# - BACK_VAULT (de étape 2)

# Exécuter
ts-node scripts/init-buyback-state.ts

# Vérifier
solana account <BUYBACK_STATE_PDA>
```

**Coût**: ~0.00089 SOL  
**Résultat**: Buyback State initialisé

---

### 5️⃣ CRÉER MERKLE TREE cNFT (10 min, ~0.05 SOL)

```bash
# Créer script simple
cat > scripts/init-merkle-tree.ts << 'SCRIPT'
import { Connection, Keypair } from '@solana/web3.js';
import { createTree } from '@metaplex-foundation/mpl-bubblegum';
import * as fs from 'fs';

async function main() {
  const connection = new Connection('https://api.devnet.solana.com');
  const payer = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf-8')))
  );

  const treeKeypair = Keypair.generate();
  
  const signature = await createTree(connection, payer, {
    treeKeypair,
    maxDepth: 14,  // 16,384 NFTs max
    maxBufferSize: 64,
  });

  console.log('✅ Merkle Tree:', treeKeypair.publicKey.toBase58());
  console.log('✅ Signature:', signature);
  
  fs.writeFileSync('merkle-tree-address.txt', treeKeypair.publicKey.toBase58());
}

main();
SCRIPT

# Exécuter
ts-node scripts/init-merkle-tree.ts

# Vérifier
TREE_ADDRESS=$(cat merkle-tree-address.txt)
solana account $TREE_ADDRESS
```

**Coût**: ~0.05 SOL  
**Résultat**: Merkle Tree créé (capacité 16K NFTs)

---

### 6️⃣ VÉRIFICATION FINALE (5 min, gratuit)

```bash
# Script de vérification complète
cat > check-all.sh << 'SCRIPT'
#!/bin/bash
echo "=== VÉRIFICATION SWAPBACK DEVNET ==="
echo ""
echo "💰 Solde Wallet:"
solana balance
echo ""
echo "�� Tokens:"
spl-token accounts | grep -E "(BACK|USDC)"
echo ""
echo "📦 Programmes:"
echo "CNFT: 9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw"
solana balance 9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw
echo "Router: GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt"
solana balance GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt
echo "Buyback: EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf"
solana balance EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
echo ""
echo "✅ VÉRIFICATION TERMINÉE"
SCRIPT

chmod +x check-all.sh
./check-all.sh
```

---

## 📊 RÉSUMÉ COÛTS

| Étape | Opération | Coût SOL |
|-------|-----------|----------|
| 1 | Créer $BACK + account + mint | 0.00348 |
| 2 | Créer USDC + BACK vaults | 0.00608 |
| 3 | Init Router State | 0.00089 |
| 4 | Init Buyback State | 0.00089 |
| 5 | Créer Merkle Tree | 0.05000 |
| **TOTAL** | | **~0.06 SOL** |

**Solde actuel**: 0.538 SOL ✅  
**Après exécution**: ~0.478 SOL (largement suffisant)

---

## ⚠️ POINTS D'ATTENTION

### Program ID Mismatch
Les `declare_id!` dans le code ≠ addresses déployées.  
**Workaround actuel**: IDL distribués via `app/public/idl/` ✅  
**À fixer avant mainnet**: Update declare_id! + redeploy

### Scripts TypeScript
**Blocker actuel**: `init-router-state.ts` a des erreurs de compilation  
**Action requise**: Fixer imports et types avant étape 3

### Airdrop si nécessaire
Si solde < 0.1 SOL:
```bash
solana airdrop 2  # Max 10 SOL/jour
```

---

## ✅ CHECKLIST EXÉCUTION

- [ ] Créer token $BACK (étape 1)
- [ ] Créer vaults USDC/BACK (étape 2)
- [ ] Fixer scripts TypeScript
- [ ] Init Router State (étape 3)
- [ ] Init Buyback State (étape 4)
- [ ] Créer Merkle Tree (étape 5)
- [ ] Vérification finale (étape 6)
- [ ] Documenter toutes les addresses
- [ ] Commit + push

---

## 🚀 APRÈS INITIALISATION

**Phase 11 Progression**: 50% → 100% (Task 5 complete)

**Prochaines tâches**:
- Task 6: Tests E2E (2-3 jours)
- Task 7: Déploiement Testnet (1-2 jours)
- Task 8: UAT (3 semaines)

**Commande testnet**:
```bash
solana config set --url https://api.testnet.solana.com
anchor deploy --provider.cluster testnet
```

---

**Prochaine commande immédiate**:
```bash
spl-token create-token --decimals 9
```
