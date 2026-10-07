"use client";

import type { TradeFlowStepV2, QuoteSnapshot, SimulationSnapshot, PolicyEvaluation } from "@/lib/types";
import { NumberDisplay } from "@/components/shared/NumberDisplay";
import { StatusDot } from "@/components/shared/StatusDot";
import { Skeleton } from "@/components/shared/SkeletonLoader";
import { Zap, Shield, Bot } from "lucide-react";
import { useAgentStore } from "@/lib/stores/agent";

interface ExecutionFlowProps {
  step: TradeFlowStepV2;
  quote: QuoteSnapshot | null;
  simulation: SimulationSnapshot | null;
  policyEvaluation: PolicyEvaluation | null;
  onApprove: () => void;
  onExecute: () => void;
  txHash: string | null;
  executionMode: "wallet" | "agentic";
}

const STEPS = [
  { id: "quoting", label: "Quote" },
  { id: "simulating", label: "Simulate" },
  { id: "evaluating", label: "Policy" },
  { id: "awaiting-approval", label: "Approve" },
  { id: "executing", label: "Execute" },
  { id: "verifying", label: "Verify" },
  { id: "receipt", label: "Receipt" },
] as const;

function getStepStatus(
  stepId: string,
  currentStep: TradeFlowStepV2
): "completed" | "active" | "pending" | "skipped" {
  const stepOrder = STEPS.map((s) => s.id);
  const currentIdx = stepOrder.indexOf(currentStep as any);
  const stepIdx = stepOrder.indexOf(stepId as any);
  if (stepIdx < 0 || currentIdx < 0) return "pending";
  if (stepIdx < currentIdx) return "completed";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

export function ExecutionFlow({
  step,
  quote,
  simulation,
  policyEvaluation,
  onApprove,
  onExecute,
  txHash,
  executionMode,
}: ExecutionFlowProps) {
  const { agentId, registered } = useAgentStore();

  const isInFlow = [
    "quoting", "simulating", "evaluating", "awaiting-approval",
    "executing", "verifying", "receipt",
  ].includes(step);
  if (!isInFlow) return null;

  const isAutonomous = policyEvaluation?.canExecuteAutonomously === true;

  return (
    <div className="bg-surface-1 border border-border rounded-xl">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Execution Flow
        </h3>
        <div className="flex items-center gap-2">
          {registered && agentId && (
            <span className="flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">
              <Bot className="w-2.5 h-2.5" />
              Agent #{agentId}
            </span>
          )}
          {isAutonomous && step !== "receipt" && (
            <div className="flex items-center gap-1 text-accent">
              <Zap className="w-3 h-3" />
              <span className="text-[10px] font-medium">Auto</span>
            </div>
          )}
        </div>
      </div>

      {/* Step indicators */}
      <div className="px-4 py-3 flex items-center gap-0.5 border-b border-border/50 overflow-x-auto">
        {STEPS.map((s, i) => {
          const status = getStepStatus(s.id, step);
          // Skip "Approve" step indicator if autonomous
          if (s.id === "awaiting-approval" && isAutonomous) {
            return (
              <div key={s.id} className="flex items-center gap-0.5">
                <div className="flex items-center gap-1">
                  <StatusDot status="idle" />
                  <span className="text-xs text-text-muted line-through">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <span className="text-text-muted mx-0.5">&rarr;</span>}
              </div>
            );
          }
          return (
            <div key={s.id} className="flex items-center gap-0.5">
              <div className="flex items-center gap-1">
                <StatusDot
                  status={
                    status === "completed" ? "active" :
                    status === "active" ? "warning" : "idle"
                  }
                  pulse={status === "active"}
                />
                <span className={`text-xs whitespace-nowrap ${
                  status === "active" ? "text-text-primary font-medium" :
                  status === "completed" ? "text-text-secondary" : "text-text-muted"
                }`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && <span className="text-text-muted mx-0.5">&rarr;</span>}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Quote loading */}
        {step === "quoting" && !quote && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        )}

        {/* Quote details */}
        {quote && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Expected Output</span>
              <NumberDisplay value={quote.toAmount} format="decimal" decimals={6} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Expected Price</span>
              <NumberDisplay value={quote.expectedPrice} format="currency" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Price Impact</span>
              <NumberDisplay value={quote.priceImpact} format="percent" colored />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Gas Fee</span>
              <NumberDisplay value={quote.gasFee} format="currency" decimals={4} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Route</span>
              <span className="text-xs font-mono text-text-secondary">
                {quote.routes.join(" → ")}
              </span>
            </div>
            {quote.isHoneyPot && (
              <div className="text-xs text-loss font-medium mt-1">
                Warning: Token flagged as potential honeypot
              </div>
            )}
          </div>
        )}

        {/* Simulation result */}
        {simulation && (
          <div className="border-t border-border/50 pt-3">
            <div className="flex items-center gap-2 text-sm">
              <StatusDot status={simulation.status === "SUCCESS" ? "active" : "fail"} />
              <span className={simulation.status === "SUCCESS" ? "text-gain" : "text-loss"}>
                Simulation {simulation.status.toLowerCase()}
              </span>
              {simulation.failReason && (
                <span className="text-xs text-text-muted">— {simulation.failReason}</span>
              )}
            </div>
          </div>
        )}

        {/* Autonomous execution notice */}
        {step === "executing" && isAutonomous && (
          <div className="border-t border-border/50 pt-3">
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-accent/5 border border-accent/10">
              <Zap className="w-4 h-4 text-accent" />
              <div>
                <span className="text-sm text-accent font-medium">Executing autonomously</span>
                <p className="text-[10px] text-text-muted mt-0.5">
                  All policy checks passed.{" "}
                  {registered && agentId
                    ? `Agent #${agentId} executing per your policy constraints.`
                    : "Executing per your policy constraints."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Manual approve button */}
        {step === "awaiting-approval" && (
          <div className="border-t border-border/50 pt-3">
            {policyEvaluation?.action === "block" ? (
              <>
                <button
                  disabled
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-loss/10 text-loss border border-loss/20 opacity-60 cursor-not-allowed"
                >
                  Blocked by Policy
                </button>
                <p className="text-xs text-loss mt-2">
                  Trade blocked — review policy checks above.
                </p>
              </>
            ) : (
              <button
                onClick={() => { onApprove(); onExecute(); }}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Approve & Execute
                </div>
              </button>
            )}
            {policyEvaluation?.action === "warn" && (
              <p className="text-xs text-warning mt-2">
                Caution: Some checks are near your limits. Review before proceeding.
              </p>
            )}
          </div>
        )}

        {/* Executing */}
        {step === "executing" && !isAutonomous && !txHash && (
          <div className="border-t border-border/50 pt-3">
            <div className="flex items-center gap-2">
              <StatusDot status="warning" pulse />
              <span className="text-sm text-text-secondary">Executing trade...</span>
            </div>
          </div>
        )}

        {/* Verifying */}
        {step === "verifying" && (
          <div className="border-t border-border/50 pt-3">
            <div className="flex items-center gap-2">
              <StatusDot status="warning" pulse />
              <span className="text-sm text-text-secondary">Verifying execution...</span>
            </div>
          </div>
        )}

        {/* Receipt */}
        {step === "receipt" && (
          <div className="border-t border-border/50 pt-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <StatusDot status="active" />
              <span className="text-gain">Trade complete</span>
            </div>
            {txHash && (
              <div className="text-xs text-text-muted">
                <span>TX: </span>
                <a
                  href={`https://bscscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-accent hover:underline"
                >
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
