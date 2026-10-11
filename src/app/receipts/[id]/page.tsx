import Link from 'next/link';
import {readRecord} from '@/lib/server/storage';
import type {DecisionReceipt} from '@/lib/types';
export const dynamic='force-dynamic';
export default async function SharedReceipt({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  let receipt:DecisionReceipt;
  try {receipt=await readRecord<DecisionReceipt>('receipts',id);}catch{return <div className="max-w-3xl mx-auto p-6"><h1>Receipt unavailable</h1><p>This receipt may predate durable storage or belong to a different local server.</p><Link href="/receipts">Open local history</Link></div>;}
  return <div className="max-w-3xl mx-auto p-6 space-y-4">
    <h1 className="text-xl">Decision receipt · {receipt.outcome}</h1>
    <p>{receipt.intent.raw} · {receipt.selectedProvider}</p>
    <p className="text-text-secondary">{receipt.failureReason||receipt.policyEvaluation.reasoning}</p>
    <p>Actual output: {receipt.execution?.actualOutput||'Not confirmed'}</p>
    {receipt.execution?.txHash&&<a className="text-accent block" href={`https://bscscan.com/tx/${receipt.execution.txHash}`} target="_blank" rel="noopener noreferrer">Inspect settlement on BscScan</a>}
    <a className="text-accent block" href={`/api/receipts?id=${id}&verify=true`}>Verify checksum and live BSC transfer evidence (JSON)</a>
    <p className="text-xs text-text-muted">Checksum integrity is not proof of historical decision correctness. On-chain evidence proves only the recorded settlement.</p>
    <pre className="bg-surface-1 p-4 rounded-xl text-xs overflow-auto">{JSON.stringify(receipt,null,2)}</pre>
    <Link href="/receipts" className="text-accent">Open receipt history</Link>
  </div>;
}
