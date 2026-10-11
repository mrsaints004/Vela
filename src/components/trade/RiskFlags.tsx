"use client";

import type { PolicyEvaluation, PolicyResult } from "@/lib/types";
import { Check, AlertTriangle, X, Shield, Zap, ShieldOff } from "lucide-react";

interface RiskFlagsProps {
  approvalRequired?: boolean;
  policy?: PolicyResult | null;
  policyEvaluation?: PolicyEvaluation | null;
}

const STATUS_ICON = {
  pass: Check,
  warn: AlertTriangle,
  fail: X,
};

const STATUS_COLOR = {
  pass: "text-gain",
  warn: "text-warning",
  fail: "text-loss",
};

const STATUS_BG = {
  pass: "bg-gain/5",
  warn: "bg-warning/5",
  fail: "bg-loss/5",
};

export function RiskFlags({ policy, policyEvaluation, approvalRequired=false }: RiskFlagsProps) {
  // Use V2 policy evaluation if available, fall back to legacy
  if (policyEvaluation) {
    return <PolicyEvaluationView evaluation={policyEvaluation} approvalRequired={approvalRequired} />;
  }
  if (policy && policy.checks.length > 0) {
    return <LegacyPolicyView policy={policy} />;
  }
  return null;
}

function PolicyEvaluationView({ evaluation,approvalRequired }: { evaluation: PolicyEvaluation;approvalRequired:boolean }) {
  const passCount = evaluation.checks.filter((c) => c.status === "pass").length;
  const totalChecks = evaluation.checks.length;

  return (
    <div className="bg-surface-1 border border-border rounded-xl">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-text-muted" />
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Policy Evaluation
            </h3>
          </div>
          <span className="text-xs font-mono text-text-muted">
            {passCount}/{totalChecks} pass
          </span>
        </div>
        {/* Policy name */}
        <div className="text-[10px] text-text-muted mt-1">
          {evaluation.policySnapshot.name}
          {evaluation.policySnapshot.preset !== "custom" && (
            <span className="ml-1 text-accent/60">({evaluation.policySnapshot.preset})</span>
          )}
        </div>
      </div>

      {/* Checks */}
      <div className="px-4 py-2 space-y-0.5">
        {evaluation.checks.map((check, i) => {
          const Icon = STATUS_ICON[check.status];
          return (
            <div key={i} className={`flex items-start gap-2 py-1.5 px-2 rounded-lg ${STATUS_BG[check.status]}`}>
              <Icon className={`w-3 h-3 shrink-0 mt-0.5 ${STATUS_COLOR[check.status]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-text-secondary font-medium">{check.name}</span>
                  {check.threshold && (
                    <span className="text-[10px] font-mono text-text-muted shrink-0">
                      {check.threshold}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
                  {check.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Autonomous execution status */}
      <div className="px-4 py-2.5 border-t border-border">
        {evaluation.action === "block" ? (
          <div className="flex items-center gap-1.5">
            {approvalRequired?<AlertTriangle className="w-3 h-3 text-warning" />:<ShieldOff className="w-3 h-3 text-loss" />}
            <span className={approvalRequired?"text-xs text-warning":"text-xs text-loss"}>{approvalRequired?"Token approval required":"Execution blocked — policy violation"}</span>
          </div>
        ) : evaluation.canExecuteAutonomously ? (
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-accent" />
            <span className="text-xs text-accent">Autonomous execution permitted</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-text-muted" />
            <span className="text-xs text-text-secondary">{evaluation.reasoning.startsWith('Discovery only.') ? 'Discovery checks only — execution not evaluated' : 'Awaiting manual approval'}</span>
          </div>
        )}
        <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
          {evaluation.reasoning}
        </p>
      </div>
    </div>
  );
}

function LegacyPolicyView({ policy }: { policy: PolicyResult }) {
  const passCount = policy.checks.filter((c) => c.status === "pass").length;

  return (
    <div className="bg-surface-1 border border-border rounded-xl">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">Policy</h3>
        <span className="text-xs font-mono text-text-muted">
          {passCount}/{policy.checks.length} pass
        </span>
      </div>
      <div className="px-4 py-2 space-y-0.5">
        {policy.checks.map((check, i) => {
          const Icon = STATUS_ICON[check.status];
          return (
            <div key={i} className="flex items-center gap-2 py-1">
              <Icon className={`w-3 h-3 shrink-0 ${STATUS_COLOR[check.status]}`} />
              <span className="text-xs text-text-secondary flex-1">{check.name}</span>
              {check.status !== "pass" && check.message && (
                <span className="text-[10px] text-text-muted truncate max-w-[140px]">
                  {check.message}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {policy.action === "block" && (
        <div className="px-4 py-2 border-t border-border">
          <span className="text-xs text-loss">Execution blocked — fix failing checks</span>
        </div>
      )}
    </div>
  );
}
