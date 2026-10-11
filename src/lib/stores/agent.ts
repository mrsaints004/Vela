import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AgentState {
  agentId: number | null;
  txHash: string | null;
  registered: boolean;
  registering: boolean;
  error: string | null;
  useTestnet: boolean;

  setRegistered: (agentId: number, txHash: string) => void;
  setRegistering: (registering: boolean) => void;
  setError: (error: string | null) => void;
  setUseTestnet: (useTestnet: boolean) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      agentId: null,
      txHash: null,
      registered: false,
      registering: false,
      error: null,
      useTestnet: false,

      setRegistered: (agentId, txHash) =>
        set({ agentId, txHash, registered: true, registering: false, error: null }),

      setRegistering: (registering) =>
        set({ registering, error: null }),

      setError: (error) =>
        set({ error, registering: false }),

      setUseTestnet: (useTestnet) =>
        set({ useTestnet, agentId: null, txHash: null, registered: false, error: null }),

      reset: () =>
        set({ agentId: null, txHash: null, registered: false, registering: false, error: null }),
    }),
    {
      name: "vela-agent",
      partialize: (state)=>({agentId:state.agentId,txHash:state.txHash,registered:state.registered,useTestnet:state.useTestnet}),
    }
  )
);
