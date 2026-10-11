const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NextRequest}=require('next/server');
const {guard}=require('../src/lib/server/request.ts');
const {localRequest}=require('../src/lib/server/agentic-request.ts');
const {browserOrigin}=require('../src/lib/server/request-origin.ts');
function request(internal,host,origin,forwarded=host){return new NextRequest(internal,{method:'POST',headers:{host,origin,'x-forwarded-host':forwarded,'sec-fetch-site':'same-origin','content-type':'application/json'},body:'{}'});}
test('Next-injected matching forwarded host is allowed for local requests',()=>{const req=request('http://localhost:3000/api/trade','localhost:3000','http://localhost:3000');assert.doesNotThrow(()=>localRequest(req));assert.doesNotThrow(()=>guard(req));});
test('browser localhost origin survives Next internal URL rewriting',()=>{for(const internal of ['http://127.0.0.1:3000/api/trade','http://0.0.0.0:3000/api/trade']){const req=request(internal,'localhost:3000','http://localhost:3000');assert.equal(browserOrigin(req).origin,'http://localhost:3000');assert.doesNotThrow(()=>localRequest(req));assert.doesNotThrow(()=>guard(req));}});
test('loopback IP and custom port retain exact browser authority',()=>{const req=request('http://localhost:3107/api/trade','127.0.0.1:3107','http://127.0.0.1:3107');assert.doesNotThrow(()=>localRequest(req));assert.doesNotThrow(()=>guard(req));});
test('different origins, ports, spoofed forwarded hosts and public hosts remain blocked',()=>{for(const req of [request('http://localhost:3000/api/trade','localhost:3000','https://evil.example'),request('http://localhost:3000/api/trade','localhost:3000','http://localhost:3001'),request('http://localhost:3000/api/trade','localhost:3000','http://localhost:3000','evil.example')]){assert.throws(()=>guard(req));assert.throws(()=>localRequest(req));}assert.throws(()=>localRequest(request('http://localhost:3000/api/trade','example.com','http://example.com')));});
test('agentic state changes still require an Origin header and reject cross-site fetches',()=>{assert.throws(()=>localRequest(new NextRequest('http://localhost/api/agentic-wallet',{method:'POST',body:'{}'})));const req=request('http://localhost/api/trade','localhost','http://localhost');req.headers.set('sec-fetch-site','cross-site');assert.throws(()=>guard(req));});
