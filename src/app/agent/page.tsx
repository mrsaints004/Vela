"use client";

import {AgenticWalletPanel} from '@/components/agent/AgenticWalletPanel';
import { useState } from "react";
import { useAgentStore } from "@/lib/stores/agent";
import { useWalletStore } from "@/lib/stores/wallet";
import {
  registerAgent,
  getAgentIdentity,
  IDENTITY_REGISTRY,
  IDENTITY_REGISTRY_TESTNET,
} from "@/lib/agent-studio/erc8004";
import type { AgentIdentity } from "@/lib/agent-studio/erc8004";
import {
  Bot, Shield, Zap, ExternalLink, CheckCircle, AlertCircle,
  Wallet, Copy, Layers, Activity, FileText, Search,
} from "lucide-react";

const VELA_CAPABILITIES = [
  "tokenized-stock-discovery",
  "cross-provider-comparison",
  "policy-bounded-execution",
  "wallet-approved-trade-execution",
  "decision-receipt-generation",
  "market-hours-awareness",
  "slippage-estimation",
  "swap-simulation-and-rfq-order-preflight",
];

export default function AgentPage() {
  const { connected, address, connect, connecting } = useWalletStore();
  const {
    agentId, txHash, registered, registering, error, useTestnet,
    setRegistered, setRegistering, setError, setUseTestnet,
  } = useAgentStore();

  const [liveAgent, setLiveAgent] = useState<AgentIdentity | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [copied, setCopied] = useState(false);

  const registryAddress = useTestnet ? IDENTITY_REGISTRY_TESTNET : IDENTITY_REGISTRY;
  const explorerBase = useTestnet ? "https://testnet.bscscan.com" : "https://bscscan.com";

  async function handleRegister() {
    if (!connected) return;

    setRegistering(true);
    try {
      const result = await registerAgent(
        {
          name: "Vela",
          description:
            "Assisted execution for tokenized equities on BSC. " +
            "Discovers representations across bStocks, Ondo, and xStocks, " +
            "evaluates user-defined policy constraints, simulates transactions, " +
            "and requests wallet approval after policy checks — generating " +
            "durable execution-preview receipts with independently checkable settlement evidence.",
          capabilities: VELA_CAPABILITIES,
          version: "0.1.0",
          serviceEndpoint: typeof window !== "undefined" ? window.location.origin : "",
        },
        useTestnet
      );

      setRegistered(result.agentId, result.txHash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  }

  async function handleLookup() {
    if (agentId===null) return;
    setLookingUp(true);
    try {
      const identity = await getAgentIdentity(agentId, useTestnet);
      if (!identity) throw new Error("Identity not found on the selected network.");
      if (identity.owner.toLowerCase() !== address?.toLowerCase()) throw new Error("This identity belongs to another wallet.");
      setLiveAgent(identity);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Identity lookup failed.");
      setLiveAgent(null);
    }
    setLookingUp(false);
  }

  function copyAgentId() {
    if (agentId!==null) {
      navigator.clipboard.writeText(String(agentId));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <AgenticWalletPanel/>
      <div className="border border-border rounded-xl p-4 text-sm text-text-secondary space-y-2">
        <p>Registration creates an identity NFT. It does not move your USDT, create trading funds, or allow unattended spending.</p>
        <p>You need BNB on the selected network to pay registration gas. Trading uses BSC mainnet USDT and may require BNB for approvals.</p>
        <p>Binance Agentic Wallet signing is available above and in Trade. Its MPC wallet account is separate from this browser-wallet identity registration. BNB Agent Studio runtime is not integrated.</p>
      </div>
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight mb-1">
          Agent Identity
        </h1>
        <p className="text-sm text-text-muted">
          Register an on-chain identity for Vela via{" "}
          <a
            href="https://eips.ethereum.org/EIPS/eip-8004"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            ERC-8004
          </a>{" "}
          on BNB Chain.
        </p>
      </div>

      {/* Agent Identity Card */}
      <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
        {/* Card header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Vela Agent</h2>
              <p className="text-[10px] text-text-muted">
                Identity metadata for assisted stock execution
              </p>
            </div>
          </div>
          {registered && agentId!==null && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-gain/10 text-gain text-[10px] font-medium">
                <CheckCircle className="w-3 h-3" />
                Registered
              </span>
              <button
                onClick={copyAgentId}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-surface-2 text-text-muted text-[10px] font-mono hover:text-text-secondary transition-colors"
              >
                #{agentId}
                <Copy className="w-2.5 h-2.5" />
                {copied && <span className="text-accent ml-1">copied</span>}
              </button>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-5 space-y-5">
          {/* Capabilities grid */}
          <div>
            <div className="text-xs text-text-muted uppercase tracking-wider mb-3">
              Declared Product Capabilities
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { icon: Search, label: "Discovery", desc: "Cross-provider token discovery" },
                { icon: Layers, label: "Comparison", desc: "Reference-risk comparison" },
                { icon: Shield, label: "Policy Engine", desc: "Verified execution preflight" },
                { icon: Activity, label: "Simulation", desc: "On-chain tx simulation" },
                { icon: Zap, label: "Wallet Approval", desc: "You approve every trade" },
                { icon: FileText, label: "Receipts", desc: "Verifiable decision trail" },
                { icon: Bot, label: "AI Intent", desc: "Natural language parsing" },
                { icon: Wallet, label: "Browser Wallet", desc: "Signs with your permission" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="border border-border/50 rounded-lg p-2.5">
                  <Icon className="w-3.5 h-3.5 text-text-muted mb-1.5" />
                  <div className="text-xs font-medium text-text-primary">{label}</div>
                  <div className="text-[10px] text-text-muted">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ERC-8004 Details */}
          <div className="border-t border-border/50 pt-4">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-3">
              ERC-8004 Identity
            </div>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Standard</span>
                <span className="text-text-primary">ERC-8004 (Trustless Agents)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Registry</span>
                <a
                  href={`${explorerBase}/address/${registryAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-1"
                >
                  {registryAddress.slice(0, 10)}...{registryAddress.slice(-8)}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Network</span>
                <div className="flex items-center gap-2">
                  <span className="text-text-primary">
                    {useTestnet ? "BSC Testnet" : "BSC Mainnet"}
                  </span>
                  <button
                    disabled={registering||lookingUp}
                    onClick={() => { setLiveAgent(null); setUseTestnet(!useTestnet); }}
                    className="text-[10px] text-accent hover:underline"
                  >
                    Switch to {useTestnet ? "Mainnet" : "Testnet"}
                  </button>
                </div>
              </div>
              {registered && agentId!==null && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Agent ID (NFT)</span>
                    <span className="text-accent font-semibold">#{agentId}</span>
                  </div>
                  {txHash && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Registration TX</span>
                      <a
                        href={`${explorerBase}/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline inline-flex items-center gap-1"
                      >
                        {txHash.slice(0, 10)}...{txHash.slice(-8)}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </>
              )}
              {connected && address && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Owner</span>
                  <span className="text-text-primary">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Live lookup result */}
          {liveAgent && (
            <div className="border-t border-border/50 pt-4">
              <div className="text-xs text-text-muted uppercase tracking-wider mb-2">
                On-chain Verification
              </div>
              <div className="bg-gain/5 border border-gain/20 rounded-lg p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-gain font-medium">
                  <CheckCircle className="w-3 h-3" />
                  Agent identity verified on-chain
                </div>
                <div className="text-text-muted">
                  Owner: {liveAgent.owner.slice(0, 10)}...{liveAgent.owner.slice(-8)}
                </div>
                <div className="text-text-muted">
                  Name: {liveAgent.metadata.name}
                </div>
                <div className="text-text-muted">
                  Capabilities: {liveAgent.metadata.capabilities.length} registered
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-xs text-loss">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Card footer — actions */}
        <div className="px-5 py-4 border-t border-border bg-surface-1/50">
          {!connected ? (
            <button
              onClick={connect}
              disabled={connecting}
              className="w-full py-3 rounded-xl text-sm font-medium border border-border text-text-secondary hover:text-text-primary hover:border-border-active transition-colors flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              {connecting ? "Connecting..." : "Connect Wallet to Register"}
            </button>
          ) : !registered ? (
            <button
              onClick={handleRegister}
              disabled={registering}
              className="w-full py-3 rounded-xl text-sm font-medium bg-accent text-bg-primary hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {registering ? (
                <>
                  <Bot className="w-4 h-4 animate-pulse" />
                  Registering on-chain...
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  Register Identity via ERC-8004
                </>
              )}
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleLookup}
                disabled={lookingUp}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-text-secondary hover:text-text-primary hover:border-border-active transition-colors flex items-center justify-center gap-2"
              >
                <Search className="w-3.5 h-3.5" />
                {lookingUp ? "Verifying..." : "Verify On-chain"}
              </button>
              <a
                href={`${explorerBase}/token/${registryAddress}?a=${agentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-accent/20 text-accent hover:bg-accent/5 transition-colors flex items-center justify-center gap-2"
              >
                View on BSCScan
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* What is ERC-8004 explainer */}
      <div className="bg-surface-1 border border-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-text-primary mb-3">
          What is ERC-8004?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="border border-border/50 rounded-lg p-3">
            <div className="text-text-muted uppercase tracking-wider text-[10px] mb-1.5">
              Identity
            </div>
            <p className="text-text-secondary leading-relaxed">
              Each agent is minted as an ERC-721 NFT on the IdentityRegistry.
              The token resolves to metadata describing the agent&apos;s name,
              capabilities, and service endpoints.
            </p>
          </div>
          <div className="border border-border/50 rounded-lg p-3">
            <div className="text-text-muted uppercase tracking-wider text-[10px] mb-1.5">
              Reputation
            </div>
            <p className="text-text-secondary leading-relaxed">
              The ReputationRegistry stores bounded feedback attestations from
              counterparties — building a verifiable track record of agent
              behavior over time.
            </p>
          </div>
          <div className="border border-border/50 rounded-lg p-3">
            <div className="text-text-muted uppercase tracking-wider text-[10px] mb-1.5">
              Validation
            </div>
            <p className="text-text-secondary leading-relaxed">
              The ValidationRegistry records independent verification requests
              and results — third-party proof that the agent operates as
              advertised.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
