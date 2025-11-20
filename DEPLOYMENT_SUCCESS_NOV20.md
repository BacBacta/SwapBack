# ✅ Déploiement Réussi - 20 Novembre 2025

## 🚀 Résumé

Le programme `swapback_cnft` a été redéployé avec succès sur Devnet pour résoudre le problème de désérialisation du compte `GlobalState`.

## 🔑 Détails Techniques

- **Nouveau Program ID**: `EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP`
- **Ancien Program ID**: `DGDipfpHGVAnWXj7yPEBc3JYFWghQN76tEBzuK2Nojw3`
- **GlobalState**: Initialisé avec succès (272 bytes).
- **Wallet Authority**: `DAdb3ArBvhJ77trTRUs5wbHARGXdupoAgjSYCHpkt6gP`

## 📝 Actions Effectuées

1. Génération d'une nouvelle keypair (`target/deploy/swapback_cnft-keypair.json`).
2. Mise à jour de `Anchor.toml` et `programs/swapback_cnft/src/lib.rs`.
3. Build et déploiement via `scripts/redeploy-cnft.sh`.
4. Initialisation du `GlobalState` on-chain.
5. Mise à jour de la configuration frontend (`app/.env.local`).
6. Mise à jour de l'IDL (`app/src/idl/swapback_cnft.json`).

## 🔜 Prochaines Étapes

1. **Frontend**: Redéployer l'application frontend (Vercel) pour prendre en compte les nouvelles variables d'environnement.
2. **Tests**: Vérifier le fonctionnement du lock/unlock sur le dashboard.
