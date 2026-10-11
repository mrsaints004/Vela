import type { TradeIntent } from "../types";

// Known tickers for fuzzy matching
const KNOWN_TICKERS = new Set([
  "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA",
  "BRK", "JPM", "V", "JNJ", "WMT", "PG", "MA", "UNH", "HD", "DIS",
  "BAC", "XOM", "KO", "PFE", "PEP", "CSCO", "INTC", "VZ", "CMCSA",
  "ADBE", "CRM", "NFLX", "AMD", "QCOM", "TXN", "COST", "AVGO",
  "COIN", "MSTR", "SQ", "PYPL", "UBER", "ABNB", "SNOW", "PLTR",
  "SPY", "QQQ", "IWM", "DIA", "VOO",
]);

const PATTERNS = [
  // "Buy $500 of NVDA" / "buy $500 NVDA"
  /^(buy|sell)\s+\$?([\d,]+(?:\.\d+)?)\s+(?:of\s+)?([A-Za-z]+)$/i,
  // "Buy 10 shares of NVDA"
  /^(buy|sell)\s+([\d,]+(?:\.\d+)?)\s+shares?\s+(?:of\s+)?([A-Za-z]+)$/i,
  // "NVDA $500" / "NVDA 500"
  /^([A-Za-z]+)\s+\$?([\d,]+(?:\.\d+)?)$/i,
  // "$500 NVDA"
  /^\$?([\d,]+(?:\.\d+)?)\s+([A-Za-z]+)$/i,
  // "Buy NVDA $500"
  /^(buy|sell)\s+([A-Za-z]+)\s+\$?([\d,]+(?:\.\d+)?)$/i,
  // "Buy NVDA for $500"
  /^(buy|sell)\s+([A-Za-z]+)\s+for\s+\$?([\d,]+(?:\.\d+)?)$/i,
  // "I want to buy $500 of NVDA" / "I'd like to buy NVDA for $500"
  /(?:i\s+(?:want|need|would like|wanna|\'d like)\s+to\s+)(buy|sell)\s+\$?([\d,]+(?:\.\d+)?)\s+(?:of\s+)?([A-Za-z]+)/i,
  /(?:i\s+(?:want|need|would like|wanna|\'d like)\s+to\s+)(buy|sell)\s+([A-Za-z]+)\s+(?:for\s+)?\$?([\d,]+(?:\.\d+)?)/i,
  // "get me $500 worth of NVDA" / "grab $200 of TSLA"
  /(?:get\s+me|grab|pick\s+up|snag)\s+\$?([\d,]+(?:\.\d+)?)\s+(?:worth\s+)?(?:of\s+)?([A-Za-z]+)/i,
  // "put $500 into NVDA" / "invest $1000 in AAPL"
  /(?:put|invest|place|throw|drop)\s+\$?([\d,]+(?:\.\d+)?)\s+(?:into|in|on)\s+([A-Za-z]+)/i,
  // "swap $500 for NVDA" / "swap $500 to NVDA"
  /(?:swap|exchange|convert)\s+\$?([\d,]+(?:\.\d+)?)\s+(?:for|to|into)\s+([A-Za-z]+)/i,
  // "NVDA" alone (just a ticker, default to $500 buy)
  /^([A-Za-z]{1,5})$/i,
];

export function parseIntent(raw: string): TradeIntent | null {
  const sellText = raw.trim();
  const all = sellText.match(/^sell\s+all\s+(?:my\s+)?([A-Z0-9.-]{1,15})(?:\s+(?:tokens|position))?$/i);
  const quantity = sellText.match(/^sell\s+(\d+(?:\.\d+)?)\s+tokens?\s+(?:of\s+)?([A-Z0-9.-]{1,15})$/i)
    || sellText.match(/^sell\s+(\d+(?:\.\d+)?)\s+([A-Z0-9.-]{1,15})\s+tokens?$/i);
  if(all) return {raw,action:'sell',ticker:all[1].toUpperCase(),amount:0,unit:'tokens',sellAll:true};
  if(quantity) return {raw,action:'sell',ticker:quantity[2].toUpperCase(),amount:Number(quantity[1]),unit:'tokens',sellAll:false};
  const trimmed = raw.trim();
  if (!trimmed) return null;

  for (const pattern of PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match) continue;

    if (pattern === PATTERNS[0]) {
      return {
        raw: trimmed,
        action: match[1].toLowerCase() as "buy" | "sell",
        ticker: match[3].toUpperCase(),
        amount: parseAmount(match[2]),
        unit: "usd",
      };
    }

    if (pattern === PATTERNS[1]) {
      return {
        raw: trimmed,
        action: match[1].toLowerCase() as "buy" | "sell",
        ticker: match[3].toUpperCase(),
        amount: parseAmount(match[2]),
        unit: "shares",
      };
    }

    if (pattern === PATTERNS[2]) {
      return {
        raw: trimmed,
        action: "buy",
        ticker: match[1].toUpperCase(),
        amount: parseAmount(match[2]),
        unit: "usd",
      };
    }

    if (pattern === PATTERNS[3]) {
      return {
        raw: trimmed,
        action: "buy",
        ticker: match[2].toUpperCase(),
        amount: parseAmount(match[1]),
        unit: "usd",
      };
    }

    if (pattern === PATTERNS[4] || pattern === PATTERNS[5]) {
      return {
        raw: trimmed,
        action: match[1].toLowerCase() as "buy" | "sell",
        ticker: match[2].toUpperCase(),
        amount: parseAmount(match[3]),
        unit: "usd",
      };
    }

    // "I want to buy $500 of NVDA"
    if (pattern === PATTERNS[6]) {
      return {
        raw: trimmed,
        action: match[1].toLowerCase() as "buy" | "sell",
        ticker: match[3].toUpperCase(),
        amount: parseAmount(match[2]),
        unit: "usd",
      };
    }

    // "I want to buy NVDA for $500"
    if (pattern === PATTERNS[7]) {
      return {
        raw: trimmed,
        action: match[1].toLowerCase() as "buy" | "sell",
        ticker: match[2].toUpperCase(),
        amount: parseAmount(match[3]),
        unit: "usd",
      };
    }

    // "get me $500 of NVDA" / "grab $200 of TSLA"
    if (pattern === PATTERNS[8]) {
      return {
        raw: trimmed,
        action: "buy",
        ticker: match[2].toUpperCase(),
        amount: parseAmount(match[1]),
        unit: "usd",
      };
    }

    // "put $500 into NVDA" / "invest $1000 in AAPL"
    if (pattern === PATTERNS[9]) {
      return {
        raw: trimmed,
        action: "buy",
        ticker: match[2].toUpperCase(),
        amount: parseAmount(match[1]),
        unit: "usd",
      };
    }

    // "swap $500 for NVDA"
    if (pattern === PATTERNS[10]) {
      return {
        raw: trimmed,
        action: "buy",
        ticker: match[2].toUpperCase(),
        amount: parseAmount(match[1]),
        unit: "usd",
      };
    }

    // Bare ticker "NVDA" — default to $500 buy
    if (pattern === PATTERNS[11]) {
      const ticker = match[1].toUpperCase();
      if (KNOWN_TICKERS.has(ticker)) {
        return {
          raw: trimmed,
          action: "buy",
          ticker,
          amount: 0,
          unit: "usd",
        };
      }
    }
  }

  // Fuzzy fallback: try to extract a ticker and an amount from anywhere in the string
  const tickerMatch = trimmed.match(/\b([A-Z]{1,5})\b/);
  const amountMatch = trimmed.match(/\$?([\d,]+(?:\.\d+)?)/);
  const actionMatch = trimmed.match(/\b(sell|dump|exit|close)\b/i);

  if (tickerMatch && KNOWN_TICKERS.has(tickerMatch[1])) {
    return {
      raw: trimmed,
      action: actionMatch ? "sell" : "buy",
      ticker: tickerMatch[1],
      amount: amountMatch ? parseAmount(amountMatch[1]) : 0,
      unit: "usd",
    };
  }

  return null;
}

function parseAmount(s: string): number {
  const n = parseFloat(s.replace(/,/g, ""));
  return n > 0 ? n : 0;
}

export const MIN_PURCHASE_USD = 5;
export function validatePurchaseAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount < MIN_PURCHASE_USD || amount > 25000) throw new Error('Enter a purchase amount of at least $5 and at most $25,000. Vendor minimums may be higher.');
}
export function validateIntent(intent: TradeIntent): void {
  if (!intent || !['buy','sell'].includes(intent.action)) throw new Error('Enter a supported buy or sell request.');
  if(intent.action==='sell') {
    const parsed=parseIntent(intent.raw||'');
    if(intent.unit!=='tokens'||!parsed||parsed.action!=='sell'||parsed.unit!=='tokens'||parsed.ticker!==intent.ticker||parsed.amount!==intent.amount||!!parsed.sellAll!==!!intent.sellAll||(!intent.sellAll&&(!Number.isFinite(intent.amount)||intent.amount<=0))) throw new Error('Use Sell all NVDA or Sell 0.01 tokens of NVDA. Dollar, share-count and percentage sells are unsupported.');
    if(!/^[A-Z0-9.-]{1,15}$/.test(intent.ticker))throw new Error('Invalid stock ticker.');
    return;
  }
  if(/\b(sell|dump|exit|liquidate|close|shares?)\b/i.test(intent.raw||'')) throw new Error('This request is not a supported dollar purchase.');
  if (intent.unit !== 'usd') throw new Error('Share-count orders are not supported yet. Enter a dollar amount, for example Buy $5 of NVDA.');
  validatePurchaseAmount(intent.amount);
  if (!/^[A-Z0-9.-]{1,15}$/.test(intent.ticker)) throw new Error('Invalid stock ticker.');
}
