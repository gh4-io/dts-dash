/**
 * Billing Engine (P2-3: Billed Hours)
 *
 * Pure functions for aggregating, applying, and validating billing entries.
 * Mirrors time-bookings-engine.ts patterns. Zero DB imports.
 */

import type { BillingEntry, DailyDemandV2 } from "@/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SHIFT_CODES = ["DAY", "SWING", "NIGHT"];
const VALID_SOURCES = ["manual", "import"];

/**
 * Aggregate billing entries into a date → shift → total billedMh map.
 * Filters inactive entries and those outside the date range.
 */
export function aggregateBilledHours(
  entries: BillingEntry[],
  startDate: string,
  endDate: string,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();

  for (const e of entries) {
    if (!e.isActive) continue;
    if (e.billingDate < startDate || e.billingDate > endDate) continue;

    let byShift = result.get(e.billingDate);
    if (!byShift) {
      byShift = new Map<string, number>();
      result.set(e.billingDate, byShift);
    }

    const current = byShift.get(e.shiftCode) ?? 0;
    byShift.set(e.shiftCode, Math.round((current + e.billedMh) * 100) / 100);
  }

  return result;
}

/**
 * Overlay billed hours onto demand data.
 * Sets billedMH on each ShiftDemandV2 and totalBilledMH on DailyDemandV2.
 * Short-circuits if aggregated is empty (returns demand as-is).
 */
export function applyBilledHours(
  demand: DailyDemandV2[],
  aggregated: Map<string, Map<string, number>>,
): DailyDemandV2[] {
  if (aggregated.size === 0) return demand;

  return demand.map((day) => {
    const shiftAgg = aggregated.get(day.date);
    if (!shiftAgg) return day;

    let totalBilledMH = 0;
    const byShift = day.byShift.map((s) => {
      const billed = shiftAgg.get(s.shiftCode);
      if (billed !== undefined) {
        totalBilledMH += billed;
        return { ...s, billedMH: billed };
      }
      return s;
    });

    return {
      ...day,
      totalBilledMH: Math.round(totalBilledMH * 100) / 100,
      byShift,
    };
  });
}

/**
 * Compute variance between billed and worked hours.
 * Positive variance = under-billed (worked more than billed).
 */
export function computeBillingVariance(
  billed: number,
  worked: number,
): { variance: number; variancePct: number | null } {
  const variance = Math.round((worked - billed) * 100) / 100;
  const variancePct = worked > 0 ? Math.round(((worked - billed) / worked) * 10000) / 100 : null;
  return { variance, variancePct };
}

/**
 * Validate a billing entry for required fields and constraints.
 */
export function validateBillingEntry(entry: Partial<BillingEntry>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  if (!entry.aircraftReg?.trim()) {
    errors.push("aircraftReg is required");
  }
  if (!entry.customer?.trim()) {
    errors.push("customer is required");
  }
  if (!entry.billingDate) {
    errors.push("billingDate is required");
  } else if (!DATE_RE.test(entry.billingDate)) {
    errors.push("billingDate must be YYYY-MM-DD format");
  }
  if (!entry.shiftCode) {
    errors.push("shiftCode is required");
  } else if (!VALID_SHIFT_CODES.includes(entry.shiftCode)) {
    errors.push(`shiftCode must be one of: ${VALID_SHIFT_CODES.join(", ")}`);
  }
  if (entry.billedMh === undefined || entry.billedMh === null) {
    errors.push("billedMh is required");
  } else if (typeof entry.billedMh !== "number" || entry.billedMh <= 0) {
    errors.push("billedMh must be a positive number");
  }

  // Optional field validation
  if (entry.source !== undefined && !VALID_SOURCES.includes(entry.source)) {
    errors.push(`source must be one of: ${VALID_SOURCES.join(", ")}`);
  }

  return { valid: errors.length === 0, errors };
}
