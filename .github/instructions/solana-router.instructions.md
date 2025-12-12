---
applyTo: "programs/**/swapback_router/**,app/**/native-router/**,app/**/useNativeSwap*,scripts/**oracle**,app/src/config/oracles.ts,sdk/src/config/**"
---

# Instructions — Solana Native Router & Oracles

> Ces instructions s'appliquent automatiquement lors de l'édition des fichiers RouterSwap, oracles et DEX.

## Règle MUST — Consultation obligatoire

**MUST**: Avant toute modification, ouvrir et consulter:
- [`docs/ai/solana-native-router-a2z.md`](../../docs/ai/solana-native-router-a2z.md)

**MUST NOT**: Inventer un endpoint, un format de compte oracle, une règle de staleness, ou une structure de transaction.

**MUST**: Dans toute PR/commit, citer au moins 1 lien exact consulté depuis la doc A→Z.

---

## Adresses Programme (Mainnet)

| Programme | Program ID |
|-----------|------------|
| SwapBack Router | `APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN` |
| Pyth Push Oracle | `pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT` |

---

## Oracles Pyth V2 — Feeds Validés (Mainnet)

| Token | Feed Address (PDA) | Feed ID |
|-------|-------------------|---------|
| SOL/USD | `7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE` | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` |
| USDC/USD | `Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX` | `0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a` |
| USDT/USD | `HT2PLQBcG5EiCcNSaMHAjSgd9F98ecpATbk4Sk5oYuM` | `0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b` |
| JUP/USD | `7dbob1psH1iZBS7qPsm3Kwbf5DzSXK8Jyg31CTgTnxH5` | `0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996` |
| BONK/USD | `DBE3N8uNjhKPRHfANdwGvCZghWXyLPdqdSbEW2XFwBiX` | `0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419` |
| WIF/USD | `6B23K3tkb51vLZA14jcEQVCA1pfHptzEHFA93V5dYwbT` | `0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc` |
| ORCA/USD | `4CBshVeNBEXz24GZpoj8SrqP5L7VGG3qjGd6tCST1pND` | `0x37505261e557e251290b8c8899453064e8d760ed5c65a779726f2490980da74c` |
| PYTH/USD | `8vjchtMuJNY4oFQdTi8yCe6mhCaNBFaUbktT482TpLPS` | `0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff` |
| ETH/USD | `42amVS4KgzR9rA28tkVYqVXjq9Qa8dcZQMbH5EYFX6XC` | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
| BTC/USD | `4cSM2e6rvbGQUFiJbqytoVMi5GgghSMr8LwVrT9VPSPo` | `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` |

### Règles de staleness

- **maxStalenessSecs**: `120` (2 minutes)
- **confidenceRatio**: `0.01` (1%)

### Switchboard V2

⚠️ **DEPRECIÉ** — Switchboard V2 On-Demand est EOL.
- Les fichiers `switchboard-feeds.ts` sont archivés en `.ts.archived`
- Un stub avec warning de dépréciation est en place
- NE PAS utiliser pour de nouvelles intégrations

---

## DEX Endpoints (Mainnet)

| DEX | Endpoint Type | URL |
|-----|--------------|-----|
| Raydium | Quote API | `https://api-v3.raydium.io/compute/swap-base-in` |
| Orca | Whirlpool SDK | Via `@orca-so/whirlpools-sdk` |
| Meteora | DLMM API | `https://dlmm-api.meteora.ag/` |
| Phoenix | SDK | Via `@ellipsis-labs/phoenix-sdk` |
| Jupiter | Quote API | `https://quote-api.jup.ag/v6/quote` |
| Jupiter | Swap API | `https://quote-api.jup.ag/v6/swap` |

---

## Procédure de modification

### 1. Avant de coder

```bash
# Exécuter l'audit oracles
npx ts-node scripts/oracle-audit.mainnet.ts
```

### 2. Pendant le développement

- Utiliser `simulateTransaction` avant `sendTransaction`
- Logger les pubkeys oracles passées (primary + fallback)
- Vérifier le staleness des feeds

### 3. Avant le commit

- [ ] Tous les feeds oracle sont OK dans l'audit
- [ ] simulateTransaction passe sans erreur 0x1772
- [ ] Les paires non supportées sont bloquées avec fallback Jupiter
- [ ] Tests green
- [ ] Au moins 1 lien de la doc A→Z cité dans la PR

---

## Anti-patterns interdits

| Interdit | Raison |
|----------|--------|
| Hardcoder des prix | Fausse les quotes, risque de perte utilisateur |
| Fallback silencieux vers SOL/USD | Donne un prix erroné pour la vraie paire |
| `maxStalenessSecs > 300` | Masque un feed mort |
| Modifier endpoint sans doc | Risque de breaking change non documenté |

---

## Liens de référence

- [Pyth Price Feeds](https://pyth.network/developers/price-feed-ids)
- [Pyth Pull vs Push](https://docs.pyth.network/price-feeds/pull-updates)
- [Jupiter API Docs](https://station.jup.ag/docs/apis/swap-api)
- [Raydium SDK](https://github.com/raydium-io/raydium-sdk-V2)
- [Orca Whirlpools](https://orca-so.gitbook.io/orca-developer-portal/whirlpools/overview)

---

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `app/src/config/oracles.ts` | Configuration des feeds Pyth |
| `scripts/oracle-audit.mainnet.ts` | Script d'audit des feeds |
| `scripts/derive-push-feed-addresses.ts` | Dérivation des adresses PDA |
| `app/src/lib/native-router/` | Logique du routeur natif |
| `app/src/hooks/useNativeSwap*` | Hooks React pour le swap |

---

*Document généré le 2025-01-XX — Consulter `docs/ai/solana-native-router-a2z.md` pour la version complète*
