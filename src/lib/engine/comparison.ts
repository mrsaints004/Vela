import {
  RWAToken,
  Kline,
  TokenRepresentation,
  RepresentationComparison,
  EffectiveCost,
  MarketStatus,
  TradeFirewallResult,
  DiscoveredRepresentation,
  RecommendationFactor,
} from "../types";
import { fetchKlines, getProviderName } from "../api/rwa";

/**
 * Build a TokenRepresentation from a token and its kline data
 */
export function buildRepresentation(
  token: RWAToken,
  klines: Kline[]
): TokenRepresentation {
  const latestKline = klines[klines.length - 1];
  const prevKline = klines.length >= 2 ? klines[klines.length - 2] : null;

  const price = latestKline?.close ?? 0;
  const volume24h = latestKline?.volume ?? 0;
  const priceChange24h = prevKline
    ? ((price - prevKline.close) / prevKline.close) * 100
    : 0;

  // Normalize price using tokenToShareRatio (multiplier)
  // impliedSharePrice = tokenPrice / tokenToShareRatio
  const tokenToShareRatio = parseFloat(token.multiplier) || 1;
  const impliedSharePrice = tokenToShareRatio !== 0
    ? price / tokenToShareRatio
    : price;

  return {
    token,
    provider: getProviderName(token.type),
    price,
    impliedSharePrice,
    tokenToShareRatio,
    volume24h,
    priceChange24h,
    klines,
    lastUpdated: latestKline?.closeTime ?? Date.now(),
  };
}

/**
 * Fetch representations for a ticker across all providers
 */
export async function fetchRepresentations(
  tokens: RWAToken[]
): Promise<TokenRepresentation[]> {
  const results = await Promise.allSettled(
    tokens.map(async (token) => {
      const klines = await fetchKlines(
        token.chainId,
        token.contractAddress,
        "1d",
        7
      );
      return buildRepresentation(token, klines);
    })
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<TokenRepresentation> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value)
    .filter((r) => r.price > 0);
}

/**
 * Calculate reference-risk score for each representation
 */
export function calculateEffectiveCosts(
  representations: TokenRepresentation[],
  referencePrice?: number,
  marketStatus?: MarketStatus,
  quoteImpacts?: Map<string, number>
): EffectiveCost[] {
  // Use the volume-weighted average of implied share prices as reference
  const ref =
    referencePrice ??
    calculateVolumeWeightedPrice(representations);

  // After-hours: apply staleness penalty to price deviation confidence
  const isStale = marketStatus?.referenceStale ?? false;
  const staleHours = marketStatus?.staleDuration ?? 0;
  // Staleness amplifies uncertainty in price deviation — we widen the reference-risk score
  // by a factor proportional to how long the reference has been stale
  const stalenessPenaltyFactor = isStale ? 1 + Math.min(staleHours * 0.05, 0.5) : 1;

  const costs: EffectiveCost[] = representations.map((rep) => {
    // Use impliedSharePrice for cross-provider comparison
    const priceDeviation = rep.impliedSharePrice - ref;
    const priceDeviationPercent = ref > 0 ? (priceDeviation / ref) * 100 : 0;

    // Use real price impact from DEX aggregator quote if available,
    // otherwise estimate from volume as a fallback
    const realImpact = quoteImpacts?.get(rep.provider);
    const estimatedSlippage = realImpact !== undefined
      ? Math.abs(realImpact)
      : estimateSlippageFromVolume(rep.volume24h);

    // Volume score: 0-100, logarithmic
    const volumeScore = Math.min(
      100,
      rep.volume24h > 0 ? Math.log10(rep.volume24h) * 20 : 0
    );

    // Liquidity rating
    const liquidityRating = getLiquidityRating(rep.volume24h);

    // Total reference-risk score = |price deviation| + slippage penalty
    // When market is closed, staleness penalty widens the cost to reflect uncertainty
    const slippagePenalty =
      estimatedSlippage * rep.impliedSharePrice * 0.01;
    const baseCost = Math.abs(priceDeviation) + slippagePenalty;
    const totalEffectiveCost = baseCost * stalenessPenaltyFactor;

    return {
      provider: rep.provider,
      quotedPrice: rep.impliedSharePrice,
      priceDeviation,
      priceDeviationPercent,
      estimatedSlippage,
      volumeScore,
      liquidityRating,
      totalEffectiveCost,
      rank: 0,
      basis: "reference-risk" as const,
    };
  });

  // Rank by total reference-risk score (lower is better)
  costs.sort((a, b) => a.totalEffectiveCost - b.totalEffectiveCost);
  costs.forEach((c, i) => (c.rank = i + 1));

  return costs;
}

