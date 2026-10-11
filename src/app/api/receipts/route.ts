import { NextRequest, NextResponse } from 'next/server';
import type { DecisionReceipt } from '@/lib/types';
import { readRecord, digest } from '@/lib/server/storage';
import { amountUnits } from '@/lib/api/trading';
import type { Preview } from '@/lib/server/trades';
import { verifySettlement } from '@/lib/server/chain';
export const runtime='nodejs';
export async function GET(request:NextRequest) {
  try {
    const id=request.nextUrl.searchParams.get('id');if(!id) return NextResponse.json({error:'Receipt ID required. Receipt IDs are private share links.'},{status:400});
    const receipt=await readRecord<DecisionReceipt>('receipts',id);
    const {digest:checksum,...payload}=receipt;const integrity=!!checksum && digest(payload)===checksum;
    let chainEvidence=null,verificationError:string|null=null;
    if(request.nextUrl.searchParams.get('verify')==='true' && receipt.execution?.txHash && receipt.walletAddress && receipt.quote?.rawOutput) {
      try {const preview=receipt.previewId?await readRecord<Preview>('previews',receipt.previewId):null;const min=BigInt(receipt.quote.rawOutput)*BigInt(Math.floor((100-receipt.policySnapshot.maxSlippage)*10000))/1000000n;chainEvidence=await verifySettlement(receipt.execution.txHash,receipt.walletAddress,receipt.selectedTokenAddress,receipt.quote.rawInput||amountUnits(String(receipt.intent.amount)),min.toString(),receipt.quote.outputDecimals??18,receipt.quote.timestamp,preview?.swap?.executionMode==='SWAP'?preview.swap:undefined,receipt.intent.action,receipt.quote.inputDecimals??18);}catch(e){verificationError=e instanceof Error?e.message:'Verification unavailable';}
    }
    return NextResponse.json({receipt,integrity,chainEvidence,verificationError,note:'SHA-256 detects modifications; it does not prove the historical decision. Confirmed settlement can be independently checked against BSC Transfer logs. Refusals are application records.'});
  } catch {return NextResponse.json({error:'Receipt unavailable on this local server.'},{status:404});}
}
