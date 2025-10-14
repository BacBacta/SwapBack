/**
 * Route Comparison Chart
 * Visual comparison of route options
 */

'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSwapStore } from '@/store/swapStore';

export function RouteComparison() {
  const { routes } = useSwapStore();

  if (routes.routes.length === 0) {
    return null;
  }

  // Transform routes data for chart
  const chartData = routes.routes.map((route, index) => ({
    name: `Route ${index + 1}`,
    'Expected Output': typeof route.expectedOutput === 'string' 
      ? parseFloat(route.expectedOutput) 
      : route.expectedOutput,
    'Total Cost': route.totalCost,
    'MEV Risk': route.mevRisk === 'low' ? 1 : route.mevRisk === 'medium' ? 2 : 3,
  }));

  return (
    <div className="w-full bg-gray-900 rounded-2xl p-6 shadow-xl">
      <h3 className="text-xl font-bold text-white mb-4">Route Comparison</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" stroke="#9CA3AF" />
          <YAxis stroke="#9CA3AF" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#F3F4F6' }}
          />
          <Legend />
          <Bar dataKey="Expected Output" fill="#3B82F6" />
          <Bar dataKey="Total Cost" fill="#EF4444" />
          <Bar dataKey="MEV Risk" fill="#F59E0B" />
        </BarChart>
      </ResponsiveContainer>

      {/* Route Details */}
      <div className="mt-4 space-y-2">
        {routes.routes.map((route, index) => (
          <div
            key={route.id}
            className={`p-3 rounded-lg cursor-pointer transition-colors ${
              routes.selectedRoute?.id === route.id
                ? 'bg-blue-900 bg-opacity-30 border border-blue-500'
                : 'bg-gray-800 hover:bg-gray-750'
            }`}
            onClick={() => routes.selectedRoute?.id !== route.id && console.log('Select route', route)}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-semibold text-white">
                  Route {index + 1}: {route.venues.join(' → ')}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Output: {route.expectedOutput} | Cost: {route.totalCost} | MEV: {route.mevRisk}
                </div>
              </div>
              {routes.selectedRoute?.id === route.id && (
                <span className="text-green-500 text-xl">✓</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
