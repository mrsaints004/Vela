"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";

import {useWalletStore} from '@/lib/stores/wallet';
import {useTradeStore} from '@/lib/stores/trade';
import {useAgentStore} from '@/lib/stores/agent';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  useEffect(() => {
    const wallet=window.ethereum;
    if(!wallet)return;
    const accounts=(value:unknown)=>{const list=Array.isArray(value)?value:[];useWalletStore.setState({address:list[0]||null,connected:list.length>0});if(useTradeStore.getState().executionMode==='wallet')useTradeStore.getState().invalidate();useAgentStore.getState().reset();};
    const chain=(value:unknown)=>{useWalletStore.setState({chainId:Number(value)});if(useTradeStore.getState().executionMode==='wallet')useTradeStore.getState().invalidate();};
    wallet.on?.('accountsChanged',accounts);wallet.on?.('chainChanged',chain);
    return()=>{wallet.removeListener?.('accountsChanged',accounts);wallet.removeListener?.('chainChanged',chain);};
  },[]);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
