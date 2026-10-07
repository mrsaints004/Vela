import { NextRequest, NextResponse } from "next/server";
import { recordApiCall } from "@/lib/api/flight-recorder";
import { generateReceipt } from "@/lib/engine/receipt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intent, provider, tokenAddress, quote, simulation, policy, marketStatus, executionMode } = body;

    if (!intent || !provider) {
      return NextResponse.json({ error: "intent and provider are required" }, { status: 400 });
    }

    // Record the execution attempt with full context
    const log = recordApiCall({
      endpoint: "execute/attempt",
      method: "POST",
      params: {
        ticker: intent.ticker,
        provider,
        amount: String(intent.amount),
        action: intent.action,
        executionMode: executionMode || "wallet",
        hasQuote: String(!!quote),
        simulationStatus: simulation?.status || "none",
        policyAction: policy?.action || "none",
      },
      status: 200,
      latency: 0,
      success: true,
      error: null,
      responseSize: JSON.stringify(body).length,
      notes: `${intent.action} ${intent.amount} USD of ${intent.ticker} via ${provider} (${executionMode || "wallet"})`,
    });

    // Generate a receipt skeleton for the execution
    const receipt = generateReceipt({
      intent,
      selectedProvider: provider,
      selectedTokenAddress: tokenAddress || "",
      recommendation: `Executed via ${provider}`,
      factors: [],
      discoveredCount: 0,
      quote: quote || null,
      simulation: simulation || null,
      execution: null,
      policy: policy || { action: "allow", checks: [] },
      marketStatus: marketStatus || {
        isOpen: false,
        status: "closed" as const,
        nextOpenTime: null,
        referenceStale: true,
        staleDuration: null,
      },
      referencePrice: null,
    });

    return NextResponse.json({
      logged: true,
      logId: log.id,
      receiptId: receipt.id,
      timestamp: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
