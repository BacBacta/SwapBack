#!/bin/bash

echo "📤 Pushing to GitHub..."
echo ""

git push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Push réussi!"
    echo ""
    echo "🎉 Toutes les modifications Phase 2C & 2D sont maintenant sur GitHub!"
else
    echo ""
    echo "❌ Push échoué. Vérifiez votre connexion."
fi
