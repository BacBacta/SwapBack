#!/bin/bash
# 🔧 Script à exécuter sur VOTRE MACHINE LOCALE (pas dans VS Code Remote)
# Pour stabiliser la connexion VS Code Desktop → Codespace Remote

set -e

echo "🔧 Configuration SSH Keepalive pour VS Code Desktop → Remote"
echo ""
echo "⚠️  Ce script doit être exécuté sur VOTRE MACHINE LOCALE (pas dans le Codespace)"
echo ""

# Détection de l'OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macOS"
    SSH_CONFIG="$HOME/.ssh/config"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
    SSH_CONFIG="$HOME/.ssh/config"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    OS="Windows"
    SSH_CONFIG="$HOME/.ssh/config"
else
    echo "❌ OS non supporté: $OSTYPE"
    exit 1
fi

echo "✅ OS détecté: $OS"
echo ""

# Créer le répertoire .ssh s'il n'existe pas
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

# Sauvegarder l'ancienne config si elle existe
if [ -f "$SSH_CONFIG" ]; then
    echo "📁 Sauvegarde de la config SSH existante..."
    cp "$SSH_CONFIG" "$SSH_CONFIG.backup-$(date +%Y%m%d-%H%M%S)"
    echo "✅ Backup créé: $SSH_CONFIG.backup-$(date +%Y%m%d-%H%M%S)"
    echo ""
fi

# Vérifier si la config existe déjà
if grep -q "Host \*.github.dev" "$SSH_CONFIG" 2>/dev/null; then
    echo "⚠️  Configuration pour *.github.dev existe déjà"
    echo "📝 Vérifiez manuellement: $SSH_CONFIG"
    echo ""
    cat "$SSH_CONFIG"
    echo ""
    read -p "Voulez-vous remplacer la config existante ? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Annulé par l'utilisateur"
        exit 0
    fi
    
    # Supprimer l'ancienne config pour *.github.dev
    sed -i.bak '/Host \*.github.dev/,/^$/d' "$SSH_CONFIG"
fi

# Ajouter la nouvelle config
cat >> "$SSH_CONFIG" << 'EOF'

# VS Code Remote → GitHub Codespaces - Connexion stable
Host *.github.dev
    ServerAliveInterval 30
    ServerAliveCountMax 20
    TCPKeepAlive yes
    Compression yes
    ConnectionAttempts 5
    ConnectTimeout 600
    ControlMaster no
    ControlPath none
    AddressFamily inet

EOF

echo "✅ Configuration SSH ajoutée avec succès !"
echo ""
echo "📋 Configuration appliquée:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$SSH_CONFIG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Instructions finales
echo "🎯 Prochaines étapes:"
echo ""
echo "1. ✅ Configuration SSH terminée"
echo ""
echo "2. 🔄 Rechargez VS Code Desktop:"
if [[ "$OS" == "macOS" ]]; then
    echo "   → Cmd + R"
elif [[ "$OS" == "Windows" ]]; then
    echo "   → Ctrl + R"
else
    echo "   → Ctrl + R"
fi
echo ""
echo "3. 🔌 Reconnectez au Codespace:"
echo "   → Cmd/Ctrl + Shift + P"
echo "   → 'Remote-SSH: Connect to Host...'"
echo "   → Sélectionnez votre Codespace"
echo ""
echo "4. ⏱️  Testez pendant 15 minutes"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Paramètres appliqués:"
echo "  • Ping toutes les 30 secondes"
echo "  • Tolère 20 échecs (= 10 minutes de tolérance)"
echo "  • TCP keepalive activé"
echo "  • Compression activée"
echo "  • 5 tentatives de reconnexion automatique"
echo "  • Timeout de connexion: 10 minutes"
echo ""
echo "🆘 Si déconnexions persistent:"
echo "  → Voir le guide: VSCODE_DESKTOP_DISCONNECT_FIX.md"
echo ""
echo "✅ Configuration terminée avec succès !"
echo ""

# Afficher l'emplacement du fichier
echo "📍 Fichier de configuration: $SSH_CONFIG"
echo "📍 Backup sauvegardé dans: $SSH_CONFIG.backup-*"
echo ""
