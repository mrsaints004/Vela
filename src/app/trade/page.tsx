"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTradeStore } from "@/lib/stores/trade";
import { IntentInput } from "@/components/trade/IntentInput";
import { DiscoveryPanel } from "@/components/trade/DiscoveryPanel";
import { ComparisonTable } from "@/components/trade/ComparisonTable";
import { RecommendationBar } from "@/components/trade/RecommendationBar";
import { RiskFlags } from "@/components/trade/RiskFlags";
import { ExecutionFlow } from "@/components/trade/ExecutionFlow";
import { PriceChart } from "@/components/trade/PriceChart";
import { SkeletonBlock } from "@/components/shared/SkeletonLoader";
import { AlertCircle, RotateCcw, Search, Layers, ShieldCheck, Clock, Wallet, Zap, Bot, Type } from "lucide-react";
import { useWalletStore } from "@/lib/stores/wallet";

function TradePageInner() {
  const searchParams = useSearchParams();
  const ticker = searchParams.get("ticker");

  const {
    step, intent, intentMethod, representations, costs, recommendation, factors,
    selectedProvider, selectedTokenAddress, quote, simulation,
    policyEvaluation, policy,
    referencePrice, marketStatus, receipt, error, execution,
    executionMode, agenticPlan, selectionReasoning,
    submitIntent, selectProvider, fetchQuoteAndSimulate, approve, execute,
    setExecutionMode, setPolicyPreset, updatePolicyField, reset,
  } = useTradeStore();

  const { connected, connect, connecting } = useWalletStore();

  // Auto-submit if ticker from URL
  useEffect(() => {
    if (ticker && step === "idle") {
      submitIntent(`Buy $500 of ${ticker}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  const isIdle = step === "idle";
  const isParsing = step === "parsing";
  const isDiscovering = step === "discovering" || isParsing;
  const hasResults = representations.length > 0;
  const isInExecution = [
    "quoting", "simulating", "evaluating",
    "awaiting-approval", "executing", "verifying", "receipt",
  ].includes(step);

  const inputDisabled = step === "executing" || step === "discovering" || step === "parsing";

  function handleNewIntent(raw: string) {
    if (step !== "idle" && step !== "error" && step !== "receipt" && step !== "comparing") {
      reset();
    }
    submitIntent(raw);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-text-primary tracking-tight">
            Trade
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Policy-bounded execution for tokenized equities
          </p>
        </div>
        {step !== "idle" && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* Intent Input with Policy Config */}
      <div className="mb-6">
        <IntentInput
          onSubmit={handleNewIntent}
          disabled={inputDisabled}
          initialTicker={ticker}
          policy={policy}
          onPolicyPreset={setPolicyPreset}
          onPolicyFieldChange={updatePolicyField}
        />
      </div>

      {/* Error state */}
      {step === "error" && error && (
        <div className="border border-border rounded-xl px-4 py-3 flex items-start gap-3 mb-6">
          <AlertCircle className="w-4 h-4 text-loss mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-text-primary">{error}</p>
            <p className="text-xs text-text-muted mt-1">Edit your intent above and try again.</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isDiscovering && (
        <div className="space-y-4">
          {isParsing && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Bot className="w-3.5 h-3.5 text-accent animate-pulse" />
              <span>Parsing intent with AI...</span>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <SkeletonBlock lines={4} />
              <SkeletonBlock lines={6} />
            </div>
            <div className="space-y-4">
              <SkeletonBlock lines={3} />
              <SkeletonBlock lines={5} />
            </div>
          </div>
        </div>
      )}

      {/* Idle state */}
      {isIdle && !ticker && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          {[
            { icon: Search, title: "Discover", desc: "Finds every tokenized version across bStocks, Ondo, xStocks." },
            { icon: Layers, title: "Evaluate", desc: "Checks your policy constraints — deviation, slippage, concentration, liquidity." },
            { icon: ShieldCheck, title: "Execute", desc: "Autonomously when policy permits. Manual approval when it doesn't." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-surface-1 border border-border rounded-xl p-4">
              <Icon className="w-4 h-4 text-text-muted mb-2" />
              <h4 className="text-sm font-medium text-text-primary mb-1">{title}</h4>
              <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Two-column layout for results */}
      {hasResults && (step === "comparing" || isInExecution) && (
        <>
          {/* After-hours context banner */}
          {marketStatus && !marketStatus.isOpen && (
            <div className="border border-border rounded-xl px-4 py-3 flex items-start gap-3 mb-6">
              <Clock className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-text-primary">
                  Reference market is {marketStatus.status === "weekend" ? "closed for the weekend" : "closed"}
                  {marketStatus.staleDuration != null && marketStatus.staleDuration > 0
                    ? ` — reference price is ${marketStatus.staleDuration.toFixed(0)}h stale`
                    : ""}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  On-chain prices may diverge from the last reference. Effective cost includes an uncertainty penalty.
                  {policy?.blockAfterHours && (
                    <span className="text-loss"> Your policy blocks after-hours execution.</span>
                  )}
                </p>
              </div>
            </div>
          )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-4">
            {intent && (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <span className="font-mono text-text-primary">{intent.ticker}</span>
                <span>·</span>
                <span className="font-mono">${intent.amount.toLocaleString()}</span>
                <span>·</span>
                <span>{representations.length} providers</span>
                {intentMethod && (
                  <>
                    <span>·</span>
                    <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                      intentMethod === "ai"
                        ? "bg-accent/10 text-accent"
                        : "bg-surface-2 text-text-muted"
                    }`}>
                      {intentMethod === "ai" ? <Bot className="w-2.5 h-2.5" /> : <Type className="w-2.5 h-2.5" />}
                      {intentMethod === "ai" ? "AI parsed" : "regex"}
                    </span>
                  </>
                )}
                {policyEvaluation?.canExecuteAutonomously && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-accent">
                      <Zap className="w-3 h-3" />
                      Auto
                    </span>
                  </>
                )}
              </div>
            )}

            <PriceChart representations={representations} referencePrice={referencePrice} />

            <ComparisonTable
              costs={costs}
              selectedProvider={selectedProvider}
              onSelect={(provider) => {
                const rep = representations.find((r) => r.provider === provider);
                if (rep) selectProvider(provider, rep.tokenAddress);
              }}
            />

            {/* Selection Reasoning */}
            {selectionReasoning && selectedProvider && (
              <div className="bg-surface-1 border border-border rounded-xl p-3">
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
                  Selection Reasoning
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {selectionReasoning}
                </p>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {recommendation && (
              <RecommendationBar recommendation={recommendation} factors={factors} />
            )}

            <RiskFlags policyEvaluation={policyEvaluation} />

            {/* Execution mode toggle */}
            {step === "comparing" && selectedProvider && (
              <div className="bg-surface-1 border border-border rounded-xl p-3">
                <div className="text-xs text-text-muted mb-2">Execution via</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExecutionMode("agentic")}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                      executionMode === "agentic"
                        ? "bg-accent/10 text-accent border border-accent/20"
                        : "text-text-muted border border-transparent hover:text-text-secondary"
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    Agentic
                  </button>
                  <button
                    onClick={() => setExecutionMode("wallet")}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                      executionMode === "wallet"
                        ? "bg-surface-3 text-text-primary border border-border-active"
                        : "text-text-muted border border-transparent hover:text-text-secondary"
                    }`}
                  >
                    MetaMask
                  </button>
                </div>
                {executionMode === "agentic" && (
                  <p className="text-[10px] text-text-muted mt-1.5 leading-relaxed">
                    {policy?.autonomousExecution
                      ? "Auto-executes when all policy checks pass. Asks approval otherwise."
                      : "Builds execution plan via agentic pipeline. Requires your approval."}
                  </p>
                )}
              </div>
            )}

            {step === "comparing" && selectedProvider && !connected && (
              <div className="bg-surface-1 border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-text-muted" />
                  <span className="text-sm text-text-primary font-medium">Wallet not connected</span>
                </div>
                <p className="text-xs text-text-muted mb-3">
                  Connect your wallet for accurate quotes and to execute trades.
                </p>
                <button
                  onClick={connect}
                  disabled={connecting}
                  className="w-full py-2 rounded-lg text-xs font-medium border border-border text-text-secondary hover:text-text-primary hover:border-border-active transition-colors"
                >
                  {connecting ? "Connecting..." : "Connect Wallet"}
                </button>
              </div>
            )}

            {step === "comparing" && selectedProvider && (
              <button
                onClick={fetchQuoteAndSimulate}
                className="w-full py-3 rounded-xl text-sm font-medium transition-colors bg-accent text-bg-primary hover:bg-accent/90"
              >
                Get Quote & Evaluate
              </button>
            )}

            <ExecutionFlow
              step={step}
              quote={quote}
              simulation={simulation}
              policyEvaluation={policyEvaluation}
              onApprove={approve}
              onExecute={execute}
              txHash={execution?.txHash || null}
              executionMode={executionMode}
            />

            {step === "receipt" && receipt && (
              <div className="bg-surface-1 border border-border rounded-xl px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  {receipt.executionMode === "autonomous" && (
                    <Zap className="w-3 h-3 text-accent" />
                  )}
                  <span className="text-xs font-mono text-text-muted">{receipt.id}</span>
                </div>
                <div className="text-[10px] text-text-muted mb-1">
                  {receipt.executionMode === "autonomous"
                    ? "Executed autonomously"
                    : receipt.executionMode === "manual"
                    ? "Executed with manual approval"
                    : "Execution blocked"}
                </div>
                <a href="/receipts" className="block mt-1 text-xs text-accent hover:underline">
                  View decision receipts &rarr;
                </a>
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

function TradePageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <SkeletonBlock lines={3} />
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<TradePageSkeleton />}>
      <TradePageInner />
    </Suspense>
  );
}
