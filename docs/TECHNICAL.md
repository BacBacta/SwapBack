# Documentation Technique SwapBack

## Architecture des Programmes

### swapback_router

Le programme principal gère le routage, les remises et le verrouillage.

#### Structures de données

##### GlobalState

```rust
pub struct GlobalState {
    pub authority: Pubkey,           // Autorité admin
    pub rebate_percentage: u8,       // % remise (70-80)
    pub burn_percentage: u8,         // % burn (20-30)
    pub npi_threshold: u64,          // Seuil NPI pour bundles
    pub treasury: Pubkey,            // Trésorerie USDC
    pub total_volume: u64,           // Volume total traité
    pub total_npi: u64,              // NPI total généré
    pub total_rebates: u64,          // Remises distribuées
    pub bump: u8,                    // PDA bump
}
```

##### UserRebate

```rust
pub struct UserRebate {
    pub user: Pubkey,                // Utilisateur
    pub total_npi: u64,              // NPI accumulé
    pub pending_rebates: u64,        // Remises en attente
    pub total_claimed: u64,          // Remises réclamées
    pub swap_count: u64,             // Nombre de swaps
    pub locked_amount: u64,          // $BACK verrouillés
    pub lock_end_time: i64,          // Fin du lock
    pub rebate_boost: u8,            // Boost (0-50%)
    pub bump: u8,                    // PDA bump
}
```

#### Instructions

##### initialize

Initialise l'état global du protocole.

**Comptes :**
- `global_state` : PDA seeds = `["global_state"]`
- `authority` : Signer, admin du protocole
- `treasury` : Compte trésorerie USDC

**Paramètres :**
- `rebate_percentage: u8` : % du NPI pour les utilisateurs
- `burn_percentage: u8` : % du NPI pour le burn
- `npi_threshold: u64` : Seuil pour utiliser les bundles

##### execute_swap

Exécute un swap optimisé.

**Comptes :**
- `global_state` : Lecture/écriture
- `user_rebate` : Init si nécessaire, PDA seeds = `["user_rebate", user.key()]`
- `user_authority` : Signer

**Logique :**
1. Valide le montant et les comptes
2. Calcule rebate = NPI × rebate_percentage / 100
3. Calcule burn = NPI × burn_percentage / 100
4. Met à jour les stats utilisateur et globales
5. Émet l'event `SwapExecuted`

##### lock_back

Verrouille des $BACK pour obtenir un boost.

**Comptes :**
- `user_rebate` : Mut
- `user_token_account` : Source des tokens
- `lock_account` : Destination (PDA)
- `user_authority` : Signer

**Logique :**
1. Transfert des tokens vers le compte de lock
2. Calcul du boost selon montant et durée
3. Mise à jour du `UserRebate`

**Boost :**
- **Gold (50%)** : ≥10M $BACK, ≥365 jours
- **Silver (30%)** : ≥1M $BACK, ≥180 jours
- **Bronze (10%)** : ≥100K $BACK, ≥90 jours

##### claim_rewards

Réclame les remises accumulées.

**Comptes :**
- `user_rebate` : Mut
- `user_authority` : Signer

**Logique :**
1. Vérifie `pending_rebates > 0`
2. Transfère les remises
3. Met à jour `total_claimed`

### swapback_buyback

Gère le buyback et le burn de $BACK.

#### BuybackState

```rust
pub struct BuybackState {
    pub authority: Pubkey,           // Admin
    pub back_mint: Pubkey,           // Mint $BACK
    pub usdc_vault: Pubkey,          // Vault USDC
    pub min_buyback_amount: u64,     // Montant min pour buyback
    pub total_usdc_spent: u64,       // USDC dépensés
    pub total_back_burned: u64,      // $BACK brûlés
    pub buyback_count: u64,          // Nombre de buybacks
    pub bump: u8,
}
```

#### Instructions

##### execute_buyback

Achète $BACK avec les USDC accumulés.

**Intégration Jupiter :**
```rust
// Pseudo-code
let swap_ix = jupiter_swap(
    usdc_vault,
    back_vault,
    usdc_amount,
    min_back_amount
);
```

##### burn_back

Brûle les $BACK achetés.

**Logique :**
1. Vérifie l'autorité
2. Appelle `token::burn` avec signature PDA
3. Met à jour `total_back_burned`

