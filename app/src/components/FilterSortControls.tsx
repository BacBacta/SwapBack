"use client";

import { useState } from "react";

export type FilterType = "all" | "swaps" | "claims" | "locks";
export type SortType = "newest" | "oldest" | "highest" | "lowest";

interface FilterSortControlsProps {
  onFilterChange: (filter: FilterType) => void;
  onSortChange: (sort: SortType) => void;
  currentFilter: FilterType;
  currentSort: SortType;
  resultCount?: number;
}

export const FilterSortControls = ({
  onFilterChange,
  onSortChange,
  currentFilter,
  currentSort,
  resultCount,
}: FilterSortControlsProps) => {
  const [showFilters, setShowFilters] = useState(false);

  const filters: { value: FilterType; label: string; icon: string }[] = [
    { value: "all", label: "All Activity", icon: "📊" },
    { value: "swaps", label: "Swaps Only", icon: "🔄" },
    { value: "claims", label: "Claims Only", icon: "💰" },
    { value: "locks", label: "Locks Only", icon: "🔒" },
  ];

  const sorts: { value: SortType; label: string }[] = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "highest", label: "Highest Value" },
    { value: "lowest", label: "Lowest Value" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-black/20 rounded-xl border border-white/5">
      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-400 mr-2">Filter:</span>
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => onFilterChange(filter.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              currentFilter === filter.value
                ? "bg-[var(--primary)] text-white shadow-[0_0_20px_rgba(153,69,255,0.3)]"
                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="mr-2">{filter.icon}</span>
            {filter.label}
          </button>
        ))}
      </div>

      {/* Sort Dropdown */}
      <div className="flex items-center gap-3">
        {resultCount !== undefined && (
          <span className="text-sm text-gray-400">
            {resultCount} result{resultCount !== 1 ? "s" : ""}
          </span>
        )}
        
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-all border border-white/10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            <span>Sort</span>
            <svg className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showFilters && (
            <>
              <button
                className="fixed inset-0 z-10 cursor-default border-0 p-0 bg-transparent"
                onClick={() => setShowFilters(false)}
                aria-label="Close sort menu"
              />
              <div className="absolute right-0 mt-2 w-48 bg-[var(--glass-bg)] backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                {sorts.map((sort) => (
                  <button
                    key={sort.value}
                    onClick={() => {
                      onSortChange(sort.value);
                      setShowFilters(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm transition-all ${
                      currentSort === sort.value
                        ? "bg-[var(--primary)]/20 text-[var(--primary)] font-semibold"
                        : "text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    {sort.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
