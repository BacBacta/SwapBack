# 🎯 Actions Immédiates - À Faire Maintenant

> **Objectif** : Passer de la structure au projet fonctionnel

## ⚡ À Faire dans les Prochaines 48h

### 1. 🔧 Initialisation (30 minutes)

```bash
# Exécuter le script d'initialisation
./scripts/init.sh
```

**Ce script va :**
- ✅ Vérifier les prérequis (Node, Rust, Solana, Anchor)
- ✅ Installer toutes les dépendances npm
- ✅ Configurer Solana sur devnet
- ✅ Faire un airdrop de SOL
- ✅ Créer le fichier .env
- ✅ Tenter un premier build

### 2. 🐛 Correction des Erreurs TypeScript (1-2 heures)

Les erreurs actuelles sont normales car les dépendances ne sont pas encore installées.

**Après `npm install`, il restera probablement :**

```bash
# Dans app/
cd app
npm install --save-dev @types/node @types/react @types/react-dom
npm install

# Vérifier
npm run build
```

**Erreurs possibles à corriger :**
- Imports manquants
- Types non résolus
- Configuration tsconfig.json

### 3. 🔨 Build et Test Initial (1 heure)

```bash
# Build les programmes
anchor build

# Si erreurs, les corriger puis rebuild
# Les erreurs courantes:
# - Versions de dépendances incompatibles
# - Syntax Rust à ajuster selon la version
```

```bash
# Exécuter les tests
anchor test

# Si échec, debugger avec:
solana-test-validator --log  # dans un terminal
anchor test --skip-local-validator  # dans un autre
```

### 4. 🌐 Intégration Jupiter API (3-4 heures)

**Priorité #1** : Faire fonctionner les simulations de routes

**Dans `oracle/src/index.ts` :**

```typescript
// Remplacer la fonction mock par:
async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippage: number
): Promise<any> {
  try {
    const response = await axios.get(`${JUPITER_API}/quote`, {
      params: {
        inputMint,
        outputMint,
        amount,
        slippageBps: Math.floor(slippage * 100),
      },
    });
    
    console.log('Jupiter quote:', response.data);
    return response.data;
  } catch (error) {
    console.error('Jupiter API error:', error);
    throw new Error('Failed to get Jupiter quote');
  }
}
```

**Tester :**

```bash
cd oracle
npm run dev

# Dans un autre terminal
curl -X POST http://localhost:3001/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "outputMint": "So11111111111111111111111111111111111111112",
    "inputAmount": "1000000",
    "slippage": 0.5,
    "userPubkey": "..."
  }'
```

### 5. 💎 Créer le Token $BACK (2 heures)

```bash
# Installer spl-token CLI
cargo install spl-token-cli

# Créer le mint avec Token-2022
spl-token create-token \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
  --decimals 9

# Sauvegarder l'adresse du mint
export BACK_MINT=<MINT_ADDRESS>

# Créer un compte token
spl-token create-account $BACK_MINT

# Mint initial (1 milliard de tokens)
spl-token mint $BACK_MINT 1000000000
```

### 6. 🚀 Déploiement Devnet (1 heure)

```bash
# S'assurer d'avoir du SOL
solana balance
# Si besoin:
solana airdrop 5

# Déployer
anchor deploy --provider.cluster devnet

# Sauvegarder les Program IDs
solana program show <PROGRAM_ID> --url devnet
```

**Mettre à jour les IDs dans :**
- `Anchor.toml`
- `programs/*/src/lib.rs` (declare_id!)
- `.env` (NEXT_PUBLIC_ROUTER_PROGRAM_ID, etc.)

### 7. ⚙️ Initialiser les Programmes (30 minutes)

```typescript
// Créer scripts/initialize.ts
import * as anchor from "@coral-xyz/anchor";

async function initialize() {
  const provider = anchor.AnchorProvider.env();
  const program = anchor.workspace.SwapbackRouter;
  
  // Initialiser le router
  await program.methods
    .initialize(
      75,  // rebate_percentage
      25,  // burn_percentage
      new anchor.BN(1000)  // npi_threshold
    )
    .accounts({
      // ... comptes
    })
    .rpc();
    
  console.log('Router initialisé !');
}

initialize();
```

```bash
ts-node scripts/initialize.ts
```

### 8. 🎨 Tester le Frontend (1 heure)

```bash
cd app
npm run dev
```

Ouvrir http://localhost:3000

**Vérifier :**
- [ ] Connexion wallet fonctionne
- [ ] Composants s'affichent correctement
- [ ] Simulation de route (même avec données mock)
- [ ] Pas d'erreurs console critiques

## 📋 Checklist de Validation

Après ces 48h, vous devriez avoir :

- [ ] ✅ Projet build sans erreur (`anchor build`)
- [ ] ✅ Tests passent (`anchor test`)
- [ ] ✅ Oracle répond aux requêtes
- [ ] ✅ Jupiter API intégrée (simulations fonctionnent)
- [ ] ✅ Token $BACK créé sur devnet
- [ ] ✅ Programmes déployés sur devnet
- [ ] ✅ Programmes initialisés
- [ ] ✅ Frontend démarre sans erreur
- [ ] ✅ Connexion wallet fonctionne

## 🆘 En Cas de Problème

### Problème : Build Anchor échoue

**Solutions :**
```bash
# Nettoyer et rebuild
anchor clean
cargo clean
anchor build

# Si erreurs de version
rustup update
cargo update
```

### Problème : Tests échouent

**Solutions :**
```bash
# Vérifier le validateur local
solana-test-validator --reset

# Dans un autre terminal
anchor test --skip-local-validator
```

### Problème : Jupiter API ne répond pas

**Solutions :**
- Vérifier la connexion internet
- Tester directement l'API : https://quote-api.jup.ag/v6/quote?inputMint=...
- Vérifier les paramètres (mints valides, montants corrects)

### Problème : Frontend n'affiche pas les données

**Solutions :**
- Ouvrir la console développeur (F12)
- Vérifier les erreurs réseau
- Vérifier que l'oracle tourne (`cd oracle && npm run dev`)
- Vérifier les variables d'environnement dans `.env`

## 📞 Obtenir de l'Aide

Si vous êtes bloqué :

1. **Vérifier les logs** : Toujours commencer par lire les messages d'erreur
2. **Consulter la doc** : [docs/BUILD.md](docs/BUILD.md), [docs/TECHNICAL.md](docs/TECHNICAL.md)
3. **Créer une issue** : Sur GitHub avec les détails (erreur, environnement, étapes)
4. **Discord** : Demander sur le serveur SwapBack

## 🎯 Après ces 48h

Si tout est validé, passez à la **Semaine 2** du [ROADMAP.md](ROADMAP.md) :
- Implémenter les swaps réels
- Ajouter le mécanisme de lock/boost
- Tests end-to-end complets

---

**Prêt ? Lancez `./scripts/init.sh` et c'est parti ! 🚀**
