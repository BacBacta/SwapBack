"use client";

export const SkeletonLoader = () => {
  return (
    <div className="animate-pulse space-y-4">
      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="stat-card">
            <div className="h-4 bg-gray-700/50 rounded w-24 mx-auto mb-3"></div>
            <div className="h-8 bg-gray-700/50 rounded w-32 mx-auto"></div>
          </div>
        ))}
      </div>

      {/* Stats Cards Skeleton */}
      <div className="space-y-4 mt-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-effect rounded-lg p-5 border border-gray-700/50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-700/50"></div>
                <div className="h-4 bg-gray-700/50 rounded w-32"></div>
              </div>
              <div className="h-8 bg-gray-700/50 rounded w-24"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChartSkeleton = () => {
  return (
    <div className="animate-pulse">
      <div className="h-64 bg-gray-700/30 rounded-xl"></div>
    </div>
  );
};

export const ActivitySkeleton = () => {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-gray-700/20 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-gray-700/50"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-700/50 rounded w-3/4"></div>
            <div className="h-3 bg-gray-700/50 rounded w-1/2"></div>
          </div>
          <div className="h-6 bg-gray-700/50 rounded w-16"></div>
        </div>
      ))}
    </div>
  );
};
