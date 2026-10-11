import {signedCall, object} from './client';
export interface AuthRWAToken {
  binanceChainId: string;
  tokenContractAddress: string;
  platformId: string;
  assetType: number;
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl: string;
  decimals: string;
  underlyingTicker: string;
  underlyingName: string;
  tokenToShareRatio: string;
  tags: string[];
  statusInfo: {
    openState: boolean;
    marketStatus: string | null;
    reasonCode: string;
    reasonMsg: string | null;
    nextOpenTime: number | null;
    nextCloseTime: number | null;
  };
  tokenPrice: string;
  referencePrice: string;
  volume24H: string;
  marketCap: string | null;
  peRatioTTM: string | null;
}


let cached: {tokens:AuthRWAToken[];time:number}|null=null;
let pending:Promise<AuthRWAToken[]|null>|null=null;
export async function fetchAuthenticatedTokens(required=false):Promise<AuthRWAToken[]|null> {
  if(!process.env.BINANCE_WEB3_API_KEY||!process.env.BINANCE_WEB3_SECRET_KEY){
    if(required)throw new Error('Authenticated stock data is unavailable: configure BINANCE_WEB3_API_KEY and BINANCE_WEB3_SECRET_KEY in equitytwin/.env.local, then restart the app server. Agentic Wallet sign-in does not configure API credentials.');
    return null;
  }
  if(cached&&Date.now()-cached.time<15000)return cached.tokens;
  if(pending)return pending;
  pending=(async()=>{
    try{
      const {data}=await signedCall('GET','/api/v1/dex/market/rwa/tokens',{binanceChainId:'56'});
      if(!Array.isArray(data))throw new Error('Unexpected RWA token response.');
      const tokens=data.map(v=>{const t=object(v);if(typeof t.tokenContractAddress!=='string'||typeof t.underlyingTicker!=='string'||!t.statusInfo)throw new Error('Incomplete RWA metadata.');return t as unknown as AuthRWAToken;});
      cached={tokens,time:Date.now()};return tokens;
    }finally{pending=null;}
  })();
  return pending;
}
export async function findAuthenticatedRepresentations(ticker:string,required=false){const tokens=await fetchAuthenticatedTokens(required);return tokens?.filter(t=>t.underlyingTicker.toUpperCase()===ticker.toUpperCase()&&String(t.binanceChainId)==='56')||[];}
export async function getReferencePrice(ticker:string){const tokens=await findAuthenticatedRepresentations(ticker);return tokens.map(t=>Number(t.referencePrice)).find(n=>Number.isFinite(n)&&n>0)??null;}
