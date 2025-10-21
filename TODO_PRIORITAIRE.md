# ✅ TODO Liste Priorisée - SwapBack

**Date de création** : 19 octobre 2025  
**Dernière mise à jour** : 19 octobre 2025 16:30 UTC  
**Statut projet** : 🟡 MVP en développement  
**Objectif** : Production mainnet dans 6-10 semaines

---

## � Progression Globale

| TODO                  | Statut        | Priorité | Temps Estimé | Bloqueurs |
| --------------------- | ------------- | -------- | ------------ | --------- |
| #1 Build Stabilisé    | ✅ COMPLÉTÉ   | P0       | -            | -         |
| #2 Déploiement Devnet | ✅ COMPLÉTÉ   | P0       | -            | -         |
| #3 Token $BACK        | ⏳ EN ATTENTE | P0       | 4-6h         | -         |
| #4 Oracle Prix Réel   | ✅ COMPLÉTÉ   | P0       | -            | -         |
| #5 Tests E2E          | ⏳ EN ATTENTE | P0       | 3-4h         | TODO #3   |
| #6-13 Intégrations    | ⏳ EN ATTENTE | P1-P2    | Variable     | TODO #5   |

---

## �🔥 AUJOURD'HUI (19 octobre 2025) - Priorité P0

### ✅ 1. Build Stabilisé

- [x] Résoudre conflits dépendances Solana
- [x] Créer IDL manuel fonctionnel
- [x] Valider tests (188/188 pass)
- [x] Documentation analyse complète
- **Status** : ✅ **COMPLÉTÉ** (19 oct 2025 14:00)
- **Rapport** : `ANALYSE_COMPLETE.md`

### ✅ 2. Déployer Programmes sur Devnet

- [x] **2.1** Vérifier configuration Solana CLI
- [x] **2.2** Build avec cargo build-sbf (Rust 1.90)
- [x] **2.3** Déployer swapback_router
  - **Program ID** : `3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap`
  - **Signature** : `GHVAWajF3TdLLZzqQeWYCR8HgGLvhxpamY41WQn8JFCBDCdZBbXhT3g6ZG2YnKNTPvU1fX5fVMY2BnQdKePkSRi`
- [x] **2.4** Déployer swapback_buyback
  - **Program ID** : `46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU`
  - **Signature** : `61F1yF3rKnuMqRPyRuZnhm2xNwNPqt8dqKy93yKcAYXdx3dDyJg2YWxMGd6ksF7cPgBRUfhgWiHSVsJ3K8wfVYxd`
- [x] **2.5** Mettre à jour Program IDs
  - `.env`, `Anchor.toml`, `lib.rs` (Router + Buyback)
  - `target/idl/*.json`, `target/types/*.ts`
- [x] **2.6** Vérifier déploiements (both programs confirmed on-chain)
- [x] **2.7** Backup keypairs sécurisés (`backups/README_SECURITY.md`)

**Status** : ✅ **COMPLÉTÉ** (19 oct 2025 15:00)  
**Coût** : ~4 SOL (Router 2.00 SOL, Buyback 2.02 SOL)  
**Rapport** : `DEPLOYMENT_REPORT.md`

### ✅ 4. Oracle Prix Réel (Switchboard) - RÉORDONNÉ EN #3

- [x] **4.1** Activer feature Switchboard dans oracle.rs
- [x] **4.2** Supprimer mock price ($100 fixe)
- [x] **4.3** Corriger API Switchboard v0.30.4
  - `get_result()` → `Result` pas `Option`
  - `new_from_bytes()` pour lifetime safety
- [x] **4.4** Rebuild avec `--features switchboard`
- [x] **4.5** Redéployer Router sur devnet
  - **Signature** : `5AVbNTQjRgEy3ZYz3BZGW31nrT2sXfxrTHc1jr3NaasYoHJEnpJU1btvUwxMZcDWe5gJmqsqAASeB7Lw2ob3zHVj`
  - **Taille** : 363KB (+30% avec Switchboard compilé)
