"use client";

import { useQuery } from "@tanstack/react-query";
import { useWalletStore } from "@/lib/stores/wallet";
import { WalletConnect } from "@/components/portfolio/WalletConnect";
import { PositionsList } from "@/components/portfolio/PositionsList";
import { ExposureSummary } from "@/components/portfolio/ExposureSummary";
import { SkeletonTable } from "@/components/shared/SkeletonLoader";
import { Wallet } from "lucide-react";
import { useTradeStore } from "@/lib/stores/trade";
import { useAgenticWalletStore } from "@/lib/stores/agentic-wallet";
import { AgenticWalletPanel } from "@/components/agent/AgenticWalletPanel";

export default function PortfolioPage() {
  const browserWallet = useWalletStore();
  const agenticWallet = useAgenticWalletStore(s => s.status);
  const mode = useTradeStore(s => s.executionMode);
  const setMode = useTradeStore(s => s.setExecutionMode);
  const tradeStep = useTradeStore(s => s.step);
  const address = mode === 'agentic' ? agenticWallet?.address : browserWallet.address;
  const connected = mode === 'agentic' ? !!agenticWallet?.connected : browserWallet.connected;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["portfolio", address],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio?wallet=${address}`);
      if (!res.ok) throw new Error("Failed to fetch portfolio");
      return res.json();
    },
    enabled: connected && !!address,
    refetchInterval: 15000,
  });

  const holdings = data?.holdings || [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <fieldset disabled={['executing','verifying','quoting'].includes(tradeStep)} className="flex flex-wrap gap-4 text-sm"><legend className="text-xs text-text-secondary mb-2">Portfolio account</legend>
        <label className="min-h-11 flex items-center gap-2"><input type="radio" name="portfolio-wallet" checked={mode==='wallet'} onChange={()=>setMode('wallet')}/>Browser wallet</label>
        <label className="min-h-11 flex items-center gap-2"><input type="radio" name="portfolio-wallet" checked={mode==='agentic'} onChange={()=>setMode('agentic')}/>Binance Agentic Wallet</label>
      </fieldset>
      {mode === 'agentic' && <AgenticWalletPanel/>}
      {mode === 'wallet' && !connected && <WalletConnect/>}
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight mb-1">
          Portfolio
        </h1>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Wallet className="w-3.5 h-3.5" />
          <span>{mode === 'agentic' ? 'Binance MPC account' : 'Browser account'}</span>
          <span className="font-mono">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}</span>
          <span className="text-text-muted">on BSC</span>
        </div>
      </div>

      {!connected ? <p className="text-sm text-text-secondary">Connect the selected account to view its BSC holdings.</p> : error ? <div role="alert" className="border border-border rounded-xl p-4"><p className="text-loss">Portfolio unavailable: {error.message}</p><button className="min-h-11 text-accent" onClick={()=>refetch()}>Retry</button></div> : isLoading ? (
        <div className="space-y-4">
          <div className="bg-surface-1 border border-border rounded-xl p-4">
            <div className="skeleton h-6 w-32 mb-3" />
            <div className="skeleton h-4 w-48" />
          </div>
          <div className="bg-surface-1 border border-border rounded-xl">
            <SkeletonTable rows={4} cols={4} />
          </div>
        </div>
      ) : holdings.length === 0 ? (
        <div className="bg-surface-1 border border-border rounded-xl p-10 text-center">
          <p className="text-sm text-text-muted mb-1">No tokenized stock positions found</p>
          <p className="text-xs text-text-muted">
            Execute a trade to see your positions here.
          </p>
        </div>
      ) : (
        <>
          <ExposureSummary positions={holdings} />
          <PositionsList positions={holdings} />
        </>
      )}
    </div>
  );
}
