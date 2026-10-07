import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { VelaReceipt, DecisionReceipt } from "../types";

type AnyReceipt = DecisionReceipt | VelaReceipt;

interface ReceiptsState {
  receipts: AnyReceipt[];
  addReceipt: (receipt: AnyReceipt) => void;
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
