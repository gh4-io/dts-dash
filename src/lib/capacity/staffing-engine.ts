/**
 * Staffing Engine (v0.3.0)
 *
 * Pure computation functions for rotation-based staffing resolution.
 * Converts rotation patterns + shift definitions into headcount-per-category-per-date,
 * which can feed the existing capacity engine.
 *
 * Zero DB dependencies — all data passed as arguments.
 */

import type {
  RotationPattern,
  StaffingShift,
  StaffingShiftCategory,
  StaffingDayResult,
  WeeklyMatrixCell,
  WeeklyMatrixResult,
  CapacityAssumptions,
} from "@/types";

// ─── Core Rotation Logic ────────────────────────────────────────────────────

/**
 * Given a target date, rotation pattern, and anchor start date,
 * determine whether the rotation says "work" on that date.
 *
 * The pattern is a 21-character string (x=work, o=off),
 * representing a 3-week (21-day) repeating cycle.
 * Position 0 corresponds to the rotationStartDate.
 */
export function isWorkingDay(
  targetDate: string,
  pattern: string,
  rotationStartDate: string,
): boolean {
  const target = new Date(targetDate + "T00:00:00Z");
  const start = new Date(rotationStartDate + "T00:00:00Z");
  const diffMs = target.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  const dayIndex = ((diffDays % 21) + 21) % 21; // handles negative offsets
  return pattern[dayIndex] === "x";
}

// ─── Effective Paid Hours ───────────────────────────────────────────────────

/**
 * Compute the effective paid hours for a staffing shift.
 * Uses mhOverride if set, otherwise computes from shift duration minus breaks/lunch.
 */
export function computeEffectivePaidHours(shift: StaffingShift): number {
  if (shift.mhOverride != null) {
    return shift.mhOverride;
  }

  // Compute shift duration from start/end times
  const startTotalMinutes = shift.startHour * 60 + shift.startMinute;
  const endTotalMinutes = shift.endHour * 60 + shift.endMinute;

  let durationMinutes: number;
  if (endTotalMinutes > startTotalMinutes) {
    durationMinutes = endTotalMinutes - startTotalMinutes;
  } else {
    // Overnight shift (e.g., 23:00 - 07:00)
    durationMinutes = 24 * 60 - startTotalMinutes + endTotalMinutes;
  }

  const netMinutes = durationMinutes - shift.breakMinutes - shift.lunchMinutes;
  return Math.max(0, netMinutes / 60);
}

// ─── Daily Resolution ───────────────────────────────────────────────────────

/**
 * For a given date, resolve all staffing shifts and compute headcount
 * per category and per shift.
 *
 * @param date YYYY-MM-DD
 * @param shifts Active staffing shifts for the config
 * @param patterns All rotation patterns (keyed by ID for fast lookup)
 */
export function resolveStaffingDay(
  date: string,
  shifts: StaffingShift[],
  patterns: Map<number, RotationPattern>,
): StaffingDayResult {
  const byCategory: Record<StaffingShiftCategory, number> = {
    DAY: 0,
    SWING: 0,
    NIGHT: 0,
    OTHER: 0,
  };

  const byShift: StaffingDayResult["byShift"] = [];
  let totalHeadcount = 0;

  for (const shift of shifts) {
    if (!shift.isActive) continue;

    const rotation = patterns.get(shift.rotationId);
    if (!rotation || !rotation.isActive) continue;

    const working = isWorkingDay(date, rotation.pattern, shift.rotationStartDate);
    const effectivePaidHours = computeEffectivePaidHours(shift);

    byShift.push({
      shiftId: shift.id,
      shiftName: shift.name,
      category: shift.category,
      isWorking: working,
      headcount: working ? shift.headcount : 0,
      effectivePaidHours,
    });

    if (working) {
      byCategory[shift.category] += shift.headcount;
      totalHeadcount += shift.headcount;
    }
  }

  return { date, byCategory, byShift, totalHeadcount };
}

// ─── Weekly Matrix ──────────────────────────────────────────────────────────

function emptyCell(): WeeklyMatrixCell {
  return { headcount: 0, paidMH: 0, availableMH: 0, productiveMH: 0 };
}

function addCells(a: WeeklyMatrixCell, b: WeeklyMatrixCell): WeeklyMatrixCell {
  return {
    headcount: a.headcount + b.headcount,
    paidMH: a.paidMH + b.paidMH,
    availableMH: a.availableMH + b.availableMH,
    productiveMH: a.productiveMH + b.productiveMH,
  };
}

/**
 * Compute the full weekly matrix for a staffing config.
 *
 * Returns 7 days × categories with headcount, paid MH, available MH, productive MH.
 * Uses the productivity chain from capacity_assumptions.
 */