/**
 * Compare all representations of a ticker
 */
export function compareRepresentations(
  ticker: string,
  representations: TokenRepresentation[],
  referencePrice?: number
): RepresentationComparison {
  if (representations.length === 0) {
    return {
      ticker,
      representations: [],
      bestByPrice: null,
      bestByVolume: null,
      bestByEffectiveCost: null,
      maxSpread: 0,
      maxSpreadPercent: 0,
      recommendation: "No representations available",
      warnings: ["No data found for this ticker on BSC"],
    };
  }

  const costs = calculateEffectiveCosts(representations, referencePrice);
  const warnings: string[] = [];

  // Find best by different criteria (using implied share price for fair comparison)
  const bestByPrice = [...representations].sort(
    (a, b) => a.impliedSharePrice - b.impliedSharePrice
  )[0];
  const bestByVolume = [...representations].sort(
    (a, b) => b.volume24h - a.volume24h
  )[0];
  const bestCost = costs[0];
  const bestByEffectiveCost =
    representations.find((r) => r.provider === bestCost.provider) ?? null;

  // Calculate max spread using implied (normalized) share prices
  const prices = representations.map((r) => r.impliedSharePrice);
  const maxSpread = Math.max(...prices) - Math.min(...prices);
  const avgPrice =
    prices.reduce((a, b) => a + b, 0) / prices.length;
  const maxSpreadPercent =
    avgPrice > 0 ? (maxSpread / avgPrice) * 100 : 0;

  // Generate warnings
  const zeroVolume = representations.filter((r) => r.volume24h === 0);
  if (zeroVolume.length > 0) {
    warnings.push(
      `Zero volume on: ${zeroVolume.map((r) => r.provider).join(", ")}`
    );
  }

  if (maxSpreadPercent > 2) {
    warnings.push(
      `Large spread between providers: ${maxSpreadPercent.toFixed(2)}%`
    );
  }

  const lowLiquidity = costs.filter((c) => c.liquidityRating === "low" || c.liquidityRating === "none");
  if (lowLiquidity.length === costs.length) {
    warnings.push("All providers have low or no liquidity");
  }

  // Build recommendation
  let recommendation: string;
  if (bestByEffectiveCost && bestByPrice) {
    if (bestByEffectiveCost.provider === bestByPrice.provider) {
      recommendation = `${bestByEffectiveCost.provider} is the best choice — lowest discovery price and lowest reference-risk score; request a live quote to check execution.`;
    } else {
      recommendation = `${bestByEffectiveCost.provider} has the lowest reference-risk score ($${bestCost.totalEffectiveCost.toFixed(2)}), though ${bestByPrice.provider} has a lower quoted price. The reference-risk score accounts for liquidity and slippage.`;
    }
  } else {
    recommendation = "Insufficient data to make a recommendation.";
  }

  return {
    ticker,
    representations,
    bestByPrice,
    bestByVolume,
    bestByEffectiveCost,
    maxSpread,
    maxSpreadPercent,
    recommendation,
    warnings,
  };
}

// --- Helpers ---

function calculateVolumeWeightedPrice(
  reps: TokenRepresentation[]
): number {
  const withVolume = reps.filter((r) => r.volume24h > 0);
  if (withVolume.length === 0) {
    // Fall back to simple average of implied share prices
    return reps.reduce((a, r) => a + r.impliedSharePrice, 0) / reps.length;
  }

  const totalVolume = withVolume.reduce((a, r) => a + r.volume24h, 0);
  return (
    withVolume.reduce((a, r) => a + r.impliedSharePrice * r.volume24h, 0) /
    totalVolume
  );
}

