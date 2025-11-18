# 📜 On-Chain Transaction History

## 🎯 Vue d'ensemble

SwapBack inclut maintenant un système complet de visualisation de l'historique des transactions **directement depuis la blockchain Solana**. Contrairement au `TransactionHistory` existant qui utilise localStorage, cette nouvelle fonctionnalité récupère les vraies transactions on-chain.

## 📦 Composants disponibles

### 1. **OnChainHistory** (Page complète)

Composant de page complète avec toutes les fonctionnalités.

**Fichier**: `app/src/components/OnChainHistory.tsx`

**Utilisation**:
```tsx
import OnChainHistory from "@/components/OnChainHistory";

<OnChainHistory />
```

**Features**:
- ✅ Liste complète des transactions
- ✅ Détails expandables par transaction
- ✅ Changements de balance SOL
- ✅ Liste des instructions et programmes
- ✅ Liens vers multiples explorers (Solscan, Xray, Solana Explorer)
- ✅ Sélecteur de limite (10/25/50/100 transactions)
- ✅ Bouton refresh manuel
- ✅ Copie de signature
- ✅ Statistiques de succès/échec

### 2. **OnChainHistoryWidget** (Widget compact)

Version compacte pour intégration dans le dashboard.

**Fichier**: `app/src/components/OnChainHistoryWidget.tsx`

**Utilisation**:
```tsx
import OnChainHistoryWidget from "@/components/OnChainHistoryWidget";

// Compact mode (5 dernières transactions)
<OnChainHistoryWidget limit={5} compact={true} />

// Mode avec stats
<OnChainHistoryWidget limit={10} compact={false} />
```

**Props**:
- `limit` (number, défaut: 5): Nombre de transactions à afficher
- `compact` (boolean, défaut: true): Mode compact sans statistiques

### 3. **useOnChainHistory** (Hook personnalisé)

Hook pour récupérer l'historique programmatiquement.

**Fichier**: `app/src/hooks/useOnChainHistory.ts`

**Utilisation**:
```tsx
import { useOnChainHistory } from "@/hooks/useOnChainHistory";

function MyComponent() {
  const { 
    transactions, 
    isLoading, 
    error, 
    refresh 
  } = useOnChainHistory({
    limit: 50,
    autoRefresh: true,
    refreshInterval: 30000 // 30 secondes
  });

  return (
    <div>
      {transactions.map(tx => (
        <div key={tx.signature}>
          {tx.signature} - {tx.success ? "✅" : "❌"}
        </div>
      ))}
    </div>
  );
}
```

**Options**:
```typescript
interface UseOnChainHistoryOptions {
  limit?: number;                // Nombre de transactions (défaut: 10)
  programFilter?: PublicKey;     // Filtrer par programme
  autoRefresh?: boolean;         // Auto-refresh activé (défaut: false)
  refreshInterval?: number;      // Intervalle en ms (défaut: 30000)
}
```

## 🚀 Page dédiée

Une page dédiée est disponible à `/history` :

**Fichier**: `app/history/page.tsx`

**URL**: `https://votre-app.com/history`

## 📊 Structure des données

### Transaction Object

```typescript
interface OnChainTransaction {
  signature: string;              // Signature de la transaction
  blockTime: number | null;       // Timestamp Unix
  slot: number;                   // Numéro de slot Solana
  success: boolean;               // Transaction réussie ou échouée
  fee: number;                    // Frais en SOL
  instructions: {
    programId: string;
    type: string;
    data?: string;
  }[];
  balanceChanges: {
    account: string;
    before: number;
    after: number;
    change: number;
  }[];
  memo?: string;                  // Memo éventuel
}
```

## 🛠️ Fonctions utilitaires

### filterTransactionsByInstruction

Filtre les transactions par programme et type d'instruction.

```tsx
import { filterTransactionsByInstruction } from "@/hooks/useOnChainHistory";

const cnftProgram = process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID!;
const lockTransactions = filterTransactionsByInstruction(
  transactions,
  cnftProgram,
  "mint_level_nft"  // Type d'instruction spécifique
);
```

### getTransactionStats

Obtient des statistiques sur un ensemble de transactions.

```tsx
import { getTransactionStats } from "@/hooks/useOnChainHistory";

const stats = getTransactionStats(transactions);
console.log(stats);
// {
//   total: 50,
//   success: 48,
//   failed: 2,
//   totalFees: 0.025,
//   averageFee: 0.0005,
//   programCounts: {
//     "11111111111111111111111111111111": 100,
//     "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": 50,
//     // ...
//   }
// }
```

