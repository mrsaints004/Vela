const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {Wallet,Interface,JsonRpcProvider}=require('ethers');
const order=require('../src/lib/engine/order.ts');
const {parseIntent,validateIntent}=require('../src/lib/engine/intent.ts');
const stock='0x2222222222222222222222222222222222222222',spender='0x3333333333333333333333333333333333333333';
function typed(wallet,raw='2500000',output=order.amountUnits('6')){return {domain:{name:'Test sell',chainId:56,verifyingContract:spender},types:{Order:[{name:'sellToken',type:'address'},{name:'buyToken',type:'address'},{name:'receiver',type:'address'},{name:'sellAmount',type:'uint256'},{name:'buyAmount',type:'uint256'},{name:'validTo',type:'uint256'}]},message:{sellToken:stock,buyToken:order.USDT_BSC,receiver:wallet,sellAmount:raw,buyAmount:output,validTo:Math.floor(Date.now()/1000)+300}};}
test('sell intent accepts all or explicit token quantity and rejects ambiguous sizing',()=>{
  for(const text of ['Sell all NVDA','Sell all my NVDA tokens','Sell 0.01 tokens of NVDA','Sell 0.01 NVDA tokens'])validateIntent(parseIntent(text));
  assert.equal(parseIntent('Sell all NVDA').sellAll,true);
  assert.equal(parseIntent('Sell 0.01 tokens of NVDA').amount,0.01);
  for(const text of ['Sell $6 of NVDA','Sell 2 shares of NVDA','Sell 50% of NVDA','Sell 0 tokens of NVDA','Sell -1 tokens of NVDA'])assert.throws(()=>validateIntent(parseIntent(text)));
  assert.throws(()=>validateIntent({...parseIntent('Sell all NVDA'),ticker:'AAPL'}));
  assert.throws(()=>validateIntent({...parseIntent('Sell all NVDA'),sellAll:false}));
});
test('sell quotes, swap builds and approvals use the stock token and its raw units',async()=>{
  const trading=require('../src/lib/api/trading.ts'),original=global.fetch;
  const oldKey=process.env.BINANCE_WEB3_API_KEY,oldSecret=process.env.BINANCE_WEB3_SECRET_KEY;
  process.env.BINANCE_WEB3_API_KEY='test';process.env.BINANCE_WEB3_SECRET_KEY='test';
  const wallet=Wallet.createRandom().address,pair={inputToken:stock,outputToken:order.USDT_BSC,rawInput:'2500000'},abi=new Interface(['function approve(address,uint256)']);
  let unsafe=false;
  global.fetch=async(url)=>{const u=new URL(url);assert.equal(u.searchParams.get('binanceChainId'),'56');
    let data;
    if(u.pathname.endsWith('/approve-transaction')){assert.equal(u.searchParams.get('tokenContractAddress'),stock);assert.equal(u.searchParams.get('approveAmount'),'2500000');data=[{to:stock,data:abi.encodeFunctionData('approve',[spender,2500000n]),value:'0'}];}
    else{assert.equal(u.searchParams.get('fromTokenAddress'),stock);assert.equal(u.searchParams.get('toTokenAddress'),order.USDT_BSC);assert.equal(u.searchParams.get('amount'),'2500000');
      data=u.pathname.endsWith('/quote')?[{quoteId:'sell-quote',executionMode:'RFQ',fromTokenAmount:'2500000',toTokenAmount:order.amountUnits('6'),fromToken:{tokenContractAddress:stock,isHoneyPot:unsafe},toToken:{tokenContractAddress:order.USDT_BSC,decimal:'18',isHoneyPot:false},approveTarget:spender,priceImpactPercent:'0.1'}]:{executionMode:'RFQ',rfq:{vendor:'CowSwap',orderId:'sell-quote',typedDataToSign:typed(wallet)}};
    }return new Response(JSON.stringify({code:0,data}),{status:200});};
  try{assert.equal((await trading.getQuote(stock,'2.5',wallet,pair)).quotes[0].isHoneyPot,false);unsafe=true;assert.equal((await trading.getQuote(stock,'2.5',wallet,pair)).quotes[0].isHoneyPot,true);await trading.buildSwap(stock,'2.5',wallet,'sell-quote','0.5',pair);const txs=await trading.getApproval('2.5','CowSwap',spender,pair);order.validateApproval(txs[0],'2500000',spender,stock);assert.throws(()=>order.validateApproval(txs[0],'2500000',spender));}
  finally{global.fetch=original;if(oldKey===undefined)delete process.env.BINANCE_WEB3_API_KEY;else process.env.BINANCE_WEB3_API_KEY=oldKey;if(oldSecret===undefined)delete process.env.BINANCE_WEB3_SECRET_KEY;else process.env.BINANCE_WEB3_SECRET_KEY=oldSecret;}
});
test('sell RFQ validation binds reversed pair, exact stock spend and USDT minimum',()=>{
  const wallet=Wallet.createRandom().address,pair={inputToken:stock,outputToken:order.USDT_BSC,rawInput:'2500000'},t=typed(wallet);
  order.validateTypedOrder(t,wallet,stock,'2.5',order.amountUnits('6'),0.5,pair);
  for(const patch of [{sellToken:order.USDT_BSC},{buyToken:stock},{sellAmount:'2500001'},{buyAmount:order.amountUnits('5')},{receiver:spender}])assert.throws(()=>order.validateTypedOrder({...t,message:{...t.message,...patch}},wallet,stock,'2.5',order.amountUnits('6'),0.5,pair));
  assert.throws(()=>order.validateTypedOrder(t,wallet,stock,'2.5',order.amountUnits('6'),0.5));
});
test('sell settlement requires net stock outflow and USDT inflow with correct decimals',async()=>{
  const {verifySettlement}=require('../src/lib/server/chain.ts');const wallet=Wallet.createRandom().address,abi=new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);
  const log=(address,from,to,value)=>({address,...abi.encodeEventLog(abi.getEvent('Transfer'),[from,to,value])});
  const receipt={status:1,blockNumber:123,gasUsed:21000n,logs:[log(stock,wallet,spender,2500000n),log(order.USDT_BSC,spender,wallet,BigInt(order.amountUnits('6')))]};
  const originals={send:JsonRpcProvider.prototype.send,receipt:JsonRpcProvider.prototype.getTransactionReceipt,block:JsonRpcProvider.prototype.getBlock};
  JsonRpcProvider.prototype.send=async()=>'0x38';JsonRpcProvider.prototype.getTransactionReceipt=async()=>receipt;JsonRpcProvider.prototype.getBlock=async()=>({timestamp:100});
  const args=['0x'+'1'.repeat(64),wallet,stock,'2500000',order.amountUnits('5.9'),18,99000,undefined,'sell',6];
  try{const result=await verifySettlement(...args);assert.equal(result.actualInput,'2.5');assert.equal(result.actualOutput,'6.0');await assert.rejects(verifySettlement(...[...args.slice(0,8),'buy',6]));await assert.rejects(verifySettlement(...[...args.slice(0,4),order.amountUnits('6.1'),...args.slice(5)]));receipt.logs.push(log(stock,spender,wallet,2500000n));await assert.rejects(verifySettlement(...args));}
  finally{JsonRpcProvider.prototype.send=originals.send;JsonRpcProvider.prototype.getTransactionReceipt=originals.receipt;JsonRpcProvider.prototype.getBlock=originals.block;}
});
test('sell-all pipeline freezes balance, signs, submits and persists verified USDT settlement',async()=>{
  const root=await mkdtemp(join(tmpdir(),'vela-sell-')),oldRoot=process.env.VELA_DATA_DIR;process.env.VELA_DATA_DIR=root;
  const rwa=require('../src/lib/api/rwa.ts'),auth=require('../src/lib/api/authenticated-rwa.ts'),comparison=require('../src/lib/engine/comparison.ts'),trading=require('../src/lib/api/trading.ts'),chain=require('../src/lib/server/chain.ts'),trades=require('../src/lib/server/trades.ts'),storage=require('../src/lib/server/storage.ts');
  const {createPolicyFromPreset}=require('../src/lib/engine/policy-compiler.ts');
  const originals=[];const mock=(m,k,v)=>{originals.push([m,k,m[k]]);m[k]=v;};
  const wallet=Wallet.createRandom(),t=typed(wallet.address),token={ticker:'NVDA',contractAddress:stock,type:1,chainId:'56',multiplier:'0.01',d:6};
  mock(rwa,'findRepresentations',async()=>[token]);mock(auth,'findAuthenticatedRepresentations',async()=>[{tokenContractAddress:stock,tokenToShareRatio:'0.01',decimals:'6',tokenPrice:'2.4',referencePrice:'240',volume24H:'100000',statusInfo:{openState:true,reasonCode:''}}]);
  mock(comparison,'fetchRepresentations',async()=>[{token,provider:'Ondo',tokenToShareRatio:0.01,price:2.4,impliedSharePrice:240,volume24h:100000,klines:[]}]);
  let balance='2500000',quoted=0,submitted=0;
  mock(chain,'walletFunds',async()=>({usdt:'0',native:'1',stock:balance,stockDecimals:6}));
  mock(trading,'getQuote',async(_,amount,address,pair)=>{quoted++;assert.equal(address,wallet.address);assert.equal(pair.inputToken,stock);assert.equal(pair.outputToken,order.USDT_BSC);const output=(BigInt(pair.rawInput)*2400000000000n).toString();return {quotes:[{quoteId:'sell-q',vendorName:'CowSwap',executionMode:'RFQ',toDecimals:18,toTokenAmount:output,tradeFee:'0',priceImpactPercent:'0.1',isHoneyPot:false,routes:[],approveTarget:spender,isBest:true}]};});
  mock(trading,'buildSwap',async()=>({swap:{executionMode:'RFQ',rfq:{typedData:t,vendor:'CowSwap',orderId:'sell-q'}}}));
  mock(trading,'submitOrder',async()=>{submitted++;return {orderId:'sell-order',status:'PENDING'};});
  mock(trading,'getOrder',async()=>({status:'FILLED',txHash:'0x'+'1'.repeat(64)}));
  mock(chain,'verifySettlement',async(hash,address,asset,limit,min,decimals,since,tx,direction,inputDecimals)=>{assert.equal(direction,'sell');assert.equal(inputDecimals,6);assert.equal(decimals,18);assert.equal(limit,'2500000');return {txHash:hash,status:'confirmed',actualInput:'2.5',actualOutput:'6.0',actualOutputRaw:order.amountUnits('6'),chainId:56};});
  try{
    const prepared=await trades.prepare(parseIntent('Sell all NVDA'),wallet.address,stock,createPolicyFromPreset('moderate'));assert.equal(prepared.receipt.outcome,'pending');assert.equal(prepared.quote.inputAmount,'2.5');assert.equal(prepared.quote.toAmount,6);assert.equal(prepared.quote.rawInput,'2500000');
    const p=await trades.getPreview(prepared.previewId);balance='10000000';assert.equal(p.pair.rawInput,'2500000');
    const signature=await wallet.signTypedData(t.domain,t.types,t.message);await trades.submit(p,signature);assert.equal(submitted,1);const result=await trades.finalize(await trades.getPreview(p.id,false));assert.equal(result.status,'confirmed');const saved=await storage.readRecord('receipts',result.receipt.id);assert.equal(saved.intent.action,'sell');assert.equal(saved.execution.actualOutput,'6.0');
    const tooMuch=await trades.prepare(parseIntent('Sell 11 tokens of NVDA'),wallet.address,stock,createPolicyFromPreset('moderate'));assert.equal(tooMuch.receipt.outcome,'refused');assert.match(tooMuch.receipt.failureReason,/Insufficient stock/);
    balance='0';const empty=await trades.prepare(parseIntent('Sell all NVDA'),wallet.address,stock,createPolicyFromPreset('moderate'));assert.equal(empty.receipt.outcome,'refused');assert.equal(quoted,1);assert.equal(submitted,1);
  }finally{for(const [m,k,v]of originals.reverse())m[k]=v;if(oldRoot===undefined)delete process.env.VELA_DATA_DIR;else process.env.VELA_DATA_DIR=oldRoot;await rm(root,{recursive:true,force:true});}
});
test('Agentic Wallet sell previews sign the reversed order and submit only the reviewed quantity',async()=>{
  const root=await mkdtemp(join(tmpdir(),'vela-agentic-sell-')),oldRoot=process.env.VELA_DATA_DIR;process.env.VELA_DATA_DIR=root;
  const cli=require('../src/lib/server/agentic-cli.ts'),agentic=require('../src/lib/server/agentic.ts'),chain=require('../src/lib/server/chain.ts'),trades=require('../src/lib/server/trades.ts'),trading=require('../src/lib/api/trading.ts'),storage=require('../src/lib/server/storage.ts');
  const {createPolicyFromPreset}=require('../src/lib/engine/policy-compiler.ts'),{randomUUID}=require('node:crypto');
  const wallet=Wallet.createRandom(),t=typed(wallet.address),id=randomUUID(),now=Date.now(),policy=createPolicyFromPreset('moderate');
  const pair={inputToken:stock,outputToken:order.USDT_BSC,rawInput:'2500000'};
  const receipt=await trades.persistReceipt({id:`vela-${randomUUID()}`,previewId:id,timestamp:now,walletAddress:wallet.address,intent:parseIntent('Sell all NVDA'),selectedTokenAddress:stock,policySnapshot:policy,policyEvaluation:{action:'allow',checks:[]},simulation:{status:'SUCCESS'},quote:{action:'sell',rawInput:pair.rawInput,inputDecimals:6,rawOutput:order.amountUnits('6'),toAmount:6,timestamp:now,outputDecimals:18},outcome:'pending',execution:null,signer:'binance-agentic-wallet',agenticEvidence:{operations:[]}});
  await storage.saveRecord('previews',id,{id,wallet:wallet.address,token:stock,amount:'2.5',pair,inputDecimals:6,notionalUsd:6,decimals:18,quote:receipt.quote,receipt,policy,spender,expiresAt:now+25000,signer:'binance-agentic-wallet',swap:{executionMode:'RFQ',rfq:{typedData:t,vendor:'CowSwap',orderId:'sell-q'}}});
  const originals={run:cli.runBaw,status:cli.walletStatus,provider:chain.chainProvider,submit:trading.submitOrder,prepare:trades.prepare};let executionCount=0;
  const signature=await wallet.signTypedData(t.domain,t.types,t.message);
  cli.walletStatus=async()=>({connected:true,address:wallet.address,lock:'UNLOCKED',settings:{quotaLeft:10,sessionExpireTime:new Date(Date.now()+3600000).toISOString(),devMode:{enabled:true,expiresAt:Math.floor(Date.now()/1000)+3600,dailyLimit:10,balanceExceeded:false},developerModeQuotaUsed:0}});
  chain.chainProvider=()=>({send:async()=>'0x38',call:async tx=>{assert.equal(tx.to.toLowerCase(),stock.toLowerCase());return '0x'+2500000n.toString(16).padStart(64,'0');}});
  cli.runBaw=async args=>{assert.equal(args[0],'sign-message');if(args[1]==='preview'){const message=JSON.parse(args[args.indexOf('--message')+1]);const payload=JSON.parse(message.params[1]);assert.equal(payload.message.sellToken,stock);assert.equal(payload.message.buyToken.toLowerCase(),order.USDT_BSC.toLowerCase());assert.equal(payload.message.sellAmount,'2500000');return {requestId:'sell-preview',expiresAt:Date.now()+20000,requireConfirmation:false,parsedMessage:{sellToken:stock},risks:{riskDetails:[],addresses:{}}};}executionCount++;return {status:'COMPLETED',signature:signature.slice(2,130),signatureRecovery:signature.slice(130)};};
  trading.submitOrder=async(request,signed,swap)=>{assert.equal(request,id);assert.equal(signed,signature);assert.equal(swap.rfq.typedData.message.sellAmount,'2500000');return {orderId:'agentic-sell-order'};};
  trades.prepare=async()=>({previewId:id,policyEvaluation:receipt.policyEvaluation,receipt});
  try{const checked=await agentic.prepareAgentic(parseIntent('Sell all NVDA'),stock,policy);assert.ok(checked.policyEvaluation.checks.some(c=>c.name==='Binance wallet quota'&&c.threshold==='≥ $6'));const prepared=await agentic.previewAgentic(id);assert.equal(prepared.preview.action,'sell');assert.equal(prepared.preview.inputToken,stock);await assert.rejects(agentic.executeAgentic(id,prepared.preview.id,false),/Explicit confirmation/);assert.equal(executionCount,0);const result=await agentic.executeAgentic(id,prepared.preview.id,true);assert.equal(result.status,'submitted');assert.equal(executionCount,1);const stored=await storage.readRecord('previews',id);assert.equal(stored.pair.rawInput,'2500000');assert.equal(stored.orderId,'agentic-sell-order');}
  finally{cli.runBaw=originals.run;cli.walletStatus=originals.status;chain.chainProvider=originals.provider;trading.submitOrder=originals.submit;trades.prepare=originals.prepare;if(oldRoot===undefined)delete process.env.VELA_DATA_DIR;else process.env.VELA_DATA_DIR=oldRoot;await rm(root,{recursive:true,force:true});}
});
test('browser sells approve the stock token and safely reset a partial allowance',async()=>{
  const browser=require('../src/lib/browser-wallet.ts'),{useTradeStore}=require('../src/lib/stores/trade.ts'),{createPolicyFromPreset}=require('../src/lib/engine/policy-compiler.ts');
  const oldSigner=browser.walletSigner,oldFetch=global.fetch,wallet=Wallet.createRandom().address;
  const abi=new Interface(['function approve(address,uint256)']);
  const pair={inputToken:stock,outputToken:order.USDT_BSC,rawInput:'2500000'},quote={action:'sell',rawInput:pair.rawInput,rawOutput:order.amountUnits('6'),timestamp:Date.now(),toAmount:6};
  try{for(const allowance of [0n,1n]){
    let sent=0,approvalRequests=0;
    const provider={call:async tx=>{assert.equal(tx.to.toLowerCase(),stock.toLowerCase());return '0x'+(tx.data.startsWith('0x70a08231')?2500000n:allowance).toString(16).padStart(64,'0');}};
    browser.walletSigner=async()=>({address:wallet,provider,signer:{sendTransaction:async tx=>{sent++;assert.equal(tx.to,stock);const decoded=abi.parseTransaction(tx);assert.equal(decoded.args[0].toLowerCase(),spender);assert.equal(decoded.args[1],allowance>0n?0n:2500000n);return {wait:async()=>({status:1})};}}});
    global.fetch=async(_,opts)=>{const body=JSON.parse(opts.body);if(body.action==='preview')return new Response(JSON.stringify({wallet,spender,pair,quote,policy:createPolicyFromPreset('moderate'),amount:'2.5',expiresAt:Date.now()+25000,swap:{executionMode:'RFQ'}}),{status:200});assert.equal(body.action,'approval');approvalRequests++;return new Response(JSON.stringify({txs:[{to:stock,value:'0',data:abi.encodeFunctionData('approve',[spender,2500000n])}]}),{status:200});};
    useTradeStore.getState().reset();useTradeStore.setState({step:'awaiting-approval',executionMode:'wallet',intent:parseIntent('Sell 2.5 tokens of NVDA'),previewId:'reviewed-sell',quote,simulation:{status:'SUCCESS'},policyEvaluation:{action:'allow'},selectedTokenAddress:stock});
    await useTradeStore.getState().execute();assert.equal(sent,1);assert.equal(approvalRequests,allowance>0n?0:1);assert.equal(useTradeStore.getState().step,'comparing');assert.equal(useTradeStore.getState().previewId,null);
  }}finally{browser.walletSigner=oldSigner;global.fetch=oldFetch;useTradeStore.getState().reset();}
});
