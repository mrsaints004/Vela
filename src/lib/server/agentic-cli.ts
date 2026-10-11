import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { isAddress, Signature } from 'ethers';
import { object, textField } from '../api/client';
import type { AgenticSettings, AgenticStatus } from '../types/agentic';

const requiredVersion='1.10.0';
export function redactAgentic(value:unknown):unknown {
  if(Array.isArray(value))return value.map(redactAgentic);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key,v])=>!(/(?:access|refresh|session|auth)token|secret|clientid|apikey|password|privatekey|seedphrase|credential|signature/i.test(key)) && (key.toLowerCase()!=='token'||isAddress(String(v)))).map(([key,v])=>[key,redactAgentic(v)]));
  return value;
}
export async function cliExecutable() {
  const configured=process.env.VELA_BAW_PATH;
  if(configured){if(!isAbsolute(configured))throw new Error('VELA_BAW_PATH must be an absolute executable path.');return configured;}
  const local=join(process.cwd(),'.tools','agentic-wallet','node_modules','.bin','baw');
  try{await access(local);return local;}catch{return 'baw';}
}
export async function runBaw(args:string[],options:{timeout?:number;signal?:AbortSignal}={}):Promise<Record<string,unknown>> {
  const executable=await cliExecutable();
  // No shell interpolation, arbitrary commands, credentials in logs, or automatic funding.
  const stdout=await new Promise<string>((resolve,reject)=>{
    execFile(executable,[...args,'--json'],{cwd:process.cwd(),env:{...process.env,BINANCE_BAW_DIR:process.env.BINANCE_BAW_DIR||join(process.cwd(),'.data','baw')},timeout:options.timeout??20000,maxBuffer:1024*1024,windowsHide:true,signal:options.signal},(error,stdout)=>{
      if(error && !stdout){const code='code' in error?String(error.code):'';reject(new Error(code==='ENOENT'?'Binance Agentic Wallet CLI is missing. Run npm run agentic:install, then refresh.':error.name==='AbortError'?'Agentic Wallet request cancelled.':'Agentic Wallet CLI failed or timed out. No success was recorded.'));return;}
      resolve(stdout);
    });
  });
  let result:Record<string,unknown>;
  try{result=object(JSON.parse(stdout.trim()));}catch{throw new Error('Agentic Wallet CLI returned invalid JSON.');}
  if(result.success!==true){const error=object(result.error||{});const message=textField(error.message,'Agentic Wallet rejected the request.');throw new Error(`${textField(error.name,'BINANCE_ERROR')}: ${message}`);}
  return object(result.data);
}
export async function checkCli() {
  const result=await runBaw(['cli-check','--required-version',requiredVersion]);
  if(result.needUpdateCli!==false)throw new Error(`Agentic Wallet CLI ${requiredVersion} or newer is required. Run npm run agentic:install.`);
  return textField(result.currentCliVersion);
}
export function parseSettings(raw:Record<string,unknown>):AgenticSettings {
  const finite=(key:string)=>{const value=Number(raw[key]);if(!Number.isFinite(value)||value<0)throw new Error(`Agentic Wallet ${key} is unavailable.`);return value;};
  const dev=object(raw.devMode||{});
  if(typeof dev.enabled!=='boolean')throw new Error('Agentic Wallet Developer Mode state is unavailable.');
  return {dailyLimit:finite('dailyLimit'),quotaLeft:finite('quotaLeft'),quotaUsed:finite('quotaUsed'),quotaDate:textField(raw.quotaDate),tradeAllTokens:raw.tradeAllTokens===true,abnormalTxnHandling:textField(raw.abnormalTxnHandling),sessionExpireTime:textField(raw.sessionExpireTime),devMode:{enabled:dev.enabled,expiresAt:dev.expiresAt===null?null:Number(dev.expiresAt),dailyLimit:Number(dev.dailyLimit),balanceExceeded:dev.balanceExceeded===true},developerModeQuotaUsed:Number(raw.developerModeQuotaUsed)};
}
export async function walletStatus():Promise<AgenticStatus> {
  const version=await checkCli();const status=await runBaw(['wallet','status']);
  if(status.status!=='CONNECTED')return {installed:true,version,connected:false,status:textField(status.status,'UNCONNECTED'),address:null,settings:null,lock:null};
  const [addresses,rawSettings,lock]=await Promise.all([runBaw(['wallet','address']),runBaw(['wallet','settings']),runBaw(['wallet','tx-lock','--binanceChainId','56'])]);
  const list=Array.isArray(addresses.addresses)?addresses.addresses:[];
  const address=list.map(object).find(a=>a.binanceChainId==='56')?.address;
  if(!isAddress(String(address)))throw new Error('Agentic Wallet did not return a valid BSC mainnet address.');
  return {installed:true,version,connected:true,status:'CONNECTED',address:String(address),settings:parseSettings(rawSettings),lock:textField(lock.status)};
}
export function assertAgenticReady(status:AgenticStatus,amount:number,wallet?:string,allowLocked=false) {
  if(!status.connected||!status.address||!status.settings)throw new Error('Sign in to Binance Agentic Wallet first.');
  if(wallet && status.address.toLowerCase()!==wallet.toLowerCase())throw new Error('Agentic Wallet account changed. Get a fresh preview.');
  if(!allowLocked && status.lock!=='UNLOCKED')throw new Error('Agentic Wallet is locked. Resolve the pending transaction or confirmation in Binance App.');
  const s=status.settings,session=Date.parse(s.sessionExpireTime);
  if(!Number.isFinite(session)||session<=Date.now())throw new Error('Agentic Wallet session expired or cannot be verified. Sign in again.');
  if(!s.devMode.enabled||!Number.isFinite(s.devMode.expiresAt)||Number(s.devMode.expiresAt)*1000<=Date.now())throw new Error('Enable unexpired Developer Mode in Binance App for Vela external signing.');
  if(!Number.isFinite(amount)||amount<=0||s.quotaLeft<amount)throw new Error('Trade exceeds the remaining Binance wallet daily quota.');
  if(!Number.isFinite(s.developerModeQuotaUsed)||!Number.isFinite(s.devMode.dailyLimit)||s.devMode.balanceExceeded||s.devMode.dailyLimit-s.developerModeQuotaUsed<amount)throw new Error('Developer Mode quota is unavailable or insufficient. Review Binance App settings.');
}
export function normalizeSignature(data:Record<string,unknown>):string {
  const raw=textField(data.signature).replace(/^0x/,'');
  if(/^[a-f0-9]{130}$/i.test(raw))return Signature.from(`0x${raw}`).serialized;
  const recovery=textField(data.signatureRecovery).replace(/^0x/,'');
  if(!/^[a-f0-9]{128}$/i.test(raw)||!/^(00|01|1b|1c)$/i.test(recovery))throw new Error('Binance returned an invalid EIP-712 signature.');
  return Signature.from(`0x${raw}${recovery}`).serialized;
}
