"use client";

// Hook simplifié pour éviter les erreurs de compilation

export const useBlockchainTracer = () => {
  return {
    operations: [],
    loading: false,
    error: null,
    refreshOperations: () => {},
    traceSwap: () => {},
    statistics: {
      totalOps: 0,
      totalVolume: 0,
      totalFees: 0,
      avgExecutionTime: 0
    }
  };
};

export const useFilteredOperations = (operations: unknown[], _filters: unknown) => {
  return operations;
};