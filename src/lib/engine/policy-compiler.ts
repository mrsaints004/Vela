/**
 * Policy Compiler
 *
 * Parses natural language constraints into a structured ExecutionPolicy.
 * Also provides factory functions for preset policies.
 */

import type { ExecutionPolicy, PolicyPreset } from "../types";
import { POLICY_PRESETS as PRESETS } from "../types";

/**
 * Create a policy from a preset
 */
export function createPolicyFromPreset(
  preset: Exclude<PolicyPreset, "custom">,
  overrides?: Partial<ExecutionPolicy>
): ExecutionPolicy {
  const base = PRESETS[preset];
  return {
    id: `policy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${preset.charAt(0).toUpperCase() + preset.slice(1)} Policy`,
    preset,
    allowedAssets: [],
    expiresAt: null,
    createdAt: Date.now(),
    ...base,
    ...overrides,
  };
}

/**
 * Create a fully custom policy
 */
export function createCustomPolicy(
  params: Partial<Omit<ExecutionPolicy, "id" | "preset" | "createdAt">>
): ExecutionPolicy {
  const moderate = PRESETS.moderate;
  return {
    id: `policy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: params.name || "Custom Policy",
    preset: "custom",
    maxDeviation: params.maxDeviation ?? moderate.maxDeviation,
    maxSlippage: params.maxSlippage ?? moderate.maxSlippage,
    maxTradeSize: params.maxTradeSize ?? moderate.maxTradeSize,
    dailyLimit: params.dailyLimit ?? moderate.dailyLimit,
    maxConcentration: params.maxConcentration ?? moderate.maxConcentration,
    allowedAssets: params.allowedAssets ?? [],
    autonomousExecution: params.autonomousExecution ?? moderate.autonomousExecution,
    blockAfterHours: params.blockAfterHours ?? moderate.blockAfterHours,
    minLiquidity: params.minLiquidity ?? moderate.minLiquidity,
    expiresAt: params.expiresAt ?? null,
    createdAt: Date.now(),
  };
}

/**
 * Extract policy constraints from natural language intent.
 *
 * Looks for patterns like:
 * - "never execute above 1% deviation"
 * - "max slippage 0.5%"
 * - "don't let any stock exceed 30% of my portfolio"
 * - "avoid poor-liquidity"
 * - "only during market hours"
 * - "max $500 per trade"
 * - "daily limit $2000"
 * - "autonomous" / "auto-execute"
 * - "only NVDA, AAPL, TSLA"
 */
export function extractPolicyFromIntent(raw: string): Partial<ExecutionPolicy> {
  const lower = raw.toLowerCase();
  const extracted: Partial<ExecutionPolicy> = {};

  // Max deviation: "never execute above 1% deviation", "max deviation 2%", "deviation under 0.5%"
  const devMatch = lower.match(
    /(?:max(?:imum)?|never.*above|under|below|within)\s+(\d+(?:\.\d+)?)\s*%?\s*(?:price\s+)?dev(?:iation)?/
  ) || lower.match(
    /dev(?:iation)?\s*(?:under|below|max|limit|<|<=)\s*(\d+(?:\.\d+)?)\s*%/
  );
  if (devMatch) {
    extracted.maxDeviation = parseFloat(devMatch[1]);
  }

  // Max slippage: "max slippage 0.5%", "slippage under 1%"
  const slipMatch = lower.match(
    /(?:max(?:imum)?|under|below|limit)\s+(?:slippage\s+)?(\d+(?:\.\d+)?)\s*%?\s*slippage/
  ) || lower.match(
    /slippage\s*(?:under|below|max|limit|<|<=)\s*(\d+(?:\.\d+)?)\s*%/
  ) || lower.match(
    /(?:max(?:imum)?)\s+slippage\s+(\d+(?:\.\d+)?)\s*%/
  );
  if (slipMatch) {
    extracted.maxSlippage = parseFloat(slipMatch[1]);
  }

  // Max concentration: "max 30% concentration", "don't let any stock exceed 30%", "max 30% of my portfolio"
  const concMatch = lower.match(
    /(?:max(?:imum)?|no more than|don'?t.*exceed)\s+(\d+(?:\.\d+)?)\s*%\s*(?:of\s+(?:my\s+)?portfolio|concentration|per\s+asset|of\s+portfolio)/
  ) || lower.match(
    /concentration\s*(?:max|limit|under|below)\s*(\d+(?:\.\d+)?)\s*%/
  );
  if (concMatch) {
    extracted.maxConcentration = parseFloat(concMatch[1]);
  }

  // Max trade size: "max $500 per trade", "no more than $1000", "limit trades to $500"
  const tradeSizeMatch = lower.match(
    /(?:max(?:imum)?|no more than|limit.*to)\s+\$?([\d,]+)\s*(?:per trade|per execution|each)/
  ) || lower.match(
    /(?:max(?:imum)?)\s+(?:trade\s+)?(?:size\s+)?\$?([\d,]+)/
  );
  if (tradeSizeMatch) {
    extracted.maxTradeSize = parseFloat(tradeSizeMatch[1].replace(/,/g, ""));
  }

  // Daily limit: "daily limit $2000", "max $5000 per day"
  const dailyMatch = lower.match(
    /(?:daily\s+limit|per\s+day|daily\s+max)\s+\$?([\d,]+)/
  ) || lower.match(
    /(?:max(?:imum)?|limit)\s+\$?([\d,]+)\s*(?:per\s+day|daily)/
  );
  if (dailyMatch) {
    extracted.dailyLimit = parseFloat(dailyMatch[1].replace(/,/g, ""));
  }

  // After-hours: "only during market hours", "block after hours", "no weekend trading"
  if (
    /only\s+(?:during\s+)?market\s+hours|block\s+after\s*hours|no\s+(?:after\s*hours|weekend|off\s*hours)/.test(lower)
  ) {
    extracted.blockAfterHours = true;
  }
  if (
    /allow\s+after\s*hours|trade\s+any\s*time|24\/7|around\s+the\s+clock/.test(lower)
  ) {
    extracted.blockAfterHours = false;
  }

  // Autonomous execution: "autonomous", "auto-execute", "execute automatically"
  if (/autonom|auto[\s-]?execut|execute\s+automat/.test(lower)) {
    extracted.autonomousExecution = true;
  }
  if (/manual|always\s+ask|require\s+(?:my\s+)?approval|confirm\s+before/.test(lower)) {
    extracted.autonomousExecution = false;
  }

  // Liquidity: "avoid poor liquidity", "high liquidity only", "medium liquidity minimum"
  if (/high\s+liquidity\s+only|require\s+high\s+liquidity/.test(lower)) {
    extracted.minLiquidity = "high";
  } else if (/avoid\s+(?:poor|low|no)\s*[\s-]?liquidity|decent\s+liquidity/.test(lower)) {
    extracted.minLiquidity = "medium";
  }

  // Allowed assets: "only NVDA, AAPL, TSLA", "restrict to NVDA AAPL"
  const assetMatch = lower.match(
    /(?:only|restrict(?:ed)?\s+to|allowed?\s+assets?|just)\s+((?:[A-Z]{1,5}[,\s]+)*[A-Z]{1,5})/i
  );
  if (assetMatch) {
    const tickers = assetMatch[1]
      .toUpperCase()
      .split(/[,\s]+/)
      .filter((t) => t.length >= 1 && t.length <= 5);
    if (tickers.length > 0) {
      extracted.allowedAssets = tickers;
    }
  }

  return extracted;
}

/**
 * Build a policy from an intent string, starting from a preset base
 */
export function compilePolicyFromIntent(
  raw: string,
  basePreset: Exclude<PolicyPreset, "custom"> = "moderate"
): ExecutionPolicy {
  const extracted = extractPolicyFromIntent(raw);
  const hasCustomization = Object.keys(extracted).length > 0;

  if (!hasCustomization) {
    return createPolicyFromPreset(basePreset);
  }

  return createCustomPolicy({
    name: "Intent-Derived Policy",
    ...PRESETS[basePreset],
    ...extracted,
  });
}

/**
 * Validate a policy for internal consistency
 */
export function validatePolicy(policy: ExecutionPolicy): string[] {
  const errors: string[] = [];
  for (const field of ["maxDeviation", "maxSlippage", "maxTradeSize", "dailyLimit", "maxConcentration"] as const) {
    if (!Number.isFinite(policy[field])) errors.push(`${field} must be finite`);
  }
  if (!Array.isArray(policy.allowedAssets) || policy.allowedAssets.some(a=>typeof a!=="string"||!/^[A-Z0-9.-]{1,15}$/.test(a))) errors.push("Allowed assets must be ticker strings");
  if(typeof policy.blockAfterHours!=="boolean") errors.push("Market-hours preference must be boolean");
  if (policy.expiresAt && !Number.isFinite(Date.parse(policy.expiresAt))) errors.push("Invalid policy expiry");

  if (policy.maxDeviation <= 0 || policy.maxDeviation > 50) {
    errors.push("Max deviation must be between 0 and 50%");
  }
  if (policy.maxSlippage <= 0 || policy.maxSlippage > 20) {
    errors.push("Max slippage must be between 0 and 20%");
  }
  if (policy.maxTradeSize <= 0) {
    errors.push("Max trade size must be positive");
  }

  if (policy.maxConcentration <= 0 || policy.maxConcentration > 100) {
    errors.push("Max concentration must be between 0 and 100%");
  }
  if (policy.expiresAt && new Date(policy.expiresAt).getTime() < Date.now()) {
    errors.push("Policy has already expired");
  }

  return errors;
}
