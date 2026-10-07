import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { VelaReceipt } from "../types";

interface ReceiptsState {
  receipts: VelaReceipt[];
  addReceipt: (receipt: VelaReceipt) => void;
  clearReceipts: () => void;
}

export const useReceiptsStore = create<ReceiptsState>()(
  persist(
    (set) => ({
      receipts: [],

      addReceipt: (receipt) =>
        set((state) => ({
          receipts: [receipt, ...state.receipts],
        })),

      clearReceipts: () => set({ receipts: [] }),
    }),
    {
      name: "vela-receipts",
    }
  )
);
