import { NextRequest, NextResponse } from "next/server";
import { getQuote, buildSwap, simulateTransaction } from "@/lib/api/trading";
import { findAuthenticatedRepresentations, getReferencePrice } from "@/lib/api/authenticated-rwa";
import { findRepresentations } from "@/lib/api/rwa";
import {
  fetchRepresentations,
  calculateEffectiveCosts,
  getMarketStatus,
  evaluateTradeFirewall,
  buildDiscoveredRepresentations,
  generateRecommendation,
} from "@/lib/engine/comparison";
import { evaluatePolicy } from "@/lib/engine/policy";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // --- Discover: find representations, compare, recommend, policy ---
    if (action === "discover") {
      const { ticker, amount } = body;
      if (!ticker) {
        return NextResponse.json({ error: "ticker is required" }, { status: 400 });
      }

      const tokens = await findRepresentations(ticker);
      if (tokens.length === 0) {
        return NextResponse.json(
          { error: `No representations found for ${ticker} on BSC` },
          { status: 404 }
        );
      }

      const representations = await fetchRepresentations(tokens);
      const [authTokens, referencePrice] = await Promise.all([
        findAuthenticatedRepresentations(ticker),
        getReferencePrice(ticker),
      ]);

      const marketStatus = getMarketStatus();

      // Override market status from authenticated data if available
      const authMarketOpen = authTokens.length > 0 ? authTokens[0].statusInfo.openState : null;
      const finalMarketStatus = authMarketOpen !== null
        ? {
            ...marketStatus,
            isOpen: authMarketOpen,
            status: authMarketOpen ? ("regular" as const) : marketStatus.status,
            referenceStale: !authMarketOpen,
          }
        : marketStatus;

      // Fetch real price impacts from DEX aggregator for each provider
      const tradeAmount = String(parseFloat(amount) || 500);
      const dummyWallet = "0x0000000000000000000000000000000000000001";
      const quoteImpacts = new Map<string, number>();

      await Promise.allSettled(
        representations.map(async (rep) => {
          try {
            const quoteResult = await getQuote(rep.token.contractAddress, tradeAmount, dummyWallet);
            const best = quoteResult.quotes.find((q) => q.isBest) || quoteResult.quotes[0];
            if (best) {
              quoteImpacts.set(rep.provider, parseFloat(best.priceImpactPercent) || 0);
            }
          } catch {
            // Falls back to volume-based estimate
          }
        })
      );

      // Calculate costs with real quote impacts and market-aware staleness penalty
      const costs = calculateEffectiveCosts(representations, referencePrice ?? undefined, finalMarketStatus, quoteImpacts);
      const discovered = buildDiscoveredRepresentations(representations, costs);
      const { recommendation, factors, recommended } = generateRecommendation(
        representations,
        costs,
        referencePrice,
        finalMarketStatus
      );

      // Run policy evaluation with recommended provider
      const selectedProvider = recommended?.provider || (costs[0]?.provider ?? "");
      const policy = evaluatePolicy({
        marketStatus: finalMarketStatus,
        costs,
        representations,
        selectedProvider,
        amount: parseFloat(amount) || 500,
        referencePrice,
      });

      return NextResponse.json({
        representations: discovered,
        costs,
        recommendation,
        factors,
        recommended,
        policy,
        marketStatus: finalMarketStatus,
        referencePrice,
        enrichment: authTokens.length > 0
          ? {
              underlyingName: authTokens[0].underlyingName,
              logoUrl: authTokens[0].tokenLogoUrl,
              marketCap: authTokens[0].marketCap,
              peRatioTTM: authTokens[0].peRatioTTM,
            }
          : null,
      });
    }

    // --- Full flow: quote + simulate + policy ---
    if (action === "full-flow") {
      const { ticker, provider, tokenAddress, amount, walletAddress } = body;
      if (!ticker || !provider || !tokenAddress || !amount) {
        return NextResponse.json(
          { error: "ticker, provider, tokenAddress, and amount are required" },
          { status: 400 }
        );
      }

      const wallet = walletAddress || "0x0000000000000000000000000000000000000001";

      // Get quote
      let quote = null;
      let quoteError = null;
      try {
        const quoteResult = await getQuote(tokenAddress, amount, wallet);
        const best = quoteResult.quotes.find((q) => q.isBest) || quoteResult.quotes[0];
        if (best) {
          const toAmount = parseInt(best.toTokenAmount) / 1e18;
          quote = {
            quoteId: best.quoteId,
            provider,
            vendorName: best.vendorName,
            fromAmount: parseFloat(amount),
            toAmount,
            expectedPrice: parseFloat(amount) / toAmount,
            priceImpact: parseFloat(best.priceImpactPercent) || 0,
            tradeFee: parseFloat(best.tradeFee) || 0,
            gasFee: parseFloat(best.estimateGasFee) || 0,
            routes: best.routes.map((r) => `${r.dexName} (${r.percent}%)`),
            isHoneyPot: best.isHoneyPot,
            timestamp: Date.now(),
          };
        }
      } catch (err) {
        quoteError = err instanceof Error ? err.message : "Quote failed";
      }

      // Simulate if we got a quote
      let simulation = null;
      if (quote && !quote.isHoneyPot) {
        try {
          const swapResult = await buildSwap(tokenAddress, amount, wallet, quote.quoteId);
          const simResult = await simulateTransaction(
            swapResult.swap.from,
            swapResult.swap.to,
            swapResult.swap.value,
            swapResult.swap.data
          );
          simulation = {
            status: simResult.simulation.status,
            failReason: simResult.simulation.failReason,
            balanceChanges: simResult.simulation.balanceChanges.map((bc) => ({
              symbol: bc.symbol,
              amount: bc.amount,
              direction: bc.direction,
            })),
            timestamp: Date.now(),
          };
        } catch {
          simulation = { status: "FAILED" as const, failReason: "Simulation unavailable", balanceChanges: [], timestamp: Date.now() };
        }
      }

      // Re-evaluate policy with simulation result
      const tokens = await findRepresentations(ticker);
      const representations = await fetchRepresentations(tokens);
      const referencePrice = await getReferencePrice(ticker);
      const costs = calculateEffectiveCosts(representations, referencePrice ?? undefined);
      const marketStatus = getMarketStatus();

      const policy = evaluatePolicy({
        marketStatus,
        costs,
        representations,
        selectedProvider: provider,
        amount: parseFloat(amount),
        simulation,
        referencePrice,
      });

      return NextResponse.json({
        quote,
        quoteError,
        simulation,
        policy,
      });
    }

    // --- Full trade analysis (legacy) ---
    if (action === "analyze-trade") {
      const { ticker, provider, amount, walletAddress } = body;
      if (!ticker || !provider || !amount) {
        return NextResponse.json({ error: "ticker, provider, and amount are required" }, { status: 400 });
      }

      const wallet = walletAddress || "0x0000000000000000000000000000000000000001";
      const tokens = await findRepresentations(ticker);
      const providerTypeMap: Record<string, number> = { bStocks: 3, Ondo: 1, xStocks: 2 };
      const providerType = providerTypeMap[provider];
      const token = tokens.find((t) => t.type === providerType);

      if (!token) {
        return NextResponse.json({ error: `${provider} token not found for ${ticker}` }, { status: 404 });
      }

      const representations = await fetchRepresentations(tokens);
      const [quoteResult, referencePrice] = await Promise.all([
        getQuote(token.contractAddress, amount, wallet).catch((e) => ({ quotes: [], latency: 0, error: e.message })),
        getReferencePrice(ticker),
      ]);

      const firewall = evaluateTradeFirewall(ticker, representations, provider, parseFloat(amount));
      const marketStatus = getMarketStatus();
      const costs = calculateEffectiveCosts(representations, referencePrice ?? undefined);
      const quote = "error" in quoteResult ? null : quoteResult.quotes[0] || null;

      let expectedOutput = 0;
      let expectedPrice = 0;
      let priceImpact = 0;
      let tradeFee = 0;
      let executionMode = "N/A";
      let routeInfo: string[] = [];

      if (quote) {
        expectedOutput = parseInt(quote.toTokenAmount) / 1e18;
        expectedPrice = parseFloat(amount) / expectedOutput;
        priceImpact = parseFloat(quote.priceImpactPercent) || 0;
        tradeFee = parseFloat(quote.tradeFee) || 0;
        executionMode = quote.executionMode;
        routeInfo = quote.routes.map((r) => `${r.dexName} (${r.percent}%)`);
      }

      const selectedCost = costs.find((c) => c.provider === provider);

      return NextResponse.json({
        ticker, provider, amount: parseFloat(amount),
        tokenAddress: token.contractAddress, tokenSymbol: token.symbol,
        quote: quote ? {
          quoteId: quote.quoteId, expectedOutput, expectedPrice, priceImpact,
          tradeFee, executionMode, routes: routeInfo, vendorName: quote.vendorName,
          isHoneyPot: quote.isHoneyPot,
        } : null,
        quoteError: "error" in quoteResult ? quoteResult.error : null,
        quoteLatency: "error" in quoteResult ? 0 : quoteResult.latency,
        referencePrice,
        priceDeviation: selectedCost ? {
          percent: selectedCost.priceDeviationPercent,
          absolute: selectedCost.priceDeviation,
        } : null,
        firewall, marketStatus,
        alternatives: costs.map((c) => ({
          provider: c.provider, price: c.quotedPrice, effectiveCost: c.totalEffectiveCost,
          rank: c.rank, liquidityRating: c.liquidityRating,
          isSelected: c.provider === provider, isBest: c.rank === 1,
        })),
        meta: { timestamp: Date.now(), hasQuote: !!quote, walletConnected: walletAddress !== undefined },
      });
    }

    // --- Get quote only ---
    if (action === "quote") {
      const { tokenAddress, amount, walletAddress } = body;
      if (!tokenAddress || !amount) {
        return NextResponse.json({ error: "tokenAddress and amount required" }, { status: 400 });
      }
      const wallet = walletAddress || "0x0000000000000000000000000000000000000001";
      const result = await getQuote(tokenAddress, amount, wallet);
      return NextResponse.json(result);
    }

    // --- Build swap tx ---
    if (action === "build-swap") {
      const { tokenAddress, amount, walletAddress, quoteId, slippage } = body;
      if (!tokenAddress || !amount || !walletAddress || !quoteId) {
        return NextResponse.json({ error: "tokenAddress, amount, walletAddress, and quoteId required" }, { status: 400 });
      }
      const result = await buildSwap(tokenAddress, amount, walletAddress, quoteId, slippage || "1");
      return NextResponse.json(result);
    }

    // --- Simulate ---
    if (action === "simulate") {
      const { from, to, value, data } = body;
      if (!from || !to || !data) {
        return NextResponse.json({ error: "from, to, and data required" }, { status: 400 });
      }
      const result = await simulateTransaction(from, to, value || "0", data);
      return NextResponse.json(result);
    }

    // --- Agentic execution plan ---
    if (action === "agentic-plan") {
      const { tokenAddress, amount, walletAddress, quoteId, provider, ticker } = body;
      if (!tokenAddress || !amount || !walletAddress || !quoteId) {
        return NextResponse.json({ error: "tokenAddress, amount, walletAddress, quoteId required" }, { status: 400 });
      }

      const { buildAgenticPlan } = await import("@/lib/api/agentic-wallet");
      const plan = await buildAgenticPlan({
        tokenAddress, amount, walletAddress, quoteId,
        provider: provider || "Unknown",
        ticker: ticker || "Unknown",
      });

      return NextResponse.json(plan);
    }

    // --- Agentic execution ---
    if (action === "agentic-execute") {
      const { plan, tokenAddress, amount, walletAddress, quoteId } = body;
      if (!plan || !tokenAddress || !amount || !walletAddress || !quoteId) {
        return NextResponse.json({ error: "plan, tokenAddress, amount, walletAddress, quoteId required" }, { status: 400 });
      }

      const { executeAgenticPlan } = await import("@/lib/api/agentic-wallet");
      const result = await executeAgenticPlan(plan, { tokenAddress, amount, walletAddress, quoteId });

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
