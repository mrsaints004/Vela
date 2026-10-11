import {textField} from '../api/client';
// Keep the CLI's complete link and pairing code unchanged. Only trusted Binance hosts.
function binanceLoginHost(host:string){return host==='binance.com'||host.endsWith('.binance.com');}
export function parseBinancePairing(data:Record<string,unknown>,now=Date.now()){
 const url=textField(data.urlForWeb),pairingCode=textField(data.pairingCode),qrCodeId=textField(data.qrCodeId);
 if(!url)throw new Error('Binance sign-in response is missing urlForWeb. Update the CLI and start sign-in again.');
 let parsed:URL;try{parsed=new URL(url);}catch{throw new Error('Binance returned an invalid sign-in URL. Start sign-in again.');}
 if(parsed.protocol!=='https:'||!binanceLoginHost(parsed.hostname)||parsed.username||parsed.password||(parsed.port&&parsed.port!=='443'))throw new Error(`Binance returned an unsupported sign-in link (protocol: ${parsed.protocol}, host: ${parsed.hostname}, port: ${parsed.port||'default'}, embedded credentials: ${parsed.username||parsed.password?'yes':'no'}). Only HTTPS links on binance.com or its subdomains are permitted. This diagnostic omits the login path, query and pairing code.`);
 if(!pairingCode)throw new Error('Binance sign-in response is missing its pairing code. Update the CLI and start sign-in again.');
 if(!qrCodeId)throw new Error('Binance sign-in response is missing qrCodeId. Start sign-in again.');
 const raw=Number(data.expireAt);
 if(!Number.isFinite(raw)||raw<=0)throw new Error('Binance sign-in response has no valid expiry. Start sign-in again.');
 const expiresAt=raw<100000000000?raw*1000:raw;
 if(expiresAt<=now)throw new Error('Binance pairing code is already expired. Check your Mac’s date and time, then start a fresh sign-in.');
 return {url,pairingCode,qrCodeId,expiresAt};
}
