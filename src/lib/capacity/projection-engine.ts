/**
 * Weekly MH Projection Engine (TEMPORARY — OI-067)
 *
 * Pure functions for building projection overlays from weekly_mh_projections data.
 * No DB imports — all data comes in as arguments.
 */

import type { WeeklyProjection, ProjectionDayOverlay, ProjectionShiftCode } from "@/types";

const ISO_DAY_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VALID_SHIFTS: ProjectionShiftCode[] = ["DAY", "SWING", "NIGHT"];

// ─── Validation ─────────────────────────────────────────────────────────────

export interface ProjectionValidation {
  valid: boolean;
  errors: string[];
}

export function validateProjectionEntry(entry: {
  customer?: string;
  dayOfWeek?: number;
  shiftCode?: string;
  projectedMh?: number;
}): ProjectionValidation {
  const errors: string[] = [];

  if (!entry.customer || entry.customer.trim().length === 0) {
    errors.push("Customer name is required");
  }

  if (entry.dayOfWeek == null || entry.dayOfWeek < 1 || entry.dayOfWeek > 7) {
    errors.push("Day of week must be 1 (Mon) through 7 (Sun)");
  }

  if (!entry.shiftCode || !VALID_SHIFTS.includes(entry.shiftCode as ProjectionShiftCode)) {
    errors.push(`Shift code must be one of: ${VALID_SHIFTS.join(", ")}`);
  }

  if (entry.projectedMh == null || entry.projectedMh < 0) {
    errors.push("Projected MH must be >= 0");
  }

  return { valid: errors.length === 0, errors };
}

// ─── Overlay Builder ────────────────────────────────────────────────────────

/**
 * Build a 7-element array (Mon=1 .. Sun=7) of daily projection overlays
 * from a list of active weekly projections.
 */
export function buildProjectionOverlay(projections: WeeklyProjection[]): ProjectionDayOverlay[] {
  const result: ProjectionDayOverlay[] = [];

  for (let dow = 1; dow <= 7; dow++) {
    const dayEntries = projections.filter((p) => p.dayOfWeek === dow);

    const byShift: Record<string, number> = {};
    const byCustomer: Record<string, number> = {};
    let total = 0;

    for (const entry of dayEntries) {
      const mh = entry.projectedMh;
      total += mh;

      // Aggregate by shift
      byShift[entry.shiftCode] = (byShift[entry.shiftCode] ?? 0) + mh;

      // Aggregate by customer
      byCustomer[entry.customer] = (byCustomer[entry.customer] ?? 0) + mh;
    }

    result.push({
      dayOfWeek: dow,
      label: ISO_DAY_LABELS[dow],
      projectedTotal: Math.round(total * 10) / 10,
      projectedByShift: roundValues(byShift),
      projectedByCustomer: roundValues(byCustomer),
    });
  }

  return result;
}

/**
 * Check whether there is any non-zero projection data.
 */
export function hasProjectionData(overlay: ProjectionDayOverlay[]): boolean {
  return overlay.some((d) => d.projectedTotal > 0);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function roundValues(record: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(record)) {
    out[k] = Math.round(v * 10) / 10;
  }
  return out;
}
