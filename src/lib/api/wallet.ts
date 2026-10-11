import { signedCall, object, textField } from './client';
import { isAddress } from 'ethers';
export interface WalletTokenBalance {tokenAddress:string;tokenSymbol:string;tokenName:string;balance:string;balanceUsd:string;tokenPrice:string;decimals:number;logoUrl:string;isNative:boolean;}
export async function getWalletBalances(walletAddress:string):Promise<{balances:WalletTokenBalance[];totalUsd:number;latency:number}> {
  if(!isAddress(walletAddress))throw new Error('Invalid wallet address.');
  const balances:WalletTokenBalance[]=[];let latency=0;
  for(let page=1;page<=20;page++){
    const result=await signedCall('GET','/api/v1/dex/balance/all-token-balances-by-address',{address:walletAddress,chains:'56',page:String(page),pageSize:'100'});latency+=result.latency;
    if(!Array.isArray(result.data))throw new Error('Unexpected Wallet API response.');
    let count=0;
    for(const item of result.data){const group=object(item);if(!Array.isArray(group.tokenAssets))throw new Error('Missing Wallet API tokenAssets.');count+=group.tokenAssets.length;
      for(const value of group.tokenAssets){const t=object(value);const balance=textField(t.balance,'0'),price=textField(t.tokenPrice);const usd=Number(balance)*Number(price);
        balances.push({tokenAddress:textField(t.tokenContractAddress),tokenSymbol:textField(t.symbol),tokenName:textField(t.symbol),balance,balanceUsd:Number.isFinite(usd)&&price?String(usd):'',tokenPrice:price,decimals:18,logoUrl:'',isNative:!textField(t.tokenContractAddress)});
      }
    }
    if(count<100)break;if(page===20)throw new Error('Wallet has more than 2,000 assets; valuation is incomplete.');
  }
  return {balances,totalUsd:balances.reduce((sum,b)=>sum+(Number(b.balanceUsd)||0),0),latency};
}
