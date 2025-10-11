# 🎯 ACTION IMMÉDIATE - Résoudre le Build et Continuer

> **Statut** : Prêt à exécuter  
> **Temps estimé** : 30 minutes  
> **Objectif** : Résoudre le problème de build et déployer sur devnet

---

## ⚡ ÉTAPE 1 : RÉSOUDRE LE BUILD (15-30 min)

### Option A : Script Automatique (RECOMMANDÉ)

J'ai créé un script qui fait tout automatiquement :

```bash
cd /workspaces/SwapBack
./scripts/rebuild-clean.sh
```

**Ce script va :**
1. ✅ Sauvegarder votre code actuel
2. ✅ Créer un nouveau projet Anchor propre
3. ✅ Copier votre code
4. ✅ Tenter un build
5. ✅ Vous donner les prochaines étapes

### Option B : Manuel (si le script ne fonctionne pas)

```bash
# 1. Charger l'environnement
source "$HOME/.cargo/env"
export PATH="/home/codespace/.local/share/solana/install/active_release/bin:$PATH"

# 2. Créer nouveau projet
cd /tmp
anchor init swapback_clean --no-git
cd swapback_clean

# 3. Créer les programmes
rm -rf programs/swapback_clean
cd programs
anchor new swapback_router
anchor new swapback_buyback
cd ..

# 4. Copier le code
cp /workspaces/SwapBack/programs/swapback_router/src/lib.rs \
   programs/swapback_router/src/

cp /workspaces/SwapBack/programs/swapback_buyback/src/lib.rs \
   programs/swapback_buyback/src/

# 5. Build
anchor build
```

---

## ⚡ ÉTAPE 2 : FINALISER LE PROJET (Une fois le build OK)

### 2.1 Copier les Autres Composants

```bash
cd /tmp/swapback_clean

# Copier app, sdk, oracle, tests
cp -r /workspaces/SwapBack/app .
cp -r /workspaces/SwapBack/sdk .
cp -r /workspaces/SwapBack/oracle .
cp -r /workspaces/SwapBack/tests .
cp /workspaces/SwapBack/.env .
```

### 2.2 Récupérer les Program IDs

```bash
# Afficher les Program IDs générés
echo "Router Program ID:"
solana address -k target/deploy/swapback_router-keypair.json

echo "Buyback Program ID:"
solana address -k target/deploy/swapback_buyback-keypair.json
```

### 2.3 Mettre à Jour les Configurations

Copiez les Program IDs affichés et mettez à jour :

**Fichier `.env` :**
```bash
NEXT_PUBLIC_ROUTER_PROGRAM_ID=<VOTRE_ROUTER_ID>
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=<VOTRE_BUYBACK_ID>
```

**Fichier `Anchor.toml` (sections programs.*) :**
```toml
[programs.devnet]
swapback_router = "<VOTRE_ROUTER_ID>"
swapback_buyback = "<VOTRE_BUYBACK_ID>"
```

### 2.4 Tester Localement

```bash
# Lancer les tests
anchor test

# Si succès, vous êtes prêt pour le déploiement !
```

---

## ⚡ ÉTAPE 3 : DÉPLOIEMENT DEVNET (15 min)

### 3.1 Vérifier le Solde

```bash
solana config set --url devnet
solana balance

# Si besoin, demander un airdrop
solana airdrop 2
```

### 3.2 Déployer

```bash
anchor deploy --provider.cluster devnet
```

### 3.3 Vérifier le Déploiement

```bash
# Vérifier que les programmes sont bien déployés
solana program show <ROUTER_PROGRAM_ID> --url devnet
solana program show <BUYBACK_PROGRAM_ID> --url devnet
```

---

## ⚡ ÉTAPE 4 : LANCER LES SERVICES (10 min)

### 4.1 Service Oracle

```bash
# Terminal 1
cd /tmp/swapback_clean/oracle
npm install
npm run dev
# Devrait démarrer sur http://localhost:3001
```

### 4.2 Frontend

```bash
# Terminal 2
cd /tmp/swapback_clean/app
npm install
npm run dev
# Devrait démarrer sur http://localhost:3000
```

### 4.3 Tester l'Interface

1. Ouvrir http://localhost:3000
2. Connecter un wallet (Phantom/Solflare)
3. Tester la simulation de swap
4. Vérifier le dashboard

---

## ⚡ ÉTAPE 5 : INTÉGRATION JUPITER (3-4h)

Une fois tout fonctionne, intégrer la vraie API Jupiter :

