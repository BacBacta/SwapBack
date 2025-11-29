#!/bin/bash
# Surveillance Codespace - Évite les déconnexions

echo "🔍 Surveillance démarrée (Ctrl+C pour arrêter)"

while true; do
  MEM_USED=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
  
  if [ "$MEM_USED" -gt 75 ]; then
    echo "$(date '+%H:%M:%S') ⚠️  Mémoire: ${MEM_USED}%"
    
    # Limiter TypeScript servers
    TS_COUNT=$(ps aux | grep "tsserver.js" | grep -v grep | wc -l)
    if [ "$TS_COUNT" -gt 2 ]; then
      echo "  → Nettoyage $TS_COUNT serveurs TS"
      ps aux | grep "tsserver.js" | grep -v grep | tail -n +3 | awk '{print $2}' | xargs -r kill 2>/dev/null
    fi
    
    # Limiter ESLint servers
    ESL_COUNT=$(ps aux | grep "eslintServer" | grep -v grep | wc -l)
    if [ "$ESL_COUNT" -gt 1 ]; then
      echo "  → Redémarrage ESLint"
      pkill -f "eslintServer" 2>/dev/null
    fi
  fi
  
  sleep 30
done
