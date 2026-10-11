export interface AgenticSettings {
  dailyLimit:number;quotaLeft:number;quotaUsed:number;quotaDate:string;tradeAllTokens:boolean;abnormalTxnHandling:string;sessionExpireTime:string;
  devMode:{enabled:boolean;expiresAt:number|null;dailyLimit:number;balanceExceeded:boolean};developerModeQuotaUsed:number;
}
export interface AgenticStatus {installed:boolean;connected:boolean;status:string;version?:string;address:string|null;settings:AgenticSettings|null;lock:string|null;error?:string;}
export interface AgenticSigningPreview {
  id:string;operation:'approval'|'rfq-sign'|'swap';expiresAt:number;requireConfirmation:boolean;
  wallet:string;token:string;amount:string;action?:'buy'|'sell';inputToken?:string;spender:string;parsed:unknown;risks:unknown;authorityChanges:unknown;payload:unknown;
}
export interface AgenticPairing {jobId:string;urlForWeb:string;pairingCode:string;expiresAt:number;status:'waiting'|'connected'|'failed';error?:string;}
