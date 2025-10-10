# Guide de Déploiement SwapBack

## Pré-requis

- Solana CLI installé et configuré
- Wallet avec suffisamment de SOL pour le déploiement
- Anchor CLI >= 0.30.1
- Node.js >= 18

## Étape 1 : Préparation

### 1.1 Générer les keypairs pour les programmes

```bash
# Router program
solana-keygen new -o target/deploy/swapback_router-keypair.json

# Buyback program
solana-keygen new -o target/deploy/swapback_buyback-keypair.json
```

### 1.2 Mettre à jour Anchor.toml

Remplacez les program IDs dans `Anchor.toml` avec les adresses générées :

```bash
# Obtenir l'adresse du router
solana address -k target/deploy/swapback_router-keypair.json

# Obtenir l'adresse du buyback
solana address -k target/deploy/swapback_buyback-keypair.json
```

### 1.3 Mettre à jour les declare_id!

Dans les fichiers Rust :

- `programs/swapback_router/src/lib.rs`
- `programs/swapback_buyback/src/lib.rs`

Remplacez les `declare_id!` par les nouvelles adresses.

## Étape 2 : Build

```bash
# Build les programmes
anchor build

# Vérifier les tailles
anchor build -- --features mainnet
ls -lh target/deploy/*.so
```

⚠️ **Important** : Les programmes ne doivent pas dépasser 10 MB.

## Étape 3 : Tests

```bash
# Tests sur localnet
anchor test

# Tests sur devnet
anchor test --provider.cluster devnet
```

## Étape 4 : Déploiement Devnet

### 4.1 Configuration du wallet

```bash
# Vérifier le solde
solana balance --url devnet

# Si nécessaire, airdrop de SOL
solana airdrop 2 --url devnet
```

### 4.2 Déployer les programmes

```bash
# Déployer sur devnet
anchor deploy --provider.cluster devnet

# Vérifier le déploiement
solana program show <ROUTER_ID> --url devnet
solana program show <BUYBACK_ID> --url devnet
```

### 4.3 Initialiser les programmes

```bash
# Via le CLI Anchor
anchor run initialize-devnet
```

Ou via script TypeScript :

```typescript
import * as anchor from "@coral-xyz/anchor";

const provider = anchor.AnchorProvider.env();
const program = anchor.workspace.SwapbackRouter;

// Initialiser le router
await program.methods
  .initialize(75, 25, new anchor.BN(1000))
  .accounts({...})
  .rpc();

// Initialiser le buyback
await buybackProgram.methods
  .initialize(new anchor.BN(1_000_000))
  .accounts({...})
  .rpc();
```

## Étape 5 : Déploiement Oracle

```bash
cd oracle

# Installer les dépendances
npm install

# Copier .env
cp ../.env.example .env

# Configurer les variables d'environnement
# SOLANA_RPC, JUPITER_API, etc.

# Build
npm run build

# Lancer
npm start
```

Pour un déploiement en production, utiliser PM2 ou Docker :

```bash
# Avec PM2
pm2 start dist/index.js --name swapback-oracle

# Avec Docker
docker build -t swapback-oracle .
docker run -p 3001:3001 swapback-oracle
```

## Étape 6 : Déploiement Frontend

```bash
cd app

# Installer les dépendances
npm install

# Build
npm run build

# Déployer sur Vercel
vercel deploy --prod
```

Ou via GitHub Actions (voir `.github/workflows/deploy.yml`).

## Étape 7 : Déploiement Mainnet

⚠️ **IMPORTANT** : Ne déployez sur mainnet qu'après audit de sécurité complet !

### 7.1 Audit de sécurité

- [ ] Audit par firme externe
- [ ] Bug bounty pendant au moins 2 semaines
- [ ] Tests de stress
- [ ] Revue de code par pairs

### 7.2 Build vérifiable

```bash
# Build avec vérification
anchor build --verifiable

# Générer le hash
sha256sum target/deploy/swapback_router.so
sha256sum target/deploy/swapback_buyback.so
```

### 7.3 Déploiement

```bash
# Vérifier le solde (déploiement coûte ~5-10 SOL)
solana balance --url mainnet-beta

# Déployer
anchor deploy --provider.cluster mainnet-beta

# Vérifier avec Anchor Verify
anchor verify <PROGRAM_ID> -p swapback_router --provider.cluster mainnet-beta
```

### 7.4 Initialisation

```bash
# Initialiser avec les paramètres de production
# Utiliser un multisig pour l'authority
```

## Étape 8 : Monitoring

### 8.1 Setup Monitoring

- Grafana + Prometheus pour métriques
- Sentry pour erreurs frontend/backend
- Logs centralisés (Datadog, CloudWatch)

### 8.2 Alertes

Configurer des alertes pour :

- Transactions échouées > 5%
- Latence Oracle > 2s
- Solde faible sur comptes critiques
- Activité suspecte (MEV, exploits)

## Étape 9 : Post-Déploiement

### 9.1 Documentation

- [ ] Publier la doc technique
- [ ] Guides utilisateur
- [ ] Tutoriels vidéo
- [ ] FAQ

### 9.2 Communication

- [ ] Annonce Twitter
- [ ] Post Discord/Telegram
- [ ] Article de blog
- [ ] Partnerships announcements

### 9.3 Support

- [ ] Canal Discord de support
- [ ] Email support
- [ ] Documentation troubleshooting

## Checklist de Sécurité

- [ ] Audit de code externe
- [ ] Tests de fuzzing
- [ ] Bug bounty actif
- [ ] Multisig pour upgrade authority
- [ ] Rate limiting sur l'API
- [ ] Monitoring en temps réel
- [ ] Plan de réponse aux incidents
- [ ] Backup et disaster recovery

## Rollback Plan

En cas de problème critique :

1. Suspendre les nouvelles transactions
2. Communiquer aux utilisateurs
3. Identifier et corriger le problème
4. Tester la correction
5. Déployer le fix
6. Réactiver le protocole

---

**Note** : Ce guide est un template. Adaptez-le selon vos besoins spécifiques.
