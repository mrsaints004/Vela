import Link from "next/link";
import {
  ArrowRight, Activity, Search, Layers, ShieldCheck, Receipt,
  GitCompare, BarChart3, Wallet, TrendingUp, Clock, FileText,
  Zap, Shield, Lock, Bot,
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
            The autonomous execution<br />
            layer for <span className="text-accent">tokenized equities</span>
          </h1>

          <p className="text-base sm:text-lg text-text-secondary leading-relaxed mb-8 max-w-xl">
            Tell it what you want to own in plain language — &quot;invest 2k in Apple&quot;
            — and the rules it must obey. Vela&apos;s AI parses your intent, finds
            the best tokenized representation, evaluates execution conditions,
            simulates the transaction, and executes only when your policy is
            satisfied — then proves exactly why it acted.
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

      {/* How it works — 5-step pipeline */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-6">How it works</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { n: "01", icon: Shield, title: "Define Policy", text: "Set your constraints — max deviation, slippage, concentration, trade size. Choose conservative, moderate, or aggressive presets." },
              { n: "02", icon: Search, title: "Discover", text: "Vela finds every tokenized version of your stock across bStocks, Ondo, and xStocks on BSC." },
              { n: "03", icon: Layers, title: "Evaluate", text: "Each provider ranked by effective cost. Your policy constraints checked against live market conditions." },
              { n: "04", icon: ShieldCheck, title: "Simulate", text: "Transaction simulated on-chain. Policy engine runs all checks — if everything passes, agent can execute autonomously." },
              { n: "05", icon: Receipt, title: "Decision Receipt", text: "Full decision trail: what was asked, what was considered, why this provider, which checks passed, what happened." },
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

      {/* Core Concept — Policy-Bounded Autonomy */}
      <section className="border-t border-border bg-surface-1/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Core concept</h2>
          <h3 className="text-xl sm:text-2xl font-semibold text-text-primary mb-6">
            Autonomy without unlimited authority
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-border rounded-xl p-4">
              <Lock className="w-4 h-4 text-accent mb-2" />
              <h4 className="text-sm font-medium text-text-primary mb-1">You define the boundaries</h4>
              <p className="text-xs text-text-muted leading-relaxed">
                Max deviation, slippage limits, concentration caps, trade size limits,
                daily limits, allowed assets, market hours restrictions. The agent operates
                strictly within your constraints.
              </p>
            </div>
            <div className="border border-border rounded-xl p-4">
              <Bot className="w-4 h-4 text-accent mb-2" />
              <h4 className="text-sm font-medium text-text-primary mb-1">Agent evaluates and decides</h4>
              <p className="text-xs text-text-muted leading-relaxed">
                Discovers providers, compares effective costs, checks your policy.
                If all constraints are satisfied — it executes autonomously.
                If not — it explains why and asks for approval.
              </p>
            </div>
            <div className="border border-border rounded-xl p-4">
              <FileText className="w-4 h-4 text-accent mb-2" />
              <h4 className="text-sm font-medium text-text-primary mb-1">Every decision is provable</h4>
              <p className="text-xs text-text-muted leading-relaxed">
                Decision receipts show the full trail: what alternatives existed,
                why this provider was chosen, which policy checks passed,
                the simulation result, and the on-chain outcome.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="border-t border-border">
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

      {/* After-hours scenario */}
      <section className="border-t border-border bg-surface-1/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">In practice</h2>
          <h3 className="text-xl sm:text-2xl font-semibold text-text-primary mb-6">
            Saturday. Market closed. Your policy in action.
          </h3>

          <div className="bg-surface-1 border border-border rounded-xl p-6 max-w-2xl">
            <div className="space-y-3 font-mono text-xs">
              <div className="text-text-muted">Your policy: max deviation 1%, auto-execute when safe</div>
              <div className="border-t border-border/50 pt-3"></div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">US Market</span>
                <span className="text-warning">CLOSED (36h stale)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Reference Price</span>
                <span className="text-text-primary">$183.42</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">On-chain Price</span>
                <span className="text-text-primary">$187.76</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Deviation</span>
                <span className="text-loss">+2.37%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Policy Check</span>
                <span className="text-loss">EXCEEDS 1% LIMIT</span>
              </div>
              <div className="border-t border-border/50 pt-3"></div>
              <div className="text-loss flex items-center gap-2">
                <Shield className="w-3 h-3" />
                TRADE BLOCKED — deviation exceeds your 1% policy
              </div>
              <div className="text-text-muted text-[10px] mt-2 leading-relaxed">
                Agent explains: &quot;Reference market is closed and the current tokenized representation is
                trading 2.37% above the last available reference price, exceeding your 1% policy.
                Will re-evaluate when the reference updates.&quot;
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-text-muted">
            <Zap className="w-3 h-3 text-accent" />
            Monday, reference updates. Deviation falls to 0.3%. Policy passes. Agent executes autonomously.
          </div>
        </div>
      </section>

      {/* Navigate */}
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
                Define your policy, type your intent. Vela discovers, evaluates, simulates,
                and executes — autonomously or with your approval.
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
                Connect your wallet to see positions, balances, and exposure concentration.
                Portfolio data feeds into policy concentration checks.
              </p>
            </Link>

            <Link href="/receipts" className="group bg-surface-1 border border-border rounded-xl p-5 hover:border-border-active transition-colors">
              <div className="flex items-center justify-between mb-3">
                <FileText className="w-5 h-5 text-text-secondary" />
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
              </div>
              <h3 className="text-sm font-medium text-text-primary mb-1">Decision Receipts</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Full decision trail: what was asked, what alternatives existed, why this
                provider was chosen, policy evaluation, and on-chain proof.
              </p>
            </Link>

            <Link href="/agent" className="group bg-surface-1 border border-accent/10 rounded-xl p-5 hover:border-accent/30 transition-colors sm:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <Bot className="w-5 h-5 text-accent" />
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
              </div>
              <h3 className="text-sm font-medium text-text-primary mb-1">Agent Studio</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Register Vela as a persistent on-chain agent via ERC-8004. Verifiable identity,
                capabilities metadata, and reputation — all on BNB Chain.
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
              { value: "6", label: "Integrations", sub: "RWA, Trading, TX, Wallet, Agentic, ERC-8004" },
              { value: "12", label: "Policy Checks", sub: "Per execution" },
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
            No sign-up. Define your policy, connect your wallet, and type what you want to trade.
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
