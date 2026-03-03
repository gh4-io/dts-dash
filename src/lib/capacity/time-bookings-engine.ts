/**
 * Time Bookings Engine (P2-2: Worked Hours)
 *
 * Pure compute functions for aggregating actual man-hours and overlaying
 * them onto demand data. Zero DB imports — all data passed as arguments.
 */

import type { TimeBooking, DailyDemandV2 } from "@/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SHIFT_CODES = ["DAY", "SWING", "NIGHT"];
const VALID_TASK_TYPES = ["routine", "non_routine", "aog", "training", "admin"];
const VALID_SOURCES = ["manual", "import"];

// ─── Aggregation ─────────────────────────────────────────────────────────────

/**
 * Aggregate active time bookings by date → shift → total worked MH.
 * Only includes bookings within [startDate, endDate] that are active.
 */
export function aggregateWorkedHours(
  bookings: TimeBooking[],
  startDate: string,
  endDate: string,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();

  for (const b of bookings) {
    if (!b.isActive) continue;
    if (b.bookingDate < startDate || b.bookingDate > endDate) continue;

    let byShift = result.get(b.bookingDate);
    if (!byShift) {
      byShift = new Map<string, number>();
      result.set(b.bookingDate, byShift);
    }

    const current = byShift.get(b.shiftCode) ?? 0;
    byShift.set(b.shiftCode, Math.round((current + b.workedMh) * 100) / 100);
  }

  return result;
}

// ─── Overlay ─────────────────────────────────────────────────────────────────

/**
 * Overlay aggregated worked hours onto demand data.
 * Sets workedMH on each shift and totalWorkedMH on daily level.
 * Does NOT change demandMH or totalDemandMH — informational only.
 * Returns a new array (original is not mutated).
 */
export function applyWorkedHours(
  demand: DailyDemandV2[],
  aggregated: Map<string, Map<string, number>>,
): DailyDemandV2[] {
  if (aggregated.size === 0) return demand;

  return demand.map((day) => {
    const shiftAgg = aggregated.get(day.date);
    if (!shiftAgg) return day;

    let totalWorkedMH = 0;
    const byShift = day.byShift.map((s) => {
      const worked = shiftAgg.get(s.shiftCode);
      if (worked !== undefined) {
        totalWorkedMH += worked;
        return { ...s, workedMH: worked };
      }
      return s;
    });

    return {
      ...day,
      totalWorkedMH: Math.round(totalWorkedMH * 100) / 100,
      byShift,
    };
  });
}

// ─── Variance ────────────────────────────────────────────────────────────────

/**
 * Compute variance between planned and actual hours.
 * Positive = under-worked, negative = over-worked.
 */
export function computeVariance(
  planned: number,
  actual: number,
): { variance: number; variancePct: number | null } {
  const variance = Math.round((planned - actual) * 100) / 100;
  const variancePct = planned > 0 ? Math.round(((planned - actual) / planned) * 10000) / 100 : null;
  return { variance, variancePct };
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate a time booking input. Returns { valid, errors }.
 */
export function validateTimeBooking(booking: Partial<TimeBooking>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  if (!booking.aircraftReg?.trim()) {
    errors.push("aircraftReg is required");
  }
  if (!booking.customer?.trim()) {
    errors.push("customer is required");
  }
  if (!booking.bookingDate) {
    errors.push("bookingDate is required");
  } else if (!DATE_RE.test(booking.bookingDate)) {
    errors.push("bookingDate must be YYYY-MM-DD format");
  }
  if (!booking.shiftCode) {
    errors.push("shiftCode is required");
  } else if (!VALID_SHIFT_CODES.includes(booking.shiftCode)) {
    errors.push(`shiftCode must be one of: ${VALID_SHIFT_CODES.join(", ")}`);
  }
  if (booking.workedMh === undefined || booking.workedMh === null) {
    errors.push("workedMh is required");
  } else if (typeof booking.workedMh !== "number" || booking.workedMh <= 0) {
    errors.push("workedMh must be a positive number");
  }

  // Optional field validation
  if (booking.taskType !== undefined && !VALID_TASK_TYPES.includes(booking.taskType)) {
    errors.push(`taskType must be one of: ${VALID_TASK_TYPES.join(", ")}`);
  }
  if (booking.source !== undefined && !VALID_SOURCES.includes(booking.source)) {
    errors.push(`source must be one of: ${VALID_SOURCES.join(", ")}`);
  }
  if (
    booking.technicianCount !== undefined &&
    booking.technicianCount !== null &&
    (typeof booking.technicianCount !== "number" ||
      booking.technicianCount < 0 ||
      !Number.isInteger(booking.technicianCount))
  ) {
    errors.push("technicianCount must be a non-negative integer");
  }

  return { valid: errors.length === 0, errors };
}
