# Interface DCA - Vue d'ensemble

## Navigation dans le Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│                          > DASHBOARD                                 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────┬────────────┬──────────────┬────────┐                  │
│  │[OVERVIEW]│[ANALYTICS] │[LOCK/UNLOCK] │ [DCA]  │ ◄── Nouvel onglet│
│  └──────────┴────────────┴──────────────┴────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Onglet DCA - Vue complète

### Header avec statistiques globales

```
╔═════════════════════════════════════════════════════════════════════╗
║              > DOLLAR_COST_AVERAGING                                ║
║  > AUTOMATE_YOUR_INVESTMENTS | BUY_REGULARLY_AT_OPTIMAL_PRICES     ║
╠═════════════════════════════════════════════════════════════════════╣
║  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          ║
║  │> ACTIVE_ORDERS│  │> TOTAL_INVESTED│  │>COMPLETED_ORDS│          ║
║  │      3        │  │   $1,234.56    │  │      12       │          ║
║  └───────────────┘  └───────────────┘  └───────────────┘          ║
╚═════════════════════════════════════════════════════════════════════╝
```

### Onglets de navigation

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌──────────────┬──────────────┬──────────────┐                    │
│  │>[CREATE_DCA] │>[MY_ORDERS]⓷ │>[SIMULATOR]  │                    │
│  └──────────────┴──────────────┴──────────────┘                    │
│          ▲              ▲              ▲                            │
│       Créer          Liste         Simuler                          │
│       ordre          ordres         résultats                       │
└─────────────────────────────────────────────────────────────────────┘
              ⓷ = Badge nombre d'ordres actifs
