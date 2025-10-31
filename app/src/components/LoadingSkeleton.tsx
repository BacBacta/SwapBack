/**
 * Loading Skeleton Components
 * Provides placeholder UI while content loads
 */

export function CardSkeleton() {
  return (
    <div className="bg-black/40 backdrop-blur-sm border-2 border-[var(--primary)]/20 p-6">
      <div className="animate-pulse">
        <div className="h-4 bg-[var(--primary)]/10 rounded w-24 mb-3"></div>
        <div className="h-8 bg-[var(--primary)]/15 rounded w-32 mb-2"></div>
        <div className="h-3 bg-[var(--primary)]/10 rounded w-40"></div>
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

export function ProgressBarSkeleton() {
  return (
    <div className="bg-black/40 backdrop-blur-sm border-2 border-[var(--primary)]/20 p-6">
      <div className="animate-pulse">
        <div className="flex justify-between mb-3">
          <div className="h-5 bg-[var(--primary)]/15 rounded w-48"></div>
          <div className="h-5 bg-[var(--primary)]/15 rounded w-16"></div>
        </div>
        <div className="h-6 bg-[var(--primary)]/10 border-2 border-[var(--primary)]/10 rounded mb-3"></div>
        <div className="flex justify-between">
          <div className="h-4 bg-[var(--primary)]/10 rounded w-32"></div>
          <div className="h-4 bg-[var(--primary)]/10 rounded w-32"></div>
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-black/40 backdrop-blur-sm border-2 border-[var(--primary)]/20 p-6">
      <div className="animate-pulse">
        <div className="h-6 bg-[var(--primary)]/15 rounded w-64 mb-4"></div>
        <div className="h-64 bg-[var(--primary)]/10 border-2 border-[var(--primary)]/10 rounded"></div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-black/40 backdrop-blur-sm border-2 border-[var(--primary)]/20 p-6">
      <div className="animate-pulse">
        <div className="h-6 bg-[var(--primary)]/15 rounded w-48 mb-4"></div>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 bg-[var(--primary)]/10 rounded flex-1"></div>
              <div className="h-4 bg-[var(--primary)]/10 rounded w-24"></div>
              <div className="h-4 bg-[var(--primary)]/10 rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ButtonSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-12 bg-[var(--primary)]/20 border-2 border-[var(--primary)]/30 rounded"></div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-10 bg-[var(--primary)]/20 border-2 border-[var(--primary)]/30 rounded w-96 mb-2"></div>
          <div className="h-4 bg-[var(--primary)]/15 rounded w-64"></div>
        </div>

        {/* Stats grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>

        {/* Progress bar skeleton */}
        <div className="mb-6">
          <ProgressBarSkeleton />
        </div>

        {/* Chart skeleton */}
        <div className="mb-6">
          <ChartSkeleton />
        </div>

        {/* Table skeleton */}
        <div>
          <TableSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}
