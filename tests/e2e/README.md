# 🧪 Tests E2E - Buyback System

## Vue d'ensemble

Cette suite de tests end-to-end valide le flux complet du système de buyback, de la collecte des fees USDC jusqu'au burn des tokens $BACK.

## Structure des Tests

### Tests Principaux (Happy Path)

1. **Test 1**: Vérification de l'état du buyback
   - Vérifie que le compte `buyback_state` est initialisé
   - Valide la taille et le propriétaire du compte

2. **Test 2**: Vérification du vault USDC
   - Confirme l'existence du vault PDA
   - Affiche la balance actuelle

3. **Test 3**: Financement de l'utilisateur test
   - Transfère 0.1 SOL à un utilisateur de test
   - Nécessaire pour payer les frais de transaction

4. **Test 4**: Création du compte token USDC
   - Crée l'Associated Token Account (ATA) pour USDC
   - Utilise le programme Token standard

5. **Test 5**: Mint USDC à l'utilisateur
   - Simule la collecte de fees de swap
   - Mint 100 USDC de test (si autorité de mint disponible)

6. **Test 6**: Dépôt USDC dans le vault
   - Dépose 10 USDC dans le vault buyback
   - Vérifie l'augmentation de la balance du vault
   - Teste l'instruction `deposit_usdc`

7. **Test 7**: Vérification du seuil de buyback
   - Compare la balance du vault au seuil minimum
   - Détermine si un buyback peut être exécuté

8. **Test 8**: Création du compte token $BACK
   - Crée l'ATA pour le token $BACK (Token-2022)
   - Nécessaire pour recevoir/brûler des tokens

9. **Test 9**: Exécution du buyback
   - Exécute l'instruction `execute_buyback` avec 5 USDC
   - Vérifie la diminution du vault USDC
   - Confirme le burn des tokens $BACK
   - **Test conditionnel**: Ne s'exécute que si le seuil est atteint

10. **Test 10**: Vérification de la mise à jour de l'état
    - Parse les données on-chain du `buyback_state`
    - Vérifie `total_usdc_collected` et `total_back_burned`
    - Affiche le timestamp du dernier buyback

### Tests d'Erreurs (Error Cases)

11. **Test 11**: Dépôt avec balance insuffisante
    - Crée un utilisateur sans USDC
    - Tente de déposer 1000 USDC
    - Vérifie que la transaction échoue correctement

12. **Test 12**: Buyback sous le seuil
    - Vérifie la logique de seuil minimum
    - Confirme que le programme rejetterait un buyback prématuré

## Prérequis

### Environnement
- Node.js 18+
- Solana CLI configuré
- Wallet avec au moins 0.5 SOL sur devnet
- Programme buyback déployé sur devnet

### Dépendances
```bash
npm install --save-dev vitest
npm install @solana/web3.js @solana/spl-token @coral-xyz/anchor
```

### Configuration
- **RPC**: `https://api.devnet.solana.com`
- **Program ID**: `92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir`
- **$BACK Token**: `3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE`
- **USDC Devnet**: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

## Exécution

### Méthode 1: Script automatique (recommandé)
```bash
chmod +x run-e2e-tests.sh
./run-e2e-tests.sh
```

Le script effectue automatiquement:
- ✅ Vérification du cluster Solana (devnet)
- ✅ Vérification de la balance du wallet
- ✅ Vérification du déploiement du programme
- ✅ Installation des dépendances
- ✅ Compilation TypeScript
- ✅ Exécution des tests avec rapport détaillé

### Méthode 2: Commande directe
```bash
npx vitest run tests/e2e/buyback-flow.test.ts --reporter=verbose
```

### Méthode 3: Mode watch (développement)
```bash
npx vitest tests/e2e/buyback-flow.test.ts
```

## Résultats Attendus

### Succès Complet
```
✅ Test 1: Buyback state is initialized
✅ Test 2: USDC vault is created
✅ Test 3: Fund test user with SOL
✅ Test 4: Create user USDC token account
✅ Test 5: Mint USDC to user (ou skipped si pas mint authority)
✅ Test 6: Deposit USDC to buyback vault
✅ Test 7: Check buyback threshold
✅ Test 8: Create user $BACK token account
✅ Test 9: Execute buyback (conditionnel au seuil)
✅ Test 10: Verify buyback state updated
❌ Test 11: Deposit with insufficient balance (devrait échouer)
✅ Test 12: Buyback below threshold
```

