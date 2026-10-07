import { NextRequest, NextResponse } from "next/server";
import type { VelaReceipt } from "@/lib/types";
import fs from "fs";
import path from "path";

const RECEIPTS_FILE = path.join(process.cwd(), ".data", "receipts.json");
const MAX_RECEIPTS = 200;

function ensureDataDir() {
  const dir = path.dirname(RECEIPTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadReceipts(): VelaReceipt[] {
  try {
    ensureDataDir();
    if (fs.existsSync(RECEIPTS_FILE)) {
      const raw = fs.readFileSync(RECEIPTS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // Corrupted file — start fresh
  }
  return [];
}

function saveReceipts(receipts: VelaReceipt[]) {
  try {
    ensureDataDir();
    fs.writeFileSync(RECEIPTS_FILE, JSON.stringify(receipts, null, 2));
  } catch {
    // Write failed — non-critical, receipts still in memory
  }
}

export async function GET() {
  const receipts = loadReceipts();
  return NextResponse.json({
    receipts,
    total: receipts.length,
  });
}

export async function POST(request: NextRequest) {
  try {
    const receipt: VelaReceipt = await request.json();

    const receipts = loadReceipts();
    receipts.unshift(receipt);
    if (receipts.length > MAX_RECEIPTS) {
      receipts.pop();
    }
    saveReceipts(receipts);

    return NextResponse.json({ stored: true, id: receipt.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
