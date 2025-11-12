# 🚨 ACTION IMMÉDIATE REQUISE - Programme à redéployer

## Problème actuel

❌ **TOUS les locks/unlocks échouent** avec l'erreur:
```
Error: AnchorError caused by account: cnft_program. Error Code: DeclaredProgramIdMismatch. Error Number: 4100.
```

## Cause racine

Le programme déployé sur Solana devnet (`26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru`) a été compilé avec un **ancien `declare_id!`**:
- ❌ Binaire on-chain: `CzxpYBeKbcA6AJH7yz8ggkJ1cWen3ejKUuikE6stHEaF`
- ✅ Code source actuel: `26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru`

Anchor vérifie au runtime que le `declare_id!` compilé dans le programme correspond à l'adresse du programme. **Mismatch = toutes les transactions échouent.**

## Solution (5 minutes sur machine locale)

### Prérequis
- Machine avec **Rust** et **Anchor CLI** installés (PAS Codespaces)
- Keypair avec l'upgrade authority: `578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf`
- ~0.5 SOL sur devnet pour les frais de déploiement

### Commandes

```bash
# 1. Clone et build
git clone https://github.com/BacBacta/SwapBack.git
cd SwapBack
anchor build --program-name swapback_cnft

# 2. Configure wallet
export ANCHOR_WALLET=~/.config/solana/id.json  # Ton keypair avec authority
solana address  # Vérifie: 578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf

# 3. Redéploie (upgrade)
solana program deploy \
    --url devnet \
    --program-id target/deploy/swapback_cnft-keypair.json \
    --upgrade-authority $ANCHOR_WALLET \
    target/deploy/swapback_cnft.so

# 4. Attends 30 secondes puis teste sur Vercel
```

## Vérification post-déploiement

```bash
# Le programme doit avoir:
solana program show 26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru --url devnet

# Authority: 578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf ✅
# Last Deployed Slot: [NOUVEAU NUMERO] ✅
```

Puis teste un lock sur https://swap-back-pc5qkn6em-bactas-projects.vercel.app/ - l'erreur `DeclaredProgramIdMismatch` doit avoir disparu.

## Pourquoi Codespaces ne marche pas?

```bash
$ cargo --version
zsh: command not found: cargo
```

Codespaces Ubuntu n'a pas le toolchain Rust/Cargo installé. Le build doit être fait sur:
- Ta machine locale avec Rust
- Un autre Codespace avec Rust installé
- Un runner CI/CD avec l'environnement Solana

## Fichiers de référence

- **Documentation complète**: `/workspaces/SwapBack/REDEPLOY_CNFT_FIX.md`
- **Script automatisé**: `/workspaces/SwapBack/scripts/rebuild-and-deploy-cnft.sh` (pour machine avec cargo)
- **Historique git**: Commit `03646aa` avait l'ancien declare_id! `CzxpYBeKbcA6...`

## Timeline

- ✅ 2024-01-XX: Programme compilé avec ancien ID
- ✅ 2024-11-12 00:15: Binaire existant dans target/deploy (417K)  
- ✅ Aujourd'hui: Code source mis à jour avec nouveau declare_id!
- ❌ Aujourd'hui: Binaire déployé toujours avec ancien declare_id! → **À corriger maintenant**

---

**Action requise**: Exécuter les commandes ci-dessus sur une machine avec Rust/Anchor installé. Une fois redéployé, toutes les fonctionnalités lock/unlock fonctionneront.