### Cas Partiels
- **Test 5 skipped**: Normal si le wallet n'est pas mint authority USDC
- **Test 9 skipped**: Normal si le vault n'a pas atteint le seuil
- Dans ces cas, les tests valident quand même la logique et les erreurs attendues

## Interprétation des Résultats

### Logs de Transaction
Chaque test affiche:
- **Signature de transaction** (8 premiers caractères)
- **Balances avant/après** pour les opérations financières
- **Messages de diagnostic** pour les skips et erreurs

### Vérification sur Solana Explorer
Copiez les signatures de transaction et consultez:
```
https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet
```

Pour voir:
- Instructions exécutées
- Comptes modifiés
- Logs du programme
- Coût en SOL

## Debugging

### Test échoue au Test 1-2
**Problème**: Programme non déployé
```bash
# Vérifier le déploiement
solana program show 92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir --url devnet

# Redéployer si nécessaire
anchor deploy --provider.cluster devnet
```

### Test échoue au Test 3
**Problème**: Balance SOL insuffisante
```bash
# Obtenir des SOL devnet
solana airdrop 2 --url devnet

# Vérifier la balance
solana balance --url devnet
```

### Test 6 échoue (deposit_usdc)
**Problème**: Erreur d'instruction ou de compte

Vérifiez:
1. Les PDAs sont correctement dérivés
2. Le compte USDC source a des fonds
3. Le programme a les bonnes autorisations

```bash
# Inspecter le compte USDC vault
solana account <VAULT_PDA> --url devnet
```

### Test 9 échoue (execute_buyback)
**Problèmes possibles**:
1. **Seuil non atteint**: Déposez plus d'USDC
2. **Token-2022 extension**: Vérifiez burn authority
3. **Slippage**: Vérifiez les calculs de prix

```bash
# Vérifier l'état du buyback
solana account 74N3kmNZiRSJCFaYBFjmiQGMwv8vx3aJvMMKJECLNUNM --url devnet
```

## Scénarios de Test Avancés

### Test avec Swaps Réels
Pour tester le flux complet avec vrais swaps:

1. Exécutez des swaps sur l'interface UI
2. Vérifiez que 25% des fees vont au vault
3. Attendez que le seuil soit atteint
4. Exécutez le buyback manuellement ou via UI

### Test de Charge
Pour tester avec volume:
```bash
# Exécuter les tests en boucle
for i in {1..10}; do
  echo "Run $i"
  npx vitest run tests/e2e/buyback-flow.test.ts
  sleep 5
done
```

### Test Multi-Utilisateurs
Modifiez le test pour créer plusieurs utilisateurs:
```typescript
const users = Array.from({ length: 5 }, () => Keypair.generate());
// Chaque user dépose USDC
// Un seul exécute le buyback
```

## Métriques de Performance

Les tests mesurent:
- **Temps d'exécution** de chaque instruction
- **Coût en SOL** des transactions
- **Latence RPC** devnet
- **Taux de succès** global

Exemple de sortie:
```
Test 6: Deposit USDC
   ✓ Transaction: 2.3s
   ✓ Cost: 0.000005 SOL
   ✓ Vault increase: 10.00 USDC
```

## Intégration Continue (CI)

Pour GitHub Actions:
```yaml
- name: Run E2E Tests
  run: |
    solana config set --url devnet
    ./run-e2e-tests.sh
  env:
    SOLANA_KEYPAIR: ${{ secrets.DEVNET_WALLET }}
```

## Prochaines Étapes

Après succès des tests E2E:

1. ✅ **Tests UI**: Vérifier l'interface utilisateur
2. ✅ **Intégration Swap**: Connecter le dépôt automatique
3. ✅ **Audit Sécurité**: Review du code Rust
4. ✅ **Tests Mainnet**: Déploiement production
5. ✅ **Monitoring**: Alertes et analytics

## Support

Pour questions ou bugs:
- Consultez les logs détaillés dans le terminal
- Vérifiez les transactions sur Solana Explorer
- Examinez le code Rust du programme pour la logique métier

## License

MIT - Voir LICENSE pour détails
