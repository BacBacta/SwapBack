# 📌 TODO Pinboard (Oct 30, 2025)

1. [x] Provisionner l'initialisation buyback sur devnet
   - ✅ PDA `8McEQ8oijEUF2qeeCxWRkjr2rHVQeydD43d8hPmfjbBQ` confirmé
   - `SWAPBACK_BUYBACK_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR`
   - `SWAPBACK_BUYBACK_MIN_AMOUNT=100000000`
   - Script: `npx tsx tests/scripts/init-buyback-state.ts`
   - Vérif: `SWAPBACK_RUN_BUYBACK_INIT=true npm run test -- tests/router-e2e-onchain.test.ts`
2. [x] Activer les suites boost-system on-chain
   - ✅ Tests `tests/integration/boost-system.test.ts` exécutés avec succès (11/11)
   - Funding dynamique + restitution SOL en place, attente fix bump côté on-chain documentée
3. [ ] Régénérer les IDL et mettre à jour les discriminators côté UI/SDK
   - `anchor idl init` pour chaque programme déployé
   - Remplacer les placeholders (0x01/0x02) dans les appels front-end
4. [ ] Automatiser un test lock/unlock devnet (`tests/lock-unlock-test.ts`)
   - Script de scénarisation TS couvrant lock → unlock → vérifications d'état
