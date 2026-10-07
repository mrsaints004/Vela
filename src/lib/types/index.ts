// Vela Core Types

export type ProviderType = 1 | 2 | 3 | 4 | 9;

export const PROVIDER_NAMES: Record<number, string> = {
  1: "Ondo",
  2: "xStocks",
  3: "bStocks",
  4: "SPCX",
  9: "Binance",
};

export const PROVIDER_SUFFIXES: Record<number, string> = {
  1: "on",
  2: "x",
  3: "B",
};

export interface RWAToken {
  chainId: string;
  contractAddress: string;
  symbol: string;
  ticker: string;
  type: ProviderType;
  assetType: number;
  multiplier: string;
  d: number;
  cs?: string;
  asset?: string;
  lastUpdateTime?: number;
}

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface TokenRepresentation {
  token: RWAToken;
  provider: string;
  price: number;
  impliedSharePrice: number;
  tokenToShareRatio: number;
  volume24h: number;
  priceChange24h: number;
  klines: Kline[];
  lastUpdated: number;
}

export interface RepresentationComparison {
  ticker: string;
  representations: TokenRepresentation[];
  bestByPrice: TokenRepresentation | null;
  bestByVolume: TokenRepresentation | null;
  bestByEffectiveCost: TokenRepresentation | null;
  maxSpread: number;
  maxSpreadPercent: number;
  recommendation: string;
  warnings: string[];
}

export interface EffectiveCost {
  provider: string;
  quotedPrice: number;
  priceDeviation: number;
  priceDeviationPercent: number;
  estimatedSlippage: number;
  volumeScore: number;
  liquidityRating: "high" | "medium" | "low" | "none";
  totalEffectiveCost: number;
  rank: number;
}

export interface MarketStatus {
  isOpen: boolean;
  status: "pre_market" | "regular" | "post_market" | "closed" | "weekend" | "holiday";
  nextOpenTime: string | null;
  referenceStale: boolean;
  staleDuration: number | null;
}

export interface TradeFirewallResult {
  action: "allow" | "warn" | "block";
  reasons: string[];
  checks: {
    marketStatus: MarketStatus;
    priceDeviation: number;
    volumeCheck: boolean;
    liquidityCheck: boolean;
    simulationPassed: boolean | null;
  };
}

export interface ExecutionReceipt {
  id: string;
  timestamp: number;
  ticker: string;
  provider: string;
  requestedAmount: number;
  quotedPrice: number;
  referencePrice: number | null;
  priceDeviation: number;
  expectedSlippage: number;
  marketStatus: MarketStatus;
  firewallResult: TradeFirewallResult;
  alternatives: EffectiveCost[];
  reasoning: string;
}

// --- Vela New Types ---

export type TradeFlowStep =
  | "idle"
  | "parsing"
  | "discovering"
  | "comparing"
  | "quoting"
  | "simulating"
  | "approving"
  | "executing"
  | "receipt"
  | "error";

export interface TradeIntent {
  raw: string;
  action: "buy" | "sell";
  ticker: string;
  amount: number;
  unit: "usd" | "shares";
}

export interface DiscoveredRepresentation {
  provider: string;
  tokenAddress: string;
  tokenSymbol: string;
  decimals: number;
  available: boolean;
  impliedSharePrice: number;
  volume24h: number;
  priceDeviationPercent: number;
  liquidityRating: "high" | "medium" | "low" | "none";
}

export interface QuoteSnapshot {
  quoteId: string;
  provider: string;
  vendorName: string;
  fromAmount: number;
  toAmount: number;
  expectedPrice: number;
  priceImpact: number;
  tradeFee: number;
  gasFee: number;
  routes: string[];
  isHoneyPot: boolean;
  timestamp: number;
}

export interface SimulationSnapshot {
  status: "SUCCESS" | "FAILED";
  failReason: string | null;
  balanceChanges: Array<{
    symbol: string;
    amount: string;
    direction: string;
  }>;
  timestamp: number;
}

export interface ExecutionSnapshot {
  txHash: string | null;
  status: "pending" | "confirmed" | "failed";
  blockNumber: number | null;
  gasUsed: string | null;
  timestamp: number;
}

export interface PolicyCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export interface PolicyResult {
  action: "allow" | "warn" | "block";
  checks: PolicyCheck[];
}

export interface RecommendationFactor {
  label: string;
  value: string;
  favorable: boolean;
}

export interface VelaReceipt {
  id: string;
  timestamp: number;
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
}
