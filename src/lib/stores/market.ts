import { create } from "zustand";
import type { MarketStatus } from "../types";

interface MarketState {
  status: MarketStatus | null;
  loading: boolean;
  lastFetched: number | null;
  fetchStatus: () => Promise<void>;
}

export const useMarketStore = create<MarketState>((set) => ({
  status: null,
  loading: false,
  lastFetched: null,

  fetchStatus: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/rwa?action=market-status");
      if (!res.ok) throw new Error("Failed to fetch market status");
      const data = await res.json();
      set({ status: data, lastFetched: Date.now(), loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
