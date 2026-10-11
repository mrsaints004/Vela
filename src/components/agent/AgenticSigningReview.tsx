'use client';
import {useState} from 'react';
import type {AgenticSigningPreview} from '@/lib/types/agentic';
export function AgenticSigningReview({preview,onConfirm,expired}:{preview:AgenticSigningPreview;onConfirm:()=>void;expired:boolean}) {
  const [confirmed,setConfirmed]=useState(false);
  return <section className="border border-accent/30 rounded-xl p-4 space-y-3">
    <h4 className="text-sm font-medium">Review Binance {preview.operation==='approval'?'input-token approval':preview.operation==='rfq-sign'?'stock order signature':'swap transaction'}</h4>
    <p className="text-sm">{preview.action==='sell'?'Stock tokens to sell:':'Purchase budget:'} {preview.amount} {preview.action==='sell'?'stock tokens':'USDT'} on BSC. {preview.operation==='approval'?'This approval does not execute the trade. Review the exact allowance below; it may first reset an existing allowance to zero. Request a fresh trade quote after confirmation.':'The exact stock output and expiry are shown in the quote and signing payload.'}</p>
    <p className="text-xs text-text-secondary">{preview.requireConfirmation?'Binance App confirmation is also required.':'Binance can sign directly within your configured permissions after you confirm below.'}</p>
    <dl className="text-xs space-y-1"><dt className="text-text-secondary">Signing wallet</dt><dd className="font-mono break-all">{preview.wallet}</dd><dt className="text-text-secondary">Stock token contract</dt><dd className="font-mono break-all">{preview.token}</dd><dt className="text-text-secondary">Approval spender</dt><dd className="font-mono break-all">{preview.spender}</dd></dl>
    <p className="text-xs text-text-secondary">Review the parsed operation, risk details and authority changes. Raw contract values below are in smallest token units, not dollars.</p>
    {[['Parsed operation',preview.parsed],['Binance risk details',preview.risks],['Authority changes',preview.authorityChanges],['Exact signing payload',preview.payload]].map(([label,value])=><details key={String(label)} open={label!=='Exact signing payload'} className="text-xs"><summary className="min-h-11 flex items-center cursor-pointer">{String(label)}</summary><pre className="bg-surface-2 rounded-lg p-3 overflow-auto max-h-48 text-[11px]">{JSON.stringify(value,null,2)}</pre></details>)}
    <label className="flex gap-2 items-start min-h-11 text-xs text-text-secondary"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1"/>I reviewed this exact Binance signing operation and authorize it. I understand the token and contract risks.</label>
    <button disabled={!confirmed||expired} onClick={onConfirm} className="bg-accent text-bg-primary rounded-lg w-full min-h-11 text-sm disabled:opacity-40">{expired?'Signing preview expired — refresh':'Confirm & Sign with Agentic Wallet'}</button>
  </section>;
}