- [x] **4.6** Valider feed Switchboard SOL/USD
  - **Feed** : `GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR`
  - Test : `tests/verify-switchboard.ts` ✅
- [x] **4.7** Documenter intégration

**Status** : ✅ **COMPLÉTÉ** (19 oct 2025 16:15)  
**Impact** : 🎉 **Vulnérabilité P0 ÉLIMINÉE** (Oracle mock)  
**Rapport** : `TODO_4_COMPLETE.md`

---

## 🔴 CETTE SEMAINE (20-25 octobre) - P0 Bloquants

### 3. Créer Token $BACK Test sur Devnet (4-6h)

- [ ] **3.1** Créer keypair pour mint authority

  ```bash
  solana-keygen new -o ~/.config/solana/back-mint-authority.json
  ```

- [ ] **3.2** Créer Token-2022 mint

  ```bash
  spl-token create-token \
    --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
    --decimals 9 \
    ~/.config/solana/back-mint-authority.json
  # Sauvegarder MINT ADDRESS
  ```

- [ ] **3.3** Créer programme Transfer Hook
  - Fichier : `programs/back_transfer_hook/src/lib.rs`
  - Implémenter taxe 0.1% burn automatique
  - Interface Transfer Hook Token-2022

  ```rust
  #[program]
  pub mod back_transfer_hook {
      pub fn execute(ctx: Context<Execute>, amount: u64) -> Result<()> {
          // Burn 0.1% du montant transféré
          let burn_amount = amount.checked_div(1000).unwrap_or(0);
          // Logique burn...
      }
  }
  ```

- [ ] **3.4** Ajouter Transfer Hook au mint

  ```bash
  spl-token add-transfer-hook \
    <MINT_ADDRESS> \
    <HOOK_PROGRAM_ID>
  ```

- [ ] **3.5** Mint supply initial (1B tokens)

  ```bash
  # Créer ATA pour tester
  spl-token create-account <MINT_ADDRESS>

  # Mint 1 milliard de tokens
  spl-token mint <MINT_ADDRESS> 1000000000 \
    <TOKEN_ACCOUNT>
  ```

- [ ] **3.6** Tester burn automatique

  ```bash
  # Transfer entre 2 comptes
  spl-token transfer <MINT_ADDRESS> 1000 <DESTINATION>
  # Vérifier que 1 token a été brûlé (0.1% de 1000)
  spl-token supply <MINT_ADDRESS>
  ```

- [ ] **3.7** Mettre à jour .env
  ```properties
  BACK_TOKEN_MINT_ADDRESS=<MINT_ADDRESS_RÉEL>
  BACK_TRANSFER_HOOK_PROGRAM_ID=<HOOK_PROGRAM_ID>
  ```

**Priorité** : 🔴 **P0 CRITIQUE**  
**Temps estimé** : 4-6 heures  
**Bloquant pour** : Buyback, Lock/Unlock, Boost remise

---

### 4. Intégrer Oracle Prix Réel (6-8h)

**Option A : Switchboard (RECOMMANDÉ - Plus simple)**

- [ ] **4.1** Ajouter dépendance Switchboard

  ```toml
  # Cargo.toml
  switchboard-solana = "0.29.0"  # Compatible Solana 1.18
  ```

- [ ] **4.2** Modifier oracle.rs pour Switchboard
  - Fichier : `programs/swapback_router/src/oracle.rs`
  - Remplacer mock par vraie lecture Switchboard

  ```rust
  #[cfg(feature = "switchboard")]
  {
      let aggregator = AggregatorAccountData::new(oracle_account)?;
      let result = aggregator.get_result()?;
      let price = result.try_into()?;
      // Validation staleness, confidence...
  }
  ```

- [ ] **4.3** Tester avec feed Switchboard SOL/USD devnet
  ```
  SOL/USD Feed: GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR
  ```

**Option B : Pyth (Plus robuste mais complexe)**