/**
 * Fallback slippage estimate when no DEX quote is available.
 * Used only during initial discovery before quotes are fetched.
 * Once a real quote is obtained, its priceImpactPercent replaces this.
 */
function estimateSlippageFromVolume(volume24h: number): number {
  if (volume24h === 0) return 5.0;
  if (volume24h < 1000) return 3.0;
  if (volume24h < 10000) return 1.5;
  if (volume24h < 100000) return 0.5;
  if (volume24h < 1000000) return 0.2;
  return 0.05;
}

function getLiquidityRating(
  volume24h: number
): "high" | "medium" | "low" | "none" {
  if (volume24h === 0) return "none";
  if (volume24h < 1000) return "low";
  if (volume24h < 100000) return "medium";
  return "high";
}

/**
 * Get current US market status
 */
export function getMarketStatus(): MarketStatus {
  const now = new Date();
  const nyTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = nyTime.getDay();
  const hours = nyTime.getHours();
  const minutes = nyTime.getMinutes();
  const timeMinutes = hours * 60 + minutes;

  const isWeekend = day === 0 || day === 6;

  if (isWeekend) {
    // Calculate next Monday 9:30 AM ET
    const daysUntilMonday = day === 0 ? 1 : 2;
    const nextOpen = new Date(nyTime);
    nextOpen.setDate(nextOpen.getDate() + daysUntilMonday);
    nextOpen.setHours(9, 30, 0, 0);

    return {
      isOpen: false,
      status: "weekend",
      nextOpenTime: nyWallTimeToUTC(nextOpen),
      referenceStale: true,
      staleDuration: calculateStaleDuration(nyTime),
    };
  }

  // Pre-market: 4:00 - 9:30 ET
  if (timeMinutes >= 240 && timeMinutes < 570) {
    return {
      isOpen: false,
      status: "pre_market",
      nextOpenTime: null,
      referenceStale: true,
      staleDuration: calculateStaleDuration(nyTime),
    };
  }

  // Regular hours: 9:30 - 16:00 ET
  if (timeMinutes >= 570 && timeMinutes < 960) {
    return {
      isOpen: true,
      status: "regular",
      nextOpenTime: null,
      referenceStale: false,
      staleDuration: null,
    };
  }

  // Post-market: 16:00 - 20:00 ET
  if (timeMinutes >= 960 && timeMinutes < 1200) {
    return {
      isOpen: false,
      status: "post_market",
      nextOpenTime: null,
      referenceStale: true,
      staleDuration: (timeMinutes - 960) / 60,
    };
  }

  // Closed (overnight): 20:00 - 4:00 ET
  const nextOpen = new Date(nyTime);
  if (timeMinutes >= 1200) {
    nextOpen.setDate(nextOpen.getDate() + 1);
  }
  nextOpen.setHours(9, 30, 0, 0);

  // Skip weekends
  if (nextOpen.getDay() === 6) nextOpen.setDate(nextOpen.getDate() + 2);
  if (nextOpen.getDay() === 0) nextOpen.setDate(nextOpen.getDate() + 1);

  return {
    isOpen: false,
    status: "closed",
    nextOpenTime: nyWallTimeToUTC(nextOpen),
    referenceStale: true,
    staleDuration: calculateStaleDuration(nyTime),
  };
}

function calculateStaleDuration(nyTime: Date): number {
  const lastClose=new Date(nyTime);
  lastClose.setHours(16,0,0,0);
  if(lastClose>nyTime)lastClose.setDate(lastClose.getDate()-1);
  while(lastClose.getDay()===0||lastClose.getDay()===6)lastClose.setDate(lastClose.getDate()-1);
  return Math.max(0,(Date.parse(nyWallTimeToUTC(nyTime))-Date.parse(nyWallTimeToUTC(lastClose)))/3600000);
}

/**
 * Build DiscoveredRepresentation array from TokenRepresentations + costs
 */