### useProgramTransactions

Hook spécialisé pour récupérer les transactions d'un programme spécifique.

```tsx
import { useProgramTransactions } from "@/hooks/useOnChainHistory";

const { transactions } = useProgramTransactions(
  process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID!,
  { limit: 20 }
);
```

## 🎨 Intégration dans le Dashboard

Exemple d'intégration dans une page dashboard :

```tsx
// app/dashboard/page.tsx
import OnChainHistoryWidget from "@/components/OnChainHistoryWidget";

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Autres widgets */}
      <div className="stat-card">
        <YourStatsComponent />
      </div>
      
      {/* Historique on-chain */}
      <OnChainHistoryWidget limit={5} compact={true} />
    </div>
  );
}
```

## 🔍 Programmes reconnus

Le système reconnaît automatiquement plusieurs programmes Solana :

- ✅ **System Program**: Transferts SOL
- ✅ **Token Program**: Opérations SPL Token
- ✅ **Associated Token**: Création d'ATA
- ✅ **Compute Budget**: Limites de calcul
- ✅ **SwapBack cNFT**: Votre programme de NFT
- ✅ **SwapBack Buyback**: Votre programme de buyback

Les programmes non reconnus affichent leur ID tronqué.

## 🌐 Liens vers explorers

Chaque transaction inclut des liens vers :

1. **Solscan**: `https://solscan.io/tx/{signature}`
2. **Helius Xray**: `https://xray.helius.xyz/tx/{signature}`
3. **Solana Explorer**: `https://explorer.solana.com/tx/{signature}`

## ⚡ Performance

- **Batching**: Les transactions sont récupérées par batch
- **Caching**: Les résultats sont mis en cache dans le state
- **Lazy Loading**: Détails chargés à la demande
- **Optimistic UI**: Interface réactive pendant le chargement

## 🔒 Sécurité

- ✅ Wallet connection requise
- ✅ Validation des données blockchain
- ✅ Gestion d'erreurs robuste
- ✅ Pas de données sensibles exposées

## 📱 Responsive

Tous les composants sont entièrement responsive :
- Mobile: Layout vertical adapté
- Tablet: Layout en grille 2 colonnes
- Desktop: Layout complet avec tous les détails

## 🚦 États gérés

- **Loading**: Spinner pendant le chargement
- **Error**: Message d'erreur avec retry
- **Empty**: Message quand aucune transaction
- **Success**: Liste complète avec détails

## 🔄 Auto-refresh

Le hook supporte l'auto-refresh :

```tsx
const { transactions } = useOnChainHistory({
  limit: 10,
  autoRefresh: true,
  refreshInterval: 30000 // Refresh toutes les 30 secondes
});
```

## 📝 Notes techniques

1. **RPC Limits**: Attention aux limites RPC si vous récupérez beaucoup de transactions
2. **Network**: Fonctionne sur devnet et mainnet selon votre configuration
3. **Versioned Transactions**: Support complet des transactions versionnées (v0)
4. **Max Transaction Version**: Configuré à 0 pour supporter les lookup tables

## 🎯 Cas d'usage

### Surveiller les locks cNFT
```tsx
const cnftTxs = filterTransactionsByInstruction(
  transactions,
  process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID!,
  "mint_level_nft"
);
```

### Afficher les derniers swaps
```tsx
<OnChainHistoryWidget limit={3} compact={true} />
```

### Page d'historique complète
```tsx
<OnChainHistory />
```

### Dashboard avec stats
```tsx
const stats = getTransactionStats(transactions);
<div>Total fees: {stats.totalFees} SOL</div>
```

## 🔮 Évolutions futures

- [ ] Filtrage par type de transaction
- [ ] Recherche par signature
- [ ] Export CSV/JSON
- [ ] Pagination infinie
- [ ] Graphiques de volume
- [ ] Notifications de nouvelles transactions
- [ ] Détection de programmes custom

---

**Note**: Cette fonctionnalité complète le `TransactionHistory` existant qui stocke les transactions localement. Les deux systèmes peuvent coexister :
- **TransactionHistory**: Historique local avec métadonnées custom (NPI, rebates, etc.)
- **OnChainHistory**: Historique blockchain vérifié et immuable

