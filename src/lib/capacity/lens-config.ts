/**
 * Capacity Lens Configuration (P2-7)
 *
 * Pure constant definitions + availability helper.
 * No DB or engine imports — safe for client-side use.
 */

import type { CapacityLensId, CapacityOverviewResponse } from "@/types";

export interface CapacityLensDefinition {
  id: CapacityLensId;
  label: string;
  icon: string;
  color: string;
  description: string;
}

/**
 * All 7 capacity lenses in display order.
 * "planned" is always available as the base lens.
 */
export const CAPACITY_LENSES: readonly CapacityLensDefinition[] = [
  {
    id: "planned",
    label: "Planned",
    icon: "fa-calendar-check",
    color: "blue",
    description: "WP-based demand vs capacity",
  },
  {
    id: "allocated",
    label: "Allocated",
    icon: "fa-handshake",
    color: "amber",
    description: "Customer demand allocations",
  },
  {
    id: "events",
    label: "Events",
    icon: "fa-plane-arrival",
    color: "sky",
    description: "Flight event coverage windows",
  },
  {
    id: "forecast",
    label: "Forecast",
    icon: "fa-chart-line",
    color: "teal",
    description: "Rate forecast modeling",
  },
  {
    id: "worked",
    label: "Worked",
    icon: "fa-stopwatch",
    color: "green",
    description: "Actual worked hours from time bookings",
  },
  {
    id: "billed",
    label: "Billed",
    icon: "fa-file-invoice-dollar",
    color: "indigo",
    description: "Billed hours from invoicing",
  },
  {
    id: "concurrent",
    label: "Concurrent",
    icon: "fa-layer-group",
    color: "purple",
    description: "Concurrent aircraft pressure",
  },
] as const;

/**
 * Determine which lenses have data in the current API response.
 * "planned" is always available. Overlay lenses require non-empty arrays.
 */
export function getAvailableLenses(data: Partial<CapacityOverviewResponse>): Set<CapacityLensId> {
  const available = new Set<CapacityLensId>(["planned"]);

  if (data.contracts && data.contracts.length > 0) {
    available.add("allocated");
  }
  if (data.flightEvents && data.flightEvents.length > 0) {
    available.add("events");
  }
  if (data.forecastRates && data.forecastRates.length > 0) {
    available.add("forecast");
  }
  if (data.timeBookings && data.timeBookings.length > 0) {
    available.add("worked");
  }
  if (data.billingEntries && data.billingEntries.length > 0) {
    available.add("billed");
  }
  if (data.concurrencyBuckets && data.concurrencyBuckets.length > 0) {
    available.add("concurrent");
  }

  return available;
}
