import { create } from "zustand";
import type {
  TradeFlowStep,
  TradeIntent,
  DiscoveredRepresentation,
  QuoteSnapshot,
  SimulationSnapshot,
  ExecutionSnapshot,
  PolicyResult,
  RecommendationFactor,
  VelaReceipt,
  MarketStatus,
  EffectiveCost,
} from "../types";
import { parseIntent } from "../engine/intent";

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
  step: TradeFlowStep;
  intent: TradeIntent | null;
  representations: DiscoveredRepresentation[];
  costs: EffectiveCost[];
  recommendation: string | null;
  factors: RecommendationFactor[];
  selectedProvider: string | null;
  selectedTokenAddress: string | null;
  quote: QuoteSnapshot | null;
  simulation: SimulationSnapshot | null;
  execution: ExecutionSnapshot | null;
  policy: PolicyResult | null;
  marketStatus: MarketStatus | null;
  referencePrice: number | null;
  receipt: VelaReceipt | null;
  error: string | null;
  executionMode: ExecutionMode;
  agenticPlan: AgenticPlan | null;

  // Actions
  submitIntent: (raw: string) => Promise<void>;
  selectProvider: (provider: string, tokenAddress: string) => void;
  fetchQuoteAndSimulate: () => Promise<void>;
  approve: () => void;
  execute: () => Promise<void>;
  setExecutionMode: (mode: ExecutionMode) => void;
  reset: () => void;
}

const initialState = {
  step: "idle" as TradeFlowStep,
  intent: null,
  representations: [],
  costs: [],
  recommendation: null,
  factors: [],
  executionMode: "wallet" as ExecutionMode,
  agenticPlan: null as AgenticPlan | null,
  selectedProvider: null,
  selectedTokenAddress: null,
  quote: null,
  simulation: null,
  execution: null,
  policy: null,
  marketStatus: null,
  referencePrice: null,
  receipt: null,
  error: null,
};

export const useTradeStore = create<TradeState>((set, get) => ({
  ...initialState,

  submitIntent: async (raw: string) => {
    set({ ...initialState, step: "parsing" });

    const intent = parseIntent(raw);
    if (!intent) {
      set({ step: "error", error: "Could not parse intent. Try: \"Buy $500 of NVDA\"" });
      return;
    }

    set({ intent, step: "discovering" });

    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discover", ticker: intent.ticker, amount: intent.amount }),
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
        recommendation: data.recommendation || null,
        factors: data.factors || [],
        policy: data.policy || null,
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

  selectProvider: (provider: string, tokenAddress: string) => {
    set({ selectedProvider: provider, selectedTokenAddress: tokenAddress });
  },

  fetchQuoteAndSimulate: async () => {
    const { intent, selectedProvider, selectedTokenAddress } = get();
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
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      set({
        step: "approving",
        quote: data.quote || null,
        simulation: data.simulation || null,
        policy: data.policy || get().policy,
      });
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
        }),
      }).catch(() => {});

      let txHash: string | null = null;
      let executionStatus: "confirmed" | "failed" = "confirmed";

      if (state.executionMode === "agentic" && state.quote) {
        // --- Agentic Wallet Execution ---
        // Build and execute via the agentic pipeline
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

            // Step 2: Execute the plan
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
              txHash = result.finalTxHash;
              executionStatus = result.status === "completed" ? "confirmed" : "failed";

              // Update plan with executed steps
              set({ agenticPlan: { ...plan, steps: result.steps } });
            }
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

      // Build receipt
      const receipt: VelaReceipt = {
        id: `vela-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        intent: state.intent!,
        selectedProvider: state.selectedProvider!,
        selectedTokenAddress: state.selectedTokenAddress!,
        recommendation: state.recommendation || "",
        factors: state.factors,
        discoveredCount: state.representations.length,
        quote: state.quote,
        simulation: state.simulation,
        execution,
        policy: state.policy || { action: "allow", checks: [] },
        marketStatus: state.marketStatus || {
          isOpen: false,
          status: "closed",
          nextOpenTime: null,
          referenceStale: true,
          staleDuration: null,
        },
        referencePrice: state.referencePrice,
      };

      set({ step: "receipt", execution, receipt });

      // Persist to server
      await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(receipt),
      }).catch(() => {});
    } catch (err) {
      set({
        step: "error",
        error: err instanceof Error ? err.message : "Execution failed",
      });
    }
  },

  reset: () => set(initialState),
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
