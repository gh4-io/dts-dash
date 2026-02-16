"use client";

import { create } from "zustand";
import type { Customer } from "@/types";
import { getCustomerColor } from "@/lib/utils/customer-color-palette";

interface CustomersState {
  customers: Customer[];
  isLoading: boolean;
  error: string | null;
  fetch: (force?: boolean) => Promise<void>;
  invalidate: () => Promise<void>;
  getColor: (customerName: string) => string;
  getTextColor: (customerName: string) => string;
}

const DEFAULT_TEXT_COLOR = "#ffffff";

/**
 * Simple string hash → palette index.
 * Deterministic: same name always produces the same color.
 */
function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

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
    if (customer?.color) return customer.color;
    // Fallback: deterministic palette color based on name hash
    return getCustomerColor(hashName(customerName));
  },

  getTextColor: (customerName: string) => {
    const customer = get().customers.find((c) => c.name === customerName);
    return customer?.colorText ?? DEFAULT_TEXT_COLOR;
  },
}));
