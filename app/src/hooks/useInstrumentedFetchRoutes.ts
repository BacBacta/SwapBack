import { useCallback } from "react";
import { trackRouteRequest, trackRouteResult, trackError } from "@/lib/analytics";
import { useSwapStore, type SwapState, type RouteState, type SwapStore } from "@/store/swapStore";
import type { RoutingStrategy } from "@/lib/routing/hybridRouting";

export type RouteFetchSource =
  | "manual"
  | "input-change"
  | "router-change"
  | "auto-refresh"
  | "strategy-change"
  | "swap-fallback";

type InstrumentedFetchDeps = {
  swap: SwapState;
  routingStrategy: RoutingStrategy;
  selectedRouter: "swapback" | "jupiter";
  walletAddress: string | null;
  fetchRoutes: SwapStore["fetchRoutes"];
  getRoutesState?: () => RouteState;
};

const defaultGetRoutesState = () => useSwapStore.getState().routes;

export async function runInstrumentedFetchRoutes(
  deps: InstrumentedFetchDeps,
  source: RouteFetchSource
): Promise<boolean> {
  const {
    swap,
    routingStrategy,
    selectedRouter,
    walletAddress,
    fetchRoutes,
    getRoutesState = defaultGetRoutesState,
  } = deps;

  const amount = parseFloat(swap.inputAmount);
  if (!swap.inputToken || !swap.outputToken || !Number.isFinite(amount) || amount <= 0) {
    return false;
  }

  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

  trackRouteRequest({
    inputToken: swap.inputToken.symbol,
    outputToken: swap.outputToken.symbol,
    inputAmount: amount,
    walletConnected: Boolean(walletAddress),
    routerPreference: selectedRouter,
    mevProtection: swap.useMEVProtection,
    priorityLevel: swap.priorityLevel,
    routingStrategy,
    executionChannel: swap.executionChannel,
    source,
  });

  await fetchRoutes({ userPublicKey: walletAddress });

  const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const latestRoutes = getRoutesState();
  const success = !latestRoutes.error && Boolean(latestRoutes.selectedRoute);

  trackRouteResult({
    inputToken: swap.inputToken.symbol,
    outputToken: swap.outputToken.symbol,
    inputAmount: amount,
    routerUsed: selectedRouter,
    bestVenue: latestRoutes.selectedRoute?.venues?.[0] ?? null,
    priceImpactPct: latestRoutes.selectedRoute?.riskScore
      ? latestRoutes.selectedRoute.riskScore / 10
      : undefined,
    nativeProvider: latestRoutes.nativeRoute?.provider ?? null,
    nativeShareTokens: latestRoutes.nativeRoute?.npiShareTokens ?? null,
    usedFallback: latestRoutes.usedMultiSourceFallback,
    routePlanLength:
      latestRoutes.selectedRoutePlan?.length ??
      (Array.isArray(latestRoutes.selectedRoute?.instructions)
        ? latestRoutes.selectedRoute.instructions.length
        : undefined),
    quoteSources: latestRoutes.multiSourceQuotes?.length ?? 0,
    mevRisk: latestRoutes.selectedRoute?.mevRisk ?? null,
    routeVenues: latestRoutes.selectedRoute?.venues ?? [],
    source,
    latencyMs: finishedAt - startedAt,
    success,
    errorMessage: latestRoutes.error ?? undefined,
  });

  if (!success && latestRoutes.error) {
    trackError(new Error(latestRoutes.error), {
      stage: "route-fetch",
      source,
      inputToken: swap.inputToken.symbol,
      outputToken: swap.outputToken.symbol,
    });
  }

  return success;
}

export function useInstrumentedFetchRoutes(
  deps: Omit<InstrumentedFetchDeps, "getRoutesState">
): (source: RouteFetchSource) => Promise<boolean> {
  const { fetchRoutes, routingStrategy, selectedRouter, swap, walletAddress } = deps;
  const getRoutesState = useCallback(() => useSwapStore.getState().routes, []);

  return useCallback(
    (source: RouteFetchSource) =>
      runInstrumentedFetchRoutes(
        {
          fetchRoutes,
          routingStrategy,
          selectedRouter,
          swap,
          walletAddress,
          getRoutesState,
        },
        source
      ),
    [fetchRoutes, routingStrategy, selectedRouter, swap, walletAddress, getRoutesState]
  );
}
