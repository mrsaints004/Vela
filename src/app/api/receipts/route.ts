import { NextRequest, NextResponse } from "next/server";

// In-memory receipt store — serverless compatible.
// Primary receipt storage is client-side (Zustand + localStorage).
// This endpoint serves as a backup log for the current process lifetime.
const receipts: any[] = [];
const MAX_RECEIPTS = 200;

export async function GET() {
  return NextResponse.json({
    receipts,
    total: receipts.length,
  });
}

export async function POST(request: NextRequest) {
  try {
    const receipt = await request.json();

    receipts.unshift(receipt);
    if (receipts.length > MAX_RECEIPTS) {
      receipts.pop();
    }

    return NextResponse.json({ stored: true, id: receipt.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
