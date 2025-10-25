"use client";

export const OperationHistory = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Historique des Opérations
          </h2>
          <p className="text-gray-300 mb-6">
            L'historique détaillé de vos transactions sera affiché ici.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl mb-2">🔄</div>
              <div className="text-lg font-bold text-white">Swaps</div>
              <div className="text-gray-300">0</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl mb-2">🔒</div>
              <div className="text-lg font-bold text-white">Locks</div>
              <div className="text-gray-300">0</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl mb-2">🔓</div>
              <div className="text-lg font-bold text-white">Unlocks</div>
              <div className="text-gray-300">0</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl mb-2">🔥</div>
              <div className="text-lg font-bold text-white">Burns</div>
              <div className="text-gray-300">0</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
