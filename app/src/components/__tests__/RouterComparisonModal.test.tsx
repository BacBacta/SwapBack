/**
 * @vitest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { RouterComparisonModal } from "../RouterComparisonModal";
import { trackRouterComparisonAction } from "@/lib/analytics";

vi.mock("@/lib/analytics", () => ({
  trackRouterComparisonAction: vi.fn(),
}));

const mockedComparisonAction = vi.mocked(trackRouterComparisonAction);

const createBaseProps = () => ({
  isOpen: true,
  onClose: vi.fn(),
  onSelectRouter: vi.fn(),
  currentRouter: "swapback" as const,
  inputToken: { symbol: "SOL", amount: "10" },
  outputToken: { symbol: "USDC" },
  swapbackData: {
    outputAmount: 105.123456,
    priceImpact: 0.25,
    networkFee: 0.000005,
    platformFee: 0,
    rebateAmount: 1.2345,
    burnAmount: 0.4,
    totalSavings: 2.5,
    route: ["Raydium"],
  },
  jupiterData: {
    outputAmount: 103.123456,
    priceImpact: 0.45,
    networkFee: 0.00001,
    platformFee: 0,
    route: ["Jupiter"],
  },
});

describe("RouterComparisonModal", () => {
  beforeEach(() => {
    mockedComparisonAction.mockClear();
  });

  it("met en avant SwapBack lorsqu'il est plus avantageux", () => {
    const props = createBaseProps();
    const { container } = render(<RouterComparisonModal {...props} />);

    expect(screen.getByText("Router Comparison")).toBeInTheDocument();
    expect(screen.getByText(/SwapBack saves you/)).toBeInTheDocument();
    expect(screen.getByText("BEST")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Use Jupiter"));
    expect(props.onSelectRouter).toHaveBeenCalledWith("jupiter");
    expect(mockedComparisonAction).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedRouter: "jupiter",
        actionSource: "cta",
      })
    );

    expect(container).toMatchSnapshot();
  });

  it("affiche la carte Jupiter lorsqu'il devient courant", () => {
    const base = createBaseProps();
    const props = {
      ...base,
      currentRouter: "jupiter" as const,
      swapbackData: { ...base.swapbackData, outputAmount: 100 },
      jupiterData: { ...base.jupiterData, outputAmount: 101 },
    };

    render(<RouterComparisonModal {...props} />);

    expect(screen.getByText("Jupiter")).toBeInTheDocument();
    expect(screen.queryByText("BEST")).not.toBeInTheDocument();
  });
});
