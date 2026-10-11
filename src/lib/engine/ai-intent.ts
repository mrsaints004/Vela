import type { TradeIntent } from "../types";

const GROQ_MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You are a trade intent parser for a tokenized equities platform. Extract structured trade intent from natural language.

Return ONLY valid JSON with these fields:
- action: "buy" or "sell"
- ticker: uppercase stock ticker symbol (e.g. "NVDA", "AAPL", "TSLA")
- amount: number (the dollar amount or share count)
- unit: "usd" or "shares"

Rules:
- Default action is "buy" unless the user says sell/dump/exit/close/liquidate
- Default unit is "usd" unless the user explicitly says shares/share
- If no amount is specified, return null; never invent a spending amount
- Common stock name mappings: Apple=AAPL, Google/Alphabet=GOOGL, Amazon=AMZN, Microsoft=MSFT, Tesla=TSLA, Nvidia=NVDA, Meta/Facebook=META, Netflix=NFLX, Coinbase=COIN, MicroStrategy=MSTR
- If the user mentions "k" after a number, multiply by 1000 (e.g. "2k" = 2000)
- Strip any non-trade content — focus only on the trading intent

Examples:
"I want to purchase approximately five hundred dollars worth of Apple stock" → {"action":"buy","ticker":"AAPL","amount":500,"unit":"usd"}
"dump my tesla shares, about 2k worth" → {"action":"sell","ticker":"TSLA","amount":2000,"unit":"usd"}
"get me 10 shares of nvidia" → {"action":"buy","ticker":"NVDA","amount":10,"unit":"shares"}
"NVDA 500" → {"action":"buy","ticker":"NVDA","amount":500,"unit":"usd"}
"sell 3 shares GOOGL" → {"action":"sell","ticker":"GOOGL","amount":3,"unit":"shares"}

Return ONLY the JSON object, no markdown, no explanation.`;

export interface AIParseResult {
  intent: TradeIntent | null;
  method: "ai" | "regex";
  confidence: "high" | "medium" | "low";
  error?: string;
}

export async function parseIntentWithAI(raw: string): Promise<AIParseResult> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return { intent: null, method: "regex", confidence: "low", error: "No GROQ_API_KEY" };
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: raw },
        ],
        temperature: 0,
        max_tokens: 150,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "Unknown error");
      return { intent: null, method: "regex", confidence: "low", error: `Groq API ${res.status}: ${err}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return { intent: null, method: "regex", confidence: "low", error: "Empty response" };
    }

    // Parse the JSON response
    const parsed = JSON.parse(content);

    // Validate required fields
    if (!parsed.ticker || !parsed.action || !parsed.amount) {
      return { intent: null, method: "regex", confidence: "low", error: "Incomplete parse" };
    }

    // Validate action
    const action = parsed.action.toLowerCase();
    if (action !== "buy" && action !== "sell") {
      return { intent: null, method: "regex", confidence: "low", error: "Invalid action" };
    }

    // Validate unit
    const unit = (parsed.unit || "usd").toLowerCase();
    if (unit !== "usd" && unit !== "shares") {
      return { intent: null, method: "regex", confidence: "low", error: "Invalid unit" };
    }

    const amount = typeof parsed.amount === "number" ? parsed.amount : parseFloat(parsed.amount);
    if (isNaN(amount) || amount <= 0) {
      return { intent: null, method: "regex", confidence: "low", error: "Invalid amount" };
    }

    const intent: TradeIntent = {
      raw,
      action: action as "buy" | "sell",
      ticker: parsed.ticker.toUpperCase(),
      amount,
      unit: unit as "usd" | "shares",
    };

    return { intent, method: "ai", confidence: "high" };
  } catch (err) {
    // JSON parse error or network error
    return {
      intent: null,
      method: "regex",
      confidence: "low",
      error: err instanceof Error ? err.message : "AI parse failed",
    };
  }
}
