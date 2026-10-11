import { BrowserProvider, type Eip1193Provider } from 'ethers';
export interface InjectedWallet extends Eip1193Provider {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}
declare global {interface Window { ethereum?: InjectedWallet }}
export async function walletSigner(chainId=56) {
  if(typeof window==='undefined'||!window.ethereum) throw new Error('Install or open a browser wallet to continue.');
  const wallet=window.ethereum;
  const current=await wallet.request({method:'eth_chainId'});
  if(Number(current)!==chainId) {
    try {await wallet.request({method:'wallet_switchEthereumChain',params:[{chainId:`0x${chainId.toString(16)}`}]});}
    catch {throw new Error(`Switch your wallet to BSC ${chainId===56?'Mainnet':'Testnet'} before signing.`);}
  }
  const provider=new BrowserProvider(wallet);const signer=await provider.getSigner();
  if(Number((await provider.getNetwork()).chainId)!==chainId) throw new Error('Wallet network changed. Refresh and retry.');
  return {provider,signer,address:await signer.getAddress()};
}
export function walletError(error:unknown):string {
  if(error && typeof error==='object' && 'code' in error && (error.code===4001||error.code==='ACTION_REJECTED')) return 'You cancelled the wallet request. No success was recorded.';
  return error instanceof Error?error.message:'Wallet request failed.';
}
