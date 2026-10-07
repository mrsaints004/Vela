import { NextRequest, NextResponse } from "next/server";
import { parseIntentWithAI } from "@/lib/engine/ai-intent";
import { parseIntent } from "@/lib/engine/intent";

export async function POST(request: NextRequest) {
  try {
    const { raw } = await request.json();

    if (!raw || typeof raw !== "string") {
      return NextResponse.json({ error: "raw intent string required" }, { status: 400 });
    }

    // Try AI parsing first
    const aiResult = await parseIntentWithAI(raw);

    if (aiResult.intent && aiResult.method === "ai") {
      return NextResponse.json({
        intent: aiResult.intent,
        method: "ai",
        confidence: aiResult.confidence,
      });
    }

    // Fall back to regex
    const regexIntent = parseIntent(raw);

    if (regexIntent) {
      return NextResponse.json({
        intent: regexIntent,
        method: "regex",
        confidence: "medium",
      });
    }

    // Both failed
    return NextResponse.json({
      intent: null,
      method: "none",
      confidence: "low",
      error: aiResult.error || "Could not parse intent",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Parse failed" },
      { status: 500 }
    );
  }
}
