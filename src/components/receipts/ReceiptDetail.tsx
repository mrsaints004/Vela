"use client";

import type { DecisionReceipt, VelaReceipt } from "@/lib/types";
import { NumberDisplay } from "@/components/shared/NumberDisplay";
import { StatusDot } from "@/components/shared/StatusDot";
import { X, Zap, Shield, ShieldOff, ExternalLink, Bot, Type } from "lucide-react";

interface ReceiptDetailProps {
  receipt: DecisionReceipt | VelaReceipt;
  onClose: () => void;
}

function isDecisionReceipt(r: DecisionReceipt | VelaReceipt): r is DecisionReceipt {
  return "policySnapshot" in r;
}

export function ReceiptDetail({ receipt, onClose }: ReceiptDetailProps) {
  if (isDecisionReceipt(receipt)) {
    return <DecisionReceiptView receipt={receipt} onClose={onClose} />;
  }
  return <LegacyReceiptView receipt={receipt} onClose={onClose} />;
}

function DecisionReceiptView({ receipt, onClose }: { receipt: DecisionReceipt; onClose: () => void }) {
  return (
    <div className="bg-surface-1 border border-border rounded-xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Decision Receipt
          </h3>
          {receipt.executionMode === "autonomous" && (
            <span className="flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">
              <Zap className="w-2.5 h-2.5" /> Auto
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-secondary">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
        {/* REQUEST */}
        <Section title="Request">
          <Row label="Intent" value={receipt.intent.raw} mono />
          <Row label="Action" value={receipt.intent.action.toUpperCase()} />
          <Row label="Ticker" value={receipt.intent.ticker} mono />
          <Row
            label="Amount"
            value={
              receipt.intent.unit === "usd"
                ? `$${receipt.intent.amount.toLocaleString()}`
                : `${receipt.intent.amount} shares`
            }
            mono
          />
        </Section>

        {/* POLICY */}
        <Section title="Policy Constraints">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Row label="Max Deviation" value={`${receipt.policySnapshot.maxDeviation}%`} mono />
            <Row label="Max Slippage" value={`${receipt.policySnapshot.maxSlippage}%`} mono />
            <Row label="Max Trade" value={`$${receipt.policySnapshot.maxTradeSize.toLocaleString()}`} mono />
            <Row label="Daily Limit" value={`$${receipt.policySnapshot.dailyLimit.toLocaleString()}`} mono />
            <Row label="Max Concentration" value={`${receipt.policySnapshot.maxConcentration}%`} mono />
            <Row label="Min Liquidity" value={receipt.policySnapshot.minLiquidity} />
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted">
            <span>{receipt.policySnapshot.autonomousExecution ? "Auto-execute: ON" : "Auto-execute: OFF"}</span>
            <span>{receipt.policySnapshot.blockAfterHours ? "After-hours: BLOCKED" : "After-hours: ALLOWED"}</span>
          </div>
          {receipt.policySnapshot.allowedAssets.length > 0 && (
            <div className="text-xs text-text-muted mt-1">
              Allowed: {receipt.policySnapshot.allowedAssets.join(", ")}
            </div>
          )}
        </Section>

        {/* REPRESENTATIONS CONSIDERED */}
        <Section title={`Representations Considered (${receipt.representationsConsidered.length})`}>
          <div className="space-y-2">
            {receipt.representationsConsidered.map((rep, i) => (
              <div
                key={i}
                className={`flex items-start justify-between py-1.5 px-2 rounded-lg ${
                  rep.provider === receipt.selectedProvider ? "bg-accent/5 border border-accent/10" : ""
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-text-primary">
                      #{rep.rank} {rep.provider}
                    </span>
                    {rep.provider === receipt.selectedProvider && (
                      <span className="text-[9px] text-accent font-medium">SELECTED</span>
                    )}
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {rep.selectionNote}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-text-primary">
                    ${rep.impliedSharePrice.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {rep.liquidityRating} · ${rep.effectiveCost.toFixed(2)} cost
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* SELECTION REASONING */}
        <Section title="Why This Provider">
          <p className="text-xs text-text-secondary leading-relaxed">
            {receipt.selectionReasoning}
          </p>
        </Section>

        {/* MARKET CONTEXT */}
        <Section title="Market Context">
          <Row label="Status" value={receipt.marketStatus.status} />
          <Row label="Market Open" value={receipt.marketStatus.isOpen ? "Yes" : "No"} />
          {receipt.referencePrice && (
            <Row label="Reference Price" mono>
              <NumberDisplay value={receipt.referencePrice} format="currency" />
            </Row>
          )}
          {receipt.referenceStaleness != null && receipt.referenceStaleness > 0 && (
            <Row label="Reference Staleness" value={`${receipt.referenceStaleness.toFixed(1)}h`} mono />
          )}
        </Section>

        {/* POLICY EVALUATION */}
        <Section title="Policy Evaluation">
          <div className="flex items-center gap-2 mb-2">
            {receipt.policyEvaluation.action === "allow" ? (
              <Shield className="w-3.5 h-3.5 text-gain" />
            ) : receipt.policyEvaluation.action === "warn" ? (
              <Shield className="w-3.5 h-3.5 text-warning" />
            ) : (
              <ShieldOff className="w-3.5 h-3.5 text-loss" />
            )}
            <span className={`text-xs font-medium ${
              receipt.policyEvaluation.action === "allow" ? "text-gain" :
              receipt.policyEvaluation.action === "warn" ? "text-warning" : "text-loss"
            }`}>
              {receipt.policyEvaluation.action.toUpperCase()}
            </span>
            {receipt.policyEvaluation.canExecuteAutonomously && (
              <span className="text-[10px] text-accent ml-1">· autonomous</span>
            )}
          </div>
          <div className="space-y-1">
            {receipt.policyEvaluation.checks.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs py-0.5">
                <StatusDot status={c.status} />
                <span className="text-text-muted w-28 shrink-0">{c.name}</span>
                <span className="text-text-secondary flex-1">{c.message}</span>
                {"threshold" in c && c.threshold && (
                  <span className="text-[10px] font-mono text-text-muted shrink-0">
                    {c.threshold}
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
            {receipt.policyEvaluation.reasoning}
          </p>
        </Section>

        {/* SIMULATION */}
        {receipt.simulation && (
          <Section title="Simulation">
            <div className="flex items-center gap-2">
              <StatusDot status={receipt.simulation.status === "SUCCESS" ? "active" : "fail"} />
              <span className={receipt.simulation.status === "SUCCESS" ? "text-gain" : "text-loss"}>
                {receipt.simulation.status}
              </span>
              {receipt.simulation.failReason && (
                <span className="text-text-muted text-xs">— {receipt.simulation.failReason}</span>
              )}
            </div>
          </Section>
        )}

        {/* QUOTE */}
        {receipt.quote && (
          <Section title="Quote">
            <Row label="Expected Price" mono>
              <NumberDisplay value={receipt.quote.expectedPrice} format="currency" />
            </Row>
            <Row label="Output" mono>
              <NumberDisplay value={receipt.quote.toAmount} format="decimal" decimals={6} />
            </Row>
            <Row label="Price Impact" mono>
              <NumberDisplay value={receipt.quote.priceImpact} format="percent" colored />
            </Row>
            <Row label="Route" value={receipt.quote.routes.join(" → ")} mono />
          </Section>
        )}

        {/* EXECUTION */}
        <Section title="Execution">
          <Row label="Mode">
            <span className="flex items-center gap-1 text-xs">
              {receipt.executionMode === "autonomous" && <Zap className="w-3 h-3 text-accent" />}
              {receipt.executionMode}
            </span>
          </Row>
          {receipt.execution && (
            <>
              <Row label="Status">
                <StatusDot status={receipt.execution.status === "confirmed" ? "active" : "fail"} />
                <span className="ml-1.5">{receipt.execution.status}</span>
              </Row>
              {receipt.execution.txHash && (
                <Row label="TX Hash">
                  <a
                    href={`https://bscscan.com/tx/${receipt.execution.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-accent hover:underline text-xs inline-flex items-center gap-1"
                  >
                    {receipt.execution.txHash.slice(0, 10)}...{receipt.execution.txHash.slice(-8)}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </Row>
              )}
            </>
          )}
          {receipt.expectedSlippage != null && (
            <Row label="Expected Slippage" mono>
              <NumberDisplay value={receipt.expectedSlippage} format="percent" colored />
            </Row>
          )}
          {receipt.actualSlippage != null && (
            <Row label="Actual Slippage" mono>
              <NumberDisplay value={receipt.actualSlippage} format="percent" colored />
            </Row>
          )}
        </Section>

        {/* AGENT IDENTITY */}
        {receipt.agentIdentity && (
          <Section title="Agent Identity (ERC-8004)">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-medium text-accent">
                Registered Agent #{receipt.agentIdentity.agentId}
              </span>
            </div>
            <Row label="Agent NFT" value={`#${receipt.agentIdentity.agentId}`} mono />
            <Row label="Registry">
              <a
                href={`${receipt.agentIdentity.chainId === 97 ? "https://testnet.bscscan.com" : "https://bscscan.com"}/address/${receipt.agentIdentity.registryAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-accent hover:underline text-xs inline-flex items-center gap-1"
              >
                {receipt.agentIdentity.registryAddress.slice(0, 10)}...{receipt.agentIdentity.registryAddress.slice(-8)}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </Row>
            <Row label="Chain" value={receipt.agentIdentity.chainId === 97 ? "BSC Testnet" : "BSC Mainnet"} />
          </Section>
        )}

        {/* INTENT PARSING METHOD */}
        <Section title="Intent Parsing">
          <div className="flex items-center gap-2">
            {receipt.intentMethod === "ai" ? (
              <>
                <Bot className="w-3 h-3 text-accent" />
                <span className="text-xs text-accent font-medium">AI (Groq LLM)</span>
              </>
            ) : (
              <>
                <Type className="w-3 h-3 text-text-muted" />
                <span className="text-xs text-text-muted">Regex pattern matching</span>
              </>
            )}
          </div>
        </Section>

        {/* Timestamp */}
        <div className="text-xs text-text-muted border-t border-border/50 pt-3">
          {new Date(receipt.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function LegacyReceiptView({ receipt, onClose }: { receipt: VelaReceipt; onClose: () => void }) {
  return (
    <div className="bg-surface-1 border border-border rounded-xl">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">Receipt</h3>
          <span className="text-xs text-text-muted font-mono">{receipt.id}</span>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-secondary">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-4 text-sm">
        <Section title="Intent">
          <Row label="Raw" value={receipt.intent.raw} mono />
          <Row label="Ticker" value={receipt.intent.ticker} mono />
          <Row label="Amount" value={`$${receipt.intent.amount.toLocaleString()}`} mono />
        </Section>
        <Section title="Selection">
          <Row label="Provider" value={receipt.selectedProvider} />
          <Row label="Recommendation" value={receipt.recommendation} />
        </Section>
        {receipt.execution?.txHash && (
          <Section title="Execution">
            <Row label="TX Hash">
              <a
                href={`https://bscscan.com/tx/${receipt.execution.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-accent hover:underline text-xs"
              >
                {receipt.execution.txHash.slice(0, 10)}...{receipt.execution.txHash.slice(-8)}
              </a>
            </Row>
          </Section>
        )}
        <div className="text-xs text-text-muted border-t border-border/50 pt-3">
          {new Date(receipt.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/50 pt-3 first:border-t-0 first:pt-0">
      <h4 className="text-xs text-text-muted uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      {children || (
        <span className={`text-text-primary ${mono ? "font-mono text-xs" : ""}`}>
          {value}
        </span>
      )}
    </div>
  );
}
