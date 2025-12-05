import { describe, it, expect, beforeEach, vi } from "vitest";
import { runInstrumentedFetchRoutes } from "@/hooks/useInstrumentedFetchRoutes";
import type { SwapState, RouteState } from "@/store/swapStore";
import type { RoutingStrategy } from "@/lib/routing/hybridRouting";
import { trackRouteRequest, trackRouteResult, trackError } from "@/lib/analytics";

vi.mock("@/lib/analytics", () => {
  const noop = vi.fn();
  return {
    trackRouteRequest: vi.fn(),
    trackRouteResult: vi.fn(),
    trackError: vi.fn(),
    trackSwap: noop,
    trackSwapPreview: noop,
    trackRouterSelection: noop,
    trackPageView: noop,
  };
});

const baseSwap: SwapState = {
  inputToken: {
    mint: "mintA",
    symbol: "AAA",
    name: "Token AAA",
    decimals: 6,
  },
  outputToken: {
    mint: "mintB",
    symbol: "BBB",
    name: "Token BBB",
    decimals: 6,
  },
  inputAmount: "100",
  outputAmount: "0",
  slippageTolerance: 0.01,
  useMEVProtection: true,
  executionChannel: "jito",
  priorityLevel: "medium",
};

const baseRouteState: RouteState = {
  routes: [],
  selectedRoute: {
    id: "route-1",
    venues: ["Orca"],
    path: ["mintA", "mintB"],
    hops: 1,
    splits: [],
    expectedOutput: 90,
    totalCost: 0,
    effectiveRate: 0.9,
    riskScore: 5,
    mevRisk: "low",
    instructions: [],
    estimatedComputeUnits: 200000,
  } as any,
  selectedRoutePlan: [],
  jupiterCpi: null,
  nativeRoute: {
    provider: "SwapBack",
    npiShareTokens: 1,
  } as any,
  npiOpportunity: null,
  multiSourceQuotes: [],
  usedMultiSourceFallback: false,
  isMock: false,
  isLoading: false,
  error: null,
  intents: [],
  reliability: null,
};

const mockFetchRoutes = vi.fn(async () => {});

const routingStrategy: RoutingStrategy = "smart";

const createRoutesState = (overrides: Partial<RouteState> = {}): RouteState => ({
  ...baseRouteState,
  ...overrides,
});

const createSwapState = (overrides: Partial<SwapState> = {}): SwapState => ({
  ...baseSwap,
  ...overrides,
});

const getAnalyticsMocks = () => ({
  request: vi.mocked(trackRouteRequest),
  result: vi.mocked(trackRouteResult),
  error: vi.mocked(trackError),
});

describe("runInstrumentedFetchRoutes", () => {
  beforeEach(() => {
    mockFetchRoutes.mockClear();
    const analytics = getAnalyticsMocks();
    analytics.request.mockClear();
    analytics.result.mockClear();
    analytics.error.mockClear();
  });

  it("tracks success when routes resolve", async () => {
    const routesState = createRoutesState();
    const swap = createSwapState();

    const success = await runInstrumentedFetchRoutes(
      {
        swap,
        routingStrategy,
        selectedRouter: "swapback",
        walletAddress: "wallet123",
        fetchRoutes: mockFetchRoutes,
        getRoutesState: () => routesState,
      },
      "manual"
    );

    const analytics = getAnalyticsMocks();

    expect(success).toBe(true);
    expect(mockFetchRoutes).toHaveBeenCalledWith({ userPublicKey: "wallet123" });
    expect(analytics.request).toHaveBeenCalledWith(
      expect.objectContaining({ source: "manual", routerPreference: "swapback" })
    );
    expect(analytics.result).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, routerUsed: "swapback", routeVenues: ["Orca"] })
    );
    expect(analytics.error).not.toHaveBeenCalled();
  });

  it("tracks failures and errors when route fetch fails", async () => {
    const routesState = createRoutesState({ error: "Quote unavailable", selectedRoute: null });
    const swap = createSwapState();

    const success = await runInstrumentedFetchRoutes(
      {
        swap,
        routingStrategy,
        selectedRouter: "jupiter",
        walletAddress: "walletXYZ",
        fetchRoutes: mockFetchRoutes,
        getRoutesState: () => routesState,
      },
      "auto-refresh"
    );

    const analytics = getAnalyticsMocks();

    expect(success).toBe(false);
    expect(analytics.result).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, errorMessage: "Quote unavailable", source: "auto-refresh" })
    );
    expect(analytics.error).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ stage: "route-fetch", source: "auto-refresh" })
    );
  });

  it("does nothing when swap inputs are incomplete", async () => {
    const swap = createSwapState({ inputToken: null });
    const routesState = createRoutesState();

    const success = await runInstrumentedFetchRoutes(
      {
        swap,
        routingStrategy,
        selectedRouter: "swapback",
        walletAddress: null,
        fetchRoutes: mockFetchRoutes,
        getRoutesState: () => routesState,
      },
      "manual"
    );

    const analytics = getAnalyticsMocks();

    expect(success).toBe(false);
    expect(mockFetchRoutes).not.toHaveBeenCalled();
    expect(analytics.request).not.toHaveBeenCalled();
    expect(analytics.result).not.toHaveBeenCalled();
    expect(analytics.error).not.toHaveBeenCalled();
  });
});