export function computeWeeklyMatrix(
  weekStart: string,
  shifts: StaffingShift[],
  patterns: Map<number, RotationPattern>,
  assumptions: CapacityAssumptions,
): WeeklyMatrixResult {
  const categories: StaffingShiftCategory[] = ["DAY", "SWING", "NIGHT", "OTHER"];

  const days: WeeklyMatrixResult["days"] = [];
  const categoryTotals: Record<StaffingShiftCategory, WeeklyMatrixCell> = {
    DAY: emptyCell(),
    SWING: emptyCell(),
    NIGHT: emptyCell(),
    OTHER: emptyCell(),
  };
  let grandTotal = emptyCell();

  // Total config headcount (sum of all shift headcounts, regardless of working day)
  const totalConfigHeadcount = shifts
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + s.headcount, 0);

  const startDate = new Date(weekStart + "T00:00:00Z");

  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayOfWeek = d.getUTCDay(); // 0=Sun

    const dayResult = resolveStaffingDay(dateStr, shifts, patterns);

    const byCategory: Record<StaffingShiftCategory, WeeklyMatrixCell> = {
      DAY: emptyCell(),
      SWING: emptyCell(),
      NIGHT: emptyCell(),
      OTHER: emptyCell(),
    };
    let dayTotal = emptyCell();

    // Aggregate by category from per-shift results
    for (const shiftResult of dayResult.byShift) {
      if (!shiftResult.isWorking) continue;

      const cat = shiftResult.category;
      const isNight = cat === "NIGHT";
      const nightFactor = isNight ? assumptions.nightProductivityFactor : 1.0;

      const paidMH = shiftResult.headcount * shiftResult.effectivePaidHours;
      const availableMH = paidMH * assumptions.paidToAvailable;
      const productiveMH = availableMH * assumptions.availableToProductive * nightFactor;

      const cell: WeeklyMatrixCell = {
        headcount: shiftResult.headcount,
        paidMH,
        availableMH,
        productiveMH,
      };

      byCategory[cat] = addCells(byCategory[cat], cell);
      dayTotal = addCells(dayTotal, cell);
    }

    // Accumulate into category totals and grand total
    for (const cat of categories) {
      categoryTotals[cat] = addCells(categoryTotals[cat], byCategory[cat]);
    }
    grandTotal = addCells(grandTotal, dayTotal);

    days.push({ date: dateStr, dayOfWeek, byCategory, total: dayTotal });
  }

  return {
    weekStart,
    days,
    categoryTotals,
    grandTotal,
    totalConfigHeadcount,
  };
}

// ─── Capacity Engine Integration ────────────────────────────────────────────

/**
 * Resolve staffing headcounts for a range of dates, producing output
 * compatible with the capacity engine's computeDailyCapacityV2.
 *
 * Maps staffing categories → capacity shift codes (DAY→DAY, SWING→SWING, NIGHT→NIGHT).
 * OTHER category is excluded from capacity computation (supplemental/non-standard).
 */
export function resolveStaffingForCapacity(
  dates: string[],
  shifts: StaffingShift[],
  patterns: Map<number, RotationPattern>,
): Map<string, Map<string, { headcount: number; effectivePaidHours: number }>> {
  // Returns: Map<date, Map<shiftCode, {headcount, effectivePaidHours}>>
  const result = new Map<string, Map<string, { headcount: number; effectivePaidHours: number }>>();

  for (const date of dates) {
    const dayResult = resolveStaffingDay(date, shifts, patterns);
    const shiftMap = new Map<string, { headcount: number; effectivePaidHours: number }>();

    // Aggregate by category, using category as shift code
    for (const shiftResult of dayResult.byShift) {
      if (!shiftResult.isWorking) continue;

      const code = shiftResult.category;
      if (code === "OTHER") continue; // excluded from capacity engine

      const existing = shiftMap.get(code) ?? { headcount: 0, effectivePaidHours: 0 };
      const newHeadcount = existing.headcount + shiftResult.headcount;

      // Weighted average of effectivePaidHours by headcount
      const totalPeople = newHeadcount;
      const weightedHours =
        totalPeople > 0
          ? (existing.effectivePaidHours * existing.headcount +
              shiftResult.effectivePaidHours * shiftResult.headcount) /
            totalPeople
          : 0;

      shiftMap.set(code, {
        headcount: newHeadcount,
        effectivePaidHours: weightedHours,
      });
    }

    result.set(date, shiftMap);
  }

  return result;
}

// ─── Pattern Helpers ────────────────────────────────────────────────────────

/** Build a Map<id, RotationPattern> for fast lookup */
export function buildPatternMap(patterns: RotationPattern[]): Map<number, RotationPattern> {
  const map = new Map<number, RotationPattern>();
  for (const p of patterns) {
    map.set(p.id, p);
  }
  return map;
}

/** Validate a rotation pattern string */
export function validatePattern(pattern: string): string | null {
  if (pattern.length !== 21) {
    return `Pattern must be exactly 21 characters (got ${pattern.length})`;
  }
  if (!/^[xo]+$/.test(pattern)) {
    return "Pattern must only contain 'x' (work) and 'o' (off)";
  }
  return null; // valid
}

/** Count working days in a pattern */
export function countWorkingDays(pattern: string): number {
  return pattern.split("").filter((c) => c === "x").length;
}
