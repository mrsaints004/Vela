const {test}=require('node:test'),assert=require('node:assert/strict');
const rwa=require('../src/lib/api/authenticated-rwa.ts'),client=require('../src/lib/api/client.ts');
test('public discovery remains available but execution explains missing authenticated credentials',async()=>{
 const key=process.env.BINANCE_WEB3_API_KEY,secret=process.env.BINANCE_WEB3_SECRET_KEY;
 try{delete process.env.BINANCE_WEB3_API_KEY;delete process.env.BINANCE_WEB3_SECRET_KEY;assert.equal(await rwa.fetchAuthenticatedTokens(),null);await assert.rejects(rwa.findAuthenticatedRepresentations('NVDA',true),/equitytwin\/\.env.local.*Agentic Wallet sign-in/);}
 finally{if(key===undefined)delete process.env.BINANCE_WEB3_API_KEY;else process.env.BINANCE_WEB3_API_KEY=key;if(secret===undefined)delete process.env.BINANCE_WEB3_SECRET_KEY;else process.env.BINANCE_WEB3_SECRET_KEY=secret;}
});
test('authenticated BSC metadata matches chain identifiers returned as strings or numbers',async()=>{
 const key=process.env.BINANCE_WEB3_API_KEY,secret=process.env.BINANCE_WEB3_SECRET_KEY,original=client.signedCall;
 try{process.env.BINANCE_WEB3_API_KEY='fixture';process.env.BINANCE_WEB3_SECRET_KEY='fixture';client.signedCall=async()=>({data:[56,'56',1].map((chain,i)=>({binanceChainId:chain,underlyingTicker:'NVDA',tokenContractAddress:'0x'+String(i+1).repeat(40),statusInfo:{openState:false}}))});const result=await rwa.findAuthenticatedRepresentations('nvda',true);assert.equal(result.length,2);}
 finally{client.signedCall=original;if(key===undefined)delete process.env.BINANCE_WEB3_API_KEY;else process.env.BINANCE_WEB3_API_KEY=key;if(secret===undefined)delete process.env.BINANCE_WEB3_SECRET_KEY;else process.env.BINANCE_WEB3_SECRET_KEY=secret;}
});