```

## Tab 1 : [CREATE_DCA]

```
╔═════════════════════════════════════════════════════════════════════╗
║                    > [CREATE_NEW_DCA_ORDER]                         ║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  > INPUT_TOKEN              > OUTPUT_TOKEN                         ║
║  ┌──────────────┐           ┌──────────────┐                       ║
║  │   [SOL]     ▼│           │  [USDC]     ▼│                       ║
║  └──────────────┘           └──────────────┘                       ║
║                                                                     ║
║  > AMOUNT_PER_ORDER                                                ║
║  ┌────────────────────────────────────┐                            ║
║  │ 0.00                               │                            ║
║  └────────────────────────────────────┘                            ║
║  BALANCE: 5.4321 SOL                                               ║
║                                                                     ║
║  > FREQUENCY                                                       ║
║  ┌─────────┬─────────┬─────────┬─────────┐                        ║
║  │[HOURLY] │[DAILY]  │[WEEKLY] │[MONTHLY]│                        ║
║  └─────────┴─────────┴─────────┴─────────┘                        ║
║            (sélectionné avec bordure verte)                        ║
║                                                                     ║
║  > TOTAL_ORDERS                                                    ║
║  ┌────────────────────────────────────┐                            ║
║  │ 10                                 │                            ║
║  └────────────────────────────────────┘                            ║
║                                                                     ║
║  ╔═══════════════════════════════════════╗                         ║
║  ║        > [ORDER_SUMMARY]              ║                         ║
║  ╠═══════════════════════════════════════╣                         ║
║  ║  TOTAL_INVESTMENT:     1.0000 SOL     ║                         ║
║  ║  ESTIMATED_DURATION:   10 DAYS        ║                         ║
║  ║  NEXT_EXECUTION:       ~1 DAY         ║                         ║
║  ╚═══════════════════════════════════════╝                         ║
║                                                                     ║
║  ┌───────────────────────────────────────┐                         ║
║  │    > [CREATE_DCA_ORDER]               │ ◄── Bouton principal    ║
║  └───────────────────────────────────────┘                         ║
║                                                                     ║
╚═════════════════════════════════════════════════════════════════════╝
```

## Tab 2 : [MY_ORDERS]

### État vide

```
╔═════════════════════════════════════════════════════════════════════╗
║                                                                     ║
║                      ┌────────────┐                                ║
║                      │     📊     │                                ║
║                      └────────────┘                                ║
║                                                                     ║
║                    > NO_DCA_ORDERS                                 ║
║         Create your first DCA order to start automated investing   ║
║                                                                     ║
║              ┌─────────────────────────────┐                       ║
║              │ > [CREATE_FIRST_ORDER]      │                       ║
║              └─────────────────────────────┘                       ║
║                                                                     ║
╚═════════════════════════════════════════════════════════════════════╝
```

### Avec ordres

```
╔═════════════════════════════════════════════════════════════════════╗
║  ┌─────┐  SOL → USDC                           [ACTIVE]            ║
║  │  🔄 │  0.1 SOL | EVERY_DAY                                      ║
║  └─────┘                                                            ║
║                                                                     ║
║  PROGRESS:  ████████░░░░░░░░░░  3 / 10 ORDERS                      ║
║                                                                     ║
║  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ ║
║  │TOTAL_INVESTED│ │   AVG_PRICE  │ │NEXT_EXECUTION│ │ CREATED  │ ║
║  │   $30.45     │ │   $101.50    │ │   Dec 24     │ │  Dec 21  │ ║
║  └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ ║
║                                                                     ║
║  ┌──────────────────┐  ┌──────────────────┐                       ║
║  │   > [PAUSE]      │  │   > [CANCEL]     │                       ║
║  └──────────────────┘  └──────────────────┘                       ║
╠═════════════════════════════════════════════════════════════════════╣
║  ┌─────┐  USDC → BACK                         [COMPLETED]          ║
║  │  🔄 │  100 USDC | EVERY_WEEK                                    ║
║  └─────┘                                                            ║
║                                                                     ║
║  PROGRESS:  ████████████████████  4 / 4 ORDERS                     ║
║                                                                     ║
║  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ ║
║  │TOTAL_INVESTED│ │   AVG_PRICE  │ │NEXT_EXECUTION│ │ CREATED  │ ║
║  │  $400.00     │ │    $0.0245   │ │     ---      │ │  Nov 23  │ ║
║  └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ ║
║                                                                     ║
╚═════════════════════════════════════════════════════════════════════╝
```

## Tab 3 : [SIMULATOR]

```
╔═════════════════════════════════════════════════════════════════════╗
║                      > [DCA_SIMULATOR]                              ║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  > AMOUNT_PER_PURCHASE ($)      > FREQUENCY                        ║
║  ┌──────────────────┐            ┌──────────────┐                  ║
║  │ 100              │            │  [WEEKLY]   ▼│                  ║
║  └──────────────────┘            └──────────────┘                  ║
║                                                                     ║
║  > DURATION (MONTHS)            > INITIAL_PRICE ($)                ║
║  ┌──────────────────┐            ┌──────────────┐                  ║
║  │ 12               │            │  50          │                  ║
║  └──────────────────┘            └──────────────┘                  ║
║                                                                     ║
║  > VOLATILITY (%)                                                  ║
║  ├────●──────────────────────┤                                     ║
║                20%                                                  ║
║                                                                     ║
║  ╔═══════════════════════════════════════════════════════════════╗ ║
║  ║              > [SIMULATION_RESULTS]                           ║ ║
║  ╠═══════════════════════════════════════════════════════════════╣ ║
║  ║  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ║ ║
║  ║  │TOTAL_INVESTED: │  │ AVERAGE_PRICE: │  │  TOTAL_TOKENS: │  ║ ║
║  ║  │   $4,800.00    │  │    $52.13      │  │     92.08      │  ║ ║
║  ║  └────────────────┘  └────────────────┘  └────────────────┘  ║ ║
║  ║                                                               ║ ║
║  ║  ┌────────────────┐  ┌────────────────────────────────────┐  ║ ║
║  ║  │CURRENT_VALUE:  │  │      PROFIT / LOSS:                │  ║ ║
║  ║  │   $5,524.80    │  │  +$724.80        +15.10%           │  ║ ║
║  ║  └────────────────┘  └────────────────────────────────────┘  ║ ║
║  ╚═══════════════════════════════════════════════════════════════╝ ║
║                                                                     ║
║  ╔═══════════════════════════════════════════════════════════════╗ ║
║  ║ > This is a simulated projection based on random price       ║ ║
║  ║   movements                                                   ║ ║
║  ║ > Actual results may vary significantly                      ║ ║
║  ║ > Past performance does not guarantee future results         ║ ║
║  ╚═══════════════════════════════════════════════════════════════╝ ║
║                                                                     ║
╚═════════════════════════════════════════════════════════════════════╝
```

## Légende des couleurs

```
┌─────────────────────────────────────────────────────────────────┐
│  Couleur         │  Usage                                        │
├─────────────────────────────────────────────────────────────────┤
│  #00ff00 (vert)  │  Texte principal, bordures, états actifs     │
│  #000000 (noir)  │  Fond de page, cartes                        │
│  Jaune           │  État PAUSED                                  │
│  Bleu            │  État COMPLETED                               │
│  Rouge           │  État CANCELLED, bouton CANCEL, pertes       │
│  Vert clair      │  Profits, valeurs positives                  │
└─────────────────────────────────────────────────────────────────┘
```

## États visuels

### Bouton actif

```
┌────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  Fond vert/20
│ ▓▓▓  > [CREATE_DCA]       ▓▓▓ │  Bordure verte 2px
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└────────────────────────────────┘
```

### Bouton inactif (hover)

```
┌────────────────────────────────┐
│                                │  Fond transparent
│    > [MY_ORDERS]               │  Bordure verte/50 au hover
│                                │
└────────────────────────────────┘
```

### Barre de progression

```
PROGRESS: ████████░░░░░░░░░░░░░░ 30%
          │       │              │
          Complété│              Restant
                  Position actuelle
