'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 🚀 Aggressive caching for better performance
            staleTime: 2 * 60_000, // 2 minutes - data is considered fresh
            gcTime: 10 * 60_000, // 10 minutes - cache garbage collection
            refetchOnWindowFocus: false, // Disable auto-refetch on focus
            refetchOnReconnect: false, // Don't refetch on reconnect
            refetchOnMount: false, // Don't refetch on component mount if data exists
            retry: 2, // Reduce retries
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
            // 🚀 Structural sharing for better memory usage
            structuralSharing: true,
            // 🚀 Throttle refetch interval
            refetchInterval: false,
          },
          mutations: {
            retry: 1,
            retryDelay: 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
