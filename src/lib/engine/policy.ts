import type {
  PolicyResult,
  PolicyCheck,
  PolicyCheckWithThreshold,
  PolicyEvaluation,
  ExecutionPolicy,
  MarketStatus,
  EffectiveCost,
  TokenRepresentation,
  SimulationSnapshot,
  QuoteSnapshot,
} from "../types";
import { createPolicyFromPreset } from "./policy-compiler";

const LIQUIDITY_RANK: Record<string, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Evaluate execution conditions against a user-defined ExecutionPolicy.
 *
 * Each check uses the user's configured threshold as the boundary.
 * Returns a PolicyEvaluation with:
 * - Whether autonomous execution is permitted
 * - Each check showing the user's threshold vs the actual value
 * - Reasoning explaining the decision
 */
export function evaluatePolicyV2(opts: {
  policy: ExecutionPolicy;
  marketStatus: MarketStatus;
  costs: EffectiveCost[];
  representations: TokenRepresentation[];
  selectedProvider: string;
  amount: number;
  simulation?: SimulationSnapshot | null;
  quote?: QuoteSnapshot | null;
  referencePrice?: number | null;
  currentPortfolioValue?: number;
  currentAssetExposure?: number;
  dailyExecutedTotal?: number;
}): PolicyEvaluation {
  const {
    policy, marketStatus, costs, representations, selectedProvider,
    amount, simulation, quote, referencePrice,
    currentPortfolioValue = 0, currentAssetExposure = 0, dailyExecutedTotal = 0,
  } = opts;

  const checks: PolicyCheckWithThreshold[] = [];
  const selected = representations.find((r) => r.provider === selectedProvider);
  const selectedCost = costs.find((c) => c.provider === selectedProvider);

  // 1. Policy expiry
  if (policy.expiresAt) {
    const expired = new Date(policy.expiresAt).getTime() < Date.now();
    checks.push({
      name: "Policy Validity",
      status: expired ? "fail" : "pass",
      message: expired ? "Policy has expired" : `Valid until ${new Date(policy.expiresAt).toLocaleDateString()}`,
      threshold: policy.expiresAt,
      actual: new Date().toISOString(),
    });
  }

  // 2. Allowed assets
  if (policy.allowedAssets.length > 0) {
    const intent_ticker = representations[0]?.token?.ticker || "";
    const allowed = policy.allowedAssets.some(
      (t) => t.toUpperCase() === intent_ticker.toUpperCase()
    );
    checks.push({
      name: "Allowed Asset",
      status: allowed ? "pass" : "fail",
      message: allowed
        ? `${intent_ticker} is in allowed list`
        : `${intent_ticker} is not in allowed assets: ${policy.allowedAssets.join(", ")}`,
      threshold: policy.allowedAssets.join(", "),
      actual: intent_ticker,
    });
  }

  // 3. Market status (against user's blockAfterHours setting)
  const isClosed = marketStatus.status === "weekend" || marketStatus.status === "closed";
  const isAfterHours = !marketStatus.isOpen;
  if (policy.blockAfterHours && isClosed) {
    checks.push({
      name: "Market Hours",
      status: "fail",
      message: `Market ${marketStatus.status}. Policy blocks after-hours execution.`,
      threshold: "Market open required",
      actual: `${marketStatus.status} (${(marketStatus.staleDuration ?? 0).toFixed(1)}h stale)`,
    });
  } else if (isAfterHours) {
    checks.push({
      name: "Market Hours",
      status: policy.blockAfterHours ? "warn" : "pass",
      message: isAfterHours
        ? `Market ${marketStatus.status}${marketStatus.staleDuration ? ` — reference ${marketStatus.staleDuration.toFixed(1)}h stale` : ""}`
        : "Market open",
      threshold: policy.blockAfterHours ? "Market open required" : "Any hours allowed",
      actual: marketStatus.status,
    });
  } else {
    checks.push({
      name: "Market Hours",
      status: "pass",
      message: "Market open",
      threshold: policy.blockAfterHours ? "Market open required" : "Any hours allowed",
      actual: "regular",
    });
  }

  // 4. Price deviation (against user's maxDeviation)
  if (selectedCost && referencePrice && referencePrice > 0) {
    const dev = Math.abs(selectedCost.priceDeviationPercent);
    const exceeds = dev > policy.maxDeviation;
    const nearLimit = dev > policy.maxDeviation * 0.8;
    checks.push({
      name: "Price Deviation",
      status: exceeds ? "fail" : nearLimit ? "warn" : "pass",
      message: exceeds
        ? `${dev.toFixed(2)}% exceeds your ${policy.maxDeviation}% limit`
        : `${dev.toFixed(2)}% within your ${policy.maxDeviation}% limit`,
      threshold: `≤ ${policy.maxDeviation}%`,
      actual: `${dev.toFixed(2)}%`,
    });
  }

  // 5. Slippage (against user's maxSlippage)
  const slippage = quote?.priceImpact ?? selectedCost?.estimatedSlippage ?? 0;
  const slippageExceeds = slippage > policy.maxSlippage;
  const slippageNear = slippage > policy.maxSlippage * 0.8;
  checks.push({
    name: "Slippage",
    status: slippageExceeds ? "fail" : slippageNear ? "warn" : "pass",
    message: slippageExceeds
      ? `${slippage.toFixed(2)}% exceeds your ${policy.maxSlippage}% limit`
      : `${slippage.toFixed(2)}% within your ${policy.maxSlippage}% limit`,
    threshold: `≤ ${policy.maxSlippage}%`,
    actual: `${slippage.toFixed(2)}%`,
  });

  // 6. Trade size (against user's maxTradeSize)
  const sizeExceeds = amount > policy.maxTradeSize;
  checks.push({
    name: "Trade Size",
    status: sizeExceeds ? "fail" : amount > policy.maxTradeSize * 0.9 ? "warn" : "pass",
    message: sizeExceeds
      ? `$${amount.toLocaleString()} exceeds your $${policy.maxTradeSize.toLocaleString()} limit`
      : `$${amount.toLocaleString()} within your $${policy.maxTradeSize.toLocaleString()} limit`,
    threshold: `≤ $${policy.maxTradeSize.toLocaleString()}`,
    actual: `$${amount.toLocaleString()}`,
  });

  // 7. Daily limit
  const newDailyTotal = dailyExecutedTotal + amount;
  const dailyExceeds = newDailyTotal > policy.dailyLimit;
  checks.push({
    name: "Daily Limit",
    status: dailyExceeds ? "fail" : newDailyTotal > policy.dailyLimit * 0.8 ? "warn" : "pass",
    message: dailyExceeds
      ? `$${newDailyTotal.toLocaleString()} would exceed daily limit of $${policy.dailyLimit.toLocaleString()}`
      : `$${newDailyTotal.toLocaleString()} of $${policy.dailyLimit.toLocaleString()} daily limit`,
    threshold: `≤ $${policy.dailyLimit.toLocaleString()}/day`,
    actual: `$${newDailyTotal.toLocaleString()} today`,
  });

  // 8. Portfolio concentration
  if (currentPortfolioValue > 0) {
    const newExposure = currentAssetExposure + amount;
    const concentrationPercent = (newExposure / (currentPortfolioValue + amount)) * 100;
    const concExceeds = concentrationPercent > policy.maxConcentration;
    checks.push({
      name: "Concentration",
      status: concExceeds ? "fail" : concentrationPercent > policy.maxConcentration * 0.8 ? "warn" : "pass",
      message: concExceeds
        ? `${concentrationPercent.toFixed(1)}% would exceed your ${policy.maxConcentration}% concentration limit`
        : `${concentrationPercent.toFixed(1)}% within your ${policy.maxConcentration}% limit`,
      threshold: `≤ ${policy.maxConcentration}%`,
      actual: `${concentrationPercent.toFixed(1)}%`,
    });
  }

  // 9. Liquidity (against user's minLiquidity)
  if (selectedCost) {
    const actualRank = LIQUIDITY_RANK[selectedCost.liquidityRating] ?? 0;
    const requiredRank = LIQUIDITY_RANK[policy.minLiquidity] ?? 0;
    const insufficient = actualRank < requiredRank;
    checks.push({
      name: "Liquidity",
      status: insufficient ? "fail" : actualRank === requiredRank ? "warn" : "pass",
      message: insufficient
        ? `${selectedCost.liquidityRating} liquidity below your ${policy.minLiquidity} minimum`
        : `${selectedCost.liquidityRating} liquidity meets your ${policy.minLiquidity} minimum`,
      threshold: `≥ ${policy.minLiquidity}`,
      actual: selectedCost.liquidityRating,
    });
  }

  // 10. Volume check (hard safety — not configurable)
  if (selected) {
    if (selected.volume24h === 0) {
      checks.push({
        name: "Volume",
        status: "fail",
        message: "Zero 24h volume — no trading activity detected",
        threshold: "> 0",
        actual: "$0",
      });
    } else if (selected.volume24h < amount * 2) {
      checks.push({
        name: "Volume",
        status: "warn",
        message: `Trade is ${((amount / selected.volume24h) * 100).toFixed(0)}% of 24h volume ($${selected.volume24h.toLocaleString()})`,
        threshold: "< 50% of volume",
        actual: `${((amount / selected.volume24h) * 100).toFixed(0)}%`,
      });
    } else {
      checks.push({
        name: "Volume",
        status: "pass",
        message: `$${selected.volume24h.toLocaleString()} 24h volume`,
        threshold: "> 0",
        actual: `$${selected.volume24h.toLocaleString()}`,
      });
    }
  }

  // 11. Simulation
  if (simulation) {
    checks.push({
      name: "Simulation",
      status: simulation.status === "SUCCESS" ? "pass" : "fail",
      message: simulation.status === "SUCCESS"
        ? "Transaction simulation passed"
        : simulation.failReason || "Simulation failed",
      threshold: "SUCCESS",
      actual: simulation.status,
    });
  }

  // 12. Honeypot
  if (quote?.isHoneyPot) {
    checks.push({
      name: "Honeypot",
      status: "fail",
      message: "Token flagged as potential honeypot",
      threshold: "Not honeypot",
      actual: "Flagged",
    });
  }

  // Determine action
  const hasFail = checks.some((c) => c.status === "fail");
  const hasWarn = checks.some((c) => c.status === "warn");
  const action = hasFail ? "block" : hasWarn ? "warn" : "allow";

  // Can execute autonomously?
  const canExecuteAutonomously =
    policy.autonomousExecution && action === "allow";

  // Build reasoning
  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const failedChecks = checks.filter((c) => c.status === "fail").map((c) => c.name);
  const warnChecks = checks.filter((c) => c.status === "warn").map((c) => c.name);

  let reasoning: string;
  if (action === "block") {
    reasoning = `Blocked: ${failedChecks.join(", ")} ${failCount === 1 ? "violates" : "violate"} your policy. ${passCount}/${checks.length} checks passed.`;
  } else if (action === "warn") {
    reasoning = canExecuteAutonomously
      ? `Caution: ${warnChecks.join(", ")} near your limits. Autonomous execution permitted but proceed with awareness.`
      : `Caution: ${warnChecks.join(", ")} near your limits. ${passCount}/${checks.length} passed, awaiting your approval.`;
  } else {
    reasoning = canExecuteAutonomously
      ? `All ${checks.length} policy checks passed. Executing autonomously per your policy.`
      : `All ${checks.length} policy checks passed. Awaiting your approval to execute.`;
  }

  return {
    action,
    canExecuteAutonomously,
    policySnapshot: { ...policy },
    checks,
    reasoning,
  };
}

/**
 * Legacy evaluatePolicy — kept for backward compatibility during migration.
 * Wraps evaluatePolicyV2 with a default moderate policy.
 */
export function evaluatePolicy(opts: {
  marketStatus: MarketStatus;
  costs: EffectiveCost[];
  representations: TokenRepresentation[];
  selectedProvider: string;
  amount: number;
  simulation?: SimulationSnapshot | null;
  referencePrice?: number | null;
}): PolicyResult {
  const defaultPolicy = createPolicyFromPreset("moderate");

  const evaluation = evaluatePolicyV2({
    policy: defaultPolicy,
    ...opts,
  });

  return {
    action: evaluation.action,
    checks: evaluation.checks.map((c) => ({
      name: c.name,
      status: c.status,
      message: c.message,
    })),
  };
}
