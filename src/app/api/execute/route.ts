import { NextResponse } from 'next/server';
export async function POST() {return NextResponse.json({error:'Use a verified /api/trade preview. Client-supplied execution receipts are no longer accepted.'},{status:410});}