## Service Oracle

### Endpoints

#### POST /simulate

Simule une route de swap.

**Request :**
```json
{
  "inputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "outputMint": "So11111111111111111111111111111111111111112",
  "inputAmount": "500000000",
  "slippage": 0.5,
  "userPubkey": "..."
}
```

**Response :**
```json
{
  "type": "Aggregator",
  "inputAmount": 500,
  "estimatedOutput": 2.45,
  "npi": 0.01,
  "rebateAmount": 0.0075,
  "burnAmount": 0.0025,
  "fees": 0.002,
  "priceImpact": 0.1
}
```

#### GET /stats/global

Stats globales du protocole.

**Response :**
```json
{
  "totalVolume": 1234567,
  "totalSwaps": 5678,
  "totalNPI": 24680,
  "totalRebates": 18510,
  "totalBurned": 6170
}
```

### Logique de Routage

```typescript
// 1. Obtenir quote Jupiter
const jupiterQuote = await getJupiterQuote(params);

// 2. Comparer avec route directe
const directRoute = await getDirectRoute(params);
const npi = jupiterQuote.outAmount - directRoute.outAmount;

// 3. Sélectionner le type de route
if (npi > threshold) {
  return 'Bundle'; // Jito bundle
} else if (multiHop) {
  return 'Aggregator';
} else if (hasRFQ) {
  return 'RFQ';
} else {
  return 'Direct';
}
```

## SDK

### SwapBackClient

Classe principale pour interagir avec les programmes.

#### Méthodes

##### simulateRoute

```typescript
async simulateRoute(
  inputMint: PublicKey,
  outputMint: PublicKey,
  inputAmount: number,
  slippage?: number
): Promise<RouteSimulation>
```

Appelle l'oracle pour simuler la meilleure route.

##### executeSwap

```typescript
async executeSwap(
  inputMint: PublicKey,
  outputMint: PublicKey,
  inputAmount: number,
  minimumOutput: number,
  route: RouteSimulation
): Promise<SwapResult>
```

Construit et envoie la transaction de swap.

##### getUserStats

```typescript
async getUserStats(
  userPubkey?: PublicKey
): Promise<UserStats>
```

Lit le compte `UserRebate` pour obtenir les stats.

##### lockTokens

```typescript
async lockTokens(
  amount: number,
  durationDays: number
): Promise<string>
```

Verrouille des $BACK pour obtenir un boost.

### SwapBackUtils

Fonctions utilitaires.

```typescript
// Calculer le boost
const boost = SwapBackUtils.calculateBoost(1000, 180); // 30%

// Calculer la remise
const rebate = SwapBackUtils.calculateRebate(100, 75, 30); // 97.5

// Convertir les montants
const native = SwapBackUtils.toNativeAmount(500, 6); // 500000000
```

## Tests

### Structure

```
tests/
├── swapback_router.test.ts
└── swapback_buyback.test.ts
```

### Exemple

```typescript
describe('swapback_router', () => {
  it('Initialise le programme', async () => {
    await program.methods
      .initialize(75, 25, new BN(1000))
      .accounts({...})
      .rpc();
  });

  it('Exécute un swap', async () => {
    const tx = await program.methods
      .executeSwap(new BN(500), new BN(2.4), new BN(0.01))
      .accounts({...})
      .rpc();
      
    expect(tx).toBeDefined();
  });
});
```

## Déploiement

### Devnet

```bash
# Build
anchor build

# Deploy
anchor deploy --provider.cluster devnet

# Vérifier
solana program show <PROGRAM_ID> --url devnet
```

### Mainnet

```bash
# Build en mode release
anchor build --verifiable

# Deploy
anchor deploy --provider.cluster mainnet

# Vérifier avec Anchor Verify
anchor verify <PROGRAM_ID>
```

## Sécurité

### Checklist

- [ ] Validation de tous les comptes (owner, signer)
- [ ] Vérification des soldes avant lecture
- [ ] Protection contre le reentrancy
- [ ] Limites de montants
- [ ] Tests de fuzzing
- [ ] Audit externe

### Ressources

- [Anchor Security](https://www.anchor-lang.com/docs/security)
- [Solana Security Best Practices](https://github.com/coral-xyz/sealevel-attacks)
- [SlowMist Guidelines](https://slowmist.medium.com/)
