/**
 * Skeleton Screen Components
 * Improved loading states with smooth animations
 */

"use client";

// Base skeleton animation
const SkeletonPulse = ({ className = "", style }: { className?: string; style?: React.CSSProperties }) => (
  <div
    className={`animate-pulse bg-gradient-to-r from-[var(--primary)]/5 via-[var(--primary)]/10 to-[var(--primary)]/5 bg-[length:200%_100%] ${className}`}
    style={{
      animation: "skeleton-loading 1.5s ease-in-out infinite",
      ...style,
    }}
  />
);

// Swap Interface Skeleton
export function SwapInterfaceSkeleton() {
  return (
    <div className="terminal-box p-6 max-w-md mx-auto">
      {/* Header */}
      <div className="mb-6">
        <SkeletonPulse className="h-8 w-48 mb-2" />
        <SkeletonPulse className="h-4 w-64" />
      </div>

      {/* Input Token */}
      <div className="bg-black/40 border-2 border-[var(--primary)]/20 p-4 mb-4">
        <div className="flex justify-between mb-2">
          <SkeletonPulse className="h-4 w-16" />
          <SkeletonPulse className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonPulse className="w-10 h-10 rounded-full" />
          <SkeletonPulse className="h-8 w-32 flex-1" />
        </div>
      </div>

      {/* Switch Icon */}
      <div className="flex justify-center my-4">
        <SkeletonPulse className="w-12 h-12 rounded-full" />
      </div>

      {/* Output Token */}
      <div className="bg-black/40 border-2 border-[var(--primary)]/20 p-4 mb-6">
        <div className="flex justify-between mb-2">
          <SkeletonPulse className="h-4 w-16" />
          <SkeletonPulse className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonPulse className="w-10 h-10 rounded-full" />
          <SkeletonPulse className="h-8 w-32 flex-1" />
        </div>
      </div>

      {/* Route Info */}
      <div className="bg-black/40 border-2 border-[var(--primary)]/20 p-4 mb-6">
        <SkeletonPulse className="h-5 w-full mb-3" />
        <SkeletonPulse className="h-5 w-3/4 mb-3" />
        <SkeletonPulse className="h-5 w-2/3" />
      </div>

      {/* Swap Button */}
      <SkeletonPulse className="h-14 w-full" />
    </div>
  );
}

// Dashboard Stats Skeleton
export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="terminal-box p-6">
          <SkeletonPulse className="h-5 w-32 mb-4" />
          <SkeletonPulse className="h-10 w-48 mb-2" />
          <SkeletonPulse className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

// Chart Skeleton
export function ChartSkeleton() {
  return (
    <div className="terminal-box p-6">
      <div className="flex justify-between items-center mb-6">
        <SkeletonPulse className="h-7 w-48" />
        <div className="flex gap-2">
          <SkeletonPulse className="h-10 w-20" />
          <SkeletonPulse className="h-10 w-20" />
          <SkeletonPulse className="h-10 w-20" />
        </div>
      </div>
      
      {/* Chart area */}
      <div className="relative h-80">
        <SkeletonPulse className="absolute bottom-0 left-0 w-full h-64" />
        
        {/* Animated bars */}
        <div className="absolute bottom-0 left-0 w-full h-64 flex items-end justify-around gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonPulse
              key={i}
              className="w-8"
              style={{
                height: `${Math.random() * 60 + 20}%`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Transaction List Skeleton
export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-black/40 border-2 border-[var(--primary)]/20 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <SkeletonPulse className="w-12 h-12 rounded-full" />
              <div>
                <SkeletonPulse className="h-5 w-32 mb-2" />
                <SkeletonPulse className="h-4 w-48" />
              </div>
            </div>
            <SkeletonPulse className="h-8 w-24" />
          </div>
          
          <div className="flex justify-between text-sm">
            <SkeletonPulse className="h-4 w-20" />
            <SkeletonPulse className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Token List Skeleton
export function TokenListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3 hover:bg-[var(--primary)]/5 transition-colors"
        >
          <div className="flex items-center gap-3 flex-1">
            <SkeletonPulse className="w-10 h-10 rounded-full" />
            <div className="flex-1">
              <SkeletonPulse className="h-5 w-24 mb-1" />
              <SkeletonPulse className="h-4 w-16" />
            </div>
          </div>
          <div className="text-right">
            <SkeletonPulse className="h-5 w-32 mb-1" />
            <SkeletonPulse className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Profile Skeleton
export function ProfileSkeleton() {
  return (
    <div className="terminal-box p-6">
      <div className="flex items-center gap-4 mb-6">
        <SkeletonPulse className="w-20 h-20 rounded-full" />
        <div className="flex-1">
          <SkeletonPulse className="h-7 w-48 mb-2" />
          <SkeletonPulse className="h-5 w-64" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-black/40 border-2 border-[var(--primary)]/20 p-4">
            <SkeletonPulse className="h-4 w-20 mb-2" />
            <SkeletonPulse className="h-6 w-32" />
          </div>
        ))}
      </div>

      <SkeletonPulse className="h-12 w-full" />
    </div>
  );
}

// Table Skeleton
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="terminal-box overflow-hidden">
      {/* Header */}
      <div className="grid gap-4 p-4 border-b-2 border-[var(--primary)]/20" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonPulse key={i} className="h-5 w-24" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-4 p-4 border-b border-[var(--primary)]/10"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, colIndex) => (
            <SkeletonPulse key={colIndex} className="h-5 w-32" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Add keyframes to global CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes skeleton-loading {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }
  `;
  document.head.appendChild(style);
}
