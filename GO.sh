#!/bin/bash

# COMMANDE UNIQUE POUR TOUT FINALISER
# Exécutez simplement : ./GO.sh

set -e

clear

cat << "EOF"
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║       🚀 SWAPBACK - FINALISATION AUTOMATIQUE 🚀              ║
║                                                              ║
║  Ce script va résoudre le problème de build et préparer     ║
║  le projet pour le déploiement                               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

EOF

echo "📋 ÉTAPES QUI VONT ÊTRE EXÉCUTÉES:"
echo ""
echo "  1. ✅ Charger l'environnement"
echo "  2. ✅ Sauvegarder le code actuel"
echo "  3. ✅ Créer un projet Anchor propre"
echo "  4. ✅ Copier votre code"
echo "  5. ✅ Tenter un build"
echo "  6. ✅ Afficher les prochaines étapes"
echo ""
echo "⏱️  Temps estimé : 2-5 minutes"
echo ""

read -p "Voulez-vous continuer ? (o/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
    echo "❌ Annulé."
    exit 1
fi

echo ""
echo "🚀 C'est parti !"
echo ""

# Exécuter le script de rebuild
./scripts/rebuild-clean.sh

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                     ✅ SCRIPT TERMINÉ                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📖 PROCHAINES ÉTAPES :"
echo ""
echo "  Consultez le fichier FINALISATION.md pour la suite"
echo "  Ou exécutez : cat ETAPES_FINALES.md"
echo ""
echo "🎯 Si le build a réussi :"
echo "  cd /tmp/swapback_clean"
echo "  anchor test"
echo "  anchor deploy --provider.cluster devnet"
echo ""
echo "💡 Besoin d'aide ? Consultez INDEX.md pour naviguer"
echo ""
