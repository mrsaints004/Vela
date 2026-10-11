import {NextRequest,NextResponse} from 'next/server';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {localRequest} from '@/lib/server/agentic-request';
import {guard} from '@/lib/server/request';
import {object} from '@/lib/api/client';
import {walletStatus} from '@/lib/server/agentic-cli';
import {beginSignIn,pairingStatus,signOut,prepareAgentic,previewAgentic,executeAgentic,checkAgenticOperation,settleAgentic,agenticLock,AgenticRefusalError} from '@/lib/server/agentic';
import {defaultPolicy} from '@/lib/server/trades';
import type {ExecutionPolicy} from '@/lib/types';
export const runtime='nodejs';
const capability=randomBytes(32).toString('hex');
export async function GET(request:NextRequest) {
  try{localRequest(request);if(process.env.VELA_AGENTIC_WALLET_ENABLED!=='true')throw new Error('Restart with npm run dev or npm start to enable the loopback-only Agentic Wallet bridge.');return NextResponse.json({capability,localOnly:true},{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Local access required.'},{status:403});}
}
export async function POST(request:NextRequest) {
  try{
    localRequest(request);guard(request);
    if(process.env.VELA_AGENTIC_WALLET_ENABLED!=='true')return NextResponse.json({error:'Agentic Wallet bridge is disabled. Restart with npm run dev or npm start.'},{status:403});
    const token=request.headers.get('x-vela-agentic-token')||'';
    if(token.length!==capability.length||!timingSafeEqual(Buffer.from(token),Buffer.from(capability)))return NextResponse.json({error:'Local Agentic Wallet session expired. Refresh the page.'},{status:401});
    const body=object(await request.json());
    const respond=(value:unknown)=>NextResponse.json(value,{headers:{'Cache-Control':'no-store'}});
    if(body.action==='status')return respond(await walletStatus());
    if(body.action==='pairing-status')return respond(pairingStatus(String(body.jobId)));
    return await agenticLock(async()=>{
      if(body.action==='signin')return respond(await beginSignIn());
      if(body.action==='signout')return respond(await signOut());
      if(body.action==='prepare'&&!['buy','sell'].includes(String(body.intentAction)))throw new Error('Unsupported trade direction.');
      if(body.action==='prepare')return respond(await prepareAgentic({raw:String(body.raw||''),action:body.intentAction==='sell'?'sell':'buy',unit:body.unit==='tokens'?'tokens':body.unit==='usd'?'usd':'shares',sellAll:body.sellAll===true,ticker:String(body.ticker).toUpperCase(),amount:Number(body.amount)},String(body.tokenAddress),body.policy as ExecutionPolicy||defaultPolicy()));
      const id=String(body.previewId||'');
      if(body.action==='signing-preview')return respond(await previewAgentic(id));
      if(body.action==='execute')return respond(await executeAgentic(id,String(body.operationId),body.confirmed===true));
      if(body.action==='operation-status')return respond(await checkAgenticOperation(id,String(body.operationId)));
      if(body.action==='settlement')return respond(await settleAgentic(id));
      return NextResponse.json({error:'Unsupported Agentic Wallet operation.'},{status:400});
    });
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Agentic Wallet request failed.',receipt:e instanceof AgenticRefusalError?e.receipt:undefined},{status:400});}
}