```

### Badge compteur

```
[MY_ORDERS] ⓷
            │
            Badge noir sur vert
            Nombre d'ordres actifs
```

## Responsive Breakpoints

```
Mobile (< 768px):
┌────────────┐
│ Grilles    │
│ 1 colonne  │
│            │
│ Tabs       │
│ Stack      │
│ vertical   │
└────────────┘

Tablet (768-1024px):
┌─────────────────┐
│ Grilles         │
│ 2 colonnes      │
│                 │
│ Tabs horizontal │
└─────────────────┘

Desktop (> 1024px):
┌───────────────────────────┐
│ Grilles 3-4 colonnes      │
│                           │
│ Tabs horizontal large     │
└───────────────────────────┘
```

## Workflow utilisateur

```
1. Connexion wallet
   │
   ├─> Dashboard → [DCA]
   │
2. [SIMULATOR] (optionnel)
   │ • Tester paramètres
   │ • Voir projections
   │
3. [CREATE_DCA]
   │ • Sélectionner tokens
   │ • Définir montant
   │ • Choisir fréquence
   │ • Nombre d'ordres
   │ • Vérifier summary
   │ • [CREATE_DCA_ORDER]
   │
4. [MY_ORDERS]
   │ • Voir progression
   │ • Consulter stats
   │ • [PAUSE]/[RESUME]
   │ • [CANCEL] si besoin
   │
5. Suivi automatique
   │ • Exécutions périodiques
   │ • Mise à jour stats
   │ • Notifications (futur)
   │
6. Completion
   └─> État [COMPLETED]
       Badge bleu
       Actions désactivées
```

## Interactions clavier (accessibilité)

```
Tab           → Navigation entre champs
Shift+Tab     → Navigation inverse
Enter         → Submit formulaire / Valider action
Esc           → Annuler / Fermer modal
Space         → Sélectionner bouton/checkbox
Arrow Up/Down → Naviguer dans select
```

## Messages d'erreur

```
┌───────────────────────────────────────────────────┐
│  ⚠️  WALLET_NOT_CONNECTED                         │
│  Connect your wallet to use DCA feature           │
│  ┌─────────────────────────────┐                 │
│  │  > [CONNECT_WALLET]         │                 │
│  └─────────────────────────────┘                 │
└───────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────┐
│  ❌  INVALID_AMOUNT                               │
│  Please enter a valid amount                      │
└───────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────┐
│  ❌  INSUFFICIENT_BALANCE                         │
│  Your balance is insufficient for this order      │
└───────────────────────────────────────────────────┘
```

Cette vue d'ensemble montre l'interface complète de la fonctionnalité DCA avec tous ses états et interactions.
