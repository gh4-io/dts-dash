"use client";

import { create } from "zustand";
import type { Customer } from "@/types";

interface CustomersState {
  customers: Customer[];
  isLoading: boolean;
  error: string | null;
  fetch: (force?: boolean) => Promise<void>;
  invalidate: () => Promise<void>;
  getColor: (customerName: string) => string;
  getTextColor: (customerName: string) => string;
}

const DEFAULT_COLOR = "#6b7280";
const DEFAULT_TEXT_COLOR = "#ffffff";

export const useCustomers = create<CustomersState>()((set, get) => ({
  customers: [],
  isLoading: false,
  error: null,

  fetch: async (force?: boolean) => {
    // Don't refetch if already loaded (unless forced)
    if (!force && get().customers.length > 0 && !get().error) return;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/admin/customers");
      if (!res.ok) throw new Error("Failed to fetch customers");
      const data = await res.json();
      set({ customers: data, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  invalidate: async () => {
    set({ customers: [], error: null });
    await get().fetch(true);
  },

  getColor: (customerName: string) => {
    const customer = get().customers.find((c) => c.name === customerName);
    return customer?.color ?? DEFAULT_COLOR;
  },

  getTextColor: (customerName: string) => {
    const customer = get().customers.find((c) => c.name === customerName);
    return customer?.colorText ?? DEFAULT_TEXT_COLOR;
  },
}));
