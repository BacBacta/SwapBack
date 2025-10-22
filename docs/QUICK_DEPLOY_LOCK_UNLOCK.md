# 🚀 Guide de Déploiement Rapide - Lock-Unlock cNFT

**Prérequis**: Programme compilé ✅, SDK intégré ✅, UI prête ✅  
**Manque**: SOL sur devnet pour déployer

---

## 🎯 Checklist Rapide

### ✅ Déjà Fait

- [x] Programme compilé: `swapback_cnft.so`
- [x] Program ID: `CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH`
- [x] SDK créé: `/app/src/lib/cnft.ts` (231 lignes)
- [x] UI intégrée: Dashboard > Strategies > Lock-Unlock
- [x] Mode simulation actif pour dev

### ⏳ À Faire (30 min total)

- [ ] Obtenir 2 SOL sur devnet (5 min)
- [ ] Déployer le programme (5 min)
- [ ] Initialiser la collection (5 min)
- [ ] Activer les vraies transactions (2 min)
- [ ] Tester lock + unlock (15 min)

---

## 📋 Commandes à Exécuter

### 1. Vérifier la Configuration Actuelle

```bash
# Devrait afficher:
# Config File: /home/codespace/.config/solana/cli/config.yml
# RPC URL: https://api.devnet.solana.com
# WebSocket URL: wss://api.devnet.solana.com/
# Keypair Path: /home/codespace/.config/solana/id.json
solana config get

# Devrait afficher:
# 65abbvvVT4L7hdd9JMgk3g2eeu6sfSyVqVKQjLZnyBo
solana address

# Affiche le balance actuel (actuellement: 0 SOL)
solana balance
```

### 2. Obtenir du SOL (PRIORITÉ #1)

**Option A: Faucet Web** ⭐ (Recommandé - 5 min)

```bash
# 1. Ouvrir dans le navigateur:
#    https://sol-faucet.com
#    OU
#    https://solfaucet.com
#    OU
#    https://faucet.solana.com

# 2. Coller l'adresse:
#    65abbvvVT4L7hdd9JMgk3g2eeu6sfSyVqVKQjLZnyBo

# 3. Demander 2 SOL

# 4. Vérifier après 30 secondes:
solana balance
# Devrait afficher: 2 SOL
```

**Option B: CLI** (Si le rate limit a reset)

```bash
# Tenter l'airdrop via CLI:
solana airdrop 2

# Si ça échoue avec "rate limit", attendre 1h ou utiliser Option A
```

**Option C: Discord Solana** (5-10 min)

```bash
# 1. Rejoindre: https://discord.gg/solana
# 2. Aller dans le canal #devnet-faucet
# 3. Envoyer le message:
#    !airdrop 65abbvvVT4L7hdd9JMgk3g2eeu6sfSyVqVKQjLZnyBo
```

### 3. Déployer le Programme (5 min)

```bash
cd /workspaces/SwapBack

# Vérifier que le programme est compilé
ls -lh target/deploy/swapback_cnft.so
# Devrait afficher: ~500-600 KB

# DÉPLOIEMENT
solana program deploy \
  target/deploy/swapback_cnft.so \
  --program-id CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH \
  --url devnet \
  -v

# Attendre le message:
# ✅ Program Id: CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH
# ✅ Signature: <TX_SIGNATURE>

# Vérifier le déploiement:
solana program show CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH --url devnet

# Vérifier le balance restant:
solana balance
# Devrait rester ~1-1.5 SOL
```

### 4. Initialiser la Collection cNFT (5 min)

**Créer le script d'initialisation:**

