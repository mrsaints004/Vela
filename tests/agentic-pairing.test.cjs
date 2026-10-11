const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseBinancePairing}=require('../src/lib/server/agentic-pairing.ts');
const now=1791680000000;
function data(host='web3.binance.com'){return {urlForWeb:`https://${host}/en/agent-login?expireAt=1791680300000&url=preserve%2Bexact`,pairingCode:'012345',qrCodeId:'qr-test',expireAt:String(now+300000)};}
test('accepts trusted Binance login hosts without changing links or pairing codes',()=>{
 for(const host of ['binance.com','web3.binance.com','www.binance.com','accounts.binance.com','app.binance.com']){const d=data(host),r=parseBinancePairing(d,now);assert.equal(r.url,d.urlForWeb);assert.equal(r.pairingCode,'012345');}
});
test('normalizes expiry units and rejects expired or incomplete responses',()=>{
 assert.equal(parseBinancePairing({...data(),expireAt:(now+300000)/1000},now).expiresAt,now+300000);
 for(const patch of [{expireAt:now-1},{expireAt:null},{pairingCode:''},{qrCodeId:''},{urlForWeb:''}])assert.throws(()=>parseBinancePairing({...data(),...patch},now));
});
test('rejects lookalike hosts, insecure links, credentials and custom ports',()=>{
 for(const urlForWeb of ['https://web3.binance.com.evil.test/login','https://fakebinance.com/login','http://web3.binance.com/login','https://user:pass@web3.binance.com/login','https://www.binance.com:444/login','https://evil.test/binance.com'])assert.throws(()=>parseBinancePairing({...data(),urlForWeb},now));
});
test('unsupported link diagnostics omit the sensitive path, query and credentials',()=>{
 assert.throws(()=>parseBinancePairing({...data(),urlForWeb:'https://user:secret@unknown.example/sensitive?token=private'},now),error=>error.message.includes('host: unknown.example')&&!/secret|sensitive|private/.test(error.message));
});
