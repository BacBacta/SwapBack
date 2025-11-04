#!/bin/bash

echo "🧹 Nettoyage localStorage DCA et test"
echo ""

cat > /tmp/reset-dca-storage.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Reset DCA Storage</title>
    <style>
        body { 
            font-family: monospace; 
            padding: 20px; 
            background: #1a1a1a; 
            color: #0f0; 
        }
        .log { margin: 5px 0; }
        .success { color: #0f0; }
        .error { color: #f00; }
        button { 
            padding: 15px 30px; 
            margin: 10px 5px; 
            background: #0f0; 
            color: #000; 
            border: none; 
            cursor: pointer;
            font-family: monospace;
            font-size: 14px;
        }
        button.danger {
            background: #f00;
            color: #fff;
        }
        #logs {
            margin-top: 20px;
            padding: 10px;
            background: #000;
            border: 1px solid #0f0;
        }
    </style>
</head>
<body>
    <h1>🧹 Outils DCA Storage</h1>
    
    <div>
        <button onclick="checkStorage()">📊 VÉRIFIER STORAGE</button>
        <button class="danger" onclick="clearStorage()">🗑️ EFFACER STORAGE</button>
        <button onclick="testCreate()">✅ TESTER CRÉATION</button>
    </div>
    
    <div id="logs"></div>
    
    <script>
        function log(message, isError = false) {
            const div = document.createElement('div');
            div.className = 'log ' + (isError ? 'error' : 'success');
            div.textContent = '> ' + message;
            document.getElementById('logs').appendChild(div);
        }
        
        function clearLogs() {
            document.getElementById('logs').innerHTML = '';
        }
        
        function checkStorage() {
            clearLogs();
            log('🔍 Vérification du localStorage...');
            
            let found = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('swapback_dca_')) {
                    found++;
                    log(`📦 Clé trouvée: ${key}`);
                    
                    try {
                        const data = JSON.parse(localStorage.getItem(key) || '[]');
                        log(`   📊 ${data.length} plan(s) DCA enregistré(s)`);
                        
                        data.forEach((plan, idx) => {
                            log(`   Plan ${idx + 1}:`);
                            log(`      - ID: ${plan.id}`);
                            log(`      - ${plan.inputToken} → ${plan.outputToken}`);
                            log(`      - Montant: ${plan.amountPerOrder}`);
                            log(`      - Fréquence: ${plan.frequency}`);
                            log(`      - Type createdAt: ${typeof plan.createdAt}`);
                            log(`      - Type nextExecution: ${typeof plan.nextExecution}`);
                        });
                    } catch (e) {
                        log(`   ❌ ERREUR parsing: ${e.message}`, true);
                    }
                }
            }
            
            if (found === 0) {
                log('⚠️ Aucune donnée DCA trouvée');
            } else {
                log(`✅ ${found} clé(s) trouvée(s)`);
            }
        }
        
        function clearStorage() {
            if (!confirm('⚠️ Êtes-vous sûr de vouloir effacer toutes les données DCA ?')) {
                return;
            }
            
            clearLogs();
            log('🗑️ Suppression des données DCA...');
            
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('swapback_dca_')) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                log(`✅ Supprimé: ${key}`);
            });
            
            log(`✅ ${keysToRemove.length} clé(s) supprimée(s)`);
            log('🔄 Rechargez l\'application SwapBack maintenant');
        }
        
        function testCreate() {
            clearLogs();
            log('🧪 Test de création DCA...');
            
            const publicKey = 'TEST_WALLET_' + Date.now();
            const planId = Date.now().toString();
            const planPda = `DCA_${publicKey.slice(0, 8)}_${planId}`;
            
            const newOrder = {
                id: planPda,
                inputToken: 'SOL',
                outputToken: 'USDC',
                amountPerOrder: 0.1,
                frequency: 'daily',
                totalOrders: 10,
                executedOrders: 0,
                nextExecution: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                status: 'active',
                createdAt: new Date().toISOString(),
                totalInvested: 0,
                averagePrice: 0
            };
            
            log(`✅ Plan créé (structure):`, false);
            log(`   ID: ${newOrder.id}`);
            log(`   ${newOrder.inputToken} → ${newOrder.outputToken}`);
            
            try {
                const storageKey = `swapback_dca_${publicKey}`;
                const existing = localStorage.getItem(storageKey);
                const orders = existing ? JSON.parse(existing) : [];
                orders.push(newOrder);
                
                localStorage.setItem(storageKey, JSON.stringify(orders));
                log(`✅ Sauvegardé avec clé: ${storageKey}`);
                
                // Vérifier la lecture
                const readBack = JSON.parse(localStorage.getItem(storageKey) || '[]');
                log(`✅ Lecture réussie: ${readBack.length} plan(s)`);
                
                const firstPlan = readBack[0];
                log(`   createdAt: ${firstPlan.createdAt} (${typeof firstPlan.createdAt})`);
                log(`   nextExecution: ${firstPlan.nextExecution} (${typeof firstPlan.nextExecution})`);
                
                log('✅ TEST RÉUSSI - La sérialisation fonctionne');
                
                // Nettoyer le test
                localStorage.removeItem(storageKey);
                log('🧹 Test nettoyé');
                
            } catch (e) {
                log(`❌ ERREUR: ${e.message}`, true);
            }
        }
    </script>
</body>
</html>
EOF

echo "✅ Fichier créé: /tmp/reset-dca-storage.html"
echo ""
echo "📋 INSTRUCTIONS:"
echo ""
echo "1️⃣  Ouvrez ce fichier dans votre navigateur:"
echo "    file:///tmp/reset-dca-storage.html"
echo ""
echo "2️⃣  Cliquez sur [📊 VÉRIFIER STORAGE] pour voir les données actuelles"
echo ""
echo "3️⃣  Si vous voyez des erreurs de format, cliquez sur [🗑️ EFFACER STORAGE]"
echo ""
echo "4️⃣  Rechargez http://localhost:3000 et testez la création DCA"
echo ""
echo "5️⃣  Utilisez [✅ TESTER CRÉATION] pour vérifier que la nouvelle version fonctionne"
echo ""
