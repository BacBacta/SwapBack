"use client";

import { ReactNode, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  threshold?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      // Only trigger on downward swipe from top of page
      if (
        eventData.dir === "Down" &&
        window.scrollY === 0 &&
        !isRefreshing
      ) {
        const distance = Math.min(eventData.deltaY, threshold * 1.5);
        setPullDistance(distance);
      }
    },
    onSwiped: async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  const progress = Math.min((pullDistance / threshold) * 100, 100);
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div {...handlers} ref={containerRef} className="relative min-h-screen">
      {/* Pull Indicator */}
      {showIndicator && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-200"
          style={{
            transform: `translateY(${isRefreshing ? "60px" : `${pullDistance}px`})`,
            opacity: isRefreshing ? 1 : Math.min(progress / 100, 1),
          }}
        >
          <div className="bg-gray-900/95 backdrop-blur-sm border border-[var(--primary)]/30 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
            {isRefreshing ? (
              <>
                <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-white font-medium">
                  Refreshing...
                </span>
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 text-[var(--primary)] transition-transform"
                  style={{
                    transform: `rotate(${progress * 3.6}deg)`,
                  }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="text-sm text-white font-medium">
                  {progress < 100 ? "Pull to refresh" : "Release to refresh"}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: isRefreshing
            ? "translateY(0)"
            : `translateY(${Math.min(pullDistance * 0.5, threshold * 0.5)}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
