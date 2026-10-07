import crypto from "crypto";

const BASE_URL = "https://web3.binance.com";
const BSC_CHAIN_ID = "56";
export const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";

function getCredentials() {
  const apiKey = process.env.BINANCE_WEB3_API_KEY;
  const secretKey = process.env.BINANCE_WEB3_SECRET_KEY;
  if (!apiKey || !secretKey) throw new Error("API credentials not configured");
  return { apiKey, secretKey };
}

function signRequest(secretKey: string, timestamp: string, method: string, pathWithQuery: string, body: string = "") {
  const preHash = `${timestamp}${method}${pathWithQuery}${body}`;
  return crypto.createHmac("sha256", secretKey).update(preHash, "utf8").digest("base64");
}

async function apiCall(method: "GET" | "POST", path: string, params?: Record<string, string>, body?: object) {
  const { apiKey, secretKey } = getCredentials();
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

  let fullPath = `/build${path}`;
  if (params && method === "GET") {
    const qs = new URLSearchParams(params).toString();
    if (qs) fullPath += `?${qs}`;
  }

  const bodyStr = body ? JSON.stringify(body) : "";
  const signature = signRequest(secretKey, timestamp, method, fullPath, bodyStr);

  const res = await fetch(`${BASE_URL}${fullPath}`, {
    method,
    headers: {
      "X-OC-APIKEY": apiKey,
      "X-OC-TIMESTAMP": timestamp,
      "X-OC-SIGN": signature,
      "Content-Type": "application/json",
    },
    body: method === "POST" ? bodyStr : undefined,
  });

  const data = await res.json();
  const latency = Date.now() - startTime;

  return { data, latency, status: res.status };
}

// --- Quote ---

export interface QuoteRoute {
  dexName: string;
  percent: string;
  fromSymbol: string;
  toSymbol: string;
}

export interface Quote {
  quoteId: string;
  vendorName: string;
  executionMode: string;
  fromTokenAmount: string;
  toTokenAmount: string;
  tradeFee: string;
  estimateGasFee: string;
  priceImpactPercent: string;
  fromTokenSymbol: string;
  fromTokenPrice: string;
  toTokenSymbol: string;
  toTokenPrice: string;
  isHoneyPot: boolean;
  routes: QuoteRoute[];
  approveTarget: string;
  isBest: boolean;
}

export async function getQuote(
  toTokenAddress: string,
  usdtAmount: string,
  walletAddress: string
): Promise<{ quotes: Quote[]; latency: number }> {
  // Convert USD to wei (18 decimals)
  const amountWei = BigInt(Math.floor(parseFloat(usdtAmount) * 1e18)).toString();

  const { data, latency } = await apiCall("GET", "/api/v1/dex/aggregator/quote", {
    binanceChainId: BSC_CHAIN_ID,
    fromTokenAddress: USDT_BSC,
    toTokenAddress,
    amount: amountWei,
    userWalletAddress: walletAddress,
  });

  if (data.code !== 0 || !data.data) {
    throw new Error(`Quote failed: ${data.msg || JSON.stringify(data)}`);
  }

  const quotes: Quote[] = (data.data as any[]).map((q: any) => ({
    quoteId: q.quoteId,
    vendorName: q.vendorName,
    executionMode: q.executionMode,
    fromTokenAmount: q.fromTokenAmount,
    toTokenAmount: q.toTokenAmount,
    tradeFee: q.tradeFee,
    estimateGasFee: q.estimateGasFee,
    priceImpactPercent: q.priceImpactPercent,
    fromTokenSymbol: q.fromToken?.tokenSymbol || "USDT",
    fromTokenPrice: q.fromToken?.tokenUnitPrice || "1",
    toTokenSymbol: q.toToken?.tokenSymbol || "",
    toTokenPrice: q.toToken?.tokenUnitPrice || "0",
    isHoneyPot: q.toToken?.isHoneyPot || false,
    routes: (q.dexRouterList || []).map((r: any) => ({
      dexName: r.dexProtocol?.dexName || "Unknown",
      percent: r.dexProtocol?.percent || "100",
      fromSymbol: r.fromToken?.tokenSymbol || "",
      toSymbol: r.toToken?.tokenSymbol || "",
    })),
    approveTarget: q.approveTarget || "",
    isBest: q.isBest || false,
  }));

  return { quotes, latency };
}

// --- Swap Build ---

export interface SwapTx {
  executionMode: string;
  from: string;
  to: string;
  value: string;
  data: string;
  hasRFQ: boolean;
}

export async function buildSwap(
  toTokenAddress: string,
  usdtAmount: string,
  walletAddress: string,
  quoteId: string,
  slippagePercent: string = "1"
): Promise<{ swap: SwapTx; latency: number }> {
  const amountWei = BigInt(Math.floor(parseFloat(usdtAmount) * 1e18)).toString();

  const { data, latency } = await apiCall("GET", "/api/v1/dex/aggregator/swap", {
    binanceChainId: BSC_CHAIN_ID,
    fromTokenAddress: USDT_BSC,
    toTokenAddress,
    amount: amountWei,
    quoteId,
    userWalletAddress: walletAddress,
    slippagePercent,
  });

  if (data.code !== 0 || !data.data) {
    throw new Error(`Swap build failed: ${data.msg || JSON.stringify(data)}`);
  }

  const d = data.data;
  const tx = d.tx || d.swapTransaction || {};

  return {
    swap: {
      executionMode: d.executionMode || "SWAP",
      from: tx.from || walletAddress,
      to: tx.to || "",
      value: tx.value || "0",
      data: tx.data || "",
      hasRFQ: Boolean(d.rfq?.typedDataToSign),
    },
    latency,
  };
}

// --- Simulation ---

export interface SimulationResult {
  status: "SUCCESS" | "FAILED";
  failReason: string | null;
  balanceChanges: Array<{
    address: string;
    symbol: string;
    amount: string;
    direction: string;
  }>;
}

export async function simulateTransaction(
  from: string,
  to: string,
  value: string,
  calldata: string
): Promise<{ simulation: SimulationResult; latency: number }> {
  const { data, latency } = await apiCall("POST", "/api/v1/dex/pre-transaction/simulate", undefined, {
    binanceChainId: BSC_CHAIN_ID,
    evmTx: { from, to, value, data: calldata },
  });

  if (data.code !== 0) {
    throw new Error(`Simulation failed: ${data.msg || JSON.stringify(data)}`);
  }

  const d = data.data || {};

  return {
    simulation: {
      status: d.status || "FAILED",
      failReason: d.failReason || null,
      balanceChanges: (d.balanceChanges || []).map((bc: any) => ({
        address: bc.tokenAddress || "",
        symbol: bc.tokenSymbol || "",
        amount: bc.amount || "0",
        direction: bc.direction || "unknown",
      })),
    },
    latency,
  };
}
