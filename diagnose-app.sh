#!/bin/bash
echo "🔍 DIAGNOSTIC COMPLET DE L'APPLICATION"
echo "========================================"

echo ""
echo "1. État des processus Node.js/Next.js:"
ps aux | grep -E "(node|next)" | grep -v grep | head -5

echo ""
echo "2. Ports ouverts:"
netstat -tlnp 2>/dev/null | grep -E ":300[0-9]" || echo "Aucun port 300x trouvé"

echo ""
echo "3. Test de connectivité localhost:"
curl -s --connect-timeout 3 -o /dev/null -w "HTTP %{http_code} - %{time_total}s\n" http://localhost:3000 2>/dev/null || echo "❌ Échec de connexion"

echo ""
echo "4. Variables d'environnement importantes:"
env | grep -E "(PORT|HOST|CODESPACE|GITHUB)" | head -5

echo ""
echo "5. Logs récents de l'application:"
tail -10 /tmp/swapback-app.log 2>/dev/null || echo "Pas de logs trouvés"

echo ""
echo "6. Test du système de fichiers:"
ls -la /workspaces/SwapBack/app/package.json 2>/dev/null && echo "✅ package.json trouvé" || echo "❌ package.json manquant"

echo ""
echo "🔧 RECOMMANDATIONS:"
echo "- Si l'application ne répond pas, essayez: cd /workspaces/SwapBack && ./start-app-background.sh"
echo "- Pour voir les logs en temps réel: tail -f /tmp/swapback-app.log"
echo "- Pour forcer un redémarrage: pkill -f 'next' && ./start-app-background.sh"
