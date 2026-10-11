"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import type {TradeFlowStepV2,QuoteSnapshot,SimulationSnapshot,PolicyEvaluation,ExecutionSnapshot,DecisionReceipt} from '@/lib/types';
import {AgenticSigningReview} from '@/components/agent/AgenticSigningReview';
import type {AgenticSigningPreview} from '@/lib/types/agentic';
import {NumberDisplay} from '@/components/shared/NumberDisplay';
import {allowanceOnlyBlocked} from '@/lib/engine/approval-readiness';
interface Props {agenticSigningPreview?:AgenticSigningPreview|null;step:TradeFlowStepV2;quote:QuoteSnapshot|null;simulation:SimulationSnapshot|null;policyEvaluation:PolicyEvaluation|null;onApprove:()=>void;onExecute:()=>void;txHash:string|null;executionMode:'wallet'|'agentic';execution?:ExecutionSnapshot|null;receipt?:DecisionReceipt|null;onRefresh?:()=>void;}
export function ExecutionFlow({step,quote,simulation,policyEvaluation,onApprove,onExecute,txHash,execution,receipt,onRefresh,executionMode,agenticSigningPreview}:Props){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  if(!['quoting','simulating','evaluating','awaiting-approval','executing','verifying','receipt'].includes(step))return null;
  const outcome=receipt?.outcome||execution?.status;
  const confirmed=outcome==='confirmed' && !!txHash;
  const approvalRequired=allowanceOnlyBlocked(policyEvaluation,simulation);
  const blocked=policyEvaluation?.action==='block';
  const expired=!!quote && now-quote.timestamp>=25000;
  return <section className="bg-surface-1 border border-border rounded-xl" aria-live="polite">
    <h3 className="px-4 py-3 border-b border-border text-xs uppercase tracking-wider text-text-secondary">Execution Flow · {executionMode==='agentic'?'Binance MPC signing':'Wallet approval'}</h3>
    <p className="px-4 py-3 border-b border-border text-xs text-text-muted">Quote → {simulation?.scope==='rfq-order'?'Order preflight':'Simulate'} → Policy → Approve → Sign → Settle → Verify → Receipt</p>
    <div className="p-4 space-y-3">
      {step==='quoting' && <p>Getting your wallet-specific quote and preflight…</p>}
      {quote && <dl className="space-y-2 text-sm">
        {quote.action==='sell'&&<div className="flex justify-between"><dt>Stock tokens to sell</dt><dd className="font-mono break-all">{quote.inputAmount}</dd></div>}
        <div className="flex justify-between"><dt>{quote.action==='sell'?'Expected USDT proceeds':'Expected stock tokens'}</dt><dd><NumberDisplay value={quote.toAmount} decimals={6}/></dd></div>
        <div className="flex justify-between"><dt>{quote.action==='sell'?'Normalized shares sold':'Normalized share exposure'}</dt><dd><NumberDisplay value={quote.normalizedShares||0} decimals={6}/></dd></div>
        <div className="flex justify-between"><dt>{quote.action==='sell'?'Quoted proceeds per share':'Quoted cost per share'}</dt><dd><NumberDisplay value={quote.expectedPrice} format="currency"/></dd></div>
        <div className="flex justify-between"><dt>Price impact magnitude</dt><dd><NumberDisplay value={Math.abs(quote.priceImpact)} format="percent"/></dd></div>
        <div className="flex justify-between"><dt>Estimated network fee</dt><dd><NumberDisplay value={quote.tradeFee} format="currency" decimals={4}/></dd></div>
        <div className="flex justify-between"><dt>Signing mode</dt><dd>{quote.executionMode==='RFQ'?'RFQ typed order':'EVM transaction'}</dd></div>
      </dl>}
      {approvalRequired?<p className="text-xs text-warning">Token approval required. After approval confirms, refresh the quote to run the trade simulation.</p>:simulation && <p className={`text-xs ${simulation.status==='SUCCESS'?'text-gain':'text-loss'}`}>{simulation.scope==='rfq-order'?'RFQ order validation':'Transaction simulation'}: {simulation.status.toLowerCase()}{simulation.failReason?` — ${simulation.failReason}`:''}</p>}
      {simulation?.scope==='rfq-order' && <p className="text-xs text-text-muted">Preflight checks order fields and wallet funds. The relayer’s settlement transaction cannot be simulated before it exists; confirmation requires verified BSC transfers.</p>}
      {step==='awaiting-approval' && <>
        {executionMode==='wallet'&&allowanceOnlyBlocked(policyEvaluation,simulation)&&<div className="space-y-2"><p className="text-xs text-text-secondary">The swap is blocked because the router cannot spend your input token yet. Approve only the exact amount, then request a fresh quote and simulation. This approval does not purchase the stock.</p><button onClick={onApprove} disabled={expired} className="w-full min-h-11 rounded-lg border border-accent text-accent disabled:opacity-40">{expired?'Refresh quote before approval':'Approve exact input-token amount'}</button></div>}
        {executionMode==='agentic'&&agenticSigningPreview?<AgenticSigningReview key={agenticSigningPreview.id} preview={agenticSigningPreview} onConfirm={onExecute} expired={now>=agenticSigningPreview.expiresAt}/>:<button onClick={onExecute} disabled={(blocked&&!(executionMode==='agentic'&&allowanceOnlyBlocked(policyEvaluation,simulation)))||!quote||expired} className="w-full min-h-11 rounded-lg bg-accent text-bg-primary disabled:opacity-40">{executionMode==='agentic'&&allowanceOnlyBlocked(policyEvaluation,simulation)?'Review exact approval in Binance':blocked?'Blocked by policy':expired?'Quote expired':executionMode==='agentic'?'Get Binance Signing Preview':'Review & Sign in Wallet'}</button>}
        <p className="text-xs text-text-muted">{approvalRequired?'Approve the exact input-token amount first. No stock trade has been sent.':blocked?'No transaction was sent. Review the failed checks or refresh unavailable data.':executionMode==='agentic'?'Review Binance’s parsed operation and risks, then explicitly confirm signing. App confirmation may also be required. Approval confirmation requires a fresh trade preview.':'You may first need to approve the exact input-token amount. After approval, get a fresh quote before signing the stock order.'}</p>
        <button onClick={onRefresh} className="w-full min-h-11 border border-border rounded-lg text-sm">Refresh quote & preflight</button>
      </>}
      {step==='executing' && <p className="text-sm">{executionMode==='agentic'?'Contacting Binance Agentic Wallet. Your configured App permissions apply.':'Review the request in your wallet. Vela cannot sign without your permission.'}</p>}
      {step==='verifying' && <p className="text-sm">Waiting for settlement and checking actual BSC transfers…</p>}
      {step==='receipt' && <p className={confirmed?'text-gain':outcome==='failed'||outcome==='refused'?'text-loss':'text-warning'}>{confirmed?'Trade confirmed on BSC':outcome==='failed'?'Trade failed':outcome==='refused'?'Trade refused — no order submitted':'Settlement pending — not confirmed'}</p>}
      {txHash && <a className="block text-xs text-accent break-all" href={`https://bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer">View BSC transaction: {txHash.slice(0,12)}…</a>}
      {receipt && <Link className="block text-sm text-accent" href={`/receipts/${receipt.id}`}>View {receipt.outcome==='refused'?'refusal':'decision'} receipt →</Link>}
    </div>
  </section>;
}
