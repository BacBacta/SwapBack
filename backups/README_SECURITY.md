# 🔐 Programme Keypairs - BACKUP CRITIQUE

**⚠️ ATTENTION SÉCURITÉ MAXIMALE ⚠️**

## 📁 Contenu de ce dossier

Ce dossier contient les **keypairs des programmes Solana déployés** :

- `swapback_router-keypair-YYYYMMDD.json` - Router Program Authority
- `swapback_buyback-keypair-YYYYMMDD.json` - Buyback Program Authority

## 🚨 Importance CRITIQUE

Ces keypairs sont **IRREMPLAÇABLES** :

1. **Upgrade Authority** - Seul moyen de mettre à jour les programmes déployés
2. **Program ID** - Dérivé de ces keypairs, utilisé partout dans le code
3. **Perte = Programmes Gelés** - Sans backup, impossible de modifier les programmes

## 🔒 Sécurité Obligatoire

### ✅ Actions à faire IMMÉDIATEMENT :

```bash
# 1. Copier ces backups dans un stockage sécurisé externe
cp backups/*.json /path/to/secure/location/

# 2. Chiffrer avec GPG (recommandé)
gpg --symmetric --cipher-algo AES256 backups/swapback_router-keypair-20251019.json
gpg --symmetric --cipher-algo AES256 backups/swapback_buyback-keypair-20251019.json

# 3. Stockage multi-localisations :
# - USB sécurisée (chiffrée)
# - Coffre-fort physique
# - Gestionnaire de secrets cloud (HashiCorp Vault, AWS Secrets Manager)
# - Stockage offline froid
```

### ❌ NE JAMAIS :

- ❌ Commiter ces fichiers dans Git (déjà dans `.gitignore`)
- ❌ Les envoyer par email/chat non chiffré
- ❌ Les stocker sur des services cloud publics (Dropbox, Google Drive)
- ❌ Les partager via screenshot ou copier-coller
- ❌ Les laisser uniquement sur devnet/dev container

## 🔑 Program IDs Actuels

**Router Program:** `3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap`
**Buyback Program:** `46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU`

## 🛡️ Procédure de Restauration

Si perte du dev container :

```bash
# 1. Recréer structure
mkdir -p target/deploy

# 2. Restaurer keypairs depuis backup sécurisé
cp /secure/backup/swapback_router-keypair-YYYYMMDD.json target/deploy/swapback_router-keypair.json
cp /secure/backup/swapback_buyback-keypair-YYYYMMDD.json target/deploy/swapback_buyback-keypair.json

# 3. Vérifier Program IDs
solana-keygen pubkey target/deploy/swapback_router-keypair.json
# Doit afficher: 3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap

solana-keygen pubkey target/deploy/swapback_buyback-keypair.json
# Doit afficher: 46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU
```

## 📝 Log des Backups

| Date       | Router Keypair                   | Buyback Keypair                   | Status    |
| ---------- | -------------------------------- | --------------------------------- | --------- |
| 2025-10-19 | swapback_router-keypair-20251019 | swapback_buyback-keypair-20251019 | ✅ Active |

## 🔄 Politique de Rotation

**MAINNET** : Rotation tous les 6 mois ou après incident de sécurité
**DEVNET** : Conserver pour cohérence avec déploiements existants

---

**Date de création:** 2025-10-19  
**Dernière mise à jour:** 2025-10-19  
**Criticité:** P0 - SÉCURITÉ MAXIMALE