export function buildDiscoveredRepresentations(
  representations: TokenRepresentation[],
  costs: EffectiveCost[]
): DiscoveredRepresentation[] {
  return representations.map((rep) => {
    const cost = costs.find((c) => c.provider === rep.provider);
    return {
      provider: rep.provider,
      tokenAddress: rep.token.contractAddress,
      tokenSymbol: rep.token.symbol,
      decimals: rep.token.d,
      available: rep.price > 0,
      impliedSharePrice: rep.impliedSharePrice,
      volume24h: rep.volume24h,
      priceDeviationPercent: cost?.priceDeviationPercent ?? 0,
      liquidityRating: cost?.liquidityRating ?? "none",
    };
  });
}

/**
 * Generate structured recommendation with factors
 */
export function generateRecommendation(
  representations: TokenRepresentation[],
  costs: EffectiveCost[],
  referencePrice: number | null,
  marketStatus?: MarketStatus
): { recommendation: string; factors: RecommendationFactor[]; recommended: { provider: string; tokenAddress: string } | null } {
  if (costs.length === 0) {
    return { recommendation: "No representations available", factors: [], recommended: null };
  }

  const best = costs[0];
  const bestRep = representations.find((r) => r.provider === best.provider);
  const factors: RecommendationFactor[] = [];

  // After-hours context factor
  const isAfterHours = marketStatus && !marketStatus.isOpen;
  if (isAfterHours) {
    const staleHours = marketStatus.staleDuration ?? 0;
    factors.push({
      label: "Market Status",
      value: `${marketStatus.status}${staleHours > 0 ? ` (${staleHours.toFixed(0)}h stale)` : ""}`,
      favorable: false,
    });
  }

  // Reference-risk score factor
  factors.push({
    label: "Reference-risk score",
    value: `$${best.totalEffectiveCost.toFixed(2)}`,
    favorable: best.totalEffectiveCost < 1,
  });

  // Liquidity factor
  factors.push({
    label: "Volume activity proxy",
    value: best.liquidityRating,
    favorable: best.liquidityRating === "high" || best.liquidityRating === "medium",
  });

  // Price deviation factor
  if (referencePrice && referencePrice > 0) {
    factors.push({
      label: "Price Deviation",
      value: `${Math.abs(best.priceDeviationPercent).toFixed(2)}%`,
      favorable: Math.abs(best.priceDeviationPercent) < 1,
    });
  }

  // Slippage factor
  factors.push({
    label: "Impact heuristic",
    value: `${best.estimatedSlippage.toFixed(1)}%`,
    favorable: best.estimatedSlippage < 1,
  });

  // Volume factor
  if (bestRep) {
    factors.push({
      label: "24h volume (source units)",
      value: `${bestRep.volume24h.toLocaleString()}`,
      favorable: bestRep.volume24h > 10000,
    });
  }

  // Build recommendation text — changes based on market status
  let recommendation: string;
  if (isAfterHours && marketStatus) {
    const staleHours = marketStatus.staleDuration ?? 0;
    const highDev = Math.abs(best.priceDeviationPercent) > 2;
    const lowLiq = best.liquidityRating === "low" || best.liquidityRating === "none";

    if (highDev && lowLiq) {
      recommendation = `Market closed (${staleHours.toFixed(0)}h). ${best.provider} has ${Math.abs(best.priceDeviationPercent).toFixed(1)}% deviation and ${best.liquidityRating} volume activity. Consider waiting for market open.`;
    } else if (highDev) {
      recommendation = `Market closed (${staleHours.toFixed(0)}h). ${best.provider} is ${Math.abs(best.priceDeviationPercent).toFixed(1)}% off reference — stale-price risk applies. Reference-risk score includes uncertainty penalty.`;
    } else {
      recommendation = `Market closed (${staleHours.toFixed(0)}h). ${best.provider} is closest to last reference at $${best.totalEffectiveCost.toFixed(2)} reference-risk score. Reference may shift at open.`;
    }
  } else {
    recommendation = `${best.provider} — lowest reference-risk score at $${best.totalEffectiveCost.toFixed(2)} with ${best.liquidityRating} volume activity`;
  }

  return {
    recommendation,
    factors,
    recommended: bestRep
      ? { provider: best.provider, tokenAddress: bestRep.token.contractAddress }
      : null,
  };
}

