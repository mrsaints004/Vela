import { NextRequest, NextResponse } from "next/server";
import { getWalletBalances, getAddressPortfolio } from "@/lib/api/wallet";
import { fetchAllTokens } from "@/lib/api/rwa";
import { PROVIDER_NAMES } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json({ error: "wallet address required" }, { status: 400 });
  }

  try {
    // Get all RWA token addresses for filtering
    const allTokens = await fetchAllTokens();
    const bscTokens = allTokens.filter((t) => t.chainId === "56");
    const rwaAddresses = new Set(bscTokens.map((t) => t.contractAddress.toLowerCase()));

    // Strategy 1: Use Binance Web3 Wallet API (richer data, official integration)
    let walletApiHoldings: any[] = [];
    let walletApiUsed = false;
    let totalPortfolioUsd = 0;
    let apiLatency = 0;

    try {
      const [balanceResult, portfolioResult] = await Promise.all([
        getWalletBalances(wallet),
        getAddressPortfolio(wallet),
      ]);

      apiLatency = balanceResult.latency;

      // Filter to RWA tokens
      const rwaBalances = balanceResult.balances.filter(
        (b) => rwaAddresses.has(b.tokenAddress.toLowerCase()) && parseFloat(b.balance) > 0
      );

      // Enrich with provider info
      walletApiHoldings = rwaBalances.map((b) => {
        const token = bscTokens.find(
          (t) => t.contractAddress.toLowerCase() === b.tokenAddress.toLowerCase()
        );
        return {
          ticker: token?.ticker || b.tokenSymbol,
          symbol: b.tokenSymbol,
          provider: token ? PROVIDER_NAMES[token.type] || `type_${token.type}` : "Unknown",
          contractAddress: b.tokenAddress,
          balance: parseFloat(b.balance),
          balanceUsd: parseFloat(b.balanceUsd),
          tokenPrice: parseFloat(b.tokenPrice),
          decimals: b.decimals,
          logoUrl: b.logoUrl,
          source: "wallet-api" as const,
        };
      });

      totalPortfolioUsd = balanceResult.totalUsd;
      walletApiUsed = true;
    } catch {
      // Wallet API failed — fall back to RPC
    }

    // Strategy 2: Fallback to direct RPC balance queries
    if (!walletApiUsed) {
      const { JsonRpcProvider, Contract } = await import("ethers");
      const provider = new JsonRpcProvider("https://bsc-dataseed.binance.org");
      const erc20Abi = ["function balanceOf(address) view returns (uint256)"];

      const positions = await Promise.allSettled(
        bscTokens.map(async (token) => {
          const contract = new Contract(token.contractAddress, erc20Abi, provider);
          const balance = await contract.balanceOf(wallet);
          const decimals = token.d || 18;
          const amount = Number(balance) / Math.pow(10, decimals);
          return {
            ticker: token.ticker,
            symbol: token.symbol,
            provider: PROVIDER_NAMES[token.type] || `type_${token.type}`,
            contractAddress: token.contractAddress,
            balance: amount,
            balanceUsd: 0,
            tokenPrice: 0,
            decimals,
            logoUrl: "",
            source: "rpc" as const,
          };
        })
      );

      walletApiHoldings = positions
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter((h) => h.balance > 0);
    }

    return NextResponse.json({
      wallet,
      holdings: walletApiHoldings,
      totalPositions: walletApiHoldings.length,
      totalPortfolioUsd,
      dataSource: walletApiUsed ? "binance-wallet-api" : "rpc-fallback",
      apiLatency,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
