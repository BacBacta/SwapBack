#!/bin/bash
# Script de nettoyage des processus VS Code en double
# Créé pour résoudre les problèmes de performance et bugs VS Code

echo "🧹 Nettoyage des processus VS Code en double..."

# Arrêter les serveurs ESLint en double (garde seulement le plus récent)
ESLINT_PIDS=$(pgrep -f "eslintServer.js" | head -n -1)
if [ -n "$ESLINT_PIDS" ]; then
  echo "🔴 Arrêt de $(echo "$ESLINT_PIDS" | wc -l) serveurs ESLint en double..."
  echo "$ESLINT_PIDS" | xargs -r kill -15
  echo "✅ Serveurs ESLint nettoyés"
else
  echo "✅ Aucun serveur ESLint en double trouvé"
fi

# Arrêter les serveurs TypeScript zombies
TS_PIDS=$(pgrep -f "typescript.*tsserver" | head -n -1)
if [ -n "$TS_PIDS" ]; then
  echo "🔴 Arrêt de $(echo "$TS_PIDS" | wc -l) serveurs TypeScript en double..."
  echo "$TS_PIDS" | xargs -r kill -15
  echo "✅ Serveurs TypeScript nettoyés"
else
  echo "✅ Aucun serveur TypeScript en double trouvé"
fi

# Nettoyer les processus Next.js zombies
NEXT_ZOMBIES=$(ps aux | grep -E "next-server|next dev" | grep -v grep | awk '{if ($8 ~ /[ZD]/) print $2}')
if [ -n "$NEXT_ZOMBIES" ]; then
  echo "🔴 Arrêt de $(echo "$NEXT_ZOMBIES" | wc -l) processus Next.js zombies..."
  echo "$NEXT_ZOMBIES" | xargs -r kill -9
  echo "✅ Processus Next.js nettoyés"
else
  echo "✅ Aucun processus Next.js zombie trouvé"
fi

# Afficher l'utilisation mémoire
echo ""
echo "📊 Utilisation mémoire après nettoyage:"
free -h | grep Mem

echo ""
echo "✅ Nettoyage terminé! Rechargez la fenêtre VS Code (Cmd/Ctrl+Shift+P → 'Reload Window')"
