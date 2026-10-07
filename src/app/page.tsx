import Link from "next/link";
import {
  ArrowRight, Activity, Search, Layers, ShieldCheck, Receipt,
  GitCompare, BarChart3, Wallet, TrendingUp, Clock, FileText,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-14 sm:pb-20">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-5">
            <span className="px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-xs text-accent font-medium">
              BNB Chain
            </span>
            <span className="px-2.5 py-1 rounded-full bg-surface-2 border border-border text-xs text-text-muted">
              bStocks · Ondo · xStocks
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-text-primary tracking-tight leading-tight mb-4">
            Execution intelligence for<br />
            <span className="text-accent">tokenized stocks</span>
          </h1>

          <p className="text-base sm:text-lg text-text-secondary leading-relaxed mb-8 max-w-xl">
            The same stock trades at different prices across providers on BSC.
            Vela finds every representation, compares real costs, simulates the trade,
            and proves the outcome.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/trade"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-accent text-bg-primary hover:bg-accent/90 transition-colors"
            >
              Start Trading
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/markets"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-surface-2 border border-border text-text-primary hover:border-border-active transition-colors"
            >
              Browse Markets
            </Link>
          </div>
        </div>
      </section>

      {/* What Vela Does — 4-step flow */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-6">How it works</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: "01", icon: Search, title: "Discover", text: "Type what you want — Vela finds every tokenized version of that stock across bStocks, Ondo, and xStocks on BSC." },
              { n: "02", icon: Layers, title: "Compare", text: "Each provider ranked by effective execution cost: price deviation, slippage, liquidity depth, and gas." },
              { n: "03", icon: ShieldCheck, title: "Simulate", text: "Policy engine checks market hours, deviation, volume and honeypot risk. Transaction simulated on-chain before signing." },
              { n: "04", icon: Receipt, title: "Execute & Receipt", text: "Wallet signs the swap. Vela generates a verifiable receipt: intent, alternatives, reasoning, simulation, outcome." },
            ].map(({ n, icon: Icon, title, text }) => (
              <div key={n} className="bg-surface-1 border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-mono text-text-muted">{n}</span>
                  <Icon className="w-4 h-4 text-text-muted" />
                </div>
                <h3 className="text-sm font-medium text-text-primary mb-1.5">{title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="border-t border-border bg-surface-1/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">The problem</h2>
          <h3 className="text-xl sm:text-2xl font-semibold text-text-primary mb-6">
            One stock, multiple prices, zero transparency
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-border rounded-xl p-4">
              <GitCompare className="w-4 h-4 text-text-muted mb-2" />
              <h4 className="text-sm font-medium text-text-primary mb-1">Price fragmentation</h4>
              <p className="text-xs text-text-muted leading-relaxed">
                NVDA can differ by 2%+ across providers — $12 per $500 trade, invisible without comparison.
              </p>
            </div>
            <div className="border border-border rounded-xl p-4">
              <BarChart3 className="w-4 h-4 text-text-muted mb-2" />
              <h4 className="text-sm font-medium text-text-primary mb-1">Hidden slippage</h4>
              <p className="text-xs text-text-muted leading-relaxed">
                Low-liquidity providers quote one price but execute at another. Slippage can hit 5% on thin books.
              </p>
            </div>
            <div className="border border-border rounded-xl p-4">
              <Clock className="w-4 h-4 text-text-muted mb-2" />
              <h4 className="text-sm font-medium text-text-primary mb-1">Stale references</h4>
              <p className="text-xs text-text-muted leading-relaxed">
                Traditional markets close. On-chain doesn&apos;t. Reference prices go stale, and nobody warns you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Navigate — Cards linking to each section */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-6">Explore</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/trade" className="group bg-surface-1 border border-border rounded-xl p-5 hover:border-border-active transition-colors">
              <div className="flex items-center justify-between mb-3">
                <Activity className="w-5 h-5 text-accent" />
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
              </div>
              <h3 className="text-sm font-medium text-text-primary mb-1">Trade Terminal</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Natural-language intent input. Discover providers, compare costs, simulate, execute, and get a verifiable receipt.
              </p>
            </Link>

            <Link href="/markets" className="group bg-surface-1 border border-border rounded-xl p-5 hover:border-border-active transition-colors">
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="w-5 h-5 text-text-secondary" />
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
              </div>
              <h3 className="text-sm font-medium text-text-primary mb-1">Markets</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Browse all tokenized equities on BSC. See which providers cover each ticker, reference prices, and market status.
              </p>
            </Link>

            <Link href="/portfolio" className="group bg-surface-1 border border-border rounded-xl p-5 hover:border-border-active transition-colors">
              <div className="flex items-center justify-between mb-3">
                <Wallet className="w-5 h-5 text-text-secondary" />
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
              </div>
              <h3 className="text-sm font-medium text-text-primary mb-1">Portfolio</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Connect your wallet to see tokenized stock positions, balances, and exposure concentration across providers.
              </p>
            </Link>

            <Link href="/receipts" className="group bg-surface-1 border border-border rounded-xl p-5 hover:border-border-active transition-colors">
              <div className="flex items-center justify-between mb-3">
                <FileText className="w-5 h-5 text-text-secondary" />
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
              </div>
              <h3 className="text-sm font-medium text-text-primary mb-1">Execution Receipts</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Full audit trail of every trade: what you asked for, what was chosen, why, simulation result, and on-chain outcome.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-border bg-surface-1/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { value: "3", label: "Providers", sub: "bStocks, Ondo, xStocks" },
              { value: "BSC", label: "Network", sub: "BNB Smart Chain" },
              { value: "USDT", label: "Settlement", sub: "DEX aggregated swaps" },
              { value: "100%", label: "On-chain", sub: "Non-custodial" },
            ].map(({ value, label, sub }) => (
              <div key={label}>
                <div className="text-xl sm:text-2xl font-semibold font-mono text-text-primary mb-0.5">{value}</div>
                <div className="text-sm text-text-secondary">{label}</div>
                <div className="text-xs text-text-muted">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <h3 className="text-xl sm:text-2xl font-semibold text-text-primary mb-2">
            Try it now
          </h3>
          <p className="text-sm text-text-muted mb-6 max-w-md mx-auto">
            No sign-up. Connect your wallet and type what you want to trade.
          </p>
          <Link
            href="/trade"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-medium bg-accent text-bg-primary hover:bg-accent/90 transition-colors"
          >
            Open Trade Terminal
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
