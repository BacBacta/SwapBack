# 🚀 Quick Start - On-Chain History

## Installation rapide

Aucune installation nécessaire ! Les composants sont déjà intégrés.

## 3 façons d'utiliser l'historique on-chain

### 1️⃣ Page complète dédiée

La façon la plus simple - une page prête à l'emploi :

```bash
# Naviguez vers
/history
```

C'est tout ! La page affiche automatiquement l'historique du wallet connecté.

### 2️⃣ Widget dans votre page

Intégrez le widget n'importe où :

```tsx
// Dans n'importe quel composant
import OnChainHistoryWidget from "@/components/OnChainHistoryWidget";

export default function MyPage() {
  return (
    <div>
      <h1>Mon Dashboard</h1>
      
      {/* Widget compact - 5 dernières transactions */}
      <OnChainHistoryWidget />
      
      {/* Ou avec plus de détails */}
      <OnChainHistoryWidget limit={10} compact={false} />
    </div>
  );
}
```

### 3️⃣ Hook personnalisé

Pour un contrôle total :

```tsx
import { useOnChainHistory } from "@/hooks/useOnChainHistory";

export default function MyComponent() {
  const { transactions, isLoading, refresh } = useOnChainHistory({
    limit: 20
  });

  if (isLoading) return <div>Chargement...</div>;

  return (
    <div>
      <button onClick={refresh}>Rafraîchir</button>
      {transactions.map(tx => (
        <div key={tx.signature}>
          <a href={`https://solscan.io/tx/${tx.signature}`}>
            {tx.signature.slice(0, 8)}... 
            {tx.success ? "✅" : "❌"}
          </a>
        </div>
      ))}
    </div>
  );
}
```

## ⚡ Exemples courants

### Surveiller les transactions d'un programme

```tsx
import { useProgramTransactions } from "@/hooks/useOnChainHistory";

const { transactions } = useProgramTransactions(
  process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID!
);
```

### Filtrer par type d'instruction

```tsx
import { filterTransactionsByInstruction } from "@/hooks/useOnChainHistory";

const lockTxs = filterTransactionsByInstruction(
  transactions,
  cnftProgramId,
  "mint_level_nft"
);
```

### Obtenir des statistiques

```tsx
import { getTransactionStats } from "@/hooks/useOnChainHistory";

const stats = getTransactionStats(transactions);
console.log(`Taux de succès: ${(stats.success / stats.total * 100).toFixed(1)}%`);
console.log(`Frais moyens: ${stats.averageFee.toFixed(6)} SOL`);
```

### Auto-refresh toutes les 30 secondes

```tsx
const { transactions } = useOnChainHistory({
  autoRefresh: true,
  refreshInterval: 30000
});
```

## 📊 Données disponibles

Chaque transaction contient :

```typescript
{
  signature: "5j7s...",           // Signature unique
  blockTime: 1700000000,          // Timestamp Unix
  slot: 12345678,                 // Numéro de slot
  success: true,                  // Succès ou échec
  fee: 0.000005,                  // Frais en SOL
  instructions: [...],            // Liste des instructions
  balanceChanges: [...],          // Changements de balance
  memo: "..."                     // Memo optionnel
}
```

## 🎯 Use Cases

### Dashboard utilisateur
```tsx
<div className="grid grid-cols-2 gap-4">
  <YourBalanceCard />
  <OnChainHistoryWidget limit={5} />
</div>
```

### Page d'activité complète
```tsx
import OnChainHistory from "@/components/OnChainHistory";

export default function ActivityPage() {
  return <OnChainHistory />;
}
```

### Surveillance de programme
```tsx
const cnftTxs = useProgramTransactions(CNFT_PROGRAM_ID);
// Afficher uniquement les transactions cNFT
```

### Notifications de nouvelles transactions
```tsx
const { transactions } = useOnChainHistory({ 
  autoRefresh: true,
  refreshInterval: 10000 
});

useEffect(() => {
  if (transactions.length > previousCount) {
    toast.success("Nouvelle transaction détectée !");
  }
}, [transactions.length]);
```

## 🔗 Liens utiles

- [Documentation complète](/docs/ON_CHAIN_HISTORY.md)
- [Code du composant](/app/src/components/OnChainHistory.tsx)
- [Code du hook](/app/src/hooks/useOnChainHistory.ts)

## 💡 Tips

1. **Performance**: Utilisez `limit` pour limiter le nombre de transactions
2. **RPC**: Attention aux limites de votre RPC provider
3. **Loading states**: Gérez toujours `isLoading` pour une meilleure UX
4. **Errors**: Affichez `error` si présent
5. **Auto-refresh**: Utilisez avec modération pour ne pas surcharger le RPC

## 🆚 vs TransactionHistory

| Feature | OnChainHistory | TransactionHistory (existant) |
|---------|----------------|-------------------------------|
| Source | Blockchain Solana | localStorage |
| Fiabilité | 100% vérifié | Dépend du client |
| Métadonnées | Basiques | Enrichies (NPI, rebates) |
| Persistence | Permanente | Locale seulement |
| Performance | RPC dépendant | Instantané |

**Recommandation**: Utilisez les deux !
- OnChainHistory pour la vérité absolue
- TransactionHistory pour les détails enrichis

---

**Besoin d'aide ?** Consultez la [documentation complète](./ON_CHAIN_HISTORY.md)
