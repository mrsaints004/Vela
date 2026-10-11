import { randomUUID } from 'node:crypto';
import { Contract, formatUnits, parseUnits, verifyTypedData, isAddress } from 'ethers';
import type { DecisionReceipt, ExecutionPolicy, QuoteSnapshot, SimulationSnapshot, TradeIntent } from '../types';
import { findRepresentations } from '../api/rwa';
import { findAuthenticatedRepresentations } from '../api/authenticated-rwa';
import { getQuote, buildSwap, validateTypedOrder, simulateTransaction, getApproval, submitOrder, getOrder, amountUnits, type SwapTx } from '../api/trading';
import { fetchRepresentations, calculateEffectiveCosts, getMarketStatus, buildDiscoveredRepresentations, generateRecommendation, buildRepresentation } from '../engine/comparison';
import { buildRepresentationsConsidered, buildSelectionReasoning } from '../engine/receipt';
import { evaluatePolicyV2 } from '../engine/policy';
import { createPolicyFromPreset, validatePolicy } from '../engine/policy-compiler';
import { saveRecord, readRecord, digest } from './storage';
import { chainProvider, walletFunds, verifySettlement, verifyBroadcast } from './chain';
import {allowanceOnlyBlocked} from '../engine/approval-readiness';
import {USDT_BSC} from '../engine/order';
import type {TradePair} from '../api/trading';
import { validateIntent } from '../engine/intent';
export interface Preview { signer?: "browser-wallet"|"binance-agentic-wallet"; id: string; wallet: string; amount: string; token: string; decimals: number; quote: QuoteSnapshot | null; swap: SwapTx | null; policy: ExecutionPolicy; spender: string; expiresAt: number; receipt: DecisionReceipt; orderId?: string; submitted?: boolean; signature?:string;pair?:TradePair;inputDecimals?:number;notionalUsd?:number }
export async function persistReceipt(receipt: DecisionReceipt) {
  const { digest: previousDigest, ...body } = receipt; void previousDigest;
  const saved = { ...body, digest: digest(body), verificationUrl: `/api/receipts?id=${receipt.id}` };
  // Include the verification URL in the reproducible checksum.
  const { digest: checksum, ...payload } = saved; void checksum; saved.digest = digest(payload);
  await saveRecord('receipts', saved.id, saved); return saved;
}
export async function discover(ticker: string, amount: number, policy: ExecutionPolicy) {
  const tokens = await findRepresentations(ticker);
  if (!tokens.length) throw new Error(`No BSC stock representations found for ${ticker}.`);
  const auth = await findAuthenticatedRepresentations(ticker);
  const enriched = tokens.map(t => { const a=auth.find(a=>a.tokenContractAddress.toLowerCase()===t.contractAddress.toLowerCase()); return a ? {...t, multiplier:a.tokenToShareRatio, d:Number(a.decimals)} : t; });
  const representations = await fetchRepresentations(enriched);
  for(const token of enriched){const a=auth.find(a=>a.tokenContractAddress.toLowerCase()===token.contractAddress.toLowerCase());if(!representations.some(r=>r.token.contractAddress.toLowerCase()===token.contractAddress.toLowerCase()) && a && Number(a.tokenPrice)>0) representations.push(buildRepresentation(token,[]));}
  // Prefer authenticated price/ratio/volume; candles are a labelled fallback only.
  for (const rep of representations) {
    const a=auth.find(a=>a.tokenContractAddress.toLowerCase()===rep.token.contractAddress.toLowerCase());
    if (a && Number(a.tokenPrice)>0) { rep.lastUpdated=Date.now();rep.price=Number(a.tokenPrice); rep.impliedSharePrice=rep.price/rep.tokenToShareRatio; rep.volume24h=Number(a.volume24H)||0; }
  }
  const referencePrice = auth.map(a=>Number(a.referencePrice)).find(n=>n>0 && Number.isFinite(n)) ?? null;
  let marketStatus=getMarketStatus();
  if (auth.length) {
    const info=auth[0].statusInfo;
    marketStatus={...marketStatus,staleDuration:info.openState?null:marketStatus.staleDuration,isOpen:info.openState,referenceStale:!info.openState,status:info.openState?'regular':marketStatus.status==='regular'?'closed':marketStatus.status,nextOpenTime:info.nextOpenTime?new Date(info.nextOpenTime).toISOString():marketStatus.nextOpenTime};
  }
  const costs=calculateEffectiveCosts(representations,referencePrice??undefined,marketStatus);
  const recommended=costs[0] ? representations.find(r=>r.provider===costs[0].provider) : null;
  const discovered=buildDiscoveredRepresentations(representations,costs);
  const evaluation=evaluatePolicyV2({policy,marketStatus,costs,representations,selectedProvider:recommended?.provider||'',amount,referencePrice,discoveryOnly:true});
  const recommendation=generateRecommendation(representations,costs,referencePrice,marketStatus);
  return {representations,discovered,costs,marketStatus,referencePrice,recommended,policyEvaluation:evaluation,recommendation:recommendation.recommendation,factors:recommendation.factors,representationsConsidered:buildRepresentationsConsidered(discovered,costs,recommended?.provider||''),selectionReasoning:buildSelectionReasoning(recommended?.provider||'',costs,marketStatus,referencePrice)};
}
export async function prepare(intent: TradeIntent, wallet: string, tokenAddress: string, policy: ExecutionPolicy) {
  validateIntent(intent);
  if (!isAddress(wallet) || !isAddress(tokenAddress)) throw new Error('Connect a valid BSC wallet and choose a supported stock.');
  const policyErrors=validatePolicy(policy); if(policyErrors.length) throw new Error(policyErrors.join('; '));
  const selling=intent.action==='sell';
  const context=await discover(intent.ticker,selling?5:intent.amount,policy);
  const selected=context.representations.find(r=>r.token.contractAddress.toLowerCase()===tokenAddress.toLowerCase());
  if(!selected) throw new Error('Selected token does not match the requested stock on BSC.');
  let quote: QuoteSnapshot|null=null, swap:SwapTx|null=null, simulation:SimulationSnapshot|null=null, problem='', spender='';
  let pair:TradePair|undefined,inputDecimals=18,inputAmount=String(intent.amount),notionalUsd=selling?NaN:intent.amount;
  try {
    const metadata=(await findAuthenticatedRepresentations(intent.ticker)).find(t=>t.tokenContractAddress.toLowerCase()===tokenAddress.toLowerCase());
    if(!metadata || !Number.isFinite(Number(metadata.tokenToShareRatio)) || Number(metadata.tokenToShareRatio)<=0 || typeof metadata.statusInfo.openState!=='boolean') throw new Error('Verified share ratio and reference-market state are unavailable for this stock.');
    if(/halt|pause|suspend|corporate|maintenance/i.test(`${metadata.statusInfo.reasonCode} ${metadata.statusInfo.reasonMsg||''}`))throw new Error('This stock has a trading halt or corporate-action restriction. No order will be submitted.');
    let funds:Awaited<ReturnType<typeof walletFunds>>|undefined;
    if(selling){
      inputDecimals=Number(metadata.decimals);
      if(!Number.isInteger(inputDecimals)||inputDecimals<0||inputDecimals>36)throw new Error('Verified stock decimals are unavailable.');
      funds=await walletFunds(wallet,tokenAddress);
      if(funds.stockDecimals!==inputDecimals||funds.stock===undefined)throw new Error('On-chain stock decimals or balance could not be verified.');
      const rawInput=intent.sellAll?funds.stock:parseUnits(String(intent.amount),inputDecimals).toString();
      if(BigInt(rawInput)<=0n)throw new Error('No stock tokens available in this account and selected issuer.');
      if(BigInt(rawInput)>BigInt(funds.stock))throw new Error('Insufficient stock-token balance for this sale.');
      inputAmount=formatUnits(rawInput,inputDecimals);
      pair={inputToken:tokenAddress,outputToken:USDT_BSC,rawInput};
      notionalUsd=Number(inputAmount)*Number(metadata.tokenPrice);
      if(!Number.isFinite(notionalUsd)||notionalUsd<=0)throw new Error('Stock USD valuation is unavailable.');
    }else pair={inputToken:USDT_BSC,outputToken:tokenAddress,rawInput:amountUnits(inputAmount)};
    const amount=inputAmount, result=await getQuote(tokenAddress,amount,wallet,pair);
    const q=result.quotes.find(q=>q.isBest)||result.quotes[0]; if(!q) throw new Error('No executable quote returned for this amount.');
    spender=q.approveTarget; if(!isAddress(spender)) throw new Error('Quote approval spender is missing.');
    const toAmount=Number(formatUnits(q.toTokenAmount,q.toDecimals)), shares=(selling?Number(inputAmount):toAmount)*selected.tokenToShareRatio;
    if(!Number.isFinite(shares)||shares<=0) throw new Error('Invalid normalized quote output.');
    const timestamp=Date.now();
    quote={action:intent.action,inputToken:pair.inputToken,outputToken:pair.outputToken,rawInput:pair.rawInput,inputDecimals,inputAmount,quoteId:q.quoteId,provider:selected.provider,vendorName:q.vendorName,fromAmount:Number(inputAmount),toAmount,normalizedShares:shares,expectedPrice:selling?toAmount/shares:(intent.amount+Number(q.tradeFee||0))/shares,priceImpact:Number(q.priceImpactPercent),tradeFee:Number(q.tradeFee||0),gasFee:Number(q.tradeFee||0),routes:q.routes.map(r=>`${r.dexName} (${r.percent}%)`),isHoneyPot:q.isHoneyPot,timestamp,expiresAt:timestamp+25000,outputDecimals:q.toDecimals,rawOutput:q.toTokenAmount,executionMode:q.executionMode};
    if(selling){if(q.toDecimals!==18)throw new Error('USDT output decimals differ from BSC USDT.');notionalUsd=Math.max(notionalUsd,toAmount);}
    if(!Number.isFinite(quote.priceImpact)||!Number.isFinite(quote.tradeFee)) throw new Error('Quote has invalid impact or fees.');
    if(q.isHoneyPot) throw new Error('Token was flagged as a honeypot.');
    swap=(await buildSwap(tokenAddress,amount,wallet,q.quoteId,String(policy.maxSlippage),pair)).swap;
    if(swap.executionMode!==q.executionMode) throw new Error('Execution mode changed after quote.');
    funds=funds||await walletFunds(wallet);
    if(!selling&&BigInt(funds.usdt)<BigInt(amountUnits(amount))) throw new Error(`Insufficient BSC USDT. Available: ${formatUnits(funds.usdt,18)} USDT; requested: ${amount}.`);
    if(BigInt(funds.native)===0n) throw new Error('Your wallet has no BNB on BSC for token-approval gas.');
    if(swap.rfq) {
      validateTypedOrder(swap.rfq.typedData,wallet,tokenAddress,amount,q.toTokenAmount,policy.maxSlippage,pair);
      simulation={status:'SUCCESS',failReason:null,balanceChanges:[],timestamp:Date.now(),scope:'rfq-order'};
    } else {
      const result=await simulateTransaction(wallet,swap.to,swap.value,swap.data);
      simulation={...result.simulation,timestamp:Date.now(),scope:'transaction'};
    }
  } catch(e) { problem=e instanceof Error?e.message:'Preflight failed'; simulation={status:'FAILED',failReason:problem,balanceChanges:[],timestamp:Date.now(),scope:swap?.rfq?'rfq-order':'transaction'}; }
  const evaluation=evaluatePolicyV2({policy,marketStatus:context.marketStatus,costs:context.costs,representations:context.representations,selectedProvider:selected.provider,amount:notionalUsd,quote,simulation,referencePrice:context.referencePrice});
  const id=randomUUID();
  const receipt:DecisionReceipt={id:`vela-${randomUUID()}`,previewId:id,timestamp:Date.now(),walletAddress:wallet,intent,policySnapshot:policy,representationsConsidered:buildRepresentationsConsidered(context.discovered,context.costs,selected.provider),selectedProvider:selected.provider,selectedTokenAddress:tokenAddress,selectionReasoning:'Provider selected for a wallet-specific executable preview. Discovery ranking is a reference-risk score, not a cheapest-fill guarantee.',marketStatus:context.marketStatus,referencePrice:context.referencePrice,referenceStaleness:context.marketStatus.staleDuration,recommendation:context.recommendation,factors:context.factors,policyEvaluation:evaluation,simulation,quote,execution:null,executionMode:evaluation.action==='block'?'blocked':'manual',expectedSlippage:quote?.priceImpact??null,actualSlippage:null,agentIdentity:null,intentMethod:'regex',outcome:evaluation.action==='block'?'refused':'pending',failureReason:problem||undefined};
  const saved=await persistReceipt(receipt);
  const preview:Preview={id,wallet,token:tokenAddress,amount:inputAmount,pair,inputDecimals,notionalUsd,decimals:quote?.outputDecimals??selected.token.d,policy,quote,swap,spender,expiresAt:quote?.expiresAt??Date.now(),receipt:saved};
  await saveRecord('previews',id,preview);
  return {previewId:id,quote,simulation,policyEvaluation:evaluation,receipt:saved,expiresAt:preview.expiresAt,executionMode:swap?.executionMode,spender};
}
export async function getPreview(id:string, fresh=true):Promise<Preview> {
  const p=await readRecord<Preview>('previews',id);
  if(p.receipt.policyEvaluation.action==='block'||!p.quote||!p.swap||p.receipt.simulation?.status!=='SUCCESS') throw new Error('Trade was refused. Get a new valid preview.');
  if(fresh && (p.receipt.outcome==='refused'||p.receipt.outcome==='failed'||p.receipt.outcome==='confirmed'||p.submitted)) throw new Error('This preview has already completed or been submitted. Check its receipt or create a new preview.');
  if(fresh && validatePolicy(p.policy).length) throw new Error('Policy is invalid or expired. Create a new preview.');
  if(fresh && Date.now()>=p.expiresAt) throw new Error('Quote expired. Refresh the preview before signing.');
  return p;
}
export async function approvals(p:Preview) {
  if(!isAddress(p.spender)) throw new Error('Cannot verify approval spender.');
  const txs=await getApproval(p.amount,p.quote!.vendorName,p.spender,p.pair);
  return {txs,spender:p.spender};
}
export async function approvalSetup(id:string){
 const p=await readRecord<Preview>('previews',id);
 if(p.signer==='binance-agentic-wallet'||p.submitted||p.orderId||!p.quote||!p.swap||!p.pair||!isAddress(p.spender)||Date.now()>=p.expiresAt||validatePolicy(p.policy).length||!allowanceOnlyBlocked(p.receipt.policyEvaluation,p.receipt.simulation))throw new Error('No fresh allowance-only approval preview. Refresh the quote and review all checks.');
 const funds=await walletFunds(p.wallet,p.pair.inputToken);
 if(BigInt(funds.native)===0n||BigInt(funds.stock||'0')<BigInt(p.pair.rawInput))throw new Error('Insufficient input tokens or BNB for approval.');
 const token=new Contract(p.pair.inputToken,['function allowance(address,address) view returns(uint256)'],chainProvider());
 if(BigInt(await token.allowance(p.wallet,p.spender))>=BigInt(p.pair.rawInput))throw new Error('Allowance is already sufficient. Refresh and rerun the exact swap simulation.');
 return {wallet:p.wallet,spender:p.spender,inputToken:p.pair.inputToken,rawInput:p.pair.rawInput,expiresAt:p.expiresAt};
}
export async function submit(p:Preview, signature:string) {
  if(!p.swap?.rfq) throw new Error('RFQ order required.');
  if(!/^0x[0-9a-f]{130}$/i.test(signature)) throw new Error('Invalid wallet signature.');
  const t=p.swap.rfq.typedData;
  if(verifyTypedData(t.domain,t.types,t.message,signature).toLowerCase()!==p.wallet.toLowerCase()) throw new Error('Signature does not match the reviewed wallet/order.');
  if(p.orderId) return {orderId:p.orderId};
  p.signature=signature;p.submitted=true;
  p.receipt.execution={status:'pending',txHash:null,blockNumber:null,gasUsed:null,timestamp:Date.now()};p.receipt=await persistReceipt(p.receipt);await saveRecord('previews',p.id,p);
  const order=await submitOrder(p.id,signature,p.swap); p.orderId=order.orderId;
  p.receipt.execution={status:'pending',txHash:null,blockNumber:null,gasUsed:null,timestamp:Date.now(),orderId:order.orderId};p.receipt=await persistReceipt(p.receipt);await saveRecord('previews',p.id,p);return {...order,receipt:p.receipt};
}
export async function recordBroadcast(p:Preview,hash:string) {
  if(p.swap?.executionMode!=='SWAP') throw new Error('Direct swap required.');
  if(p.receipt.execution?.txHash && p.receipt.execution.txHash!==hash) throw new Error('A different transaction is already recorded.');
  await verifyBroadcast(hash,p.wallet,p.swap);p.submitted=true;
  p.receipt.execution={status:'pending',txHash:hash,blockNumber:null,gasUsed:null,timestamp:Date.now()};p.receipt=await persistReceipt(p.receipt);await saveRecord('previews',p.id,p);return {receipt:p.receipt};
}
export async function finalize(p:Preview, hash?:string) {
  if(p.receipt.outcome==='confirmed'||p.receipt.outcome==='failed') return {status:p.receipt.outcome,receipt:p.receipt};
  let txHash=p.receipt.execution?.txHash||hash;
  if(p.swap?.executionMode==='SWAP' && txHash && !p.submitted) { await recordBroadcast(p,txHash); }
  if(p.swap?.rfq) {
    if(!p.orderId && p.submitted && p.signature) { const recovered=await submitOrder(p.id,p.signature,p.swap);p.orderId=recovered.orderId;p.receipt.execution={status:'pending',txHash:null,blockNumber:null,gasUsed:null,timestamp:Date.now(),orderId:p.orderId};p.receipt=await persistReceipt(p.receipt);await saveRecord('previews',p.id,p); }
    if(!p.orderId) throw new Error('No signed order has been submitted.');
    const order=await getOrder(p.orderId);
    if(['FAILED','EXPIRED','CANCELLED'].includes(order.status)) {
      p.receipt.outcome='failed';p.receipt.failureReason=`RFQ settlement ${order.status.toLowerCase()}`;p.receipt.execution={status:'failed',txHash:null,blockNumber:null,gasUsed:null,timestamp:Date.now(),orderId:p.orderId,error:p.receipt.failureReason};
      p.receipt=await persistReceipt(p.receipt);await saveRecord('previews',p.id,p);return {status:'failed',receipt:p.receipt};
    }
    if(order.status!=='FILLED'||!order.txHash) return {status:'pending',orderId:p.orderId,receipt:p.receipt};
    txHash=order.txHash;
  }
  if(!txHash||!p.quote?.rawOutput) throw new Error('Missing confirmed settlement hash.');
  const minOutput=BigInt(p.quote.rawOutput)*BigInt(Math.floor((100-p.policy.maxSlippage)*10000))/1000000n;
  let verified;
  try { verified=await verifySettlement(txHash,p.wallet,p.token,p.pair?.rawInput||amountUnits(p.amount),minOutput.toString(),p.decimals,p.quote.timestamp,p.swap?.executionMode==='SWAP'?p.swap:undefined,p.receipt.intent.action,p.inputDecimals??18); } catch(e) { if(e instanceof Error && e.message==='Settlement is not yet confirmed successfully on BSC.') return {status:'pending',receipt:p.receipt}; if(e instanceof Error && e.message==='Settlement reverted on BSC.') {p.receipt.outcome='failed';p.receipt.failureReason=e.message;p.receipt.execution={status:'failed',txHash,blockNumber:null,gasUsed:null,timestamp:Date.now(),error:e.message};p.receipt=await persistReceipt(p.receipt);await saveRecord('previews',p.id,p);return {status:'failed',receipt:p.receipt};} throw e; }
  p.receipt.execution={...verified,orderId:p.orderId};p.receipt.outcome='confirmed';p.receipt.executionMode=p.signer==='binance-agentic-wallet'?'agentic':'manual';p.receipt.failureReason=undefined;
  const expected=p.quote.toAmount; p.receipt.actualSlippage=expected>0?(1-Number(verified.actualOutput)/expected)*100:null;
  p.receipt=await persistReceipt(p.receipt);await saveRecord('previews',p.id,p);return {status:'confirmed',receipt:p.receipt};
}
export const defaultPolicy=()=>createPolicyFromPreset('moderate');

// Serialize mutations for a preview in this single local Node runtime.
const locks=new Map<string,Promise<void>>();
export async function withPreviewLock<T>(id:string,task:()=>Promise<T>):Promise<T> {
  const previous=locks.get(id)||Promise.resolve();let release!:()=>void;
  const current=new Promise<void>(resolve=>{release=resolve;});locks.set(id,current);
  await previous;
  try{return await task();}finally{release();if(locks.get(id)===current)locks.delete(id);}
}
