import {create} from 'zustand';
import {Contract, Interface, isAddress} from 'ethers';
import type {TradeFlowStepV2,TradeIntent,DiscoveredRepresentation,QuoteSnapshot,SimulationSnapshot,ExecutionSnapshot,PolicyEvaluation,ExecutionPolicy,RecommendationFactor,DecisionReceipt,MarketStatus,EffectiveCost,PolicyPreset,RepresentationConsidered} from '../types';
import type {TradePair} from '../api/trading';
import type {SwapTx,EvmTx} from '../engine/order';
import {USDT_BSC,amountUnits,validateTypedOrder,validateApproval} from '../engine/order';
import {parseIntent,validateIntent} from '../engine/intent';
import {createPolicyFromPreset} from '../engine/policy-compiler';
import {useReceiptsStore} from './receipts';
import {agenticRequest,AgenticRequestError} from '../api/agentic-wallet';
import type {AgenticSigningPreview} from '../types/agentic';
import {walletSigner,walletError} from '../browser-wallet';
import {allowanceOnlyBlocked} from '../engine/approval-readiness';
interface TradeState {
  step:TradeFlowStepV2;intent:TradeIntent|null;intentMethod:'ai'|'regex'|null;policy:ExecutionPolicy;policyEvaluation:PolicyEvaluation|null;
  representations:DiscoveredRepresentation[];costs:EffectiveCost[];representationsConsidered:RepresentationConsidered[];recommendation:string|null;factors:RecommendationFactor[];selectionReasoning:string|null;
  selectedProvider:string|null;selectedTokenAddress:string|null;quote:QuoteSnapshot|null;simulation:SimulationSnapshot|null;execution:ExecutionSnapshot|null;
  marketStatus:MarketStatus|null;referencePrice:number|null;receipt:DecisionReceipt|null;error:string|null;executionMode:'wallet'|'agentic';agenticPlan:null;agenticSigningPreview:AgenticSigningPreview|null;agenticOperationId:string|null;previewId:string|null;
  submitIntent:(raw:string)=>Promise<void>;setPolicy:(policy:ExecutionPolicy)=>void;setPolicyPreset:(preset:Exclude<PolicyPreset,'custom'>)=>void;updatePolicyField:(field:string,value:unknown)=>void;
  selectProvider:(provider:string,tokenAddress:string)=>void;fetchQuoteAndSimulate:()=>Promise<void>;approve:()=>void;execute:()=>Promise<void>;setExecutionMode:(mode:'wallet'|'agentic')=>void;reset:()=>void;invalidate:()=>void;
}
const defaults=()=>({step:'idle' as TradeFlowStepV2,intent:null,intentMethod:null,policy:createPolicyFromPreset('moderate'),policyEvaluation:null,representations:[],costs:[],representationsConsidered:[],recommendation:null,factors:[],selectionReasoning:null,selectedProvider:null,selectedTokenAddress:null,quote:null,simulation:null,execution:null,marketStatus:null,referencePrice:null,receipt:null,error:null,executionMode:'wallet' as const,agenticPlan:null,agenticSigningPreview:null,agenticOperationId:null,previewId:null});
let revision=0,executing=false;
async function api<T>(body:object):Promise<T>{const res=await fetch('/api/trade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json();if(!res.ok)throw new Error(data.error||`Request failed (${res.status})`);return data as T;}
const save=(receipt:DecisionReceipt)=>useReceiptsStore.getState().addReceipt(receipt);
export const useTradeStore=create<TradeState>((set,get)=>({
  ...defaults(),
  submitIntent:async(raw)=>{
    if(executing)return;const version=++revision,policy=get().policy,executionMode=get().executionMode;set({...defaults(),policy,executionMode,step:'parsing'});
    try {
      // Never let a fuzzy/AI fallback turn an explicitly unsupported order into a purchase.
      if(/\bshares?\b/i.test(raw))throw new Error('Share-count orders are not supported yet. Enter a dollar amount.');
      let intent=parseIntent(raw),method:'ai'|'regex'='regex';
      if(/\b(sell|dump|exit|liquidate|close)\b/i.test(raw)&&(!intent||intent.action!=='sell'||intent.unit!=='tokens'))throw new Error('Use Sell all NVDA or Sell 0.01 tokens of NVDA. Dollar and percentage sells are unsupported.');
      if(!intent){const res=await fetch('/api/parse-intent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({raw})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Could not parse your request.');intent=data.intent;method=data.method==='ai'?'ai':'regex';}
      if(!intent)throw new Error('Try Buy $5 of NVDA.');validateIntent(intent);if(version!==revision)return;
      set({intent,intentMethod:method,step:'discovering'});
      const data=await api<{representations:DiscoveredRepresentation[];costs:EffectiveCost[];representationsConsidered:RepresentationConsidered[];recommendation:string;factors:RecommendationFactor[];selectionReasoning:string;policyEvaluation:PolicyEvaluation;marketStatus:MarketStatus;referencePrice:number|null;recommended:{provider:string;tokenAddress:string}|null}>({action:'discover',ticker:intent.ticker,amount:intent.amount,intentAction:intent.action,unit:intent.unit,raw:intent.raw,sellAll:intent.sellAll,policy});
      if(version!==revision)return;set({...data,step:'comparing',selectedProvider:intent.action==='sell'?null:data.recommended?.provider||null,selectedTokenAddress:intent.action==='sell'?null:data.recommended?.tokenAddress||null,selectionReasoning:intent.action==='sell'?'Choose the issuer whose tokens you hold. A sale cannot switch issuers.':data.selectionReasoning});
    }catch(e){if(version===revision)set({step:'error',error:walletError(e)});}
  },
  setPolicy:(policy)=>{if(executing)return;revision++;set({policy:{...policy,autonomousExecution:false},quote:null,simulation:null,policyEvaluation:null,previewId:null,receipt:null,agenticSigningPreview:null,agenticOperationId:null,step:get().representations.length?'comparing':'idle'});},
  setPolicyPreset:(preset)=>get().setPolicy(createPolicyFromPreset(preset)),
  updatePolicyField:(field,value)=>{if(!(field in get().policy))return;get().setPolicy({...get().policy,[field]:value,preset:'custom'});},
  selectProvider:(provider,tokenAddress)=>{if(executing)return;revision++;set({selectedProvider:provider,selectedTokenAddress:tokenAddress,quote:null,simulation:null,policyEvaluation:null,previewId:null,receipt:null,agenticSigningPreview:null,agenticOperationId:null,step:'comparing',selectionReasoning:'Selected by you. Get a fresh wallet-specific preview before signing.'});},
  fetchQuoteAndSimulate:async()=>{
    if(executing)return;const state=get();if(!state.intent||!state.selectedTokenAddress)return;let version=++revision;set({step:'quoting',error:null,quote:null,simulation:null,previewId:null,agenticSigningPreview:null,agenticOperationId:null});
    try {
      if(state.executionMode==='agentic'){
        const data=await agenticRequest<{previewId:string;quote:QuoteSnapshot|null;simulation:SimulationSnapshot|null;policyEvaluation:PolicyEvaluation;receipt:DecisionReceipt}>({action:'prepare',ticker:state.intent.ticker,intentAction:state.intent.action,unit:state.intent.unit,sellAll:state.intent.sellAll,raw:state.intent.raw,amount:String(state.intent.amount),tokenAddress:state.selectedTokenAddress,policy:state.policy});
        if(version!==revision)return;save(data.receipt);set({...data,step:'awaiting-approval',error:data.receipt.failureReason||null});return;
      }
      const {address}=await walletSigner();if(get().intent!==state.intent||get().selectedTokenAddress!==state.selectedTokenAddress)return;version=++revision;set({step:'quoting'});
      const data=await api<{previewId:string;quote:QuoteSnapshot|null;simulation:SimulationSnapshot|null;policyEvaluation:PolicyEvaluation;receipt:DecisionReceipt}>({action:'full-flow',ticker:state.intent.ticker,intentAction:state.intent.action,unit:state.intent.unit,sellAll:state.intent.sellAll,raw:state.intent.raw,amount:String(state.intent.amount),tokenAddress:state.selectedTokenAddress,walletAddress:address,policy:state.policy});
      if(version!==revision)return;save(data.receipt);set({...data,step:'awaiting-approval',error:data.receipt.failureReason||null});
    }catch(e){if(version===revision)set({step:get().representations.length?'comparing':'error',error:walletError(e)});}
  },
  approve:async()=>{
    const s=get();if(executing||s.executionMode!=='wallet'||!s.previewId||!allowanceOnlyBlocked(s.policyEvaluation,s.simulation))return;
    executing=true;set({step:'executing',error:null});
    try{
      const p=await api<{wallet:string;spender:string;inputToken:string;rawInput:string;expiresAt:number}>({action:'approval-setup',previewId:s.previewId});
      const current=await walletSigner();if(current.address.toLowerCase()!==p.wallet.toLowerCase()||Date.now()>=p.expiresAt)throw new Error('Account changed or approval preview expired. Refresh.');
      const token=new Contract(p.inputToken,['function allowance(address,address) view returns(uint256)'],current.provider);
      const allowance=BigInt(await token.allowance(current.address,p.spender));
      if(allowance>=BigInt(p.rawInput))throw new Error('Allowance is sufficient. Refresh the quote and simulation.');
      const amount=allowance>0n?'0':p.rawInput,abi=new Interface(['function approve(address,uint256)']);
      const tx={to:p.inputToken,value:'0',data:abi.encodeFunctionData('approve',[p.spender,amount])};validateApproval(tx,amount,p.spender,p.inputToken);
      const sent=await current.signer.sendTransaction(tx);const confirmed=await sent.wait();if(confirmed?.status!==1)throw new Error('Input-token approval did not confirm.');
      set({step:'comparing',quote:null,simulation:null,previewId:null,policyEvaluation:null,error:allowance>0n?'Allowance reset confirmed. Get a fresh quote to approve the exact amount.':'Exact token approval confirmed. Get a fresh quote and successful simulation before signing the stock trade.'});
    }catch(e){set({step:'awaiting-approval',error:walletError(e)});}finally{executing=false;}
  },setExecutionMode:(executionMode)=>{if(executing)return;revision++;set({executionMode,quote:null,simulation:null,previewId:null,policyEvaluation:null,receipt:null,agenticSigningPreview:null,agenticOperationId:null,step:get().representations.length?'comparing':'idle',error:null});},
  execute:async()=>{
    if(executing)return;const s=get();
    if(!s.previewId||!s.quote||!s.intent||s.policyEvaluation?.action==='block'||s.simulation?.status!=='SUCCESS'){set({error:'No valid execution preview. Refresh the quote and preflight first.'});return;}
    if(s.executionMode==='agentic'){
      executing=true;set({step:'executing',error:null});
      try {
        if(!s.agenticSigningPreview){const result=await agenticRequest<{preview:AgenticSigningPreview;receipt:DecisionReceipt}>({action:'signing-preview',previewId:s.previewId});save(result.receipt);set({step:'awaiting-approval',agenticSigningPreview:result.preview,receipt:result.receipt});return;}
        const operation=s.agenticSigningPreview.id;set({agenticOperationId:operation});
        let result=await agenticRequest<{status:string;receipt:DecisionReceipt;message?:string}>({action:'execute',previewId:s.previewId,operationId:operation,confirmed:true});
        for(let attempt=0;attempt<40;attempt++){save(result.receipt);set({receipt:result.receipt,execution:result.receipt.execution});
          if(result.status==='approval-confirmed'){set({step:'comparing',quote:null,simulation:null,previewId:null,agenticSigningPreview:null,error:result.message||'Approval confirmed. Get a fresh quote.'});return;}
          if(result.status==='confirmed'){set({step:'receipt',error:null});return;}
          if(result.status==='failed'){set({step:'receipt',error:result.message||result.receipt.failureReason||'Binance signing failed.'});return;}
          if(result.status==='submitted')break;
          set({step:'verifying',error:result.message||'Awaiting Binance App confirmation.'});await new Promise(resolve=>setTimeout(resolve,3000));
          result=await agenticRequest({action:'operation-status',previewId:s.previewId,operationId:operation});
        }
        if(result.status!=='submitted'){set({step:'receipt',error:'Agentic signing is still pending. Recheck this receipt before placing another order.'});return;}
        set({step:'verifying',error:null});
        for(let attempt=0;attempt<40;attempt++){const settled=await agenticRequest<{status:string;receipt:DecisionReceipt}>({action:'settlement',previewId:s.previewId});save(settled.receipt);set({receipt:settled.receipt,execution:settled.receipt.execution});if(settled.status!=='pending'){set({step:'receipt',error:settled.receipt.failureReason||null});return;}await new Promise(resolve=>setTimeout(resolve,3000));}
        set({step:'receipt',error:'Agentic Wallet trade is still pending. Recheck settlement in Receipts.'});
      }catch(e){if(e instanceof AgenticRequestError&&e.receipt){save(e.receipt);set({receipt:e.receipt,policyEvaluation:e.receipt.policyEvaluation});}set({step:s.agenticSigningPreview?'receipt':'awaiting-approval',error:walletError(e)});}finally{executing=false;}return;
    }
    executing=true;set({step:'executing',error:null});let submitted=false,txHash:string|undefined;
    try {
      const {provider,address}=await walletSigner();
      const p=await api<{swap:SwapTx;quote:QuoteSnapshot;spender:string;wallet:string;expiresAt:number;policy:ExecutionPolicy;pair?:TradePair;amount?:string}>({action:'preview',previewId:s.previewId});
      if(address.toLowerCase()!==p.wallet.toLowerCase())throw new Error('Wallet account changed. Get a new preview.');
      if(!isAddress(p.spender))throw new Error('Approval spender could not be verified.');
      const inputToken=p.pair?.inputToken||USDT_BSC;
      const token=new Contract(inputToken,['function allowance(address,address) view returns(uint256)','function balanceOf(address) view returns(uint256)'],provider);
      const input=BigInt(p.pair?.rawInput||amountUnits(String(s.intent.amount)));
      if(BigInt(await token.balanceOf(address))<input)throw new Error('Insufficient input-token balance for this trade.');
      const allowance=BigInt(await token.allowance(address,p.spender));
      if(allowance<input){
        if(allowance>0n){
          const resetTx={to:inputToken,value:'0',data:new Interface(['function approve(address,uint256)']).encodeFunctionData('approve',[p.spender,0])};
          validateApproval(resetTx,'0',p.spender,inputToken);
          const latest=await walletSigner();if(latest.address.toLowerCase()!==address.toLowerCase())throw new Error('Wallet account changed.');
          const sent=await latest.signer.sendTransaction(resetTx);const confirmed=await sent.wait();if(confirmed?.status!==1)throw new Error('Allowance reset did not confirm.');
          set({step:'comparing',quote:null,simulation:null,previewId:null,error:'Existing allowance reset to zero. Get a fresh preview for the exact token approval.'});return;
        }
        const approval=await api<{txs:EvmTx[]}>({action:'approval',previewId:s.previewId});
        for(const tx of approval.txs){validateApproval(tx,input.toString(),p.spender,inputToken);const latest=await walletSigner();if(latest.address.toLowerCase()!==address.toLowerCase())throw new Error('Wallet account changed.');const sent=await latest.signer.sendTransaction(tx);const result=await sent.wait();if(result?.status!==1)throw new Error('Approval did not confirm.');}
        // Approval confirmation may consume quote TTL. Never sign the old order afterward.
        set({step:'comparing',quote:null,simulation:null,previewId:null,error:'Token approval confirmed. Get a fresh preview, then review and sign the stock order.'});return;
      }
      if(Date.now()>=p.expiresAt)throw new Error('Quote expired. Refresh before signing.');
      const current=await walletSigner();if(current.address.toLowerCase()!==address.toLowerCase())throw new Error('Wallet account changed.');
      if(p.swap.rfq){
        validateTypedOrder(p.swap.rfq.typedData,address,s.selectedTokenAddress!,p.amount||String(s.intent.amount),p.quote.rawOutput!,p.policy.maxSlippage,p.pair);
        const order=p.swap.rfq.typedData;const signature=await current.signer.signTypedData(order.domain,order.types,order.message);
        submitted=true;
        const response=await api<{orderId:string;receipt:DecisionReceipt}>({action:'submit-order',previewId:s.previewId,signature});submitted=true;save(response.receipt);set({receipt:response.receipt});
        set({step:'verifying',execution:{status:'pending',txHash:null,blockNumber:null,gasUsed:null,timestamp:Date.now(),orderId:response.orderId}});
      }else{
        const tx=await current.signer.sendTransaction({to:p.swap.to,data:p.swap.data,value:p.swap.value});txHash=tx.hash;submitted=true;
        set({step:'verifying',execution:{status:'pending',txHash,blockNumber:null,gasUsed:null,timestamp:Date.now()}});
        const broadcast=await api<{receipt:DecisionReceipt}>({action:'broadcast',previewId:s.previewId,txHash});save(broadcast.receipt);set({receipt:broadcast.receipt});
      }
      for(let attempt=0;attempt<40;attempt++){
        const result=await api<{status:string;receipt?:DecisionReceipt}>({action:'settlement',previewId:s.previewId,txHash});
        if(result.receipt){save(result.receipt);set({receipt:result.receipt,execution:result.receipt.execution});if(result.status!=='pending'){set({step:'receipt',error:result.receipt.failureReason||null});return;}}
        await new Promise(resolve=>setTimeout(resolve,3000));
      }
      set({step:'receipt',error:'Settlement is still pending. Open the receipt and recheck settlement; do not submit another order.'});
    }catch(e){
      const error=walletError(e);set({error,step:submitted?'receipt':'awaiting-approval'});
      if(submitted && txHash && get().receipt){const pending={...get().receipt!,execution:{status:'pending' as const,txHash,blockNumber:null,gasUsed:null,timestamp:Date.now()}};save(pending);set({receipt:pending});}
      if(!submitted){try{const result=await api<{receipt:DecisionReceipt}>({action:'failure',previewId:s.previewId,error});save(result.receipt);set({receipt:result.receipt,execution:result.receipt.execution,step:'receipt'});}catch{/* Preserve the wallet error. */}}
    }finally{executing=false;}
  },
  reset:()=>{if(executing)return;revision++;set({...defaults(),policy:get().policy,executionMode:get().executionMode});},
  invalidate:()=>{if(executing)return;revision++;set({quote:null,simulation:null,previewId:null,policyEvaluation:null,receipt:null,agenticSigningPreview:null,agenticOperationId:null,step:get().representations.length?'comparing':'idle',error:'Wallet account or network changed. Refresh the preview.'});}
}));
