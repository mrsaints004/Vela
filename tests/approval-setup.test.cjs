const {test}=require('node:test'),assert=require('node:assert/strict');
const {allowanceOnlyBlocked}=require('../src/lib/engine/approval-readiness.ts');
test('only exact allowance failure can expose approval; other policy and simulation errors stay blocked',()=>{
 const evaluation={checks:[{name:'Preflight',status:'fail'}]},simulation={status:'FAILED',scope:'transaction',failReason:'execution reverted: BEP20: transfer amount exceeds allowance'};
 assert.equal(allowanceOnlyBlocked(evaluation,simulation),true);
 assert.equal(allowanceOnlyBlocked({...evaluation,checks:[...evaluation.checks,{name:'Trade size',status:'fail'}]},simulation),false);
 assert.equal(allowanceOnlyBlocked(evaluation,{...simulation,failReason:'insufficient balance'}),false);
 assert.equal(allowanceOnlyBlocked(evaluation,{...simulation,scope:'rfq-order'}),false);
 assert.equal(allowanceOnlyBlocked(null,simulation),false);
});
test('allowance-only browser approval signs exact allowance and clears executable preview',async()=>{
 const browser=require('../src/lib/browser-wallet.ts'),{useTradeStore}=require('../src/lib/stores/trade.ts'),{parseIntent}=require('../src/lib/engine/intent.ts'),{Interface}=require('ethers');
 const originalSigner=browser.walletSigner,originalFetch=global.fetch;
 const wallet='0x1111111111111111111111111111111111111111',token='0x2222222222222222222222222222222222222222',spender='0x3333333333333333333333333333333333333333';let sent;
 const abi=new Interface(['function approve(address,uint256)']);
 browser.walletSigner=async()=>({address:wallet,provider:{call:async()=> '0x'+'0'.repeat(64)},signer:{sendTransaction:async tx=>{sent=tx;return {wait:async()=>({status:1})};}}});
 global.fetch=async(_,opts)=>{assert.equal(JSON.parse(opts.body).action,'approval-setup');return new Response(JSON.stringify({wallet,spender,inputToken:token,rawInput:'5100000000000000000',expiresAt:Date.now()+25000}),{status:200});};
 try{
  useTradeStore.getState().reset();useTradeStore.setState({step:'awaiting-approval',executionMode:'wallet',intent:parseIntent('Buy $5.1 of AAPL'),previewId:'allowance-only',quote:{timestamp:Date.now()},policyEvaluation:{action:'block',checks:[{name:'Preflight',status:'fail'}]},simulation:{status:'FAILED',scope:'transaction',failReason:'BEP20: transfer amount exceeds allowance'}});
  await useTradeStore.getState().approve();assert.equal(sent.to,token);assert.equal(abi.decodeFunctionData('approve',sent.data)[1],5100000000000000000n);assert.equal(useTradeStore.getState().previewId,null);assert.equal(useTradeStore.getState().quote,null);
  await useTradeStore.getState().execute();assert.match(useTradeStore.getState().error,/No valid execution preview/);
 }finally{browser.walletSigner=originalSigner;global.fetch=originalFetch;useTradeStore.getState().reset();}
});
