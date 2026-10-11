import { NextRequest, NextResponse } from 'next/server';
import { discover, prepare, getPreview, approvals, approvalSetup, submit, finalize, recordBroadcast, withPreviewLock, defaultPolicy } from '@/lib/server/trades';
import { guard } from '@/lib/server/request';
import { object } from '@/lib/api/client';
import { readRecord, saveRecord } from '@/lib/server/storage';
import type { ExecutionPolicy } from '@/lib/types';
import { validatePurchaseAmount } from '@/lib/engine/intent';
export const runtime='nodejs';
export async function POST(request:NextRequest) {
  try {
    guard(request); const body=object(await request.json());
    if(body.action==='discover') {
      const ticker=String(body.ticker).toUpperCase(); if(!/^[A-Z0-9.-]{1,15}$/.test(ticker)) throw new Error('Invalid ticker.');
      if(body.intentAction==='sell'){const {validateIntent}=await import('@/lib/engine/intent');validateIntent({raw:String(body.raw||''),action:'sell',ticker,amount:Number(body.amount),unit:body.unit==='tokens'?'tokens':'usd',sellAll:body.sellAll===true});}else validatePurchaseAmount(Number(body.amount));
      const context=await discover(ticker,body.intentAction==='sell'?5:Number(body.amount),body.policy as ExecutionPolicy||defaultPolicy());
      return NextResponse.json({...context,representations:context.discovered,recommended:context.recommended?{provider:context.recommended.provider,tokenAddress:context.recommended.token.contractAddress}:null});
    }
    if(body.action==='full-flow') {
      if(!['buy','sell'].includes(String(body.intentAction)))throw new Error('Unsupported trade direction.');
      return NextResponse.json(await prepare({raw:String(body.raw||''),action:body.intentAction==='sell'?'sell':'buy',ticker:String(body.ticker).toUpperCase(),amount:Number(body.amount),unit:body.unit==='tokens'?'tokens':body.unit==='usd'?'usd':'shares',sellAll:body.sellAll===true},String(body.walletAddress),String(body.tokenAddress),body.policy as ExecutionPolicy||defaultPolicy()));
    }
    const id=String(body.previewId||'');
    return await withPreviewLock(id,async()=>{
    if(body.action==='approval-setup')return NextResponse.json(await approvalSetup(id));
    if(body.action==='broadcast') return NextResponse.json(await recordBroadcast(await getPreview(id,false),String(body.txHash)));
    if(body.action==='settlement') return NextResponse.json(await finalize(await getPreview(id,false),typeof body.txHash==='string'?body.txHash:undefined));
    if(body.action==='preview') {
      const p=await getPreview(id);return NextResponse.json({swap:p.swap,quote:p.quote,spender:p.spender,wallet:p.wallet,expiresAt:p.expiresAt,policy:p.policy,pair:p.pair,inputDecimals:p.inputDecimals,amount:p.amount});
    }
    if(body.action==='approval') return NextResponse.json(await approvals(await getPreview(id)));
    if(body.action==='submit-order') return NextResponse.json(await submit(await getPreview(id),String(body.signature)));
    if(body.action==='failure') {
      const p=await readRecord<import('@/lib/server/trades').Preview>('previews',id);
      if(p.submitted||p.orderId||p.receipt.outcome==='confirmed') throw new Error('Submitted orders must be checked through settlement.');
      p.receipt.outcome='failed';p.receipt.failureReason=String(body.error||'Wallet signing was cancelled or failed.').slice(0,500);
      p.receipt.execution={status:'failed',txHash:null,blockNumber:null,gasUsed:null,timestamp:Date.now(),error:p.receipt.failureReason};
      const {persistReceipt}=await import('@/lib/server/trades');p.receipt=await persistReceipt(p.receipt);await saveRecord('previews',id,p);return NextResponse.json({receipt:p.receipt});
    }
    return NextResponse.json({error:'Unsupported trade action.'},{status:400});
    });
  } catch(e) {return NextResponse.json({error:e instanceof Error?e.message:'Trade request failed.'},{status:400});}
}