```bash
cd /workspaces/SwapBack/scripts
cat > init-cnft-collection.ts << 'EOF'
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH");
const RPC_URL = "https://api.devnet.solana.com";

async function main() {
  console.log("🚀 Initializing cNFT Collection...");

  // Charger le wallet
  const keypairPath = "/home/codespace/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log("💼 Wallet:", keypair.publicKey.toString());

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {});

  // Charger l'IDL du programme
  const idl = JSON.parse(
    fs.readFileSync("target/idl/swapback_cnft.json", "utf-8")
  );

  const program = new Program(idl, PROGRAM_ID, provider);

  // Dériver le PDA de la collection
  const [collectionConfigPDA] = await PublicKey.findProgramAddress(
    [Buffer.from("collection_config")],
    PROGRAM_ID
  );

  console.log("📦 Collection Config PDA:", collectionConfigPDA.toString());

  // TODO: Créer le tree_config pour les compressed NFTs
  // Pour l'instant, utilisons une clé temporaire
  const treeConfig = Keypair.generate();

  console.log("🌳 Tree Config:", treeConfig.publicKey.toString());

  // Appeler initialize_collection
  console.log("📝 Sending initialize_collection transaction...");

  const tx = await program.methods
    .initializeCollection()
    .accounts({
      collectionConfig: collectionConfigPDA,
      authority: keypair.publicKey,
      treeConfig: treeConfig.publicKey,
      systemProgram: PublicKey.default,
    })
    .signers([treeConfig])
    .rpc();

  console.log("✅ Collection initialized!");
  console.log("📝 Transaction:", tx);
  console.log("🔗 View on Solscan:", `https://solscan.io/tx/${tx}?cluster=devnet`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
EOF

# Installer les dépendances si nécessaire
npm install

# Exécuter le script
npx ts-node init-cnft-collection.ts
```

### 5. Activer les Vraies Transactions (2 min)

**Modifier le fichier LockUnlock.tsx:**

```bash
code /workspaces/SwapBack/app/src/components/LockUnlock.tsx
```

**Chercher la section avec `// TODO: Décommenter` et remplacer:**

```typescript
// AVANT (simulation):
// TODO: Décommenter quand le programme sera déployé
// const durationSeconds = durationDays * 24 * 60 * 60;
// ...
console.log("⚠️ Programme non encore déployé - simulation activée");
await new Promise((resolve) => setTimeout(resolve, 2000));

// APRÈS (vraies transactions):
const durationSeconds = durationDays * 24 * 60 * 60;
const { transaction } = await createLockTransaction(
  connection,
  {
    publicKey,
    sendTransaction,
    signTransaction: undefined,
    signAllTransactions: undefined,
    signMessage: undefined,
    connected,
    connecting: false,
    disconnecting: false,
    disconnect: async () => {},
    connect: async () => {},
    select: () => {},
    wallet: null,
    wallets: [],
    autoConnect: false,
    signIn: undefined,
  },
  { amount: amount * 1e9, duration: durationSeconds }
);

const signature = await sendTransaction(transaction, connection);
const latestBlockhash = await connection.getLatestBlockhash();
await connection.confirmTransaction(
  { signature, ...latestBlockhash },
  "confirmed"
);
```

**Sauvegarder et redémarrer le serveur:**

```bash
# Ctrl+C dans le terminal du serveur, puis:
cd /workspaces/SwapBack/app
npm run dev
```

### 6. Tester Lock + Unlock (15 min)

**Ouvrir l'application:**

```bash
# Dans le navigateur:
http://localhost:3000

# Naviguer:
Dashboard > Strategies > Lock-Unlock
```

**Test 1: Lock Minimum (Bronze)**

```
1. Connecter le wallet
2. Montant: 100
3. Durée: 30 jours
4. Cliquer "Lock Tokens"
5. Signer la transaction dans le wallet
6. ✅ Vérifier: Message de succès avec "Bronze" et "+10%"
7. ✅ Vérifier: cNFT apparaît dans le statut
```

**Test 2: Vérifier le cNFT On-Chain**

```bash
# Récupérer le PDA du user
USER_PUBKEY="<VOTRE_WALLET_PUBKEY>"

# Calculer le PDA (ou lire depuis le frontend)
# Seeds: ["user_nft", userPubkey]

# Vérifier le compte
solana account <USER_NFT_PDA> --url devnet --output json-compact
```

