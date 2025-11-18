# 📜 Historique On-Chain - SwapBack

> **Version 2.0** - Système complet de visualisation des transactions blockchain

## 🎯 Vue d'ensemble

L'historique on-chain de SwapBack permet de visualiser et d'analyser toutes vos transactions Solana directement depuis la blockchain. Contrairement à un historique local, ces données sont **vérifiées et immuables**.

## ⚡ Quick Start

### Option 1: Page complète
```
Naviguez vers /history
```

### Option 2: Widget dans votre code
```tsx
import OnChainHistoryWidget from "@/components/OnChainHistoryWidget";

<OnChainHistoryWidget limit={10} compact={false} />
```

### Option 3: Hook personnalisé
```tsx
const { transactions, refresh } = useOnChainHistory({ limit: 20 });
```

## 🚀 Fonctionnalités

### ✅ Implémenté

| Feature | Description | Status |
|---------|-------------|--------|
| **Filtrage avancé** | Recherche, statut, programme | ✅ |
| **Export CSV** | Téléchargement de l'historique | ✅ |
| **Graphique volume** | Chart 7 jours avec stats | ✅ |
| **Widget Dashboard** | Intégration Analytics tab | ✅ |
| **Navigation** | Lien menu principal | ✅ |
| **Program filter** | Dropdown avec tous les programmes | ✅ |
| **Transaction details** | Expand/collapse avec détails | ✅ |
| **Explorer links** | Solscan, Xray, Explorer | ✅ |

### 🔮 Roadmap

| Feature | Priorité | Estimation |
|---------|----------|------------|
| Pagination infinie | Haute | 2h |
| WebSocket updates | Moyenne | 4h |
| Date range filter | Haute | 2h |
| Notifications | Basse | 3h |
| Export JSON/PDF | Basse | 2h |
| Chart interactif | Moyenne | 4h |

## 📦 Composants

### 1. OnChainHistory
**Page complète** avec toutes les fonctionnalités.

```tsx
import OnChainHistory from "@/components/OnChainHistory";

<OnChainHistory />
```

**Features:**
- Filtres multiples (recherche, statut, programme)
- Export CSV
- Graphique de volume
- Liste détaillée expandable
- Stats agrégées

### 2. OnChainHistoryWidget
**Widget compact** pour intégration.

```tsx
import OnChainHistoryWidget from "@/components/OnChainHistoryWidget";

<OnChainHistoryWidget 
  limit={5}      // Nombre de transactions
  compact={true} // Mode compact
/>
```

**Features:**
- Quick stats (success rate, fees, count)
- Dernières N transactions
- Lien vers page complète
- Refresh manuel

### 3. TransactionVolumeChart
**Graphique** de volume quotidien.

```tsx
import TransactionVolumeChart from "@/components/TransactionVolumeChart";

<TransactionVolumeChart transactions={transactions} />
```

**Features:**
- Bar chart 7 derniers jours
- Tooltips interactifs
- Stats résumées (total, success rate, fees)
- Responsive

### 4. useOnChainHistory
**Hook** pour fetch programmatique.

```tsx
import { useOnChainHistory } from "@/hooks/useOnChainHistory";

const { 
  transactions,   // Array de transactions
  isLoading,      // État de chargement
  error,          // Erreur éventuelle
  refresh         // Fonction de refresh
} = useOnChainHistory({
  limit: 20,
  autoRefresh: true,
  refreshInterval: 30000
});
```

**Options:**
```typescript
interface UseOnChainHistoryOptions {
  limit?: number;            // Défaut: 10
  programFilter?: PublicKey; // Filtrer par programme
  autoRefresh?: boolean;     // Défaut: false
  refreshInterval?: number;  // Défaut: 30000ms
}
```

## 🎨 Interface

### Filtres

#### Recherche
- Par signature
- Par slot
- Par programme

#### Statut
- All
- ✅ Success only
- ❌ Failed only

#### Programme
- Dropdown avec tous les programmes détectés
- Programmes reconnus automatiquement

### Actions

#### Export
- **CSV**: Format Excel/Sheets
- Colonnes: Signature, Timestamp, Slot, Status, Fee, Instructions, Programs

#### Navigation
- **Expand/Collapse**: Cliquer sur une transaction
- **Explorer links**: Solscan, Xray, Solana Explorer
- **Copy signature**: Bouton copy dans les détails

