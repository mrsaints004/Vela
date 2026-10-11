/** Browser client for the localhost-only official Binance baw bridge. No credentials are exposed. */
import type {DecisionReceipt} from '../types';
export class AgenticRequestError extends Error {constructor(message:string,public receipt?:DecisionReceipt){super(message);}}
let capability:string|null=null;
export async function agenticRequest<T>(body:object):Promise<T> {
  if(!capability){const res=await fetch('/api/agentic-wallet',{cache:'no-store'});const data=await res.json();if(!res.ok)throw new Error(data.error||'Open Vela on localhost to use Agentic Wallet.');capability=data.capability;}
  const response=await fetch('/api/agentic-wallet',{method:'POST',headers:{'Content-Type':'application/json','X-Vela-Agentic-Token':capability!},body:JSON.stringify(body),cache:'no-store'});
  const data=await response.json();if(response.status===401)capability=null;
  if(!response.ok)throw new AgenticRequestError(data.error||'Agentic Wallet request failed.',data.receipt);return data as T;
}
export function isAgenticWalletBridgeHost():boolean{return typeof window!=='undefined'&&['localhost','127.0.0.1','[::1]'].includes(window.location.hostname);}
