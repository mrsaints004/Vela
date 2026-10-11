import {create} from 'zustand';
import {agenticRequest} from '../api/agentic-wallet';
import type {AgenticStatus,AgenticPairing} from '../types/agentic';
interface State {status:AgenticStatus|null;pairing:AgenticPairing|null;busy:boolean;error:string|null;refresh:()=>Promise<void>;signIn:()=>Promise<void>;pollPairing:()=>Promise<void>;signOut:()=>Promise<void>;}
export const useAgenticWalletStore=create<State>((set,get)=>({
  status:null,pairing:null,busy:false,error:null,
  refresh:async()=>{set({busy:true,error:null});try{set({status:await agenticRequest<AgenticStatus>({action:'status'})});}catch(e){set({status:null,error:e instanceof Error?e.message:'Could not read Agentic Wallet.'});}finally{set({busy:false});}},
  signIn:async()=>{set({busy:true,error:null});try{const data=await agenticRequest<AgenticPairing|{alreadyConnected:true;status:AgenticStatus}>({action:'signin'});if('alreadyConnected' in data){await get().refresh();set({pairing:null});}else set({pairing:data});}catch(e){set({error:e instanceof Error?e.message:'Sign-in failed.'});}finally{set({busy:false});}},
  pollPairing:async()=>{const pairing=get().pairing;if(!pairing||pairing.status!=='waiting')return;try{const next=await agenticRequest<AgenticPairing>({action:'pairing-status',jobId:pairing.jobId});set({pairing:next});if(next.status==='connected')await get().refresh();if(next.status==='failed')set({error:next.error||'Pairing failed. Start a fresh sign-in.'});}catch(e){set({error:e instanceof Error?e.message:'Pairing check failed.'});}},
  signOut:async()=>{set({busy:true,error:null});try{await agenticRequest({action:'signout'});set({status:null,pairing:null});}catch(e){set({error:e instanceof Error?e.message:'Sign-out failed.'});}finally{set({busy:false});}}
}));
