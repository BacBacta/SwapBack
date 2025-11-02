/**
 * Skeleton Loaders
 * Modern loading placeholders with shimmer effect
 */

import React from "react";

export const SkeletonLine = ({ 
  width = "100%", 
  height = "16px",
  className = "" 
}: { 
  width?: string; 
  height?: string;
  className?: string;
}) => (
  <div
    className={`skeleton-shimmer rounded ${className}`}
    style={{ width, height }}
  />
);

export const SkeletonCircle = ({ 
  size = "40px",
  className = "" 
}: { 
  size?: string;
  className?: string;
}) => (
  <div
    className={`skeleton-shimmer rounded-full ${className}`}
    style={{ width: size, height: size }}
  />
);

export const SkeletonTokenRow = () => (
  <div className="flex items-center gap-3 p-3 border-2 border-[var(--primary)]/10">
    <SkeletonCircle size="40px" />
    <div className="flex-1 space-y-2">
      <SkeletonLine width="80px" height="14px" />
      <SkeletonLine width="120px" height="12px" />
    </div>
    <SkeletonLine width="60px" height="14px" />
  </div>
);

export const SkeletonSwapCard = () => (
  <div className="swap-card border-2 border-[var(--primary)]/20 p-6 space-y-6">
    {/* Header */}
    <div className="flex justify-between items-center">
      <SkeletonLine width="120px" height="20px" />
      <SkeletonCircle size="32px" />
    </div>

    {/* Input Token */}
    <div className="space-y-3">
      <SkeletonLine width="60px" height="12px" />
      <div className="flex gap-3">
        <div className="flex-1">
          <SkeletonLine width="100%" height="48px" />
        </div>
        <SkeletonCircle size="48px" />
      </div>
    </div>

    {/* Swap Icon */}
    <div className="flex justify-center">
      <SkeletonCircle size="32px" />
    </div>

    {/* Output Token */}
    <div className="space-y-3">
      <SkeletonLine width="60px" height="12px" />
      <div className="flex gap-3">
        <div className="flex-1">
          <SkeletonLine width="100%" height="48px" />
        </div>
        <SkeletonCircle size="48px" />
      </div>
    </div>

    {/* Route Info */}
    <div className="space-y-2 p-4 bg-black/20 rounded">
      <SkeletonLine width="100%" height="12px" />
      <SkeletonLine width="80%" height="12px" />
      <SkeletonLine width="60%" height="12px" />
    </div>

    {/* Button */}
    <SkeletonLine width="100%" height="48px" />
  </div>
);

export const SkeletonRouteCard = () => (
  <div className="p-4 border-2 border-[var(--primary)]/10 space-y-3">
    <div className="flex justify-between">
      <SkeletonLine width="100px" height="16px" />
      <SkeletonLine width="60px" height="20px" />
    </div>
    <div className="space-y-2">
      <SkeletonLine width="100%" height="10px" />
      <SkeletonLine width="80%" height="10px" />
    </div>
    <div className="flex gap-4">
      <SkeletonLine width="60px" height="12px" />
      <SkeletonLine width="60px" height="12px" />
    </div>
  </div>
);

// Add to global styles
export const skeletonStyles = `
  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }

  .skeleton-shimmer {
    background: linear-gradient(
      90deg,
      rgba(0, 255, 0, 0.05) 0%,
      rgba(0, 255, 0, 0.15) 50%,
      rgba(0, 255, 0, 0.05) 100%
    );
    background-size: 1000px 100%;
    animation: shimmer 2s infinite linear;
  }
`;
