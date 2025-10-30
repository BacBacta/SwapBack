# 🧪 Guide de Test Vercel - Recherche de Routes

## ✅ Problèmes Résolus

1. **Boucle infinie** ❌ → ✅ Corrigée
   - Supprimé les console.logs excessifs dans `fetchRoutes()`
   - Désactivé l'auto-fetch automatique
   - Bouton manuel obligatoire

2. **Variables d'environnement** ✅ Configurées
   - `JUPITER_API_URL` ajoutée
   - `USE_MOCK_QUOTES` configurable
   - Programme IDs et tokens définis

3. **Texte du bouton** ✅ Amélioré
   - "🔍 Search Route" au lieu de "Review Swap"
   - "✅ Execute Swap" quand route trouvée

## 📋 Comment Tester sur Vercel

### Étape 1: Accéder à l'Application
```
https://VOTRE-APP.vercel.app
```

### Étape 2: Ouvrir la Console du Navigateur
- Appuyer sur **F12**
- Aller dans l'onglet **Console**

### Étape 3: Effectuer un Swap
1. **Connecter le wallet** (Phantom, Solflare, etc.)
2. **Sélectionner SOL** comme token d'entrée
3. **Sélectionner USDC** comme token de sortie
4. **Entrer 1** comme montant
5. **Cliquer sur "🔍 Search Route"**

### Étape 4: Vérifier les Logs

**Si tout fonctionne**, vous verrez dans la console :
```
✅ API call successful
Routes found
```

**Si ça ne marche pas**, vous verrez :
```
❌ Error: [détails de l'erreur]
```

## 🔍 Test de l'API Directement

Vous pouvez aussi tester l'API avec curl :

```bash
curl -X POST https://VOTRE-APP.vercel.app/api/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR",
    "amount": 1000000000,
    "slippageBps": 50
  }'
```

**Résultat attendu** :
```json
{
  "success": true,
  "quote": {
    "inAmount": "1000000000",
    "outAmount": "150000000",
    "priceImpactPct": "0.01",
    ...
  }
}
```

## 🛠️ Script de Test Automatique

Utilisez le script fourni :

```bash
./test-vercel.sh https://VOTRE-APP.vercel.app
```

Le script va :
- ✅ Vérifier que l'app répond
- ✅ Tester l'API `/api/swap/quote`
- ✅ Afficher les résultats détaillés

## 📊 Variables d'Environnement Requises

Vérifiez dans **Vercel Dashboard > Settings > Environment Variables** :

```bash
# API Configuration
JUPITER_API_URL=https://quote-api.jup.ag/v6
USE_MOCK_QUOTES=false

# Network
NEXT_PUBLIC_SOLANA_NETWORK=testnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.testnet.solana.com

# Program IDs
NEXT_PUBLIC_ROUTER_PROGRAM_ID=GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
NEXT_PUBLIC_CNFT_PROGRAM_ID=9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw

# Tokens  
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR
```

⚠️ **Important** : Après avoir ajouté/modifié des variables, **redéployez** !

```bash
vercel --prod
```

## 🐛 Problèmes Courants

### 1. Bouton grisé (disabled)
**Causes** :
- ❌ Wallet non connecté
- ❌ Tokens non sélectionnés
- ❌ Montant = 0

**Solution** : Vérifier toutes les conditions

### 2. Rien ne se passe au clic
**Causes** :
- ❌ API ne répond pas (404)
- ❌ Variables d'environnement manquantes
- ❌ Erreur réseau

**Solution** : Vérifier les logs de la console et Vercel Functions

### 3. Erreur "USE_MOCK_QUOTES undefined"
**Cause** : Variable non définie sur Vercel

**Solution** :
```bash
# Dans Vercel Dashboard
USE_MOCK_QUOTES=false
```
Puis redéployer

## 📞 Besoin d'Aide ?

Si vous rencontrez un problème, partagez :

1. **URL de votre app Vercel**
2. **Screenshot de la console (F12)**
3. **Message d'erreur exact**
4. **Variables d'environnement configurées** (screenshot Vercel Dashboard)

---

## ✅ Checklist Finale

- [ ] Variables d'environnement configurées sur Vercel
- [ ] Application déployée (dernier commit)
- [ ] Wallet connecté
- [ ] Tokens sélectionnés (SOL → USDC)
- [ ] Montant entré (1 SOL)
- [ ] Clic sur "🔍 Search Route"
- [ ] Routes affichées ✨

**Si tout fonctionne** : Vous verrez les routes et pourrez cliquer sur "✅ Execute Swap"

**Bon test ! 🚀**
