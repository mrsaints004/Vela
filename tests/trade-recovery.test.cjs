const test = require('node:test');
const assert = require('node:assert/strict');
const {useTradeStore} = require('../src/lib/stores/trade.ts');
const browser = require('../src/lib/browser-wallet.ts');
const {useReceiptsStore} = require('../src/lib/stores/receipts.ts');
const wallet = '0x1111111111111111111111111111111111111111';
const token = '0x2222222222222222222222222222222222222222';
function discover() {
  useTradeStore.getState().reset();
  useTradeStore.setState({step:'comparing',executionMode:'wallet',intent:{raw:'Buy $5 of AAL',ticker:'AAL',amount:5,unit:'usd',action:'buy'},representations:[{provider:'Ondo',tokenAddress:token}],selectedProvider:'Ondo',selectedTokenAddress:token});
}
test('failed quote preserves discovery and can retry without re-entering the intent', async () => {
  const originalFetch=global.fetch, originalSigner=browser.walletSigner, originalSave=useReceiptsStore.getState().addReceipt;
  const saved=[];
  browser.walletSigner=async()=>({address:wallet});
  useReceiptsStore.setState({addReceipt:r=>saved.push(r)});
  try {
    discover();
    global.fetch=async()=>new Response(JSON.stringify({error:'Binance 40375: Minimum order amount is 5 USD.'}),{status:502});
    await useTradeStore.getState().fetchQuoteAndSimulate();
    assert.equal(useTradeStore.getState().step,'comparing');
    assert.equal(useTradeStore.getState().selectedTokenAddress,token);
    assert.match(useTradeStore.getState().error,/40375/);
    assert.equal(useTradeStore.getState().previewId,null);
    assert.equal(saved.length,0);
    const receipt={id:'refused-test-receipt',outcome:'refused',execution:null,failureReason:'Policy refusal'};
    global.fetch=async()=>new Response(JSON.stringify({previewId:'test-preview',quote:null,simulation:{status:'FAILED'},policyEvaluation:{action:'block'},receipt}),{status:200});
    await useTradeStore.getState().fetchQuoteAndSimulate();
    assert.equal(useTradeStore.getState().step,'awaiting-approval');
    assert.equal(saved[0].outcome,'refused');
    assert.equal(useTradeStore.getState().quote,null);
  } finally {global.fetch=originalFetch;browser.walletSigner=originalSigner;useReceiptsStore.setState({addReceipt:originalSave});useTradeStore.getState().reset();}
});
test('a delayed quote cannot replace state after the execution account changes', async () => {
  const originalFetch=global.fetch, originalSigner=browser.walletSigner;
  let resolveResponse, requestStarted;
  const started=new Promise(resolve=>{requestStarted=resolve;});
  browser.walletSigner=async()=>({address:wallet});
  global.fetch=()=>{requestStarted();return new Promise(resolve=>{resolveResponse=resolve;});};
  try {
    discover();
    const pending=useTradeStore.getState().fetchQuoteAndSimulate();
    await started;
    useTradeStore.getState().setExecutionMode('agentic');
    resolveResponse(new Response(JSON.stringify({previewId:'old-account-preview',receipt:{outcome:'pending'}}),{status:200}));
    await pending;
    assert.equal(useTradeStore.getState().executionMode,'agentic');
    assert.equal(useTradeStore.getState().previewId,null);
    assert.equal(useTradeStore.getState().step,'comparing');
  } finally {global.fetch=originalFetch;browser.walletSigner=originalSigner;useTradeStore.getState().reset();}
});
