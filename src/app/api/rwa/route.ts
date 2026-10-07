import { NextRequest, NextResponse } from "next/server";
import { findRepresentations, findMultiProviderTickers } from "@/lib/api/rwa";
import {
  fetchRepresentations,
  compareRepresentations,
  calculateEffectiveCosts,
  getMarketStatus,
  evaluateTradeFirewall,
} from "@/lib/engine/comparison";
import {
  findAuthenticatedRepresentations,
  getReferencePrice,
  AuthRWAToken,
} from "@/lib/api/authenticated-rwa";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const ticker = searchParams.get("ticker");

  try {
    if (action === "market-status") {
      return NextResponse.json(getMarketStatus());
    }

    if (action === "multi-provider-tickers") {
      const multi = await findMultiProviderTickers();
      const result: Record<string, { count: number; providers: string[] }> = {};
      for (const [t, tokens] of multi) {
        const providerNames = tokens.map((tk) => {
          const names: Record<number, string> = {
            1: "Ondo",
            2: "xStocks",
            3: "bStocks",
          };
          return names[tk.type] || `type_${tk.type}`;
        });
        result[t] = { count: tokens.length, providers: providerNames };
      }
      return NextResponse.json({
        total: multi.size,
        tickers: result,
      });
    }

    if (action === "compare" && ticker) {
      // Fetch public data (all 3 providers including xStocks)
      const tokens = await findRepresentations(ticker);
      if (tokens.length === 0) {
        return NextResponse.json(
          { error: `No representations found for ${ticker} on BSC` },
          { status: 404 }
        );
      }

      const representations = await fetchRepresentations(tokens);

      // Fetch authenticated data for reference prices & enrichment
      const [authTokens, referencePrice] = await Promise.all([
        findAuthenticatedRepresentations(ticker),
        getReferencePrice(ticker),
      ]);

      // Build enrichment map from authenticated data
      const enrichment = buildEnrichmentMap(authTokens);

      // Use real reference price from authenticated API when available
      const comparison = compareRepresentations(
        ticker,
        representations,
        referencePrice ?? undefined
      );
      const costs = calculateEffectiveCosts(
        representations,
        referencePrice ?? undefined
      );
      const marketStatus = getMarketStatus();

      // Determine authenticated market status
      const authMarketOpen = authTokens.length > 0
        ? authTokens[0].statusInfo.openState
        : null;

      return NextResponse.json({
        comparison,
        costs,
        marketStatus: {
          ...marketStatus,
          // Override with authenticated market status if available
          ...(authMarketOpen !== null && {
            isOpen: authMarketOpen,
            status: authMarketOpen ? "regular" : marketStatus.status,
            referenceStale: !authMarketOpen,
          }),
        },
        enrichment,
        referencePrice,
        meta: {
          timestamp: Date.now(),
          providersFound: representations.length,
          providersTotal: tokens.length,
          authenticatedData: authTokens.length > 0,
          hasReferencePrice: referencePrice !== null,
        },
      });
    }

    if (action === "firewall" && ticker) {
      const provider = searchParams.get("provider") || "";
      const amount = parseFloat(searchParams.get("amount") || "500");

      const tokens = await findRepresentations(ticker);
      const representations = await fetchRepresentations(tokens);
      const result = evaluateTradeFirewall(
        ticker,
        representations,
        provider,
        amount
      );

      return NextResponse.json(result);
    }

    return NextResponse.json(
      {
        error:
          "Invalid action. Use: market-status, multi-provider-tickers, compare, firewall",
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Build enrichment data from authenticated tokens (logos, names, market cap, P/E, etc.)
 */
function buildEnrichmentMap(authTokens: AuthRWAToken[]) {
  if (authTokens.length === 0) return null;

  const first = authTokens[0];
  const byProvider: Record<
    string,
    {
      tokenPrice: number;
      referencePrice: number;
      volume24H: string;
      marketStatus: string | null;
      openState: boolean;
      logoUrl: string;
    }
  > = {};

  for (const t of authTokens) {
    byProvider[t.platformId] = {
      tokenPrice: parseFloat(t.tokenPrice) || 0,
      referencePrice: parseFloat(t.referencePrice) || 0,
      volume24H: t.volume24H,
      marketStatus: t.statusInfo.marketStatus,
      openState: t.statusInfo.openState,
      logoUrl: t.tokenLogoUrl,
    };
  }

  return {
    underlyingName: first.underlyingName,
    underlyingTicker: first.underlyingTicker,
    marketCap: first.marketCap,
    peRatioTTM: first.peRatioTTM,
    logoUrl: first.tokenLogoUrl,
    providers: byProvider,
  };
}
