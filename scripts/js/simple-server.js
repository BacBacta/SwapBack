const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SwapBack - Interface Temporaire</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gray-900 text-white">
    <main class="container mx-auto px-6 py-12">
        <div class="text-center mb-16 mt-12">
            <div class="inline-block mb-4">
                <div class="flex items-center gap-3 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
                    <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    <span class="text-sm font-medium text-gray-300">Live on Solana</span>
                </div>
            </div>
            
            <h1 class="text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-6">
                SwapBack
            </h1>
            <p class="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
                The most advanced swap router on Solana. Maximize profits, minimize fees, earn rebates.
            </p>
            
            <div class="bg-gray-800 rounded-xl p-8 max-w-2xl mx-auto border border-gray-700">
                <h2 class="text-2xl font-semibold mb-6 text-center">🚀 Application Status</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="text-center">
                        <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl">✅</span>
                        </div>
                        <h3 class="font-semibold mb-2">Programs Compiled</h3>
                        <p class="text-sm text-gray-400">4 Solana programs ready</p>
                    </div>
                    <div class="text-center">
                        <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl">🚀</span>
                        </div>
                        <h3 class="font-semibold mb-2">Deployment Ready</h3>
                        <p class="text-sm text-gray-400">Devnet deployment prepared</p>
                    </div>
                    <div class="text-center">
                        <div class="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl">🔧</span>
                        </div>
                        <h3 class="font-semibold mb-2">Interface Loading</h3>
                        <p class="text-sm text-gray-400">SDK compilation in progress</p>
                    </div>
                </div>
                
                <div class="mt-8 p-4 bg-gray-700 rounded-lg">
                    <h3 class="font-semibold mb-2">📋 Next Steps:</h3>
                    <ul class="text-sm text-gray-300 space-y-1">
                        <li>• Fix SDK TypeScript compilation errors</li>
                        <li>• Resolve Jupiter API integration</li>
                        <li>• Complete wallet integration</li>
                        <li>• Deploy to Solana Devnet</li>
                    </ul>
                </div>
            </div>
        </div>
    </main>
</body>
</html>`;
  res.end(html);
});

server.listen(3001, () => {
  console.log('Server running at http://localhost:3001');
});