**Test 3: Unlock (après expiration)**

```
1. Attendre que la date de unlock soit passée
   OU
   Modifier lock_duration dans le test pour 1 minute
2. Cliquer "Unlock Tokens"
3. Signer la transaction
4. ✅ Vérifier: Tokens retournés au wallet
5. ✅ Vérifier: cNFT n'apparaît plus dans le statut
```

---

## 🐛 Troubleshooting

### Problème: "Insufficient funds"

```bash
# Solution: Vérifier le balance
solana balance

# Si < 0.5 SOL, demander plus
solana airdrop 1
```

### Problème: "Program not deployed"

```bash
# Vérifier que le programme existe:
solana program show CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH --url devnet

# Si erreur, redéployer:
solana program deploy target/deploy/swapback_cnft.so --program-id CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH --url devnet
```

### Problème: "Collection not initialized"

```bash
# Réexécuter le script d'initialisation:
cd /workspaces/SwapBack/scripts
npx ts-node init-cnft-collection.ts
```

### Problème: Compilation errors dans Next.js

```bash
# Nettoyer et rebuild:
cd /workspaces/SwapBack/app
rm -rf .next node_modules/.cache
npm run dev
```

### Problème: Transaction timeout

```bash
# Augmenter le timeout dans le code:
const signature = await sendTransaction(transaction, connection, {
  skipPreflight: false,
  maxRetries: 5,
  preflightCommitment: "confirmed",
});
```

---

## 📊 Commandes de Monitoring

### Voir les logs du programme

```bash
# En temps réel:
solana logs CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH --url devnet

# Analyser une transaction spécifique:
solana confirm <SIGNATURE> --url devnet -v
```

### Vérifier l'état d'un compte

```bash
# Collection Config:
solana account <COLLECTION_CONFIG_PDA> --url devnet --output json

# User NFT:
solana account <USER_NFT_PDA> --url devnet --output json
```

### Stats du programme

```bash
# Infos générales:
solana program show CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH --url devnet

# Taille:
solana program show CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH --url devnet | grep "Data Length"
```

---

## ✅ Validation Finale

Une fois tout déployé et testé:

- [ ] Programme déployé sur devnet
- [ ] Collection initialisée
- [ ] Lock fonctionne (Bronze/Silver/Gold)
- [ ] cNFT minté et visible on-chain
- [ ] Unlock fonctionne
- [ ] Tokens retournés correctement
- [ ] UI affiche les bonnes infos
- [ ] Pas d'erreurs dans la console

**Status**: 🟢 Lock-Unlock 100% Fonctionnel !

---

## 🎯 Prochaines Fonctionnalités (Optionnel)

### Court Terme

1. **Early Unlock avec Pénalité**
   - Permettre unlock avant date
   - Appliquer -20% de pénalité
   - Brûler les tokens pénalisés

2. **Upgrade de Niveau**
   - Permettre re-lock pour augmenter niveau
   - Bronze → Silver → Gold
   - Conserver le temps déjà écoulé

3. **Historique**
   - Afficher tous les locks/unlocks passés
   - Statistiques cumulées
   - Graphique des boosts obtenus

### Moyen Terme

1. **Notifications**
   - Email/Push 7 jours avant unlock
   - Reminder le jour J
   - Confirmation après unlock

2. **Staking Rewards**
   - Distribution de rewards additionnels
   - Basée sur le niveau (Gold > Silver > Bronze)
   - Claim automatique à l'unlock

3. **NFT Marketplace**
   - Permettre transfert des cNFTs
   - Marché secondaire
   - Pricing basé sur le temps restant

---

## 📞 Support

**Besoin d'aide ?**

- 📖 Documentation: `/docs/LOCK_UNLOCK_INTEGRATION.md`
- 💬 Discord Solana: https://discord.gg/solana
- 🐦 Twitter: @solana
- 📧 Email: support@swapback.io (si applicable)

**Prêt à déployer !** 🚀