- [ ] **4.1** Résoudre conflit versions Pyth
  - Attendre pyth-solana-receiver compatible Solana 1.18
  - Ou downgrade temporaire Solana à 1.17

- [ ] **4.2** Réactiver code Pyth commenté
  - Décommenter lignes 29-77 dans oracle.rs
  - Tester avec feed Pyth SOL/USD

- [ ] **4.3** Implémenter fallback multi-oracle

  ```rust
  pub fn read_price_with_fallback(
      pyth_account: &AccountInfo,
      switchboard_account: &AccountInfo,
      clock: &Clock
  ) -> Result<OracleObservation> {
      // Try Pyth first
      if let Ok(price) = read_pyth_price(pyth_account, clock) {
          return Ok(price);
      }
      // Fallback to Switchboard
      read_switchboard_price(switchboard_account, clock)
  }
  ```

- [ ] **4.4** Ajouter circuit breaker divergence prix

  ```rust
  const MAX_PRICE_DIVERGENCE_BPS: u64 = 500; // 5%

  if price_diff > MAX_PRICE_DIVERGENCE_BPS {
      return err!(ErrorCode::OraclePriceDivergence);
  }
  ```

- [ ] **4.5** Tests oracle réel
  ```bash
  anchor test -- --features switchboard
  ```

**Priorité** : 🔴 **P0 CRITIQUE**  
**Temps estimé** : 6-8 heures  
**Bloquant pour** : Tous les swaps, Calculs NPI, MEV protection

---

### 5. Tests On-Chain E2E (3-4h)

- [ ] **5.1** Unlock tests skipped
  - Fichier : `tests/on-chain-integration.test.ts`
  - Retirer `.skip()` sur les 6 tests

- [ ] **5.2** Configurer connexion devnet dans tests

  ```typescript
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  ```

- [ ] **5.3** Test initialize router

  ```typescript
  it("should initialize router state", async () => {
    const tx = await program.methods
      .initialize()
      .accounts({
        /* ... */
      })
      .rpc();

    const state = await program.account.routerState.fetch(statePDA);
    expect(state.authority.toString()).to.equal(wallet.publicKey.toString());
  });
  ```

- [ ] **5.4** Test create_plan

  ```typescript
  it("should create swap plan", async () => {
    const planId = new Uint8Array(32);
    crypto.randomFillSync(planId);

    const planData = {
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      inputAmount: new BN(1_000_000_000),
      minOutputAmount: new BN(90_000_000),
      // ...
    };

    await program.methods
      .createPlan(planId, planData)
      .accounts({
        /* ... */
      })
      .rpc();
  });
  ```

- [ ] **5.5** Test swap_toc (stub sans vraie exécution)

  ```typescript
  it("should execute swap_toc instruction", async () => {
    // Test que l'instruction compile et s'exécute
    // Sans vraie intégration DEX pour l'instant
    const args = {
      /* ... */
    };

    await program.methods
      .swapToc(args)
      .accounts({
        /* ... */
      })
      .rpc();
  });
  ```

- [ ] **5.6** Test buyback initialize
  ```typescript
  it("should initialize buyback program", async () => {
    await buybackProgram.methods
      .initialize(new BN(1_000_000))
      .accounts({
        /* ... */
      })
      .rpc();
  });
  ```

**Priorité** : 🔴 **P0 CRITIQUE**  
**Temps estimé** : 3-4 heures  
**Validation** : Programmes fonctionnent on-chain

---

## 🟠 SEMAINE PROCHAINE (26 oct - 1 nov) - P1 Critiques

### 6. Intégrer Jupiter Quote API Réelle (4-6h)

- [ ] **6.1** Remplacer mock dans oracle service
  - Fichier : `oracle/src/index.ts`
  - Supprimer données mockées

  ```typescript
  import axios from "axios";

  app.post("/simulate", async (req, res) => {
    const { inputMint, outputMint, amount } = req.body;

    const jupiterQuote = await axios.get("https://quote-api.jup.ag/v6/quote", {
      params: {
        inputMint,
        outputMint,
        amount,
        slippageBps: 50,
      },
    });

    res.json(jupiterQuote.data);
  });
  ```

