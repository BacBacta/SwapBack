// Test rapide de santé de l'application
const http = require('http');

const tests = [
  { name: 'Page principale', path: '/' },
  { name: 'Page DCA', path: '/dca' },
  { name: 'Page Swap', path: '/swap-enhanced' },
  { name: 'Page Dashboard', path: '/dashboard' },
];

async function testEndpoint(path) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      resolve({
        status: res.statusCode,
        ok: res.statusCode === 200
      });
    }).on('error', (err) => {
      resolve({ status: 0, ok: false, error: err.message });
    });
  });
}

async function runHealthCheck() {
  console.log('🏥 Test de santé de l\'application SwapBack\n');
  
  let allPassed = true;
  
  for (const test of tests) {
    const result = await testEndpoint(test.path);
    const status = result.ok ? '✅' : '❌';
    console.log(`${status} ${test.name.padEnd(20)} → ${result.status === 200 ? 'OK' : 'Erreur ' + result.status}`);
    if (!result.ok) allPassed = false;
  }
  
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('✅ Tous les tests passés !');
    console.log('\n📝 Configuration:');
    console.log('   - Réseau: devnet');
    console.log('   - RPC: https://api.devnet.solana.com');
    console.log('   - Environnement: .env.local chargé');
  } else {
    console.log('❌ Certains tests ont échoué');
  }
  
  process.exit(allPassed ? 0 : 1);
}

// Attendre que le serveur soit prêt
setTimeout(runHealthCheck, 2000);
