import { create } from "zustand";
import type {
  TradeFlowStepV2,
  TradeIntent,
  DiscoveredRepresentation,
  QuoteSnapshot,
  SimulationSnapshot,
  ExecutionSnapshot,
  PolicyEvaluation,
  ExecutionPolicy,
  RecommendationFactor,
  VelaReceipt,
  DecisionReceipt,
  MarketStatus,
  EffectiveCost,
  PolicyPreset,
  RepresentationConsidered,
} from "../types";
import { parseIntent } from "../engine/intent";
import { createPolicyFromPreset } from "../engine/policy-compiler";
import { useAgentStore } from "./agent";
import { IDENTITY_REGISTRY, IDENTITY_REGISTRY_TESTNET } from "../agent-studio/erc8004";

type ExecutionMode = "wallet" | "agentic";

interface AgenticPlan {
  tradeId: string;
  steps: Array<{
    stepNumber: number;
    action: string;
    status: string;
    description: string;
    txHash?: string;
    details?: Record<string, any>;
  }>;
  totalSteps: number;
  requiresApproval: boolean;
}

interface TradeState {
  step: TradeFlowStepV2;
  intent: TradeIntent | null;
  intentMethod: "ai" | "regex" | null;

  // Policy
  policy: ExecutionPolicy | null;
  policyEvaluation: PolicyEvaluation | null;

  // Discovery
  representations: DiscoveredRepresentation[];
  costs: EffectiveCost[];
  representationsConsidered: RepresentationConsidered[];

  // Recommendation
  recommendation: string | null;
  factors: RecommendationFactor[];
  selectionReasoning: string | null;

  // Selection
  selectedProvider: string | null;
  selectedTokenAddress: string | null;

  // Quote & Simulation
  quote: QuoteSnapshot | null;
  simulation: SimulationSnapshot | null;
  execution: ExecutionSnapshot | null;

  // Context
  marketStatus: MarketStatus | null;
  referencePrice: number | null;

  // Receipt
  receipt: DecisionReceipt | null;

  // Legacy receipt (backward compat)
  legacyReceipt: VelaReceipt | null;

  // Error
  error: string | null;

  // Execution
  executionMode: ExecutionMode;
  agenticPlan: AgenticPlan | null;

  // Actions
  submitIntent: (raw: string) => Promise<void>;
  setPolicy: (policy: ExecutionPolicy) => void;
  setPolicyPreset: (preset: Exclude<PolicyPreset, "custom">) => void;
  updatePolicyField: (field: string, value: any) => void;
  selectProvider: (provider: string, tokenAddress: string) => void;
  fetchQuoteAndSimulate: () => Promise<void>;
  approve: () => void;
  execute: () => Promise<void>;
  setExecutionMode: (mode: ExecutionMode) => void;
  reset: () => void;
}

const defaultPolicy = createPolicyFromPreset("moderate");

const initialState = {
  step: "idle" as TradeFlowStepV2,
  intent: null as TradeIntent | null,
  intentMethod: null as "ai" | "regex" | null,
  policy: defaultPolicy,
  policyEvaluation: null as PolicyEvaluation | null,
  representations: [] as DiscoveredRepresentation[],
  costs: [] as EffectiveCost[],
  representationsConsidered: [] as RepresentationConsidered[],
  recommendation: null as string | null,
  factors: [] as RecommendationFactor[],
  selectionReasoning: null as string | null,
  selectedProvider: null as string | null,
  selectedTokenAddress: null as string | null,
  quote: null as QuoteSnapshot | null,
  simulation: null as SimulationSnapshot | null,
  execution: null as ExecutionSnapshot | null,
  marketStatus: null as MarketStatus | null,
  referencePrice: null as number | null,
  receipt: null as DecisionReceipt | null,
  legacyReceipt: null as VelaReceipt | null,
  error: null as string | null,
  executionMode: "agentic" as ExecutionMode,
  agenticPlan: null as AgenticPlan | null,
};