- [ ] **6.2** Intégrer dans SDK LiquidityDataCollector
  - Fichier : `sdk/src/services/LiquidityDataCollector.ts`
  - Remplacer mocks par vrais appels API

  ```typescript
  async fetchJupiterQuote(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<JupiterQuote> {
    const response = await axios.get(/* ... */);
    return response.data;
  }
  ```

- [ ] **6.3** Supprimer sdk-mock.ts
  - Fichier : `app/src/lib/sdk-mock.ts`
  - Remplacer imports par vrais services SDK

- [ ] **6.4** Tester avec paires réelles
  ```bash
  curl -X POST http://localhost:3001/simulate \
    -H "Content-Type: application/json" \
    -d '{
      "inputMint": "So11111111111111111111111111111111111111112",
      "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "amount": "1000000000"
    }'
  ```

**Priorité** : 🟠 **P1 CRITIQUE**  
**Temps estimé** : 4-6 heures  
**Débloque** : Routage réel, Calculs NPI réels

---

### 7. Implémenter Jupiter CPI dans Programme (8-12h)

- [ ] **7.1** Ajouter dépendance Jupiter CPI

  ```toml
  # programs/swapback_router/Cargo.toml
  jupiter-cpi = { version = "0.1", features = ["cpi"] }
  ```

- [ ] **7.2** Créer module cpi_jupiter.rs
  - Fichier : `programs/swapback_router/src/cpi_jupiter.rs`

  ```rust
  use anchor_lang::prelude::*;
  use jupiter_cpi::program::Jupiter;

  pub fn execute_jupiter_swap(
      ctx: Context<ExecuteSwap>,
      amount_in: u64,
      minimum_amount_out: u64
  ) -> Result<u64> {
      let cpi_accounts = jupiter_cpi::cpi::accounts::Swap {
          jupiter_program: ctx.accounts.jupiter_program.to_account_info(),
          user_transfer_authority: ctx.accounts.user.to_account_info(),
          user_source_token_account: ctx.accounts.user_source.to_account_info(),
          user_destination_token_account: ctx.accounts.user_dest.to_account_info(),
          // ... autres comptes Jupiter requis
      };

      let cpi_ctx = CpiContext::new(
          ctx.accounts.jupiter_program.to_account_info(),
          cpi_accounts
      );

      jupiter_cpi::cpi::swap(cpi_ctx, amount_in, minimum_amount_out)?;

      Ok(minimum_amount_out) // Retourner montant reçu
  }
  ```

- [ ] **7.3** Intégrer dans swap_toc
  - Fichier : `programs/swapback_router/src/lib.rs`

  ```rust
  pub fn swap_toc(ctx: Context<SwapToC>, args: SwapArgs) -> Result<()> {
      // Valider oracle prix
      let oracle_price = oracle::read_price(&ctx.accounts.oracle, &clock)?;

      // Exécuter swap via Jupiter CPI
      let output_amount = cpi_jupiter::execute_jupiter_swap(
          ctx,
          args.input_amount,
          args.min_output_amount
      )?;

      // Calculer NPI
      let npi = calculate_npi(oracle_price, output_amount);

      // Emit event
      emit!(SwapExecuted { npi, output_amount });

      Ok(())
  }
  ```

- [ ] **7.4** Gérer comptes Jupiter dynamiques
  - Jupiter nécessite liste variable de comptes (pools, routes)
  - Utiliser `remaining_accounts`

  ```rust
  #[derive(Accounts)]
  pub struct SwapToC<'info> {
      // Comptes fixes...

      /// CHECK: Comptes Jupiter passés dynamiquement
      /// remaining_accounts contient tous les comptes de route
  }
  ```

- [ ] **7.5** Tester swap réel SOL→USDC sur devnet
  ```bash
  anchor test --skip-local-validator
  # Utilise devnet au lieu de local validator
  ```

