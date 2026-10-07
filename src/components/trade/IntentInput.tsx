"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowRight } from "lucide-react";

const TICKERS = ["NVDA", "AAPL", "TSLA", "MSFT", "GOOGL", "AMZN", "META", "COIN"];

const SUGGESTIONS = [
  { label: "Buy $500 of NVDA", sub: "NVIDIA" },
  { label: "Buy $1000 of AAPL", sub: "Apple" },
  { label: "Buy $500 of TSLA", sub: "Tesla" },
  { label: "Buy $200 of MSFT", sub: "Microsoft" },
  { label: "Buy $500 of COIN", sub: "Coinbase" },
  { label: "Buy $300 of GOOGL", sub: "Alphabet" },
];

interface IntentInputProps {
  onSubmit: (intent: string) => void;
  disabled?: boolean;
  initialTicker?: string | null;
}

export function IntentInput({ onSubmit, disabled, initialTicker }: IntentInputProps) {
  const [value, setValue] = useState(initialTicker ? `Buy $500 of ${initialTicker}` : "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialTicker) {
      setValue(`Buy $500 of ${initialTicker}`);
      inputRef.current?.focus();
    }
  }, [initialTicker]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim() && !disabled) {
      setShowSuggestions(false);
      onSubmit(value.trim());
    }
  }

  function handleTickerClick(ticker: string) {
    const intent = `Buy $500 of ${ticker}`;
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
            placeholder='Buy $500 of NVDA'
            disabled={disabled}
            className="w-full bg-surface-1 border border-border rounded-xl pl-4 pr-12 py-3.5 text-base font-mono text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/40 transition-colors disabled:opacity-40"
            autoFocus
          />
          <button
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
                onMouseDown={() => handleSuggestionClick(s.label)}
                className="w-full px-4 py-2 text-left flex items-center justify-between hover:bg-surface-3 transition-colors"
              >
                <span className="text-sm font-mono text-text-primary">{s.label}</span>
                <span className="text-xs text-text-muted">{s.sub}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Quick tickers */}
      <div className="flex items-center gap-1.5 flex-wrap">
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
    </div>
  );
}
