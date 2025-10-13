# 🔍 Traçabilité Blockchain - SwapBack

## Vue d'ensemble

Le système de traçabilité blockchain de SwapBack permet d'enregistrer toutes les opérations effectuées sur la plateforme directement sur la blockchain Solana. Cela garantit une transparence totale et un audit immuable de toutes les transactions.

## Fonctionnalités

### 1. Types d'opérations tracées

- **SWAP** 🔄 : Échanges de tokens avec optimisation de route
- **LOCK** 🔒 : Verrouillage de tokens pour obtenir des boost de rebates
- **UNLOCK** 🔓 : Déverrouillage de tokens avec pénalités éventuelles
- **STAKE** 📈 : Mise en staking de tokens SwapBack
- **UNSTAKE** 📉 : Retrait de tokens du staking
- **CLAIM_REWARD** 💰 : Réclamation de récompenses et rebates
- **BURN** 🔥 : Brûlage de tokens (mécanisme déflationniste)

### 2. Informations enregistrées

Pour chaque opération, les informations suivantes sont stockées sur la blockchain :

```typescript
interface TracedOperation {
  id: string;                    // ID unique de l'opération
  type: OperationType;           // Type d'opération
  status: OperationStatus;       // Statut (SUCCESS, PENDING, FAILED)
  timestamp: number;             // Horodatage
  user: string;                  // Adresse publique de l'utilisateur
  signature: string;             // Signature de la transaction
  slot: number;                  // Slot blockchain
  blockTime: number;             // Temps du bloc
  
  // Métadonnées financières
  npi?: number;                  // Net Positive Impact
  rebate?: number;               // Montant du rebate
  burn?: number;                 // Montant brûlé
  fees?: number;                 // Frais de transaction
  
  // Détails spécifiques
  details?: SwapDetails | LockDetails | UnlockDetails | ...;
}
```

### 3. Détails par type d'opération

#### Swap
```typescript
interface SwapDetails {
  inputToken: string;            // Token d'entrée
  outputToken: string;           // Token de sortie
  inputAmount: number;           // Montant d'entrée
  outputAmount: number;          // Montant de sortie
  route: string[];               // Route d'exécution (Jupiter, Raydium, Orca)
  priceImpact: number;           // Impact sur le prix
  slippage: number;              // Slippage toléré
}
```

#### Lock
```typescript
interface LockDetails {
  token: string;                 // Token verrouillé
  amount: number;                // Montant verrouillé
  duration: number;              // Durée en jours
  unlockDate: number;            // Date de déverrouillage
  lockType: string;              // Type de lock
}
```

#### Unlock
```typescript
interface UnlockDetails {
  token: string;                 // Token déverrouillé
  amount: number;                // Montant déverrouillé
  lockId: string;                // ID du lock original
  penalty?: number;              // Pénalité appliquée
}
```

## Architecture technique

### Module SDK : `blockchain-tracer.ts`

Le tracer est implémenté dans le SDK SwapBack et expose les méthodes suivantes :

```typescript
// Initialisation
const tracer = createBlockchainTracer(connection, programId);

// Traçage des opérations
const operation = await tracer.traceSwap(userPubkey, swapDetails, metadata);
const operation = await tracer.traceLock(userPubkey, lockDetails);
const operation = await tracer.traceUnlock(userPubkey, unlockDetails);
const operation = await tracer.traceBurn(userPubkey, burnDetails);

// Récupération de l'historique
const operations = await tracer.getOperationHistory(userPubkey, {
  limit: 100,
  type: OperationType.SWAP
});

// Statistiques
const stats = await tracer.getUserStatistics(userPubkey);

// Export CSV
const csvPath = await tracer.exportHistoryToCSV(userPubkey, './history.csv');
```

### Hook React : `useBlockchainTracer`

Le hook fournit une interface simple pour intégrer le tracer dans les composants React :

```typescript
const {
  tracer,                        // Instance du tracer
  operations,                    // Liste des opérations
  loading,                       // État de chargement
  error,                         // Erreur éventuelle
  
  // Méthodes de traçage
  traceSwap,
  traceLock,
  traceUnlock,
  traceBurn,
  
  // Méthodes de récupération
  refreshOperations,
  getOperationBySignature,
  
  // Statistiques
  statistics,
  refreshStatistics
} = useBlockchainTracer();
```

### Composant UI : `OperationHistory`

