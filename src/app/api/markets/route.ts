import { NextResponse } from "next/server";
import { fetchAllTokens } from "@/lib/api/rwa";
import { fetchAuthenticatedTokens } from "@/lib/api/authenticated-rwa";
import { getMarketStatus } from "@/lib/engine/comparison";
import { PROVIDER_NAMES } from "@/lib/types";

export async function GET() {
  try {
    const [allTokens, authTokens] = await Promise.all([
      fetchAllTokens(),
      fetchAuthenticatedTokens(),
    ]);

    // Group by ticker (BSC only)
    const bscTokens = allTokens.filter((t) => t.chainId === "56");
    const byTicker: Record<string, any[]> = {};

    for (const token of bscTokens) {
      if (!byTicker[token.ticker]) byTicker[token.ticker] = [];
      byTicker[token.ticker].push({
        provider: PROVIDER_NAMES[token.type] || `type_${token.type}`,
        symbol: token.symbol,
        contractAddress: token.contractAddress,
        type: token.type,
        multiplier: token.multiplier,
      });
    }

    // Build enrichment from authenticated data
    const enrichment: Record<string, any> = {};
    if (authTokens) {
      for (const t of authTokens) {
        const ticker = t.underlyingTicker;
        if (!enrichment[ticker]) {
          enrichment[ticker] = {
            name: t.underlyingName,
            logoUrl: t.tokenLogoUrl,
            referencePrice: parseFloat(t.referencePrice) || null,
            marketCap: t.marketCap,
            isOpen: t.statusInfo.openState,
          };
        }
        // Per-provider price
        if (!enrichment[ticker].providers) enrichment[ticker].providers = {};
        enrichment[ticker].providers[t.platformId] = {
          tokenPrice: parseFloat(t.tokenPrice) || 0,
          volume24H: t.volume24H,
        };
      }
    }

    // Build result
    const tickers = Object.entries(byTicker).map(([ticker, providers]) => ({
      ticker,
      name: enrichment[ticker]?.name || ticker,
      logoUrl: enrichment[ticker]?.logoUrl || null,
      providerCount: providers.length,
      providers,
      referencePrice: enrichment[ticker]?.referencePrice || null,
      marketCap: enrichment[ticker]?.marketCap || null,
      isOpen: enrichment[ticker]?.isOpen ?? null,
    }));

    // Sort alphabetically
    tickers.sort((a, b) => a.ticker.localeCompare(b.ticker));

    return NextResponse.json({
      tickers,
      total: tickers.length,
      marketStatus: getMarketStatus(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