**Priorité** : 🟠 **P1 CRITIQUE**  
**Temps estimé** : 8-12 heures  
**Débloque** : Swaps réels fonctionnels

---

### 8. Remplacer Mocks Dashboard (3-4h)

- [ ] **8.1** Connecter useRealtimeStats aux comptes réels
  - Fichier : `app/src/hooks/useRealtimeStats.ts`
  - Fetch RouterState PDA

  ```typescript
  const fetchRealStats = async () => {
    const statePDA = findProgramAddress(["router_state"]);
    const stateAccount = await program.account.routerState.fetch(statePDA);

    return {
      totalSwaps: stateAccount.totalSwaps.toNumber(),
      totalVolume: stateAccount.totalVolume.toNumber(),
      // ...
    };
  };
  ```

- [ ] **8.2** Fetch historique swaps depuis événements

  ```typescript
  const fetchRecentSwaps = async () => {
    const signatures = await connection.getSignaturesForAddress(programId);
    const txs = await connection.getParsedTransactions(signatures);

    return txs.map((tx) => ({
      timestamp: tx.blockTime * 1000,
      inputAmount: parseInputAmount(tx),
      outputAmount: parseOutputAmount(tx),
      // ...
    }));
  };
  ```

- [ ] **8.3** Supprimer toutes les données mockées
  - Rechercher : `mockStats`, `MOCK`, `// MOCK`
  - Remplacer par vraies requêtes blockchain

**Priorité** : 🟠 **P1 CRITIQUE**  
**Temps estimé** : 3-4 heures  
**Débloque** : Dashboard affiche vraies données

---

### 9. Compléter Orca Whirlpool CPI (6-8h)

- [ ] **9.1** Finaliser cpi_orca.rs
  - Fichier : `programs/swapback_router/src/cpi_orca.rs`
  - Remplacer stub par vraie implémentation

  ```rust
  use whirlpool::cpi as whirlpool_cpi;

  pub fn execute_orca_swap(
      ctx: Context<OrcaSwap>,
      amount: u64,
      sqrt_price_limit: u128
  ) -> Result<u64> {
      let cpi_accounts = whirlpool_cpi::accounts::Swap {
          whirlpool: ctx.accounts.whirlpool.to_account_info(),
          token_authority: ctx.accounts.authority.to_account_info(),
          token_owner_account_a: ctx.accounts.token_a.to_account_info(),
          token_owner_account_b: ctx.accounts.token_b.to_account_info(),
          // ...
      };

      whirlpool_cpi::swap(
          CpiContext::new(ctx.accounts.whirlpool_program, cpi_accounts),
          amount,
          0, // amount_other_threshold
          sqrt_price_limit,
          true, // amount_specified_is_input
          true  // a_to_b
      )?;

      Ok(amount) // Calculer réel output
  }
  ```

- [ ] **9.2** Ajouter routing logic
  - Déterminer quand utiliser Orca vs Jupiter
  - Based on liquidité, slippage prévu

- [ ] **9.3** Tests avec vraie pool Orca devnet
  ```
  SOL/USDC Pool: HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ
  ```

**Priorité** : 🟠 **P1 IMPORTANT**  
**Temps estimé** : 6-8 heures  
**Bénéfice** : Routing multi-DEX réel

---

## 🟡 DANS 2 SEMAINES (2-8 nov) - P2 Importantes

### 10. Jito Bundles Réels (4-6h)

- [ ] **10.1** S'inscrire Jito Block Engine
  - URL : https://jito.wtf/
  - Obtenir accès devnet
  - Configurer tip accounts

- [ ] **10.2** Mettre à jour JitoBundleService
  - Fichier : `sdk/src/services/JitoBundleService.ts`
  - Remplacer mock fetch par vraie API

  ```typescript
  async submitBundle(bundle: Bundle): Promise<BundleResult> {
    const response = await fetch(this.jitoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendBundle',
        params: [bundle.transactions]
      })
    });

    return response.json();
  }
  ```

