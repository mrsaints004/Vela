import type {
  VelaReceipt,
  TradeIntent,
  QuoteSnapshot,
  SimulationSnapshot,
  ExecutionSnapshot,
  PolicyResult,
  MarketStatus,
  RecommendationFactor,
} from "../types";

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
