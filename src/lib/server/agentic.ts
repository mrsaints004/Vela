import {randomUUID} from 'node:crypto';
import {Contract,TypedDataEncoder,Interface} from 'ethers';
import {runBaw,walletStatus,assertAgenticReady,normalizeSignature,redactAgentic,checkCli} from './agentic-cli';
import {object,textField} from '../api/client';
import {prepare,getPreview,approvals,submit,recordBroadcast,finalize,persistReceipt,type Preview,withPreviewLock} from './trades';
import {saveRecord,readRecord} from './storage';
import {chainProvider,verifyBroadcast} from './chain';
import {USDT_BSC,amountUnits,validateApproval,validateTypedOrder,type EvmTx} from '../engine/order';
import type {ExecutionPolicy,TradeIntent,DecisionReceipt} from '../types';
import type {AgenticSigningPreview,AgenticPairing} from '../types/agentic';
import {validateIntent,MIN_PURCHASE_USD} from '../engine/intent';
import {allowanceOnlyBlocked} from '../engine/approval-readiness';
import {validatePolicy} from '../engine/policy-compiler';
import {parseBinancePairing} from './agentic-pairing';
interface Operation {id:string;previewId:string;requestId:string;wallet:string;kind:'contract-call'|'sign-message';view:AgenticSigningPreview;tx?:EvmTx;attempted:boolean;orderId?:string;result?:Record<string,unknown>}
interface LoginJob {view:AgenticPairing;abort:AbortController;}
const loginJobs=new Map<string,LoginJob>();
const approvalAbi=new Interface(['function approve(address spender,uint256 amount)']);
export async function beginSignIn() {
  await checkCli();
  for(const job of loginJobs.values())if(job.view.status==='waiting'&&job.view.expiresAt>Date.now())return job.view;
  for(const job of loginJobs.values())if(job.view.status==='waiting'&&job.view.expiresAt<=Date.now()){job.abort.abort();job.view.status='failed';job.view.error='Pairing expired. Start a fresh sign-in.';}
  const data=await runBaw(['auth','signin']);
  if(data.status==='ALREADY_CONNECTED')return {alreadyConnected:true,status:await walletStatus()};
  const {url,pairingCode,qrCodeId,expiresAt}=parseBinancePairing(data);
  const view:AgenticPairing={jobId:randomUUID(),urlForWeb:url,pairingCode,expiresAt,status:'waiting'};const job={view,abort:new AbortController()};
  loginJobs.set(view.jobId,job);
  // Keep the blocking verifier alive in this local Node process until App confirmation or timeout.
  void runBaw(['auth','verify','--qrCodeId',qrCodeId],{timeout:330000,signal:job.abort.signal}).then(async()=>{const status=await walletStatus();view.status=status.connected?'connected':'failed';if(!status.connected)view.error='Binance CLI remains unconnected. Start a fresh sign-in.';}).catch(e=>{view.status='failed';view.error=e instanceof Error?e.message:'Sign-in failed.';});
  if(loginJobs.size>10)for(const [id,old]of loginJobs)if(old.view.status!=='waiting')loginJobs.delete(id);
  return view;
}
export function pairingStatus(id:string) {const job=loginJobs.get(id);if(!job)throw new Error('Pairing expired or server restarted. Start sign-in again.');return job.view;}
export async function signOut() {for(const job of loginJobs.values())job.abort.abort();loginJobs.clear();await runBaw(['auth','signout']);return {connected:false};}
export async function prepareAgentic(intent:TradeIntent,token:string,policy:ExecutionPolicy) {
  validateIntent(intent);
  const status=await walletStatus();assertAgenticReady(status,intent.action==='sell'?MIN_PURCHASE_USD:intent.amount);
  const result=await prepare(intent,status.address!,token,{...policy,autonomousExecution:false});
  const p=await readRecord<Preview>('previews',result.previewId);p.signer='binance-agentic-wallet';p.receipt.signer='binance-agentic-wallet';
  const notional=p.notionalUsd??intent.amount;
  if(p.receipt.policyEvaluation.action==='block'){p.receipt=await persistReceipt(p.receipt);await saveRecord('previews',p.id,p);return {...result,receipt:p.receipt};}
  try{assertAgenticReady(status,notional);}catch(e){const reason=e instanceof Error?e.message:'Binance quota check failed';p.receipt.outcome='refused';p.receipt.failureReason=reason;p.receipt.policyEvaluation.action='block';p.receipt.policyEvaluation.checks.push({name:'Binance quotas',status:'fail',message:reason,threshold:'Sufficient USD quota',actual:'Insufficient'});p.receipt=await persistReceipt(p.receipt);await saveRecord('previews',p.id,p);throw new AgenticRefusalError(reason,p.receipt);}
  p.receipt.policyEvaluation.checks.push({name:'Binance wallet quota',status:'pass',message:`${status.settings!.quotaLeft} USD available in the connected wallet quota.`,threshold:`≥ $${notional}`,actual:`$${status.settings!.quotaLeft}`},{name:'Binance Developer Mode',status:'pass',message:'External signing enabled with sufficient Developer Mode quota.',threshold:'Enabled, unexpired and sufficient quota',actual:'Verified'});
  p.receipt.policyEvaluation.reasoning+=' Binance wallet session and external-sign quota checks passed; settings are rechecked before execution.';
  p.receipt.agenticEvidence={wallet:status.address!,cliVersion:status.version||'',quotaLeft:status.settings!.quotaLeft,developerModeQuotaLeft:status.settings!.devMode.dailyLimit-status.settings!.developerModeQuotaUsed,sessionExpireTime:status.settings!.sessionExpireTime,operations:[]};
  p.receipt=await persistReceipt(p.receipt);await saveRecord('previews',p.id,p);
  return {...result,policyEvaluation:p.receipt.policyEvaluation,receipt:p.receipt};
}
async function loadAgentic(id:string,fresh=true,approvalOnly=false) {
  let p:Preview;
  try{p=await getPreview(id,fresh);}catch(error){
    if(!approvalOnly)throw error;
    p=await readRecord<Preview>('previews',id);
    if(!allowanceOnlyBlocked(p.receipt.policyEvaluation,p.receipt.simulation)||!p.quote||!p.swap||!p.pair||p.submitted||p.orderId||validatePolicy(p.policy).length||(fresh&&Date.now()>=p.expiresAt))throw error;
  }
  if(p.signer!=='binance-agentic-wallet')throw new Error('This preview belongs to the browser-wallet flow.');return p;
}
async function writeEvidence(p:Preview,operation:Operation,status:string) {
  const evidence=p.receipt.agenticEvidence;if(evidence){evidence.operations=evidence.operations.filter(o=>o.id!==operation.id);evidence.operations.push({id:operation.id,operation:operation.view.operation,status,requestId:operation.requestId,orderId:operation.orderId,expiresAt:operation.view.expiresAt,requireConfirmation:operation.view.requireConfirmation,parsed:operation.view.parsed,risks:operation.view.risks,authorityChanges:operation.view.authorityChanges});}
  p.receipt=await persistReceipt(p.receipt);await saveRecord('previews',p.id,p);
}
async function buildSigningPreview(p:Preview) {
  const status=await walletStatus();assertAgenticReady(status,p.notionalUsd??Number(p.amount),p.wallet);
  const provider=chainProvider();
  if(BigInt(await provider.send('eth_chainId',[]))!==56n)throw new Error('RPC endpoint is not BSC mainnet.');
  const token=new Contract(p.pair?.inputToken||USDT_BSC,['function allowance(address,address) view returns(uint256)','function balanceOf(address) view returns(uint256)'],provider);
  const allowance=BigInt(await token.allowance(p.wallet,p.spender));
  let tx:EvmTx|undefined,kind:Operation['kind'],operation:AgenticSigningPreview['operation'],args:string[];
  if(BigInt(await token.balanceOf(p.wallet))<BigInt(p.pair?.rawInput||amountUnits(p.amount)))throw new Error('Insufficient input-token balance for this trade.');
  if(allowance<BigInt(p.pair?.rawInput||amountUnits(p.amount))) {
    // Exact approval, including zero-reset for tokens requiring it. Never request unlimited allowance.
    if(allowance>0n)tx={to:p.pair?.inputToken||USDT_BSC,value:'0',data:approvalAbi.encodeFunctionData('approve',[p.spender,0])};
    else {const built=await approvals(p);if(built.txs.length!==1)throw new Error('Multiple approval transactions require separate reviewed previews.');tx=built.txs[0];validateApproval(tx,p.pair?.rawInput||amountUnits(p.amount),p.spender,p.pair?.inputToken||USDT_BSC);}
    kind='contract-call';operation='approval';args=['contract-call','preview','--binanceChainId','56','--from',p.wallet,'--to',tx.to,'--value',tx.value,'--inputData',tx.data];
  } else if(allowanceOnlyBlocked(p.receipt.policyEvaluation,p.receipt.simulation)) {
    throw new Error('Allowance is now sufficient. Obtain a fresh quote and successful swap simulation before trading.');
  } else if(p.swap!.rfq) {
    const order=p.swap!.rfq.typedData;validateTypedOrder(order,p.wallet,p.token,p.amount,p.quote!.rawOutput!,p.policy.maxSlippage,p.pair);
    const typed=TypedDataEncoder.getPayload(order.domain,order.types,order.message);
    const message=JSON.stringify({method:'eth_signTypedData_v4',params:[p.wallet,JSON.stringify(typed)]});
    kind='sign-message';operation='rfq-sign';args=['sign-message','preview','--binanceChainId','56','--signType','EIP712','--message',message];
  } else {
    tx=p.swap!;kind='contract-call';operation='swap';args=['contract-call','preview','--binanceChainId','56','--from',p.wallet,'--to',tx.to,'--value',tx.value,'--inputData',tx.data];
  }
  const data=await runBaw(args),requestId=textField(data.requestId),expires=Number(data.expiresAt);
  if(!requestId||!Number.isFinite(expires)||expires<=Date.now()||typeof data.requireConfirmation!=='boolean'||!data.risks)throw new Error('Binance signing preview is incomplete or expired.');
  const risks=object(data.risks);if(!Array.isArray(risks.riskDetails)||!risks.addresses||typeof risks.addresses!=='object')throw new Error('Binance signing risk data is incomplete.');
  if(kind==='contract-call'){const sim=object(data.simulationResult);if(sim.simulationCode!=='000000000'||sim.simulationErrorDetail)throw new Error('Binance contract-call simulation did not pass.');}
  if(!(kind==='sign-message'?data.parsedMessage:data.parsedTx))throw new Error('Binance did not return a parsed signing operation.');
  const view:AgenticSigningPreview={id:`agentic-${randomUUID()}`,operation,expiresAt:operation==='approval'?expires:Math.min(expires,p.expiresAt),requireConfirmation:data.requireConfirmation,wallet:p.wallet,token:p.token,amount:p.amount,action:p.receipt.intent.action,inputToken:p.pair?.inputToken||USDT_BSC,spender:p.spender,parsed:redactAgentic(kind==='sign-message'?data.parsedMessage:data.parsedTx),risks:redactAgentic(data.risks),authorityChanges:redactAgentic(object(data.simulationResult||{}).authorityChanges||[]),payload:kind==='sign-message'?p.swap!.rfq!.typedData:tx};
  const op:Operation={id:view.id,previewId:p.id,requestId,wallet:p.wallet,kind,view,tx,attempted:false};
  await saveRecord('previews',op.id,op);await writeEvidence(p,op,'previewed');return {preview:view,receipt:p.receipt};
}
export class AgenticRefusalError extends Error {constructor(message:string,public receipt:DecisionReceipt){super(message);}}
export async function previewAgentic(id:string) {
  const p=await loadAgentic(id,true,true);
  try{return await buildSigningPreview(p);}catch(e){
    const reason=e instanceof Error?e.message:'Binance signing preview failed.';
    p.receipt.outcome='refused';p.receipt.failureReason=reason;p.receipt.execution=null;p.receipt.executionMode='blocked';
    p.receipt.policyEvaluation={...p.receipt.policyEvaluation,action:'block',canExecuteAutonomously:false,reasoning:reason,checks:[...p.receipt.policyEvaluation.checks,{name:'Binance signing preview',status:'fail',message:reason,threshold:'Successful parsed signing and risk preview',actual:'Refused'}]};
    p.receipt=await persistReceipt(p.receipt);await saveRecord('previews',p.id,p);
    throw new AgenticRefusalError(reason,p.receipt);
  }
}
export async function executeAgentic(id:string,operationId:string,confirmed:boolean) {
  if(confirmed!==true)throw new Error('Explicit confirmation of the displayed Binance signing preview is required.');
  const op=await readRecord<Operation>('previews',operationId);if(op.previewId!==id)throw new Error('Signing preview does not match this trade.');
  if(op.attempted)return checkAgenticOperation(id,operationId);
  const p=await loadAgentic(id,op.view.operation!=='approval',op.view.operation==='approval');
  if(Date.now()>=op.view.expiresAt)throw new Error('Binance signing preview expired. Request a new preview.');
  const status=await walletStatus();assertAgenticReady(status,p.notionalUsd??Number(p.amount),p.wallet);
  if(Date.now()>=op.view.expiresAt)throw new Error('Binance signing preview expired during permission checks. Refresh before signing.');
  // Persist before making an irreversible call. A timeout cannot cause automatic re-execution.
  op.attempted=true;p.receipt.execution={status:'pending',txHash:null,blockNumber:null,gasUsed:null,timestamp:Date.now()};await saveRecord('previews',op.id,op);await writeEvidence(p,op,'execution-requested');
  try {op.result=await runBaw([op.kind,'execute','--requestId',op.requestId]);op.orderId=textField(op.result.orderId);await saveRecord('previews',op.id,op);return consumeResult(p,op);}
  catch(e){await writeEvidence(p,op,'execution-uncertain');throw e;}
}
async function consumeResult(p:Preview,op:Operation):Promise<{status:string;receipt:DecisionReceipt;operationId?:string;message?:string}> {
  if(p.receipt.outcome==='confirmed'||p.receipt.outcome==='failed')return {status:p.receipt.outcome,receipt:p.receipt,message:p.receipt.failureReason};
  const result=op.result!;const status=textField(result.status);
  if(['REJECTED','EXPIRED','FAILED'].includes(status)){p.receipt.outcome='failed';p.receipt.failureReason=`Binance ${status.toLowerCase()} the signing request.`;p.receipt.execution={status:'failed',txHash:null,blockNumber:null,gasUsed:null,timestamp:Date.now(),error:p.receipt.failureReason};await writeEvidence(p,op,status.toLowerCase());return {status:'failed',receipt:p.receipt,message:`Binance ${status.toLowerCase()} the signing request. No trade success was recorded.`};}
  if(op.kind==='sign-message'&&status==='COMPLETED') {
    if(!p.orderId){try{await loadAgentic(p.id);await submit(p,normalizeSignature(result));}catch(e){if(!p.submitted){p.receipt.outcome='refused';p.receipt.failureReason=e instanceof Error?e.message:'Signature could not be submitted.';p.receipt.execution=null;}await writeEvidence(p,op,p.submitted?'rfq-submission-uncertain':'signature-not-submitted');throw e;}}
    await writeEvidence(p,op,'rfq-submitted');return {status:'submitted',receipt:p.receipt};
  }
  if(op.kind==='contract-call'&&textField(result.txHash)) {
    const hash=textField(result.txHash);await verifyBroadcast(hash,p.wallet,op.tx!);
    if(op.view.operation==='approval') {
      const receipt=await chainProvider().getTransactionReceipt(hash);
      if(!receipt)return {status:'pending',receipt:p.receipt,operationId:op.id,message:'Approval broadcast. Waiting for BSC confirmation.'};
      if(receipt.status!==1){p.receipt.outcome='failed';p.receipt.failureReason='Approval reverted on BSC.';p.receipt.execution={status:'failed',txHash:hash,blockNumber:receipt.blockNumber,gasUsed:receipt.gasUsed.toString(),timestamp:Date.now(),error:p.receipt.failureReason};await writeEvidence(p,op,'approval-failed');return {status:'failed',receipt:p.receipt,message:'Approval reverted on BSC. No stock order submitted.'};}
      p.receipt.execution=null;await writeEvidence(p,op,'approval-confirmed');return {status:'approval-confirmed',receipt:p.receipt,message:'Approval confirmed. Get a fresh trade quote and Binance signing preview.'};
    }
    await recordBroadcast(p,hash);await writeEvidence(p,op,'swap-broadcast');return {status:'submitted',receipt:p.receipt};
  }
  await writeEvidence(p,op,status==='PENDING_CONFIRMATION'?'awaiting-app-confirmation':'pending');
  return {status:'pending',operationId:op.id,receipt:p.receipt,message:status==='PENDING_CONFIRMATION'?'Approve or reject this request in Binance App.':'Binance signing is still pending.'};
}
export async function checkAgenticOperation(id:string,operationId:string) {
  const op=await readRecord<Operation>('previews',operationId);if(op.previewId!==id||!op.attempted)throw new Error('No matching executed signing request.');
  const p=await loadAgentic(id,false,op.view.operation==='approval');if(p.receipt.outcome==='confirmed'||p.receipt.outcome==='failed')return {status:p.receipt.outcome,receipt:p.receipt,message:p.receipt.failureReason};
  if(p.submitted)return settleAgentic(id);
  const current=await walletStatus();if(current.address?.toLowerCase()!==p.wallet.toLowerCase())throw new Error('Sign in to the original Agentic Wallet to recover this operation.');
  if(!op.result)throw new Error('Execution outcome is unknown. Inspect Binance App and wallet history before retrying; Vela will not execute this request twice.');
  if(op.kind==='sign-message'&&op.result.status==='PENDING_CONFIRMATION')op.result=await runBaw(['sign-message','result','--order-id',op.orderId!]);
  if(op.kind==='contract-call'&&!textField(op.result.txHash)) {
    // Contract execute has no documented result command. Correlate an exact confirmed call from wallet history.
    const history=await runBaw(['wallet','tx-history','--binanceChainId','56','--size','100','--startTime',String(p.receipt.timestamp),'--type','all']);
    const transactions=Array.isArray(history.transactions)?history.transactions:[];
    for(const value of transactions){const tx=object(value);const hashes=[textField(tx.txHash),...(Array.isArray(tx.txHashList)?tx.txHashList.map(h=>textField(object(h).txHash)):[])];for(const hash of hashes.filter(Boolean)){try{await verifyBroadcast(hash,p.wallet,op.tx!);const actual=await chainProvider().getTransactionReceipt(hash);if(actual){const block=await chainProvider().getBlock(actual.blockNumber);if(!block||block.timestamp*1000<p.receipt.timestamp-1000)continue;}op.result={...op.result,txHash:hash};break;}catch{/* Unrelated transactions do not establish this operation. */}}if(textField(op.result.txHash))break;}
  }
  await saveRecord('previews',op.id,op);return consumeResult(p,op);
}
export async function settleAgentic(id:string){const p=await loadAgentic(id,false);const result=await finalize(p);if(result.receipt?.outcome==='confirmed'){result.receipt.executionMode='agentic';result.receipt=await persistReceipt(result.receipt);p.receipt=result.receipt;await saveRecord('previews',id,p);}return result;}
export const agenticLock=<T>(task:()=>Promise<T>)=>withPreviewLock('agentic-wallet-session',task);
