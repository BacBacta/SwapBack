/**
 * @vitest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { NativeRouteCard } from "../NativeRouteCard";
import type { NativeRouteInsights } from "@/lib/routing/nativeRouteInsights";
import { describe, it, expect } from "vitest";

const baseInsights: NativeRouteInsights = {
  provider: "Raydium",
  quoteTokens: 101.2345,
  baseTokens: 100,
  improvedTokens: 101.2345,
  improvementBps: 42.5,
  userShareTokens: 0.7,
  totalGainTokens: 1,
  sharePercent: 70,
  explanation: "70% du gain distribué",
  hasEconomics: true,
  usedFallback: false,
  fromCache: false,
};

describe("NativeRouteCard", () => {
  it("affiche les informations économiques lorsqu'elles sont disponibles", () => {
    const { container } = render(
      <NativeRouteCard
        insights={baseInsights}
        providerLabel="Raydium"
        outputSymbol="USDC"
      />
    );

    expect(screen.getByText("Raydium")).toBeInTheDocument();
    expect(screen.getByText(/\+0\.700000/)).toBeInTheDocument();
    expect(screen.getByText(/\+1\.000000/)).toBeInTheDocument();

    expect(container).toMatchSnapshot();
  });

  it("affiche une explication lorsqu'aucun NPI n'est disponible", () => {
    const insightsWithoutEconomics: NativeRouteInsights = {
      ...baseInsights,
      hasEconomics: false,
      userShareTokens: 0,
      totalGainTokens: 0,
      explanation: "Aucune opportunité NPI",
    };

    const { container } = render(
      <NativeRouteCard
        insights={insightsWithoutEconomics}
        providerLabel="SwapBack"
        outputSymbol="SOL"
        fromCache
        usedFallback
      />
    );

    expect(screen.getByText("Aucune opportunité NPI")).toBeInTheDocument();
    expect(screen.getByText("cache")).toBeInTheDocument();
    expect(screen.getByText("fallback")).toBeInTheDocument();

    expect(container).toMatchSnapshot();
  });
});