## 📊 Données

### Transaction Object
```typescript
interface OnChainTransaction {
  signature: string;
  blockTime: number | null;
  slot: number;
  success: boolean;
  fee: number;
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
  memo?: string;
}
```

### Métriques Calculées
- Total transactions
- Success rate (%)
- Total fees (SOL)
- Average fee (SOL)
- Program usage counts

## 🔧 Configuration

### Variables d'Environnement

```env
NEXT_PUBLIC_CNFT_PROGRAM_ID=AaN2BwpGWbvDo7NHfpyC6zGYxsbg2xtcikToW9xYy4Xq
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=H3Wz4RrhtMNPJf7e3ztGPuMkA7XsQcjvSpzEbPnb6hPL
```

### RPC Configuration

Le système utilise la connection RPC du wallet adapter.

**Limits à considérer:**
- getSignaturesForAddress: Rate limited
- getParsedTransaction: Coûteuse en compute

**Recommandations:**
- Utilisez `limit` pour contrôler le nombre de transactions
- Activez `autoRefresh` avec précaution
- Considérez un RPC premium pour usage intensif

## 📱 Routes

### `/history`
Page dédiée accessible depuis le menu.

**Features:**
- Vue complète
- Tous les filtres
- Export CSV
- Graphique

### Dashboard → Analytics
Widget intégré dans l'onglet Analytics.

**Features:**
- 10 dernières transactions
- Stats rapides
- Lien vers /history

## 🎯 Use Cases

### 1. Audit Personnel
```tsx
// Voir toutes mes transactions
<OnChainHistory />
// Rechercher une transaction spécifique
<input value="signature..." />
```

### 2. Monitoring Programme
```tsx
// Transactions du programme cNFT uniquement
const { transactions } = useProgramTransactions(
  CNFT_PROGRAM_ID,
  { limit: 50 }
);
```

### 3. Analyse Performance
```tsx
// Taux de succès sur 7 jours
<TransactionVolumeChart transactions={transactions} />
```

### 4. Comptabilité
```tsx
// Exporter pour déclaration fiscale
<button onClick={exportToCSV}>
  📥 Export CSV
</button>
```

### 5. Dashboard Exécutif
```tsx
// Vue d'ensemble dans dashboard
<OnChainHistoryWidget limit={10} compact={false} />
```

## 🐛 Troubleshooting

### Transactions ne se chargent pas
- Vérifier la connexion RPC
- Réduire `limit`
- Vérifier wallet connecté

### Export CSV vide
- Désactiver les filtres
- Vérifier qu'il y a des transactions
- Essayer avec "All" / "All Programs"

### Graphique vide
- Besoin d'au moins 1 transaction avec blockTime
- Vérifier `transactions.length > 0`
- Attendre le chargement complet

## 📚 Documentation

- [Guide complet](./ON_CHAIN_HISTORY.md)
- [Quick Start](./ON_CHAIN_HISTORY_QUICKSTART.md)
- [Améliorations v2](./ON_CHAIN_HISTORY_IMPROVEMENTS.md)

## 🔗 Liens Utiles

### Code Source
- [OnChainHistory.tsx](/app/src/components/OnChainHistory.tsx)
- [useOnChainHistory.ts](/app/src/hooks/useOnChainHistory.ts)
- [OnChainHistoryWidget.tsx](/app/src/components/OnChainHistoryWidget.tsx)
- [TransactionVolumeChart.tsx](/app/src/components/TransactionVolumeChart.tsx)

### Explorers
- [Solscan](https://solscan.io)
- [Helius Xray](https://xray.helius.xyz)
- [Solana Explorer](https://explorer.solana.com)

## 🎉 Changelog

### v2.0 (2025-11-18)
- ✅ Filtrage avancé (recherche, statut, programme)
- ✅ Export CSV
- ✅ Graphique de volume 7 jours
- ✅ Intégration Dashboard
- ✅ Navigation menu
- ✅ Stats améliorées

### v1.0 (2025-11-18)
- ✅ Composant OnChainHistory
- ✅ Hook useOnChainHistory
- ✅ Widget compact
- ✅ Page /history
- ✅ Explorer links

---

**Développé par**: SwapBack Team  
**License**: MIT  
**Support**: [GitHub Issues](https://github.com/BacBacta/SwapBack/issues)

