/**
 * ⚡ React Performance Optimizations
 *
 * Utilities pour optimiser les performances React:
 * - Smart memoization
 * - Optimized callbacks
 * - Debounced values
 * - Throttled functions
 *
 * @author SwapBack Team
 * @date October 26, 2025
 */

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook pour debouncer une valeur
 * Utile pour inputs et recherches
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook pour throttler une fonction
 * Limite le nombre d'exécutions dans un intervalle
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 1000
): T {
  const lastRun = useRef(Date.now());

  return useCallback(
    ((...args) => {
      const now = Date.now();

      if (now - lastRun.current >= delay) {
        callback(...args);
        lastRun.current = now;
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * Hook pour un interval optimisé
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);

    return () => clearInterval(id);
  }, [delay]);
}

/**
 * Hook pour détecter si un composant est monté
 * Évite les setState sur composants démontés
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback(() => isMountedRef.current, []);
}

/**
 * Hook pour un state asynchrone sécurisé
 */
export function useSafeState<T>(
  initialState: T
): [T, (newState: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialState);
  const isMounted = useIsMounted();

  const setSafeState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      if (isMounted()) {
        setState(newState);
      }
    },
    [isMounted]
  );

  return [state, setSafeState];
}

/**
 * Hook pour memoizer des calculs complexes
 * avec dépendances profondes
 */
export function useDeepMemo<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  const ref = useRef<{ deps: React.DependencyList; value: T }>();

  if (
    !ref.current ||
    !deepEqual(ref.current.deps, deps)
  ) {
    ref.current = {
      deps,
      value: factory(),
    };
  }

  return ref.current.value;
}

/**
 * Comparaison profonde pour useDeepMemo
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Hook pour une valeur précédente
 * Utile pour comparer avec l'état actuel
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

/**
 * Hook pour tracker les changements de valeur
 */
export function useWhyDidYouUpdate(name: string, props: Record<string, unknown>) {
  const previousProps = useRef<Record<string, unknown>>();

  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changesObj: Record<string, { from: unknown; to: unknown }> = {};

      allKeys.forEach((key) => {
        if (previousProps.current![key] !== props[key]) {
          changesObj[key] = {
            from: previousProps.current![key],
            to: props[key],
          };
        }
      });

      if (Object.keys(changesObj).length) {
        console.log("[WhyDidYouUpdate]", name, changesObj);
      }
    }

    previousProps.current = props;
  });
}

/**
 * Hook pour lazy loading avec suspense
 */
export function useLazyLoad<T>(
  loader: () => Promise<T>,
  deps: React.DependencyList = []
): [T | null, boolean, Error | null] {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useIsMounted();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await loader();

        if (!cancelled && isMounted()) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled && isMounted()) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled && isMounted()) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return [data, loading, error];
}

/**
 * Hook pour batching des mises à jour
 */
export function useBatchedUpdates<T>(
  initialValues: T[],
  batchDelay: number = 100
): [T[], (newValue: T) => void, () => void] {
  const [values, setValues] = useState<T[]>(initialValues);
  const pendingUpdates = useRef<T[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const addValue = useCallback(
    (newValue: T) => {
      pendingUpdates.current.push(newValue);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setValues((prev) => [...prev, ...pendingUpdates.current]);
        pendingUpdates.current = [];
      }, batchDelay);
    },
    [batchDelay]
  );

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (pendingUpdates.current.length > 0) {
      setValues((prev) => [...prev, ...pendingUpdates.current]);
      pendingUpdates.current = [];
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [values, addValue, flush];
}

/**
 * Hook pour memoizer des composants avec shallow compare
 */
export function useShallowMemo<T>(value: T): T {
  const ref = useRef<T>(value);

  if (!shallowEqual(ref.current, value)) {
    ref.current = value;
  }

  return ref.current;
}

function shallowEqual(objA: unknown, objB: unknown): boolean {
  if (Object.is(objA, objB)) return true;

  if (
    typeof objA !== "object" ||
    objA === null ||
    typeof objB !== "object" ||
    objB === null
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    if (
      !Object.prototype.hasOwnProperty.call(objB, keysA[i]) ||
      !Object.is((objA as Record<string, unknown>)[keysA[i]], (objB as Record<string, unknown>)[keysA[i]])
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Exemples d'utilisation:
 *
 * ```typescript
 * // Debounce search input
 * const [searchTerm, setSearchTerm] = useState("");
 * const debouncedSearch = useDebounce(searchTerm, 500);
 *
 * // Throttle scroll handler
 * const handleScroll = useThrottle(() => {
 *   console.log("Scrolled!");
 * }, 200);
 *
 * // Safe async state
 * const [data, setData] = useSafeState(null);
 *
 * // Interval
 * useInterval(() => {
 *   fetchLatestData();
 * }, 10000); // Every 10 seconds
 *
 * // Track component updates
 * useWhyDidYouUpdate("MyComponent", { prop1, prop2, prop3 });
 * ```
 */
