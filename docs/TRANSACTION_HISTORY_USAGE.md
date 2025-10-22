# Utilisation de Transaction History avec Lock/Unlock et DCA

## Import des fonctions helper

```typescript
import {
  addLockTransaction,
  addUnlockTransaction,
  addDCATransaction,
} from "@/components/TransactionHistory";
```

## Exemple dans LockUnlock.tsx

```typescript
// Après une transaction Lock réussie
const handleLock = async () => {
  // ... votre logique de lock ...
  
  const signature = await sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature);
  
  // Ajouter à l'historique
  if (publicKey) {
    addLockTransaction(publicKey.toString(), {
      signature,
      inputAmount: parseFloat(lockAmount),
      lockDuration: parseInt(lockDuration),
      lockLevel: level, // "Bronze", "Silver", ou "Gold"
      lockBoost: boost, // 10, 30, ou 50
      status: "success",
    });
  }
};

// Après une transaction Unlock réussie
const handleUnlock = async () => {
  // ... votre logique de unlock ...
  
  const signature = await sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature);
  
  // Ajouter à l'historique
  if (publicKey && cnftData) {
    addUnlockTransaction(publicKey.toString(), {
      signature,
      outputAmount: cnftData.lockedAmount,
      lockLevel: levelName,
      status: "success",
    });
  }
};
```

## Exemple dans DCA.tsx

```typescript
// Après l'exécution d'un swap DCA
const executeDCASwap = async () => {
  // ... votre logique de DCA ...
  
  const signature = await sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature);
  
  // Ajouter à l'historique
  if (publicKey) {
    addDCATransaction(publicKey.toString(), {
      signature,
      inputToken: "USDC",
      outputToken: "SOL",
      inputAmount: amountPerSwap,
      outputAmount: receivedAmount,
      dcaInterval: intervalDays,
      dcaSwapsExecuted: currentSwap,
      dcaTotalSwaps: totalSwaps,
      status: "success",
    });
  }
};
```

## Affichage de l'historique

```typescript
import { TransactionHistory } from "@/components/TransactionHistory";

// Dans votre composant
<TransactionHistory />
```

## Filtres disponibles

- **ALL** : Toutes les transactions
- **SWAP** : Swaps classiques
- **LOCK** : Verrouillages de tokens
- **UNLOCK** : Déverrouillages de tokens
- **DCA** : Swaps DCA automatiques

## Informations affichées

### Pour Lock/Unlock
- ✅ Niveau (Bronze/Silver/Gold)
- ✅ Durée de verrouillage (en jours)
- ✅ Boost (pourcentage)
- ✅ Montant verrouillé/déverrouillé

### Pour DCA
- ✅ Intervalle entre swaps (en jours)
- ✅ Progression (swaps exécutés / total)
- ✅ Montants d'entrée/sortie
- ✅ Tokens échangés

### Icônes
- 🔄 SWAP
- 🔒 LOCK
- 🔓 UNLOCK
- 📊 DCA
