#!/bin/bash

echo "🔍 Vérification de l'application SwapBack..."
echo ""

# 1. Vérifier que le serveur répond
echo "1️⃣ Test de connexion à http://localhost:3000..."
if curl -s -f -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    echo "✅ Serveur répond (HTTP 200)"
else
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
    echo "⚠️ Serveur répond avec code: $HTTP_CODE"
fi

echo ""

# 2. Vérifier les composants clés
echo "2️⃣ Vérification des fichiers clés..."
FILES=(
    "/workspaces/SwapBack/app/src/app/page.tsx"
    "/workspaces/SwapBack/app/src/components/Dashboard.tsx"
    "/workspaces/SwapBack/app/src/components/LockUnlock.tsx"
    "/workspaces/SwapBack/app/src/lib/cnft.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $(basename $file) existe"
    else
        echo "❌ $(basename $file) manquant"
    fi
done

echo ""

# 3. Vérifier les imports dans page.tsx
echo "3️⃣ Vérification des imports dans page.tsx..."
if grep -q "import { Dashboard }" /workspaces/SwapBack/app/src/app/page.tsx; then
    echo "✅ Dashboard importé correctement"
else
    echo "❌ Dashboard non importé"
fi

if grep -q "<Dashboard />" /workspaces/SwapBack/app/src/app/page.tsx; then
    echo "✅ Dashboard utilisé dans le JSX"
else
    echo "❌ Dashboard non utilisé"
fi

echo ""

# 4. Vérifier Dashboard.tsx
echo "4️⃣ Vérification de Dashboard.tsx..."
if grep -q '"strategies"' /workspaces/SwapBack/app/src/components/Dashboard.tsx; then
    echo "✅ Onglet 'strategies' présent"
else
    echo "❌ Onglet 'strategies' manquant"
fi

if grep -q 'strategyTab === "lockunlock"' /workspaces/SwapBack/app/src/components/Dashboard.tsx; then
    echo "✅ Sous-onglet 'lockunlock' présent"
else
    echo "❌ Sous-onglet 'lockunlock' manquant"
fi

if grep -q '<LockUnlock />' /workspaces/SwapBack/app/src/components/Dashboard.tsx; then
    echo "✅ Composant LockUnlock rendu"
else
    echo "❌ Composant LockUnlock non rendu"
fi

echo ""

# 5. Vérifier les logs du serveur
echo "5️⃣ État du serveur Next.js..."
if pgrep -f "next dev" > /dev/null; then
    echo "✅ Serveur Next.js en cours d'exécution (PID: $(pgrep -f 'next dev'))"
else
    echo "❌ Serveur Next.js arrêté"
fi

echo ""
echo "🎯 Vérification terminée !"
