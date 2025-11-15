# 🚀 DÉPLOIEMENT MAINTENANT

Vous êtes prêt à déployer! Voici les 3 commandes exactes à exécuter:

## 1️⃣ Générer nouvelle keypair et Program ID

```bash
cd /workspaces/SwapBack
mkdir -p target/deploy
solana-keygen new --no-bip39-passphrase -o target/deploy/swapback_cnft-keypair.json --force
NEW_PROGRAM_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)
echo "Program ID: $NEW_PROGRAM_ID"
```

Notez bien le Program ID affiché!

## 2️⃣ Mettre à jour le code avec le nouveau Program ID

```bash
# Remplacer le declare_id dans lib.rs
sed -i "s/declare_id!(\"[^\"]*\")/declare_id!(\"$NEW_PROGRAM_ID\")/" programs/swapback_cnft/src/lib.rs

# Vérifier
head -20 programs/swapback_cnft/src/lib.rs | grep declare_id
```

## 3️⃣ Builder le programme

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd /workspaces/SwapBack/programs/swapback_cnft
cargo build --release --target sbf-solana-solana 2>&1 | tail -50
```

Cela prendra ~5-10 minutes la première fois.

## 4️⃣ Déployer sur devnet

```bash
cd /workspaces/SwapBack
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

solana program deploy \
  --program-id target/deploy/swapback_cnft-keypair.json \
  target/sbf-solana-solana/release/swapback_cnft.so \
  --url https://api.devnet.solana.com \
  --commitment confirmed
```

## 5️⃣ Mettre à jour le frontend

```bash
./update-frontend-program-id.sh $NEW_PROGRAM_ID
```

## 6️⃣ Initialiser et tester

```bash
ts-node scripts/init-cnft.ts
ts-node scripts/test-lock-unlock.ts
```

---

**C'est tout!** Votre programme est déployé! 🎉

