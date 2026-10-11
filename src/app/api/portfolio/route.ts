import { NextRequest,NextResponse } from 'next/server';
import {getWalletBalances} from '@/lib/api/wallet';
import {fetchBSCTokens} from '@/lib/api/rwa';
import {PROVIDER_NAMES} from '@/lib/types';
import {isAddress} from 'ethers';
export async function GET(request:NextRequest){
  const wallet=request.nextUrl.searchParams.get('wallet');if(!wallet||!isAddress(wallet))return NextResponse.json({error:'Valid wallet address required.'},{status:400});
  try{const [tokens,result]=await Promise.all([fetchBSCTokens(),getWalletBalances(wallet)]);
    const holdings=result.balances.flatMap(b=>{const t=tokens.find(t=>t.contractAddress.toLowerCase()===b.tokenAddress.toLowerCase());return t&&Number(b.balance)>0?[{ticker:t.ticker,symbol:b.tokenSymbol,provider:PROVIDER_NAMES[t.type],contractAddress:b.tokenAddress,balance:Number(b.balance),balanceUsd:b.balanceUsd?Number(b.balanceUsd):null,tokenPrice:b.tokenPrice?Number(b.tokenPrice):null,decimals:t.d,source:'wallet-api'}]:[];});
    return NextResponse.json({wallet,holdings,totalPositions:holdings.length,totalPortfolioUsd:result.totalUsd,dataSource:'binance-wallet-api',apiLatency:result.latency});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Portfolio unavailable. No zero-value fallback was substituted.'},{status:502});}
}