**Fichier : `oracle/src/index.ts`**

Remplacer la fonction mock (lignes ~50-80) par :

```typescript
import axios from 'axios';

const JUPITER_API = process.env.JUPITER_API || 'https://quote-api.jup.ag/v6';

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
    
    console.log('Jupiter quote received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Jupiter API error:', error);
    throw new Error('Failed to get Jupiter quote');
  }
}

// Utiliser cette fonction dans /api/simulate-route
app.post('/api/simulate-route', async (req, res) => {
  try {
    const { inputMint, outputMint, amount, slippage } = req.body;
    
    const quote = await getJupiterQuote(inputMint, outputMint, amount, slippage);
    
    res.json({
      success: true,
      route: quote,
      npi: calculateNPI(quote), // Implémenter cette fonction
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Tester l'intégration :**

```bash
# Terminal 1 : Oracle en dev mode
cd oracle && npm run dev

# Terminal 2 : Test avec curl
curl -X POST http://localhost:3001/api/simulate-route \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": "1000000000",
    "slippage": 0.5
  }'
```

---

## 📋 CHECKLIST FINALE

Cochez au fur et à mesure :

### Build & Déploiement
- [ ] Script rebuild-clean.sh exécuté avec succès
- [ ] `anchor build` fonctionne sans erreur
- [ ] `anchor test` passe tous les tests
- [ ] Program IDs récupérés
- [ ] .env et Anchor.toml mis à jour
- [ ] Déployé sur devnet
- [ ] Programmes vérifiés sur devnet

### Services
- [ ] Oracle démarre sur port 3001
- [ ] Frontend démarre sur port 3000
- [ ] Wallet se connecte correctement
- [ ] Simulation de swap fonctionne

### Intégration Jupiter
- [ ] API Jupiter intégrée dans oracle
- [ ] Tests curl passent
- [ ] Frontend affiche les vraies routes
- [ ] NPI calculé correctement

### Tests End-to-End
- [ ] Test de swap complet
- [ ] Test de lock/unlock
- [ ] Test de claim rewards
- [ ] Test de buyback

---

## 🎯 TEMPS TOTAL ESTIMÉ

| Étape | Temps |
|-------|-------|
| Résoudre build | 15-30 min |
| Déploiement devnet | 15 min |
| Lancer services | 10 min |
| Intégration Jupiter | 3-4h |
| Tests E2E | 1-2h |
| **TOTAL** | **5-7h** |

---

## 💡 CONSEILS

### Si le build échoue encore :
1. Vérifier les logs : `tail -50 /tmp/build.log`
2. Vérifier les versions Rust : `rustc --version` (devrait être 1.79.0)
3. Nettoyer : `anchor clean && cargo clean`
4. Demander aide sur [Anchor Discord](https://discord.gg/anchor)

### Pour débugger :
```bash
# Voir les logs Solana en temps réel
solana logs --url devnet

# Vérifier une transaction
solana confirm <SIGNATURE> -v --url devnet

# Vérifier un compte
solana account <ACCOUNT_ADDRESS> --url devnet
```

### Pour optimiser :
- Utilisez `anchor test --skip-build` pour tests rapides
- Ajoutez `msg!()` dans vos programmes pour debug
- Utilisez `console.log()` dans le SDK/frontend

---

## 🚀 COMMANDE RAPIDE POUR TOUT FAIRE

Copiez-collez cette séquence complète :

```bash
# 1. Résoudre le build
cd /workspaces/SwapBack
./scripts/rebuild-clean.sh

# 2. Aller dans le nouveau projet (si build OK)
cd /tmp/swapback_clean

# 3. Copier les composants
cp -r /workspaces/SwapBack/{app,sdk,oracle,tests,.env} .

# 4. Tester
anchor test

# 5. Déployer
solana config set --url devnet
solana airdrop 2
anchor deploy --provider.cluster devnet

# 6. Lancer (dans des terminaux séparés)
# Terminal 1:
cd oracle && npm install && npm run dev

# Terminal 2:
cd app && npm install && npm run dev
```

---

## 📞 AIDE

**Besoin d'aide ?**
- Documentation : [INDEX.md](INDEX.md)
- Problèmes connus : [RESUME_SESSION.md](RESUME_SESSION.md)
- Discord Anchor : https://discord.gg/anchor
- Discord Solana : https://discord.gg/solana

---

**Vous êtes à 70% ! Plus que 5-7h de travail et le projet sera complet ! 💪**

**Commencez maintenant : `./scripts/rebuild-clean.sh` 🚀**
