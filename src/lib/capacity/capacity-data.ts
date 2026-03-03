/**
 * Capacity Data Access Layer (v0.3.0)
 *
 * Drizzle queries for loading capacity modeling data from SQLite.
 * All functions return plain objects (no DB cursors or lazy evaluation).
 */

import { db } from "@/lib/db/client";
import { eq, and, lte, gte, or, isNull } from "drizzle-orm";
import {
  capacityShifts,
  capacityAssumptions,
  headcountPlans,
  headcountExceptions,
} from "@/lib/db/schema";
import type {
  CapacityShift,
  CapacityAssumptions,
  HeadcountPlan,
  HeadcountException,
} from "@/types";

// ─── Shifts ────────────────────────────────────────────────────────────────

export function loadShifts(): CapacityShift[] {
  const rows = db
    .select()
    .from(capacityShifts)
    .where(eq(capacityShifts.isActive, true))
    .orderBy(capacityShifts.sortOrder)
    .all();

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    startHour: r.startHour,
    endHour: r.endHour,
    paidHours: r.paidHours,
    timezone: r.timezone,
    minHeadcount: r.minHeadcount,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
  }));
}

// ─── Assumptions ───────────────────────────────────────────────────────────

export function loadAssumptions(): CapacityAssumptions | null {
  const row = db
    .select()
    .from(capacityAssumptions)
    .where(eq(capacityAssumptions.isActive, true))
    .limit(1)
    .get();

  if (!row) return null;

  return {
    id: row.id,
    station: row.station,
    paidToAvailable: row.paidToAvailable,
    availableToProductive: row.availableToProductive,
    defaultMhNoWp: row.defaultMhNoWp,
    nightProductivityFactor: row.nightProductivityFactor,
    demandCurve: row.demandCurve as "EVEN" | "WEIGHTED",
    arrivalWeight: row.arrivalWeight,
    departureWeight: row.departureWeight,
    allocationMode: row.allocationMode as "DISTRIBUTE",
    isActive: row.isActive,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
  };
}

// ─── Headcount Plans ───────────────────────────────────────────────────────

/**
 * Load headcount plans, optionally filtered by date range.
 * If startDate/endDate provided, only loads plans that overlap with the range.
 */
export function loadPlans(startDate?: string, endDate?: string): HeadcountPlan[] {
  let rows;

  if (startDate && endDate) {
    // Plans that overlap with [startDate, endDate]:
    // effectiveFrom <= endDate AND (effectiveTo IS NULL OR effectiveTo >= startDate)
    rows = db
      .select()
      .from(headcountPlans)
      .where(
        and(
          lte(headcountPlans.effectiveFrom, endDate),
          or(isNull(headcountPlans.effectiveTo), gte(headcountPlans.effectiveTo, startDate)),
        ),
      )
      .all();
  } else {
    rows = db.select().from(headcountPlans).all();
  }

  return rows.map((r) => ({
    id: r.id,
    station: r.station,
    shiftId: r.shiftId,
    headcount: r.headcount,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    dayOfWeek: r.dayOfWeek,
    label: r.label,
    notes: r.notes,
  }));
}

// ─── Headcount Exceptions ──────────────────────────────────────────────────

/**
 * Load headcount exceptions, optionally filtered by date range.
 */
export function loadExceptions(startDate?: string, endDate?: string): HeadcountException[] {
  let rows;

  if (startDate && endDate) {
    rows = db
      .select()
      .from(headcountExceptions)
      .where(
        and(
          gte(headcountExceptions.exceptionDate, startDate),
          lte(headcountExceptions.exceptionDate, endDate),
        ),
      )
      .all();
  } else {
    rows = db.select().from(headcountExceptions).all();
  }

  return rows.map((r) => ({
    id: r.id,
    station: r.station,
    shiftId: r.shiftId,
    exceptionDate: r.exceptionDate,
    headcountDelta: r.headcountDelta,
    reason: r.reason,
  }));
}
