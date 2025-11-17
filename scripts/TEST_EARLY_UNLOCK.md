# Test du flux Early Unlock (2% penalty)

Script automatisé pour tester le unlock anticipé avec redirection de la pénalité vers le buyback wallet.

## Fonctionnalités

✅ **Vérifie** qu'un lock actif existe  
✅ **Calcule** la pénalité de 2% automatiquement  
✅ **Affiche** tous les comptes impliqués dans la transaction  
✅ **Compare** les balances avant/après pour confirmer le routing  
✅ **Valide** que le buyback wallet reçoit exactement 2%

## Utilisation

### Méthode 1 : Avec keypair JSON
```bash
node scripts/test-early-unlock.js path/to/your-keypair.json
```

### Méthode 2 : Keypair par défaut (devnet-keypair.json)
```bash
node scripts/test-early-unlock.js
```

### Variables d'environnement (optionnelles)

```bash
# RPC endpoint personnalisé
export SOLANA_RPC_URL=https://api.devnet.solana.com

# Program ID du cNFT (override)
export CNFT_PROGRAM_ID=GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E

# BACK token mint
export BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
```

## Pré-requis

1. **Keypair devnet** avec :
   - Au moins 0.01 SOL pour les frais
   - Un lock actif dans le programme cNFT

2. **Lock actif** créé via :
   ```bash
   # Exemple : créer un lock de 100 BACK pour 30 jours
   node scripts/create-test-lock.js 100 30
   ```

## Sortie attendue

```
🔑 Chargement du keypair: devnet-keypair.json
   Wallet: 8x7Q...Abc

🌐 Connexion au RPC: https://api.devnet.solana.com
   Solde SOL: 0.5000 SOL

📍 Calcul des PDAs...
   Program ID: GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E
   global_state: 4Zx...
   user_lock: 7Hy...
   vault_authority: 9Kp...

📖 Lecture du GlobalState...
   ✅ Buyback Wallet: FpQ2...

🔒 Lecture du UserLock...
   ✅ Montant verrouillé: 100.000000 BACK
   ✅ Boost: 2.5%
   ✅ Unlock time: 17/12/2025 14:30:00
   ⚠️  EARLY UNLOCK

💰 Calcul de la pénalité (2%):
   • Montant verrouillé: 100.000000 BACK
   • Pénalité (2%): 2.000000 BACK
   • Vous recevrez: 98.000000 BACK
   • Destination pénalité: Buyback Wallet

🔗 Calcul des token accounts...
   user_token_account: 5Rt...
   vault_token_account: 3Pq...
   buyback_wallet_token_account: 8Xm...

💼 Balances avant unlock:
   User: 0 BACK
   Buyback: 15.5 BACK

🔨 Construction de la transaction unlock_tokens...
   ✅ Comptes configurés (9):
      1. 7Hy... (writable)
      2. 4Zx... (writable)
      3. 5Rt... (writable)
      4. 3Pq... (writable)
      5. 8Xm... (writable)  ← BUYBACK WALLET
      6. 9Kp...
      7. 862P... (BACK mint)
      8. 8x7Q... (signer)
      9. Token... (token program)

⚠️  CONFIRMATION REQUISE
   Vous allez unlock 100.000000 BACK
   Pénalité de 2% (2.000000 BACK) sera envoyée au buyback wallet

   Appuyez sur Entrée pour continuer...

📤 Envoi de la transaction...
   🚀 Transaction envoyée: 5vK8z...
   🔗 Explorer: https://explorer.solana.com/tx/5vK8z...?cluster=devnet

⏳ Confirmation en cours...
   ✅ Transaction confirmée!

💼 Balances après unlock:
   User: 98.000000 BACK (+98.000000)
   Buyback: 17.500000 BACK (+2.000000)

   ✅ Pénalité correctement routée vers le buyback wallet!

✅ Test d'unlock anticipé réussi!
```

## Vérifications effectuées

1. ✅ Le compte `buybackWalletTokenAccount` est bien présent en position 5
2. ✅ La pénalité de 2% est calculée correctement
3. ✅ Le buyback wallet reçoit exactement 2% du montant verrouillé
4. ✅ L'utilisateur reçoit 98% du montant
5. ✅ Le UserLock est marqué comme inactif après unlock

## Debugging

Si la transaction échoue, le script affiche :
- Les logs détaillés de la transaction
- L'erreur Solana spécifique
- Les comptes manquants ou invalides

Pour plus de détails sur la transaction :
```bash
solana confirm -v <SIGNATURE> --url devnet
```

## Notes

- Le script demande confirmation avant d'envoyer la transaction
- Les balances sont vérifiées avant et après pour validation
- Un délai de 2s est appliqué pour la propagation des balances
- Le test fonctionne uniquement sur devnet (pas de risque sur mainnet)
