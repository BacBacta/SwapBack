# 🔐 Test du Lock de Tokens BACK

## État du système

Vérification effectuée le 2025-11-04 :

✅ Programme déployé: `2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G`  
✅ Collection Config initialisé: `HHr1m69HKTwoC3M1z6n3jLXcqijx8MUxd9atDbeQNKR6`  
✅ Global State initialisé: `6qhbKKrSwoRfffLKsxBELcpLEfVpUGFcrmapVV8RQP8L`  
✅ Vault Authority PDA: `5fHNiP5jHjghCbaYhpqPp1w4TQDGYpiAkHNa8S2JPuRf`

## Corrections apportées

### 1. Logs de debug ajoutés

**Fichier**: `app/src/lib/lockTokens.ts`
- Ajout de logs détaillés à chaque étape
- Affichage des PDAs calculés
- Meilleure gestion des erreurs

**Fichier**: `app/src/components/LockInterface.tsx`
- Logs au démarrage du processus
- Logs à chaque étape (création TX, envoi, confirmation)
- Messages d'erreur plus détaillés selon le type d'erreur

### 2. Gestion d'erreurs améliorée

Messages d'erreur spécifiques pour :
- ❌ User rejected transaction
- ❌ Insufficient balance
- ❌ Account not found (pas de tokens BACK)
- ❌ Program error (compte non initialisé)

### 3. Script de vérification

**Fichier**: `check-lock-state.js`

Vérifier l'état du système :
```bash
node check-lock-state.js
```

## Comment tester

### 1. Prérequis

- Wallet connecté
- Tokens BACK dans le wallet
- Application sur http://localhost:3000

### 2. Étapes de test

1. **Ouvrir la console du navigateur** (F12)
   
2. **Aller sur l'interface de Lock**
   - Cliquer sur l'onglet "Lock Tokens"
   
3. **Remplir le formulaire**
   - Amount: 10 BACK (ou moins selon votre solde)
   - Duration: 30 jours
   
4. **Cliquer sur "Lock Tokens"**

5. **Observer les logs dans la console**:
   ```
   🔍 [LOCK DEBUG] Starting lock process...
   🔍 [LOCK DEBUG] Amount: 10 Days: 30
   🔍 [LOCK TX] Creating lock transaction...
   🔍 [LOCK TX] Wallet: xxxxx...
   ✅ [LOCK TX] Program loaded: xxxxx...
   ✅ [LOCK TX] Collection Config: HHr1m69H...
   ✅ [LOCK TX] Global State: 6qhbKKrS...
   ✅ [LOCK TX] User NFT: xxxxx...
   ✅ [LOCK TX] Vault Authority: 5fHNiP5j...
   ✅ [LOCK TX] User Token Account: xxxxx...
   ✅ [LOCK TX] Vault Token Account: xxxxx...
   🔍 [LOCK TX] Building instruction...
   ✅ [LOCK TX] Instruction created successfully
   ✅ [LOCK TX] Transaction built successfully
   🔍 [LOCK DEBUG] Sending transaction...
   ✅ [LOCK DEBUG] Transaction sent: xxxxx
   🔍 [LOCK DEBUG] Waiting for confirmation...
   ✅ [LOCK DEBUG] Transaction confirmed!
   ```

## Erreurs possibles et solutions

### ❌ "Unexpected error"

**Cause**: Erreur générique, vérifier les logs de debug

**Solution**: 
1. Ouvrir la console (F12)
2. Relire les logs `[LOCK DEBUG]` et `[LOCK TX]`
3. Identifier à quelle étape ça bloque

### ❌ "Token account not found"

**Cause**: Vous n'avez pas de tokens BACK

**Solution**: 
1. Obtenir des tokens BACK via le swap
2. Vérifier votre solde dans le Dashboard

### ❌ "Account not initialized"

**Cause**: Un des PDAs (CollectionConfig ou GlobalState) n'est pas initialisé

**Solution**:
```bash
# Vérifier l'état
node check-lock-state.js

# Si un compte manque, exécuter:
cd /workspaces/SwapBack
anchor run init-collection  # Si CollectionConfig manque
anchor run init-state       # Si GlobalState manque
```

### ❌ "Insufficient balance"

**Cause**: Pas assez de tokens BACK

**Solution**: Réduire le montant ou obtenir plus de BACK

### ❌ "User rejected transaction"

**Cause**: Transaction annulée dans le wallet

**Solution**: Réessayer et approuver dans le wallet

## Fichiers modifiés

1. `app/src/lib/lockTokens.ts` - Logs de debug + meilleure gestion d'erreurs
2. `app/src/components/LockInterface.tsx` - Logs de debug + messages d'erreur détaillés
3. `check-lock-state.js` - Script de vérification du système

## Prochaines étapes

Si le lock fonctionne :
- ✅ Tester avec différents montants
- ✅ Tester avec différentes durées
- ✅ Vérifier que le unlock fonctionne après la période
- ✅ Vérifier l'affichage du cNFT dans le dashboard

## Support

En cas de problème persistant :
1. Partager les logs de la console (section `[LOCK DEBUG]` et `[LOCK TX]`)
2. Partager le résultat de `node check-lock-state.js`
3. Vérifier que vous avez bien des tokens BACK