- [ ] **10.3** Tester soumission bundle réelle
  - Swap > $1000 devrait utiliser bundle
  - Vérifier tip payment

- [ ] **10.4** Implémenter retry logic
  ```typescript
  if (bundleResult.status === "expired") {
    // Retry with higher tip
    return this.submitBundle(bundle, tip * 1.5);
  }
  ```

**Priorité** : 🟡 **P2 IMPORTANTE**  
**Temps estimé** : 4-6 heures  
**Bénéfice** : MEV protection réelle

---

### 11. Monitoring Production (6-8h)

- [ ] **11.1** Setup Grafana Cloud
  - Créer compte gratuit
  - Configurer datasources

- [ ] **11.2** Métriques clés

  ```typescript
  // Métriques à tracker
  -swap_count(counter) -
    swap_volume_usd(gauge) -
    average_npi(gauge) -
    error_rate(counter) -
    circuit_breaker_trips(counter) -
    oracle_price_divergence(gauge);
  ```

- [ ] **11.3** Dashboards
  - Volume 24h
  - NPI moyen par venue
  - Taux d'erreur
  - Latence P50/P95/P99

- [ ] **11.4** Alertes Discord/Telegram
  ```yaml
  alerts:
    - name: High Error Rate
      condition: error_rate > 5%
      severity: critical
      notify: discord-webhook

    - name: Circuit Breaker Tripped
      condition: circuit_breaker_trips > 0
      severity: warning
      notify: telegram
  ```

**Priorité** : 🟡 **P2 IMPORTANTE**  
**Temps estimé** : 6-8 heures  
**Bénéfice** : Visibilité production

---

### 12. Features Lock/Unlock Complètes (4-6h)

- [ ] **12.1** Tests lock avec vrai token $BACK
  - Fichier : `tests/lock-unlock.test.ts`
  - Utiliser mint devnet créé

- [ ] **12.2** Implémenter boost dynamique

  ```rust
  pub fn calculate_boost(lock_amount: u64, lock_duration: i64) -> u8 {
      match (lock_amount, lock_duration) {
          (amt, dur) if amt >= 10_000_000_000 && dur >= 31536000 => 50, // Gold: 10k+, 1 an
          (amt, dur) if amt >= 1_000_000_000 && dur >= 15768000 => 25,  // Silver: 1k+, 6 mois
          (amt, dur) if amt >= 100_000_000 && dur >= 2592000 => 10,     // Bronze: 100+, 1 mois
          _ => 0
      }
  }
  ```

- [ ] **12.3** Mint cNFTs pour niveaux
  - Utiliser Bubblegum CPI
  - Badge Bronze/Silver/Gold

- [ ] **12.4** UI Lock dashboard
  - Afficher niveau actuel
  - Countdown unlock
  - Estimation boost

**Priorité** : 🟡 **P2 FEATURE**  
**Temps estimé** : 4-6 heures  
**Bénéfice** : Tokenomics complet

---

## 🔵 PHASE AUDIT (Dans 3-4 semaines) - P3

### 13. Préparation Audit Externe

- [ ] **13.1** Documenter toutes les fonctions critiques
  - Ajouter NatSpec comments Rust
  - Documenter invariants
  - Cas limites (edge cases)

- [ ] **13.2** Tests de sécurité internes

  ```bash
  # Fuzzing avec honggfuzz
  cargo install honggfuzz
  cargo hfuzz run swapback_router

  # Static analysis
  cargo clippy -- -W clippy::all
  cargo audit
  ```

- [ ] **13.3** Choisir auditeur
  - OtterSec (recommandé Solana)
  - Neodyme
  - Sec3
  - Budget : $30k-$50k

- [ ] **13.4** Préparer scope audit

  ```
  Programmes à auditer:
  - swapback_router (643 lignes)
  - swapback_buyback (306 lignes)
  - back_transfer_hook (~150 lignes estimé)

  Focus areas:
  - Oracle manipulation
  - PDA validations
  - Authority checks
  - Arithmetic overflow
  - Reentrancy
  ```