export const useTradeStore = create<TradeState>((set, get) => ({
  ...initialState,

  submitIntent: async (raw: string) => {
    const currentPolicy = get().policy || defaultPolicy;
    set({ ...initialState, step: "parsing", policy: currentPolicy });

    // Try AI parsing first, fall back to regex
    let intent: TradeIntent | null = null;
    let intentMethod: "ai" | "regex" = "regex";

    try {
      const res = await fetch("/api/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.intent) {
          intent = data.intent;
          intentMethod = data.method === "ai" ? "ai" : "regex";
        }
      }
    } catch {
      // API call failed, fall back to local regex
    }

    // Final fallback to local regex if API didn't return an intent
    if (!intent) {
      intent = parseIntent(raw);
      intentMethod = "regex";
    }

    if (!intent) {
      set({ step: "error", error: "Could not parse intent. Try: \"Buy $500 of NVDA\"" });
      return;
    }

    set({ intent, intentMethod, policy: currentPolicy, step: "discovering" });

    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "discover",
          ticker: intent.ticker,
          amount: intent.amount,
          policy: currentPolicy,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      set({
        step: "comparing",
        representations: data.representations || [],
        costs: data.costs || [],
        representationsConsidered: data.representationsConsidered || [],
        recommendation: data.recommendation || null,
        factors: data.factors || [],
        selectionReasoning: data.selectionReasoning || null,
        policyEvaluation: data.policyEvaluation || null,
        marketStatus: data.marketStatus || null,
        referencePrice: data.referencePrice || null,
        selectedProvider: data.recommended?.provider || null,
        selectedTokenAddress: data.recommended?.tokenAddress || null,
      });
    } catch (err) {
      set({
        step: "error",
        error: err instanceof Error ? err.message : "Discovery failed",
      });
    }
  },

  setPolicy: (policy: ExecutionPolicy) => {
    set({ policy });
  },

  setPolicyPreset: (preset: Exclude<PolicyPreset, "custom">) => {
    set({ policy: createPolicyFromPreset(preset) });
  },

  updatePolicyField: (field: string, value: any) => {
    const current = get().policy || defaultPolicy;
    set({
      policy: { ...current, [field]: value, preset: "custom" as PolicyPreset },
    });
  },

  selectProvider: (provider: string, tokenAddress: string) => {
    set({ selectedProvider: provider, selectedTokenAddress: tokenAddress });
  },

  fetchQuoteAndSimulate: async () => {
    const { intent, selectedProvider, selectedTokenAddress, policy } = get();
    if (!intent || !selectedProvider || !selectedTokenAddress) return;

    set({ step: "quoting" });

    try {
      const walletAddress =
        (typeof window !== "undefined" && (window as any).ethereum)
          ? await getWalletAddress()
          : "0x0000000000000000000000000000000000000001";

      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "full-flow",
          ticker: intent.ticker,
          provider: selectedProvider,
          tokenAddress: selectedTokenAddress,
          amount: String(intent.amount),
          walletAddress,
          policy: policy || defaultPolicy,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      const policyEval = data.policyEvaluation || null;
      const canAutoExecute = policyEval?.canExecuteAutonomously === true;

      set({
        step: canAutoExecute ? "executing" : "awaiting-approval",
        quote: data.quote || null,
        simulation: data.simulation || null,
        policyEvaluation: policyEval,
      });

      // If autonomous execution is permitted, execute immediately
      if (canAutoExecute) {
        // Small delay so the user sees the "executing" state
        setTimeout(() => get().execute(), 500);
      }
    } catch (err) {
      set({
        step: "error",
        error: err instanceof Error ? err.message : "Quote failed",
      });
    }
  },

  setExecutionMode: (mode: ExecutionMode) => {
    set({ executionMode: mode });
  },

  approve: () => {
    set({ step: "executing" });
  },

  execute: async () => {
    const state = get();
    if (!state.intent || !state.selectedProvider) return;

    set({ step: "executing" });

    try {
      // Log execution attempt
      await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: state.intent,
          provider: state.selectedProvider,
          tokenAddress: state.selectedTokenAddress,
          quote: state.quote,
          executionMode: state.executionMode,
          policyEvaluation: state.policyEvaluation,
        }),
      }).catch(() => {});

      let txHash: string | null = null;
      let executionStatus: "confirmed" | "failed" = "confirmed";
      const isAutonomous = state.policyEvaluation?.canExecuteAutonomously === true;

      if (state.executionMode === "agentic" && state.quote) {
        // --- Agentic Wallet Execution ---
        const walletAddress = await getWalletAddress();

        try {
          // Step 1: Build agentic plan
          const planRes = await fetch("/api/trade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "agentic-plan",
              tokenAddress: state.selectedTokenAddress,
              amount: String(state.intent.amount),
              walletAddress,
              quoteId: state.quote.quoteId,
              provider: state.selectedProvider,
              ticker: state.intent.ticker,
            }),
          });

          if (planRes.ok) {
            const plan = await planRes.json();
            set({ agenticPlan: plan });

            // Step 2: Execute the plan via agentic pipeline
            const execRes = await fetch("/api/trade", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "agentic-execute",
                plan,
                tokenAddress: state.selectedTokenAddress,
                amount: String(state.intent.amount),
                walletAddress,
                quoteId: state.quote.quoteId,
              }),
            });

            if (execRes.ok) {
              const result = await execRes.json();

              // The agentic pipeline builds the transaction server-side.
              // For full autonomous execution we still need the user's wallet
              // to sign — unless they've delegated signing authority via
              // the Binance Agentic Wallet SDK (which holds a session key).
              // We attempt to sign the built tx if we have a signer.
              if (result.txData && typeof window !== "undefined" && (window as any).ethereum) {
                try {
                  const { BrowserProvider } = await import("ethers");
                  const provider = new BrowserProvider((window as any).ethereum);
                  const signer = await provider.getSigner();
                  const tx = await signer.sendTransaction({
                    to: result.txData.to,
                    data: result.txData.data,
                    value: result.txData.value || "0",
                  });
                  txHash = tx.hash;
                  const receipt = await tx.wait();
                  executionStatus = receipt?.status === 1 ? "confirmed" : "failed";
                } catch {
                  // Wallet signing failed — no on-chain tx occurred
                  txHash = null;
                  executionStatus = "failed";
                }
              } else {
                // No wallet available — pipeline ran but no tx was signed
                txHash = null;
                executionStatus = "failed";
              }

              set({ agenticPlan: { ...plan, steps: result.steps } });
            } else {
              executionStatus = "failed";
            }
          } else {
            executionStatus = "failed";
          }
        } catch {
          executionStatus = "failed";
        }
      } else if (typeof window !== "undefined" && (window as any).ethereum && state.quote) {
        // --- Direct Wallet Execution (MetaMask) ---
        try {
          const { BrowserProvider } = await import("ethers");
          const provider = new BrowserProvider((window as any).ethereum);
          const signer = await provider.getSigner();

          const swapRes = await fetch("/api/trade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "build-swap",
              tokenAddress: state.selectedTokenAddress,
              amount: String(state.intent.amount),
              walletAddress: await signer.getAddress(),
              quoteId: state.quote.quoteId,
            }),
          });

          if (swapRes.ok) {
            const { swap } = await swapRes.json();
            const tx = await signer.sendTransaction({
              to: swap.to,
              data: swap.data,
              value: swap.value,
            });
            txHash = tx.hash;
            const receipt = await tx.wait();
            executionStatus = receipt?.status === 1 ? "confirmed" : "failed";
          }
        } catch {
          executionStatus = "failed";
        }
      }

      const execution: ExecutionSnapshot = {
        txHash,
        status: executionStatus,
        blockNumber: null,
        gasUsed: null,
        timestamp: Date.now(),
      };

      set({ step: "verifying" });

      // Get agent identity if registered
      const agentState = useAgentStore.getState();
      const agentIdentity = agentState.registered && agentState.agentId
        ? {
            agentId: agentState.agentId,
            registryAddress: agentState.useTestnet ? IDENTITY_REGISTRY_TESTNET : IDENTITY_REGISTRY,
            chainId: agentState.useTestnet ? 97 : 56,
          }
        : null;

      // Build Decision Receipt
      const decisionReceipt: DecisionReceipt = {
        id: `vela-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        intent: state.intent!,
        policySnapshot: state.policy || defaultPolicy,
        representationsConsidered: state.representationsConsidered,
        selectedProvider: state.selectedProvider!,
        selectedTokenAddress: state.selectedTokenAddress!,
        selectionReasoning: state.selectionReasoning || "",
        marketStatus: state.marketStatus || {
          isOpen: false, status: "closed", nextOpenTime: null,
          referenceStale: true, staleDuration: null,
        },
        referencePrice: state.referencePrice,
        referenceStaleness: state.marketStatus?.staleDuration ?? null,
        recommendation: state.recommendation || "",
        factors: state.factors,
        policyEvaluation: state.policyEvaluation || {
          action: "allow",
          canExecuteAutonomously: false,
          policySnapshot: state.policy || defaultPolicy,
          checks: [],
          reasoning: "No policy evaluation available",
        },
        simulation: state.simulation,
        quote: state.quote,
        execution,
        executionMode: isAutonomous ? "autonomous" : executionStatus === "failed" ? "blocked" : "manual",
        expectedSlippage: state.quote?.priceImpact ?? null,
        actualSlippage: null,
        agentIdentity,
        intentMethod: state.intentMethod || "regex",
      };

      set({ step: "receipt", execution, receipt: decisionReceipt });

      // Persist to server
      await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(decisionReceipt),
      }).catch(() => {});
    } catch (err) {
      set({
        step: "error",
        error: err instanceof Error ? err.message : "Execution failed",
      });
    }
  },

  reset: () => {
    const currentPolicy = get().policy;
    set({ ...initialState, policy: currentPolicy });
  },
}));

async function getWalletAddress(): Promise<string> {
  try {
    const { BrowserProvider } = await import("ethers");
    const provider = new BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    return signer.getAddress();
  } catch {
    return "0x0000000000000000000000000000000000000001";
  }
}
