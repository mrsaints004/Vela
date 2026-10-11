import type {NextRequest} from 'next/server';
/** Use the browser-facing Host authority; Next can rewrite request.url to its internal listener. */
export function browserOrigin(request:NextRequest):URL {
  const internal=new URL(request.url);
  const host=request.headers.get('host')||internal.host;
  if(!host||/[\s,/@\\?#]/.test(host))throw new Error('Invalid request host.');
  const authority=new URL(`${internal.protocol}//${host}`);
  const forwarded=request.headers.get('x-forwarded-host');
  // Next supplies this header itself. Accept its matching value, never a different proxy authority.
  if(forwarded && forwarded.toLowerCase()!==host.toLowerCase())throw new Error('Forwarded host does not match the request host.');
  return authority;
}
export function assertSameOrigin(request:NextRequest,required=false) {
  const expected=browserOrigin(request),origin=request.headers.get('origin');
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new Error('Cross-origin execution requests are not permitted.');
  if(origin && origin!==expected.origin)throw new Error('Cross-origin execution requests are not permitted.');
  if(required&&!origin)throw new Error('Same-origin confirmation required.');
  return expected;
}
