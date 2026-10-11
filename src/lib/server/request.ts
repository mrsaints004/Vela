import { NextRequest } from 'next/server';
import {assertSameOrigin} from './request-origin';
const windows = new Map<string,{count:number;start:number}>();
export function guard(request:NextRequest) {
  assertSameOrigin(request);
  const key=request.headers.get('x-forwarded-for')?.split(',')[0]||'local';const now=Date.now();
  if(windows.size>1000) windows.clear();
  const entry=windows.get(key);
  if(!entry || now-entry.start>60000) windows.set(key,{count:1,start:now});
  else {entry.count++;if(entry.count>60) throw new Error('Too many requests. Wait a minute before retrying.');}
  const length=Number(request.headers.get('content-length')||0); if(length>100000) throw new Error('Request is too large.');
}
