import type {NextRequest} from 'next/server';
import {assertSameOrigin} from './request-origin';
export function localRequest(request:NextRequest) {
  const origin=assertSameOrigin(request,request.method==='POST');
  if(!['localhost','127.0.0.1','[::1]'].includes(origin.hostname))throw new Error('Agentic Wallet requires a local URL. Open Vela at http://localhost:<your-port> or http://127.0.0.1:<your-port>.');
}