**Priorité** : 🔵 **P3 FINAL**  
**Temps estimé** : 2-4 semaines  
**Coût** : $30k-$50k  
**Obligatoire** : Oui avant mainnet

---

## 📊 RÉCAPITULATIF TIMELINE

| Semaine                    | Phase           | Tasks              | Heures  | Status      |
| -------------------------- | --------------- | ------------------ | ------- | ----------- |
| **S1 (19-25 oct)**         | Déblocage P0    | #2, #3, #4, #5     | 16-22h  | 🔴 En cours |
| **S2 (26 oct-1 nov)**      | Intégrations P1 | #6, #7, #8, #9     | 21-30h  | ⏳ À venir  |
| **S3-S4 (2-15 nov)**       | Polish P2       | #10, #11, #12      | 14-20h  | ⏳ À venir  |
| **S5-S6 (16-29 nov)**      | Alpha Testing   | Tests users, bugs  | 20-40h  | ⏳ À venir  |
| **S7-S10 (30 nov-27 déc)** | Audit           | #13, corrections   | 80-160h | ⏳ À venir  |
| **S11+ (janv 2026)**       | Mainnet         | Deploy, monitoring | -       | ⏳ À venir  |

**Total estimé** : **6-10 semaines** pour production mainnet

---

## ✅ CHECKLIST QUOTIDIENNE

### Chaque Matin

- [ ] Vérifier solana balance devnet (airdrop si < 2 SOL)
- [ ] Pull derniers changements git
- [ ] Lancer tests : `npm test`
- [ ] Vérifier status programmes déployés

### Chaque Soir

- [ ] Commit + push changements
- [ ] Mettre à jour TODO_PRIORITAIRE.md
- [ ] Noter blockers/questions dans NOTES.md
- [ ] Review progress vs timeline

### Chaque Fin de Semaine

- [ ] Demo fonctionnalités complétées
- [ ] Mettre à jour documentation
- [ ] Planifier semaine suivante
- [ ] Backup configuration/keypairs

---

## 🚨 BLOCKERS CONNUS

### Technique

1. **Build Anchor** : anchor-syn incompatible Rust 1.90
   - Workaround : IDL manuel ✅ ou Rust 1.75
2. **Pyth SDK** : Conflit versions Solana
   - Alternative : Switchboard (recommandé)

3. **Jupiter CPI** : Documentation limitée
   - Ressource : https://station.jup.ag/docs/apis/swap-api

### Ressources

1. **SOL Devnet** : Airdrops rate-limited
   - Solution : Utiliser faucet multi-sources
2. **Jito Access** : Pas d'accès immédiat
   - Solution : S'inscrire early, utiliser tip accounts publics

---

## 📞 RESSOURCES & LIENS

### Documentation

- Anchor Book : https://book.anchor-lang.com/
- Solana Cookbook : https://solanacookbook.com/
- Jupiter Docs : https://station.jup.ag/docs
- Switchboard Docs : https://docs.switchboard.xyz/

### Tools

- Solana Explorer Devnet : https://explorer.solana.com/?cluster=devnet
- Anchor Verify : https://anchor-verify.netlify.app/
- Solana Beach : https://solanabeach.io/

### Support

- Anchor Discord : https://discord.gg/anchor
- Solana Discord : https://discord.gg/solana
- Stack Exchange : https://solana.stackexchange.com/

---

**Dernière mise à jour** : 19 octobre 2025  
**Prochaine review** : 25 octobre 2025  
**Owner** : @BacBacta

---

## 💡 NOTES

- Prioriser déploiement devnet (#2) avant tout
- Oracle réel (#4) critique pour calculs corrects
- Token $BACK (#3) débloque toute la tokenomics
- Jupiter CPI (#7) = 80% du travail DEX integration
- Ne pas négliger audit (#13) - obligatoire mainnet

**Keep going! 🚀 Production dans 6-10 semaines est réaliste si focus sur P0/P1 d'abord.**
