import {create} from 'zustand';
import {BrowserProvider} from 'ethers';
interface WalletState {address:string|null;chainId:number|null;balances:Record<string,string>;connected:boolean;connecting:boolean;error:string|null;connect:()=>Promise<void>;disconnect:()=>void;}
export const useWalletStore=create<WalletState>((set)=>({address:null,chainId:null,balances:{},connected:false,connecting:false,error:null,
  connect:async()=>{set({connecting:true,error:null});try {if(!window.ethereum) throw new Error('No browser wallet found. Open Vela in your wallet browser or install a compatible wallet.');const p=new BrowserProvider(window.ethereum);const accounts=await p.send('eth_requestAccounts',[]) as string[];if(!accounts.length) throw new Error('No wallet account selected.');set({address:accounts[0],chainId:Number((await p.getNetwork()).chainId),connected:true});}catch(e){set({error:e instanceof Error?e.message:'Wallet connection failed.'});}finally{set({connecting:false});}},
  disconnect:()=>set({address:null,chainId:null,balances:{},connected:false,connecting:false})
}));
