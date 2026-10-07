import { create } from "zustand";

interface WalletState {
  address: string | null;
  chainId: number | null;
  balances: Record<string, string>;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  chainId: null,
  balances: {},
  connected: false,
  connecting: false,

  connect: async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      return;
    }
    set({ connecting: true });
    try {
      const { BrowserProvider } = await import("ethers");
      const provider = new BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      if (accounts.length > 0) {
        set({
          address: accounts[0],
          chainId: Number(network.chainId),
          connected: true,
          connecting: false,
        });
      }
    } catch {
      set({ connecting: false });
    }
  },

  disconnect: () => {
    set({
      address: null,
      chainId: null,
      balances: {},
      connected: false,
    });
  },
}));
