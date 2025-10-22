# Dollar Cost Averaging (DCA)

## Vue d'ensemble

La fonctionnalité DCA (Dollar Cost Averaging) permet aux utilisateurs d'automatiser leurs investissements en exécutant des achats réguliers à des intervalles prédéfinis. Cette stratégie réduit l'impact de la volatilité en répartissant les achats dans le temps.

## Fonctionnalités

### 1. Création d'ordres DCA

Les utilisateurs peuvent créer des ordres DCA avec les paramètres suivants :

- **Token d'entrée** : Le token à dépenser (SOL, USDC, USDT, BACK)
- **Token de sortie** : Le token à acheter (SOL, USDC, USDT, BACK)
- **Montant par ordre** : Le montant à investir à chaque exécution
- **Fréquence** : L'intervalle entre chaque exécution
  - Horaire (Hourly)
  - Quotidienne (Daily)
  - Hebdomadaire (Weekly)
  - Mensuelle (Monthly)
- **Nombre total d'ordres** : Le nombre d'exécutions à effectuer

### 2. Gestion des ordres

#### États des ordres

- **Active** : L'ordre est en cours d'exécution
- **Paused** : L'ordre est temporairement suspendu
- **Completed** : Tous les ordres ont été exécutés
- **Cancelled** : L'ordre a été annulé par l'utilisateur

#### Actions disponibles

- **Pause/Resume** : Suspendre ou reprendre un ordre actif
- **Cancel** : Annuler définitivement un ordre

### 3. Suivi des performances

Pour chaque ordre, les utilisateurs peuvent suivre :

- **Progression** : Nombre d'ordres exécutés / total
- **Total investi** : Montant total déjà dépensé
- **Prix moyen** : Prix d'achat moyen obtenu
- **Prochaine exécution** : Date de la prochaine transaction
- **Date de création** : Quand l'ordre a été créé

### 4. Statistiques globales

Le dashboard affiche :

- **Ordres actifs** : Nombre d'ordres en cours
- **Total investi** : Montant total investi dans tous les ordres
- **Ordres complétés** : Nombre d'ordres terminés

## Interface utilisateur

### Design Terminal Hacker

L'interface DCA suit le thème Terminal Hacker avec :

- Fond noir (#000000)
- Texte vert terminal (#00ff00)
- Police monospace (Courier New)
- Bordures carrées (border-radius: 0)
- Préfixes `>` et brackets `[ACTION]`
- Labels en CAPS_WITH_UNDERSCORES

### Onglets

L'interface est organisée en deux onglets :

1. **[CREATE_DCA]** : Formulaire de création d'ordres
2. **[MY_ORDERS]** : Liste des ordres existants avec badge du nombre d'ordres actifs

### États vides

- **Pas de wallet** : Invite à connecter le wallet
- **Pas d'ordres** : Invite à créer le premier ordre DCA

## Architecture technique

### Composant principal

`/app/src/components/DCA.tsx`

### Hooks utilisés

- `useWallet` : Gestion de la connexion wallet
- `useTokenData` : Récupération des données de tokens (balance, etc.)
- `useState` : Gestion de l'état local
- `useEffect` : Chargement des ordres depuis localStorage

### Stockage

Les ordres DCA sont stockés dans localStorage avec la clé :

```
swapback_dca_${publicKey.toString()}
```

Format des données :

```typescript
interface DCAOrder {
  id: string;
  inputToken: string;
  outputToken: string;
  amountPerOrder: number;
  frequency: "hourly" | "daily" | "weekly" | "monthly";
  totalOrders: number;
  executedOrders: number;
  nextExecution: Date;
  status: "active" | "paused" | "completed" | "cancelled";
  createdAt: Date;
  totalInvested: number;
  averagePrice: number;
}
```

### Calcul de la prochaine exécution

```typescript
const calculateNextExecution = (freq: string): Date => {
  const now = new Date();
  switch (freq) {
    case "hourly":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "monthly":
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
};
```

## Intégration avec le Dashboard

Le composant DCA est intégré dans le Dashboard comme quatrième onglet :

- Overview
- Analytics
- Lock/Unlock
- **DCA** (nouveau)

## Prochaines étapes

### Fonctionnalités à implémenter

1. **Exécution on-chain**
   - Intégration avec les smart contracts Solana
   - Automatisation via Clockwork ou Gelato
   - Gestion des erreurs d'exécution

2. **Optimisation des prix**
   - Intégration avec l'agrégateur Jupiter
   - Calcul du meilleur moment d'exécution
   - Alertes de prix

3. **Historique détaillé**
   - Liste de toutes les exécutions
   - Graphiques de performance
   - Export des données

4. **Notifications**
   - Alertes d'exécution réussie/échouée
   - Rappels avant la fin d'un ordre
   - Notifications de prix atteints

5. **Stratégies avancées**
   - DCA inversé (vente progressive)
   - DCA conditionnel (basé sur le prix)
   - DCA avec stop-loss/take-profit

## Exemple d'utilisation

### Créer un ordre DCA

1. Aller dans Dashboard → [DCA]
2. Cliquer sur l'onglet [CREATE_DCA]
3. Sélectionner les tokens :
   - Input: SOL
   - Output: USDC
4. Entrer le montant : 0.1 SOL
5. Choisir la fréquence : [DAILY]
6. Définir le nombre d'ordres : 30
7. Cliquer sur [CREATE_DCA_ORDER]

Résultat :

- 30 ordres de 0.1 SOL → USDC
- Exécution quotidienne
- Investment total : 3 SOL
- Durée estimée : 30 jours

### Gérer un ordre existant

1. Aller dans l'onglet [MY_ORDERS]
2. Voir la progression de l'ordre
3. Actions disponibles :
   - [PAUSE] : Suspendre temporairement
   - [RESUME] : Reprendre l'exécution
   - [CANCEL] : Annuler définitivement

## Avantages du DCA

1. **Réduction du risque** : Évite d'acheter tout en haut du marché
2. **Automatisation** : Pas besoin de surveiller constamment
3. **Discipline** : Investissement régulier sans émotion
4. **Moyenne des prix** : Obtenir un meilleur prix moyen
5. **Simplicité** : Configuration une fois, exécution automatique

## Considérations

- Les ordres DCA nécessitent suffisamment de fonds dans le wallet
- Les frais de transaction s'appliquent à chaque exécution
- Le prix moyen peut varier en fonction de la volatilité du marché
- Les ordres peuvent échouer si le solde est insuffisant

## Support

Pour toute question ou problème :

- Consulter la documentation technique dans `/docs/TECHNICAL.md`
- Ouvrir une issue sur GitHub
- Contacter l'équipe SwapBack