Affiche l'historique des opérations avec :
- **Filtres** : Par type d'opération
- **Statistiques** : Volume total, économies, nombre d'opérations
- **Détails** : Pour chaque opération avec lien vers Solana Explorer
- **Actualisation** : Rechargement en temps réel

## Intégration dans SwapInterface

Le tracer est automatiquement appelé après chaque swap réussi :

```typescript
const handleExecuteSwap = async () => {
  // ... exécution du swap ...
  
  // 🔍 Traçage sur la blockchain
  const operation = await traceSwap(
    {
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      route,
      priceImpact,
      slippage
    },
    {
      npi: routeInfo.npi,
      rebate: routeInfo.rebate,
      burn: routeInfo.burn,
      fees: routeInfo.fees
    }
  );
  
  console.log('✅ Opération tracée:', operation.signature);
  console.log('🔗 Explorer:', `https://explorer.solana.com/tx/${operation.signature}`);
};
```

## Avantages de la traçabilité

### 1. **Transparence totale** 🔍
Tous les utilisateurs peuvent vérifier leurs opérations sur la blockchain Solana. Chaque opération est publique et immuable.

### 2. **Audit comptable** 📊
Export CSV pour la comptabilité et les rapports fiscaux. Tous les montants, frais, et rebates sont enregistrés.

### 3. **Preuve de performance** 📈
Les économies réalisées grâce à l'optimisation de routes sont mesurables et vérifiables.

### 4. **Historique complet** 📚
Conservation permanente de toutes les opérations sans limite de temps.

### 5. **Confiance** 🤝
Les utilisateurs peuvent vérifier que les promesses de SwapBack (NPI, rebates, optimisation) sont réellement tenues.

## Statistiques disponibles

Le tracer calcule automatiquement :

- **Total Swaps** : Nombre total de swaps effectués
- **Total Locks** : Nombre de locks actifs
- **Total Unlocks** : Nombre de unlocks effectués
- **Volume Total** : Volume cumulé en USD
- **Total Savings** : Économies totales réalisées (comparaison avec/sans optimisation)
- **First Operation** : Date de la première opération
- **Last Operation** : Date de la dernière opération

## Visualisation sur Solana Explorer

Chaque opération inclut un lien direct vers Solana Explorer :

```
https://explorer.solana.com/tx/{signature}?cluster=devnet
```

Les utilisateurs peuvent :
- Voir les détails de la transaction
- Vérifier les comptes impliqués
- Consulter les instructions du programme
- Vérifier le statut de confirmation

## Sécurité et confidentialité

- ✅ **Données on-chain** : Toutes les opérations sont stockées sur Solana
- ✅ **Immuabilité** : Les données ne peuvent pas être modifiées ou supprimées
- ✅ **Pseudonymat** : Seules les adresses publiques sont visibles
- ✅ **Open source** : Le code du tracer est auditable

## Roadmap

### Phase actuelle ✅
- [x] Module blockchain-tracer.ts complet
- [x] Hook useBlockchainTracer React
- [x] Intégration dans SwapInterface
- [x] Composant OperationHistory
- [x] Statistiques utilisateur

### Prochaines étapes 🚀
- [ ] Export CSV avec formatage avancé
- [ ] Notifications push pour nouvelles opérations
- [ ] Dashboard analytique avec graphiques
- [ ] API REST pour accès externe
- [ ] Intégration avec outils comptables (QuickBooks, Xero)
- [ ] Rapports fiscaux automatisés
- [ ] Comparaison de performance avec d'autres plateformes

## Utilisation

### 1. Effectuer un swap

```typescript
// Le swap est automatiquement tracé
const result = await handleExecuteSwap();
// ✅ L'opération est enregistrée sur la blockchain
```

### 2. Consulter l'historique

```typescript
// Accéder à l'onglet "Historique" dans l'interface
// Les opérations sont chargées automatiquement
```

### 3. Filtrer les opérations

```typescript
// Utiliser les boutons de filtre par type
// SWAP, LOCK, UNLOCK, etc.
```

### 4. Exporter les données

```typescript
// Bouton "Exporter CSV" (à venir)
const csv = await tracer.exportHistoryToCSV(publicKey, './export.csv');
```

## Support

Pour toute question sur la traçabilité blockchain :
- Documentation technique : `/docs/TECHNICAL.md`
- Code source : `/sdk/src/blockchain-tracer.ts`
- Examples : `/app/src/hooks/useBlockchainTracer.ts`

---

**SwapBack** - Traçabilité transparente, confiance maximale 🔍✨