/**
 * Trade Firewall — evaluate whether a trade should proceed
 */
export function evaluateTradeFirewall(
  ticker: string,
  representations: TokenRepresentation[],
  selectedProvider: string,
  amount: number
): TradeFirewallResult {
  const reasons: string[] = [];
  const marketStatus = getMarketStatus();

  const selected = representations.find(
    (r) => r.provider === selectedProvider
  );
  if (!selected) {
    return {
      action: "block",
      reasons: ["Selected provider not found"],
      checks: {
        marketStatus,
        priceDeviation: 0,
        volumeCheck: false,
        liquidityCheck: false,
        simulationPassed: null,
      },
    };
  }

  const costs = calculateEffectiveCosts(representations);
  const selectedCost = costs.find((c) => c.provider === selectedProvider);

  // Check 1: Market status
  if (marketStatus.status === "weekend" || marketStatus.status === "closed") {
    reasons.push(
      `Reference market is ${marketStatus.status}. Reference price may be stale (${(marketStatus.staleDuration ?? 0).toFixed(1)}h since close).`
    );
  }

  // Check 2: Price deviation
  const deviation = Math.abs(selectedCost?.priceDeviationPercent ?? 0);
  if (deviation > 3) {
    reasons.push(
      `Price deviation is ${deviation.toFixed(2)}% from volume-weighted average — significantly above normal.`
    );
  } else if (deviation > 1) {
    reasons.push(
      `Price deviation is ${deviation.toFixed(2)}% from volume-weighted average.`
    );
  }

  // Check 3: Volume
  const volumeCheck = selected.volume24h > 0;
  if (!volumeCheck) {
    reasons.push(
      `${selectedProvider} has zero trading volume in the last 24h.`
    );
  } else if (selected.volume24h < amount * 2) {
    reasons.push(
      `Your trade amount ($${amount.toLocaleString()}) is more than 50% of 24h volume ($${selected.volume24h.toLocaleString()}).`
    );
  }

  // Check 4: Liquidity
  const liquidityCheck =
    selectedCost?.liquidityRating !== "none" &&
    selectedCost?.liquidityRating !== "low";

  if (!liquidityCheck) {
    reasons.push(
      `Liquidity rating: ${selectedCost?.liquidityRating ?? "unknown"}. Expected slippage: ${(selectedCost?.estimatedSlippage ?? 0).toFixed(1)}%.`
    );
  }

  // Check 5: Better alternative exists
  const bestCost = costs[0];
  if (
    bestCost &&
    bestCost.provider !== selectedProvider &&
    bestCost.totalEffectiveCost <
      (selectedCost?.totalEffectiveCost ?? Infinity) * 0.9
  ) {
    reasons.push(
      `${bestCost.provider} has a significantly lower reference-risk score ($${bestCost.totalEffectiveCost.toFixed(2)} vs $${selectedCost?.totalEffectiveCost.toFixed(2)}).`
    );
  }

  // Determine action
  let action: "allow" | "warn" | "block";
  if (
    !volumeCheck ||
    deviation > 5 ||
    (marketStatus.referenceStale && deviation > 3)
  ) {
    action = "block";
  } else if (
    reasons.length > 0
  ) {
    action = "warn";
  } else {
    action = "allow";
  }

  return {
    action,
    reasons,
    checks: {
      marketStatus,
      priceDeviation: deviation,
      volumeCheck,
      liquidityCheck,
      simulationPassed: null,
    },
  };
}

// Convert New York wall time into a real UTC instant, including DST.
function nyWallTimeToUTC(wall: Date): string {
  const target=Date.UTC(wall.getFullYear(),wall.getMonth(),wall.getDate(),wall.getHours(),wall.getMinutes());
  let instant=target;
  for(let i=0;i<3;i++){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant));
    const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    const shown=Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day),Number(values.hour),Number(values.minute));
    instant+=target-shown;
  }
  return new Date(instant).toISOString();
}
