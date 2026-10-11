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
  basis?: "reference-risk" | "executable-price";
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
  unit: "usd" | "shares" | "tokens";
  sellAll?: boolean;
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
  action?: 'buy' | 'sell';
  inputToken?: string;
  outputToken?: string;
  inputDecimals?: number;
  rawInput?: string;
  inputAmount?: string;
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
  expiresAt?: number;
  outputDecimals?: number;
  rawOutput?: string;
  executionMode?: "SWAP" | "RFQ";
  normalizedShares?: number;
}

export interface SimulationSnapshot {
  scope?: "transaction" | "rfq-order";
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
  actualOutput?: string;
  actualInput?: string;
  chainId?: 56;
  orderId?: string;
  error?: string;
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

// --- Execution Policy System ---

export type PolicyPreset = "conservative" | "moderate" | "aggressive" | "custom";

export interface ExecutionPolicy {
  /** Unique policy ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Preset this was derived from, or "custom" */
  preset: PolicyPreset;
  /** Maximum allowed price deviation from reference (%) */
  maxDeviation: number;
  /** Maximum allowed slippage (%) */
  maxSlippage: number;
  /** Maximum single trade size (USD) */
  maxTradeSize: number;
  /** Maximum daily execution total (USD) */
  dailyLimit: number;
  /** Maximum portfolio concentration per asset (%) */
  maxConcentration: number;
  /** Allowed tickers (empty = all allowed) */
  allowedAssets: string[];
  /** Whether the agent can execute autonomously when all checks pass */
  autonomousExecution: boolean;
  /** Block execution when reference market is closed */
  blockAfterHours: boolean;
  /** Minimum liquidity rating required */
  minLiquidity: "high" | "medium" | "low" | "none";
  /** Policy expiry (ISO string, null = no expiry) */
  expiresAt: string | null;
  /** Created timestamp */
  createdAt: number;
}

export const POLICY_PRESETS: Record<Exclude<PolicyPreset, "custom">, Omit<ExecutionPolicy, "id" | "name" | "preset" | "allowedAssets" | "expiresAt" | "createdAt">> = {
  conservative: {
    maxDeviation: 0.5,
    maxSlippage: 0.3,
    maxTradeSize: 500,
    dailyLimit: 1000,
    maxConcentration: 20,
    autonomousExecution: false,
    blockAfterHours: true,
    minLiquidity: "high",
  },
  moderate: {
    maxDeviation: 1.0,
    maxSlippage: 0.5,
    maxTradeSize: 2000,
    dailyLimit: 5000,
    maxConcentration: 30,
    autonomousExecution: false,
    blockAfterHours: false,
    minLiquidity: "medium",
  },
  aggressive: {
    maxDeviation: 3.0,
    maxSlippage: 1.5,
    maxTradeSize: 10000,
    dailyLimit: 25000,
    maxConcentration: 50,
    autonomousExecution: false,
    blockAfterHours: false,
    minLiquidity: "low",
  },
};

// --- Policy-Aware Policy Result ---

export interface PolicyCheckWithThreshold extends PolicyCheck {
  /** The user's configured threshold for this check */
  threshold: string | null;
  /** The actual measured value */
  actual: string;
}

export interface PolicyEvaluation {
  action: "allow" | "warn" | "block";
  /** Whether the agent can execute autonomously based on this evaluation */
  canExecuteAutonomously: boolean;
  /** The policy that was evaluated against */
  policySnapshot: ExecutionPolicy;
  checks: PolicyCheckWithThreshold[];
  /** Summary of why this action was taken */
  reasoning: string;
}

// --- Decision Receipt ---

export interface RepresentationConsidered {
  provider: string;
  tokenAddress: string;
  impliedSharePrice: number;
  volume24h: number;
  priceDeviationPercent: number;
  liquidityRating: "high" | "medium" | "low" | "none";
  effectiveCost: number;
  rank: number;
  /** Why this provider was or wasn't selected */
  selectionNote: string;
}

export interface DecisionReceipt {
  signer?: 'browser-wallet'|'binance-agentic-wallet';
  agenticEvidence?: {wallet:string;cliVersion:string;quotaLeft:number;developerModeQuotaLeft:number;sessionExpireTime:string;operations:{id:string;operation:string;status:string;requestId:string;orderId?:string;expiresAt:number;requireConfirmation:boolean;parsed:unknown;risks:unknown;authorityChanges:unknown}[]};
  walletAddress?: string;
  digest?: string;
  verificationUrl?: string;
  outcome?: "refused" | "failed" | "pending" | "confirmed";
  failureReason?: string;
  previewId?: string;
  id: string;
  timestamp: number;

  // REQUEST
  intent: TradeIntent;

  // POLICY
  policySnapshot: ExecutionPolicy;

  // REPRESENTATIONS CONSIDERED
  representationsConsidered: RepresentationConsidered[];

  // SELECTED
  selectedProvider: string;
  selectedTokenAddress: string;
  selectionReasoning: string;

  // MARKET CONTEXT
  marketStatus: MarketStatus;
  referencePrice: number | null;
  referenceStaleness: number | null;

  // EXECUTION INTELLIGENCE
  recommendation: string;
  factors: RecommendationFactor[];

  // POLICY EVALUATION
  policyEvaluation: PolicyEvaluation;

  // SIMULATION
  simulation: SimulationSnapshot | null;

  // QUOTE
  quote: QuoteSnapshot | null;

  // EXECUTION
  execution: ExecutionSnapshot | null;
  executionMode: "autonomous" | "manual" | "agentic" | "blocked";

  // EXPECTED VS ACTUAL
  expectedSlippage: number | null;
  actualSlippage: number | null;

  // AGENT IDENTITY (ERC-8004)
  agentIdentity: {
    agentId: number;
    registryAddress: string;
    chainId: number;
  } | null;

  // INTENT PARSING
  intentMethod: "ai" | "regex";
}

// --- Updated Trade Flow ---

export type TradeFlowStepV2 =
  | "idle"
  | "parsing"
  | "policy-config"
  | "discovering"
  | "comparing"
  | "evaluating"
  | "quoting"
  | "simulating"
  | "awaiting-approval"
  | "executing"
  | "verifying"
  | "receipt"
  | "error";
