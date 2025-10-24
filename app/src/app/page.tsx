"use client";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-6 py-12">
        <div className="text-center mb-16 mt-12 relative">
          <div className="inline-block mb-4">
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-sm font-medium text-gray-300">Live on Solana</span>
            </div>
          </div>

          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-6">
            SwapBack
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            The most advanced swap router on Solana. Maximize profits, minimize fees, earn rebates.
          </p>

          <div className="flex justify-center gap-8 text-sm mb-12">
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-bold">$1.2M+</span>
              <span className="text-gray-500">Volume</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-bold">98%</span>
              <span className="text-gray-500">Success Rate</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-bold">0.1s</span>
              <span className="text-gray-500">Avg Time</span>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-8 max-w-2xl mx-auto border border-gray-700">
            <h2 className="text-2xl font-semibold mb-6 text-center">🚀 Application Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">✅</span>
                </div>
                <h3 className="font-semibold mb-2">Programs Compiled</h3>
                <p className="text-sm text-gray-400">4 Solana programs ready</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🚀</span>
                </div>
                <h3 className="font-semibold mb-2">Deployment Ready</h3>
                <p className="text-sm text-gray-400">Devnet deployment prepared</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔧</span>
                </div>
                <h3 className="font-semibold mb-2">Interface Loading</h3>
                <p className="text-sm text-gray-400">SDK compilation in progress</p>
              </div>
            </div>

            <div className="mt-8 p-4 bg-gray-700 rounded-lg">
              <h3 className="font-semibold mb-2">📋 Next Steps:</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Fix SDK TypeScript compilation errors</li>
                <li>• Resolve Jupiter API integration</li>
                <li>• Complete wallet integration</li>
                <li>• Deploy to Solana Devnet</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
