import type {
  VelaReceipt,
  DecisionReceipt,
  TradeIntent,
  QuoteSnapshot,
  SimulationSnapshot,
  ExecutionSnapshot,
  PolicyResult,
  PolicyEvaluation,
  ExecutionPolicy,
  MarketStatus,
  RecommendationFactor,
  RepresentationConsidered,
  EffectiveCost,
  DiscoveredRepresentation,
} from "../types";

/**
 * Generate a Decision Receipt — the full decision trail from intent to execution.
 *
 * Shows: what was asked, what policy was active, what alternatives were considered,
 * why this provider was chosen, what the market looked like, what simulation said,
 * what the policy evaluation concluded, and what actually happened.
 */
export function generateDecisionReceipt(opts: {
  intent: TradeIntent;
  policy: ExecutionPolicy;
  representationsConsidered: RepresentationConsidered[];
  selectedProvider: string;
  selectedTokenAddress: string;
  selectionReasoning: string;
  marketStatus: MarketStatus;
  referencePrice: number | null;
  recommendation: string;
  factors: RecommendationFactor[];
  policyEvaluation: PolicyEvaluation;
  simulation: SimulationSnapshot | null;
  quote: QuoteSnapshot | null;
  execution: ExecutionSnapshot | null;
  executionMode: "autonomous" | "manual" | "blocked";
  expectedSlippage: number | null;
  actualSlippage: number | null;
  agentIdentity?: { agentId: number; registryAddress: string; chainId: number } | null;
  intentMethod?: "ai" | "regex";
}): DecisionReceipt {
  return {
    id: `vela-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    intent: opts.intent,
    policySnapshot: opts.policy,
    representationsConsidered: opts.representationsConsidered,
    selectedProvider: opts.selectedProvider,
    selectedTokenAddress: opts.selectedTokenAddress,
    selectionReasoning: opts.selectionReasoning,
    marketStatus: opts.marketStatus,
    referencePrice: opts.referencePrice,
    referenceStaleness: opts.marketStatus.staleDuration,
    recommendation: opts.recommendation,
    factors: opts.factors,
    policyEvaluation: opts.policyEvaluation,
    simulation: opts.simulation,
    quote: opts.quote,
    execution: opts.execution,
    executionMode: opts.executionMode,
    expectedSlippage: opts.expectedSlippage,
    actualSlippage: opts.actualSlippage,
    agentIdentity: opts.agentIdentity ?? null,
    intentMethod: opts.intentMethod ?? "regex",
  };
}

/**
 * Build RepresentationConsidered array from discovery results
 */
export function buildRepresentationsConsidered(
  discovered: DiscoveredRepresentation[],
  costs: EffectiveCost[],
  selectedProvider: string
): RepresentationConsidered[] {
  return discovered.map((d) => {
    const cost = costs.find((c) => c.provider === d.provider);
    const isSelected = d.provider === selectedProvider;
    const isBest = cost?.rank === 1;

    let selectionNote: string;
    if (isSelected && isBest) {
      selectionNote = "Selected — lowest reference-risk score";
    } else if (isSelected) {
      selectionNote = "Selected by user override";
    } else if (!d.available) {
      selectionNote = "Unavailable — zero price or no data";
    } else if (d.liquidityRating === "none") {
      selectionNote = "No recent volume; execution availability requires a live quote";
    } else if (cost && cost.rank > 1) {
      selectionNote = `Ranked #${cost.rank} — higher reference-risk score ($${cost.totalEffectiveCost.toFixed(2)})`;
    } else {
      selectionNote = "Not selected";
    }

    return {
      provider: d.provider,
      tokenAddress: d.tokenAddress,
      impliedSharePrice: d.impliedSharePrice,
      volume24h: d.volume24h,
      priceDeviationPercent: d.priceDeviationPercent,
      liquidityRating: d.liquidityRating,
      effectiveCost: cost?.totalEffectiveCost ?? 0,
      rank: cost?.rank ?? 0,
      selectionNote,
    };
  });
}

/**
 * Generate selection reasoning text
 */
export function buildSelectionReasoning(
  selectedProvider: string,
  costs: EffectiveCost[],
  marketStatus: MarketStatus,
  referencePrice: number | null
): string {
  const selectedCost = costs.find((c) => c.provider === selectedProvider);
  if (!selectedCost) return "Provider not found in cost analysis.";

  const parts: string[] = [];

  parts.push(
    `${selectedProvider} ranked #${selectedCost.rank} of ${costs.length} providers with $${selectedCost.totalEffectiveCost.toFixed(2)} reference-risk score.`
  );

  if (selectedCost.rank === 1) {
    parts.push("Lowest reference-risk score across all available representations.");
  }

  if (referencePrice && referencePrice > 0) {
    parts.push(
      `Price deviation: ${selectedCost.priceDeviationPercent.toFixed(2)}% from $${referencePrice.toFixed(2)} reference.`
    );
  }

  parts.push(`Volume activity proxy: ${selectedCost.liquidityRating}. Impact heuristic: ${selectedCost.estimatedSlippage.toFixed(2)}%.`);

  if (!marketStatus.isOpen && marketStatus.staleDuration) {
    parts.push(
      `Note: Reference price is ${marketStatus.staleDuration.toFixed(1)}h stale (market ${marketStatus.status}). Reference-risk score includes a staleness penalty.`
    );
  }

  return parts.join(" ");
}

/**
 * Legacy receipt generator — backward compatible.
 */
export function generateReceipt(opts: {
  intent: TradeIntent;
  selectedProvider: string;
  selectedTokenAddress: string;
  recommendation: string;
  factors: RecommendationFactor[];
  discoveredCount: number;
  quote: QuoteSnapshot | null;
  simulation: SimulationSnapshot | null;
  execution: ExecutionSnapshot | null;
  policy: PolicyResult;
  marketStatus: MarketStatus;
  referencePrice: number | null;
}): VelaReceipt {
  return {
    id: `vela-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...opts,
  };
}
