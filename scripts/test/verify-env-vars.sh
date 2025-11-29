#!/bin/bash
# Script pour vérifier et documenter les variables d'environnement requises

echo "🔍 Variables d'Environnement Requises pour Vercel"
echo "=================================================="
echo ""
echo "⚠️  ATTENTION: Les variables suivantes DOIVENT être définies sur Vercel Dashboard"
echo "    https://vercel.com/bactas-projects/swap-back-app/settings/environment-variables"
echo ""

# Variables correctes
cat << EOF
✅ VARIABLES D'ENVIRONNEMENT CORRECTES:

1. NEXT_PUBLIC_CNFT_PROGRAM_ID
   Valeur: DGDipfpHGVAnWXj7yPEBc3JYFWghQN76tEBzuK2Nojw3
   Description: ID du programme Solana CNFT (smart contract)
   ⚠️  PAS 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux (c'est le MINT, pas le PROGRAM!)

2. NEXT_PUBLIC_BACK_MINT
   Valeur: 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
   Description: Adresse du token BACK (Token-2022, 9 decimals)

3. NEXT_PUBLIC_COLLECTION_CONFIG
   Valeur: 8EoDB3TGsTytD4AFz5GyRYwvqoP8NB6tWpa2cVJQGtM7
   Description: PDA collection_config initialisé le 18 Nov 2025

4. NEXT_PUBLIC_RPC_URL
   Valeur: https://api.devnet.solana.com
   Description: RPC endpoint Solana devnet

5. NEXT_PUBLIC_ROUTER_PROGRAM_ID
   Valeur: (votre program ID du router)
   Description: ID du programme SwapBack Router

6. NEXT_PUBLIC_BUYBACK_PROGRAM_ID
   Valeur: (votre program ID du buyback)
   Description: ID du programme SwapBack Buyback

EOF

echo ""
echo "📋 ÉTAPES POUR METTRE À JOUR SUR VERCEL:"
echo ""
echo "1. Aller sur: https://vercel.com/bactas-projects/swap-back-app/settings/environment-variables"
echo "2. Cliquer sur 'Edit' à côté de NEXT_PUBLIC_CNFT_PROGRAM_ID"
echo "3. Changer la valeur de:"
echo "   862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux (❌ INCORRECT - c'est le MINT!)"
echo "   À:"
echo "   DGDipfpHGVAnWXj7yPEBc3JYFWghQN76tEBzuK2Nojw3 (✅ CORRECT - c'est le PROGRAM!)"
echo "4. Sauvegarder"
echo "5. Redéployer l'application (Vercel le proposera automatiquement)"
echo ""
echo "OU utiliser la CLI Vercel:"
echo ""
echo "  vercel env rm NEXT_PUBLIC_CNFT_PROGRAM_ID production"
echo "  vercel env add NEXT_PUBLIC_CNFT_PROGRAM_ID production"
echo "  # Puis entrer: DGDipfpHGVAnWXj7yPEBc3JYFWghQN76tEBzuK2Nojw3"
echo "  vercel --prod"
echo ""

# Vérifier les valeurs locales
echo "🔍 VÉRIFICATION DES VALEURS LOCALES:"
echo ""

if [ -f "app/.env.local" ]; then
    echo "📄 Contenu de app/.env.local:"
    grep "NEXT_PUBLIC_" app/.env.local || echo "Aucune variable NEXT_PUBLIC_ trouvée"
else
    echo "⚠️  Fichier app/.env.local non trouvé"
fi

echo ""
echo "🧪 TEST DES PROGRAM IDs:"
echo ""

# Test avec solana CLI
export PATH="/home/codespace/.local/share/solana/install/active_release/bin:$PATH"

echo "Programme CNFT (DGDipf...):"
solana account DGDipfpHGVAnWXj7yPEBc3JYFWghQN76tEBzuK2Nojw3 --url devnet --output json 2>/dev/null | jq -r '.owner' || echo "  ⚠️  Erreur de requête"

echo ""
echo "Token BACK (862PQyz...):"
solana account 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux --url devnet --output json 2>/dev/null | jq -r '.owner' || echo "  ⚠️  Erreur de requête"

echo ""
echo "✅ Si le programme CNFT a owner = 'BPFLoaderUpgradeab1e11111111111111111111111', c'est un programme Solana"
echo "✅ Si le token BACK a owner = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', c'est un token Token-2022"
echo ""
