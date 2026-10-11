"use client";

import {AgenticWalletPanel} from '@/components/agent/AgenticWalletPanel';
import {useAgenticWalletStore} from '@/lib/stores/agentic-wallet';
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTradeStore } from "@/lib/stores/trade";
import { IntentInput } from "@/components/trade/IntentInput";
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
  const selling = searchParams.get("action") === "sell";
  const saleToken = searchParams.get("token");
  const initialIntent = ticker ? (selling ? `Sell all ${ticker}` : `Buy $5 of ${ticker}`) : null;

  const {
    step, intent, intentMethod, representations, costs, recommendation, factors,
    selectedProvider, quote, simulation,
    policyEvaluation, policy,
    referencePrice, marketStatus, receipt, error, execution,
    executionMode, selectionReasoning, agenticSigningPreview,setExecutionMode,
    submitIntent, selectProvider, fetchQuoteAndSimulate, approve, execute,
    setPolicyPreset, updatePolicyField, reset,
  } = useTradeStore();

  const agenticStatus=useAgenticWalletStore(s=>s.status);
  const { connected, connect, connecting } = useWalletStore();

  // Auto-submit if ticker from URL
  useEffect(() => {
    if (ticker && (step === "idle" || useTradeStore.getState().intent?.raw!==initialIntent || (selling && useTradeStore.getState().selectedTokenAddress!==saleToken))) {
      if(searchParams.get('wallet')==='agentic')setExecutionMode('agentic');
      else if(searchParams.get('wallet')==='wallet')setExecutionMode('wallet');
      void submitIntent(initialIntent!).then(()=>{
        const state=useTradeStore.getState();
        if(selling&&saleToken&&state.intent?.raw===initialIntent){const rep=state.representations.find(r=>r.tokenAddress.toLowerCase()===saleToken.toLowerCase());if(rep)state.selectProvider(rep.provider,rep.tokenAddress);}
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, selling, saleToken]);

  const isIdle = step === "idle";
  const isParsing = step === "parsing";
  const isDiscovering = step === "discovering" || isParsing;
  const hasResults = representations.length > 0;
  const isInExecution = [
    "quoting", "simulating", "evaluating",
    "awaiting-approval", "executing", "verifying", "receipt",
  ].includes(step);

  const busy = ["executing", "verifying", "quoting", "discovering", "parsing"].includes(step);
  const inputDisabled = busy;
  const quoteBlockedReason = busy ? 'A request is already in progress.' : executionMode === 'agentic'
    ? (!agenticStatus?.connected ? 'Sign in with Binance above, then refresh wallet status. Your browser wallet does not connect your Binance MPC account.' : null)
    : (!connected ? 'Connect your browser wallet to request a wallet-specific quote.' : null);

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
            Compare stock representations, preview the actual trade, and approve in your wallet.
          </p>
        </div>
        {step !== "idle" && (
          <button
            onClick={reset}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      <fieldset disabled={busy} className="flex flex-wrap gap-3 mb-4 text-sm"><legend className="text-xs text-text-secondary mb-2">Execution wallet</legend>
        <label className="min-h-11 flex items-center gap-2"><input type="radio" name="execution-wallet" checked={executionMode==='wallet'} onChange={()=>setExecutionMode('wallet')}/>Browser wallet</label>
        <label className="min-h-11 flex items-center gap-2"><input type="radio" name="execution-wallet" checked={executionMode==='agentic'} onChange={()=>setExecutionMode('agentic')}/>Binance Agentic Wallet</label>
      </fieldset>
      {executionMode==='agentic'&&<div className="mb-6"><AgenticWalletPanel/></div>}
      {/* Intent Input with Policy Config */}
      <div className="mb-6">
        <IntentInput
          key={initialIntent || "manual"}
          onSubmit={handleNewIntent}
          disabled={inputDisabled}
          initialTicker={ticker}
          initialIntent={initialIntent}
          policy={policy}
          onPolicyPreset={setPolicyPreset}
          onPolicyFieldChange={updatePolicyField}
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="border border-border rounded-xl px-4 py-3 flex items-start gap-3 mb-6">
          <AlertCircle className="w-4 h-4 text-loss mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-text-primary">{error}</p>
            <p className="text-xs text-text-muted mt-1">{hasResults ? 'Follow the message above, then refresh the quote. Never retry an order with an unknown settlement outcome.' : 'Edit your intent above and try again.'}</p>
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
            { icon: Layers, title: "Evaluate", desc: "Checks trade size, reference deviation, quote impact, market hours and preflight." },
            { icon: ShieldCheck, title: "Execute", desc: "Fresh quote, policy checks, and your wallet signature before settlement." },
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
                  On-chain prices may diverge from the last reference. Discovery scores use the last reference. They are not executable prices or a claim about current fair value.
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
                <span className="font-mono">{intent.action==='sell'?(intent.sellAll?'Sell all tokens':`Sell ${intent.amount.toLocaleString()} tokens`):`Buy $${intent.amount.toLocaleString()}`}</span>
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

            {intent?.action==='sell'&&<p className="text-sm text-text-secondary">Select the issuer whose stock tokens you own. Selling returns USDT to the same account. Token quantities are not share quantities. A fresh preview checks your exact balance, USD trade limit and vendor minimum.</p>}
            <PriceChart representations={representations} referencePrice={referencePrice} />

            <ComparisonTable
              costs={costs}
              selectedProvider={selectedProvider}
              onSelect={(provider) => {
                const rep = representations.find((r) => r.provider === provider);
                if (rep && !busy) selectProvider(provider, rep.tokenAddress);
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

            <div className="bg-surface-1 border border-border rounded-xl p-3 text-xs text-text-secondary">
              {executionMode==='agentic'?'Execution uses your Binance MPC wallet on BSC mainnet. Review Binance signing risks and confirm; Binance App rules and Developer Mode apply.':'Execution uses your browser wallet on BSC mainnet. Vela does not hold your keys. Every approval and stock order needs your signature.'}
            </div>

            {step === "comparing" && selectedProvider && executionMode==='wallet' && !connected && (
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
              <div className="space-y-2">
              <button
                onClick={fetchQuoteAndSimulate}
                disabled={!!quoteBlockedReason}
                aria-describedby="quote-prerequisites"
                className="w-full py-3 rounded-xl text-sm font-medium transition-colors bg-accent text-bg-primary hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Get Quote & Evaluate
              </button>
              <p id="quote-prerequisites" role="status" className="text-xs text-text-secondary">{quoteBlockedReason || 'Vela accepts purchases from $5. Funds and permissions are checked during preview. Binance/vendor minimums may be higher and cannot be overridden by Vela. BNB may be required for approval gas.'}</p>
              </div>
            )}

            <ExecutionFlow
              agenticSigningPreview={agenticSigningPreview}
              step={step}
              quote={quote}
              simulation={simulation}
              policyEvaluation={policyEvaluation}
              onApprove={approve}
              onExecute={execute}
              txHash={execution?.txHash || null}
              executionMode={executionMode}
              execution={execution}
              receipt={receipt}
              onRefresh={fetchQuoteAndSimulate}
            />


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
