"use client";

import { useState, useRef } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Shield, Zap, Lock, Bot } from "lucide-react";
import type { ExecutionPolicy, PolicyPreset } from "@/lib/types";

const TICKERS = ["NVDA", "AAPL", "TSLA", "MSFT", "GOOGL", "AMZN", "META", "COIN"];

const SUGGESTIONS = [
  { label: "Sell all NVDA", sub: "Sell held tokens → USDT" },
  { label: "Buy $5 of NVDA", sub: "NVIDIA" },
  { label: "I want to invest 2k in Apple stock", sub: "AI · AAPL" },
  { label: "Buy $5 of TSLA", sub: "Tesla" },
  { label: "Get me $5 worth of Microsoft", sub: "AI · MSFT" },
  { label: "Buy $5 of COIN", sub: "Coinbase" },
  { label: "Put $300 into Alphabet", sub: "AI · GOOGL" },
];

const PRESET_META: Record<Exclude<PolicyPreset, "custom">, { label: string; icon: typeof Shield; desc: string }> = {
  conservative: { label: "Conservative", icon: Lock, desc: "Tight limits, manual approval, market hours only" },
  moderate: { label: "Moderate", icon: Shield, desc: "Balanced limits, wallet approval" },
  aggressive: { label: "Aggressive", icon: Zap, desc: "Wide limits, wallet approval, any hours" },
};

interface IntentInputProps {
  onSubmit: (intent: string) => void;
  disabled?: boolean;
  initialTicker?: string | null;
  initialIntent?: string | null;
  policy: ExecutionPolicy | null;
  onPolicyPreset: (preset: Exclude<PolicyPreset, "custom">) => void;
  onPolicyFieldChange: (field: string, value: unknown) => void;
}

export function IntentInput({
  onSubmit, disabled, initialTicker, initialIntent,
  policy, onPolicyPreset, onPolicyFieldChange,
}: IntentInputProps) {
  const [value, setValue] = useState(initialIntent || (initialTicker ? `Buy $5 of ${initialTicker}` : ""));
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim() && !disabled) {
      setShowSuggestions(false);
      onSubmit(value.trim());
    }
  }

  function handleTickerClick(ticker: string) {
    const intent = `Buy $5 of ${ticker}`;
    setValue(intent);
    setShowSuggestions(false);
    onSubmit(intent);
  }

  function handleSuggestionClick(suggestion: string) {
    setValue(suggestion);
    setShowSuggestions(false);
    onSubmit(suggestion);
  }

  const filteredSuggestions = value.length > 0
    ? SUGGESTIONS.filter((s) =>
        s.label.toLowerCase().includes(value.toLowerCase()) ||
        s.sub.toLowerCase().includes(value.toLowerCase())
      )
    : SUGGESTIONS;

  const currentPreset = policy?.preset || "moderate";

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder='Buy $5 of NVDA, Sell all NVDA, or Sell 0.01 tokens of NVDA'
            disabled={disabled}
            className="w-full bg-surface-1 border border-border rounded-xl pl-4 pr-12 py-3.5 text-base font-mono text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/40 transition-colors disabled:opacity-40"
            aria-label="Stock purchase intent"
            autoComplete="off"
            autoFocus
          />
          <button
            aria-label="Preview stock purchase"
            type="submit"
            disabled={disabled || !value.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-text-muted hover:text-accent disabled:opacity-20 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {showSuggestions && filteredSuggestions.length > 0 && !disabled && (
          <div className="mt-1 bg-surface-2 border border-border rounded-xl overflow-hidden">
            {filteredSuggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSuggestionClick(s.label)}
                className="w-full px-4 py-2 text-left flex items-center justify-between hover:bg-surface-3 transition-colors"
              >
                <span className="text-sm font-mono text-text-primary">{s.label}</span>
                <span className="text-xs text-text-muted">{s.sub}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {/* AI indicator + Quick tickers + Policy toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] text-text-muted mr-1">
            <Bot className="w-3 h-3 text-accent" />
            Natural-language input
          </span>
          {TICKERS.map((ticker) => (
            <button
              key={ticker}
              onClick={() => handleTickerClick(ticker)}
              disabled={disabled}
              className="px-2.5 py-1 rounded-md text-xs font-mono text-text-muted border border-border/50 hover:border-border hover:text-text-secondary transition-colors disabled:opacity-30"
            >
              {ticker}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowPolicy(!showPolicy)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-text-muted border border-border/50 hover:border-border hover:text-text-secondary transition-colors"
        >
          <Shield className="w-3 h-3" />
          Policy
          {showPolicy ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Policy Configuration Panel */}
      {showPolicy && policy && (
        <div className="bg-surface-1 border border-border rounded-xl p-4 space-y-4">
          {/* Preset selector */}
          <div>
            <div className="text-xs text-text-muted mb-2">Execution Policy</div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PRESET_META) as Exclude<PolicyPreset, "custom">[]).map((preset) => {
                const meta = PRESET_META[preset];
                const Icon = meta.icon;
                const isActive = currentPreset === preset;
                return (
                  <button
                    key={preset}
                    onClick={() => onPolicyPreset(preset)}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? "bg-accent/10 text-accent border border-accent/20"
                        : "text-text-muted border border-border/50 hover:border-border hover:text-text-secondary"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Constraint sliders */}
          <div className="grid grid-cols-2 gap-3">
            <PolicySlider
              label="Max Deviation"
              value={policy.maxDeviation}
              min={0.1}
              max={5}
              step={0.1}
              unit="%"
              onChange={(v) => onPolicyFieldChange("maxDeviation", v)}
            />
            <PolicySlider
              label="Max Impact / Slippage"
              value={policy.maxSlippage}
              min={0.1}
              max={3}
              step={0.1}
              unit="%"
              onChange={(v) => onPolicyFieldChange("maxSlippage", v)}
            />
            <PolicySlider
              label="Max Trade Size"
              value={policy.maxTradeSize}
              min={1}
              max={25000}
              step={1}
              unit="$"
              prefix
              onChange={(v) => onPolicyFieldChange("maxTradeSize", v)}
            />



          </div>

<p className="text-xs text-text-muted">Each signing request requires confirmation. Browser-wallet daily spending and portfolio concentration limits are not enforced. Agentic Wallet additionally applies Binance App quotas. Candle volume is not executable liquidity depth.</p>
          {/* Toggles */}
          <div className="flex items-center gap-4 pt-1">

            <PolicyToggle
              label="Block After Hours"
              checked={policy.blockAfterHours}
              onChange={(v) => onPolicyFieldChange("blockAfterHours", v)}
            />
          </div>

          {currentPreset === "custom" && (
            <div className="text-[10px] text-text-muted pt-1">
              Custom policy — constraints modified from preset defaults.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PolicySlider({
  label, value, min, max, step, unit, prefix, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  prefix?: boolean;
  onChange: (value: number) => void;
}) {
  const display = prefix ? `${unit}${value.toLocaleString()}` : `${value}${unit}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">{label}</span>
        <span className="text-xs font-mono text-text-primary">{display}</span>
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-surface-3 rounded-full appearance-none cursor-pointer accent-accent"
      />
    </div>
  );
}

function PolicyToggle({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)} className="h-5 w-5 accent-accent" />
      <span className="text-xs text-text-muted">{label}</span>
    </label>
  );
}
