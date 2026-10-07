import type {
  PolicyResult,
  PolicyCheck,
  MarketStatus,
  EffectiveCost,
  TokenRepresentation,
  SimulationSnapshot,
} from "../types";

export function evaluatePolicy(opts: {
  marketStatus: MarketStatus;
  costs: EffectiveCost[];
  representations: TokenRepresentation[];
  selectedProvider: string;
  amount: number;
  simulation?: SimulationSnapshot | null;
  referencePrice?: number | null;
}): PolicyResult {
  const checks: PolicyCheck[] = [];
  const { marketStatus, costs, representations, selectedProvider, amount, simulation, referencePrice } = opts;

  const selected = representations.find((r) => r.provider === selectedProvider);
  const selectedCost = costs.find((c) => c.provider === selectedProvider);

  // 1. Market status
  if (marketStatus.status === "weekend" || marketStatus.status === "closed") {
    checks.push({
      name: "Market Status",
      status: "warn",
      message: `Market ${marketStatus.status}. Reference price stale (${(marketStatus.staleDuration ?? 0).toFixed(1)}h).`,
    });
  } else if (marketStatus.status === "regular") {
    checks.push({ name: "Market Status", status: "pass", message: "Market open" });
  } else {
    checks.push({ name: "Market Status", status: "warn", message: `Market ${marketStatus.status}` });
  }

  // 2. Price deviation
  if (selectedCost && referencePrice && referencePrice > 0) {
    const dev = Math.abs(selectedCost.priceDeviationPercent);
    if (dev > 5) {
      checks.push({ name: "Price Deviation", status: "fail", message: `${dev.toFixed(2)}% from reference — significantly above normal` });
    } else if (dev > 1) {
      checks.push({ name: "Price Deviation", status: "warn", message: `${dev.toFixed(2)}% from reference` });
    } else {
      checks.push({ name: "Price Deviation", status: "pass", message: `${dev.toFixed(2)}% from reference` });
    }
  }

  // 3. Liquidity
  if (selectedCost) {
    if (selectedCost.liquidityRating === "none") {
      checks.push({ name: "Liquidity", status: "fail", message: "No liquidity detected" });
    } else if (selectedCost.liquidityRating === "low") {
      checks.push({ name: "Liquidity", status: "warn", message: `Low liquidity. Est. slippage: ${selectedCost.estimatedSlippage.toFixed(1)}%` });
    } else {
      checks.push({ name: "Liquidity", status: "pass", message: `${selectedCost.liquidityRating} liquidity` });
    }
  }

  // 4. Volume
  if (selected) {
    if (selected.volume24h === 0) {
      checks.push({ name: "Volume", status: "fail", message: "Zero 24h volume" });
    } else if (selected.volume24h < amount * 2) {
      checks.push({
        name: "Volume",
        status: "warn",
        message: `Trade is >${((amount / selected.volume24h) * 100).toFixed(0)}% of 24h volume`,
      });
    } else {
      checks.push({ name: "Volume", status: "pass", message: `$${selected.volume24h.toLocaleString()} 24h volume` });
    }
  }

  // 5. Slippage
  if (selectedCost && selectedCost.estimatedSlippage > 3) {
    checks.push({ name: "Slippage", status: "fail", message: `Est. slippage ${selectedCost.estimatedSlippage.toFixed(1)}%` });
  } else if (selectedCost && selectedCost.estimatedSlippage > 1) {
    checks.push({ name: "Slippage", status: "warn", message: `Est. slippage ${selectedCost.estimatedSlippage.toFixed(1)}%` });
  }

  // 6. Simulation
  if (simulation) {
    if (simulation.status === "SUCCESS") {
      checks.push({ name: "Simulation", status: "pass", message: "Transaction simulation passed" });
    } else {
      checks.push({ name: "Simulation", status: "fail", message: simulation.failReason || "Simulation failed" });
    }
  }

  // 7. Honeypot (placeholder — evaluated at quote time)

  // 8. Max trade size
  if (amount > 10000) {
    checks.push({ name: "Trade Size", status: "warn", message: `Large trade: $${amount.toLocaleString()}` });
  }

  // Determine overall action
  const hasFail = checks.some((c) => c.status === "fail");
  const hasWarn = checks.some((c) => c.status === "warn");

  return {
    action: hasFail ? "block" : hasWarn ? "warn" : "allow",
    checks,
  };
}
