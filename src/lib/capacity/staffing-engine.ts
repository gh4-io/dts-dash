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
  CoverageGap,
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

      const effectiveHC = shiftResult.headcount * assumptions.paidToAvailable;
      const paidMH = effectiveHC * shiftResult.effectivePaidHours;
      const availableMH = paidMH;
      const productiveMH = paidMH * assumptions.availableToProductive * nightFactor;

      const cell: WeeklyMatrixCell = {
        headcount: effectiveHC,
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

  // Compute time-based coverage gaps
  const coverageGaps = computeCoverageGaps(days, shifts, patterns);

  return {
    weekStart,
    days,
    categoryTotals,
    grandTotal,
    totalConfigHeadcount,
    coverageGaps,
  };
}

// ─── Coverage Gap Analysis ────────────────────────────────────────────────

/**
 * Mark which hours in a 24-hour day are covered by a shift's time range.
 * Handles overnight wrapping (e.g., 23:00→07:00 covers hours 23,0,1,2,3,4,5,6).
 */
function markCoveredHours(
  covered: boolean[],
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  portion: "full" | "evening" | "morning",
): void {
  // Convert to fractional hours for edge handling
  const startFrac = startHour + startMinute / 60;
  const endFrac = endHour + endMinute / 60;
  const isOvernight = startFrac >= endFrac;

  if (!isOvernight) {
    // Normal range (e.g., 07:00→15:00) — only has a "full" portion
    if (portion !== "morning") {
      for (let h = 0; h < 24; h++) {
        if (h + 1 > startFrac && h < endFrac) covered[h] = true;
      }
    }
  } else {
    // Overnight range (e.g., 19:00→08:00)
    // "evening" = the startHour→23:59 portion (belongs to the start day)
    // "morning" = the 00:00→endHour portion (belongs to the next day)
    if (portion === "evening" || portion === "full") {
      for (let h = 0; h < 24; h++) {
        if (h + 1 > startFrac) covered[h] = true;
      }
    }
    if (portion === "morning" || portion === "full") {
      for (let h = 0; h < 24; h++) {
        if (h < endFrac) covered[h] = true;
      }
    }
  }
}

/**
 * Find contiguous ranges of uncovered hours from a 24-hour boolean array.
 */
function findUncoveredRanges(covered: boolean[]): Array<{ startHour: number; endHour: number }> {
  const ranges: Array<{ startHour: number; endHour: number }> = [];
  let i = 0;
  while (i < 24) {
    if (!covered[i]) {
      const start = i;
      while (i < 24 && !covered[i]) i++;
      ranges.push({ startHour: start, endHour: i });
    } else {
      i++;
    }
  }
  return ranges;
}

/**
 * Compute time-based coverage gaps for each day in the matrix.
 * Checks which hours (0-23) are covered by at least one working shift.
 * Returns only days that have uncovered hours.
 */
export function computeCoverageGaps(
  days: Array<{ date: string; dayOfWeek: number }>,
  shifts: StaffingShift[],
  patterns: Map<number, RotationPattern>,
): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  const activeShifts = shifts.filter((s) => s.isActive);

  /** Check if a shift is working on the given date */
  function isShiftWorking(shift: StaffingShift, dateStr: string): boolean {
    const pat = shift.rotationId ? patterns.get(shift.rotationId) : null;
    if (pat) return isWorkingDay(dateStr, pat.pattern, shift.rotationStartDate);
    // Orphaned shift (rotationId 0 or null) — not working
    return false;
  }

  /** Get the previous calendar day as YYYY-MM-DD */
  function prevDay(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().split("T")[0];
  }

  /** Is this shift an overnight shift (crosses midnight)? */
  function isOvernightShift(shift: StaffingShift): boolean {
    const startFrac = shift.startHour + shift.startMinute / 60;
    const endFrac = shift.endHour + shift.endMinute / 60;
    return startFrac >= endFrac;
  }

  for (const day of days) {
    const covered = new Array<boolean>(24).fill(false);
    const yesterday = prevDay(day.date);

    for (const shift of activeShifts) {
      if (isOvernightShift(shift)) {
        // Overnight shift (e.g., 19:00→08:00):
        // If working TODAY: covers today's evening (19:00→23:59)
        if (isShiftWorking(shift, day.date)) {
          markCoveredHours(
            covered,
            shift.startHour,
            shift.startMinute,
            shift.endHour,
            shift.endMinute,
            "evening",
          );
        }
        // If working YESTERDAY: covers today's morning (00:00→08:00)
        if (isShiftWorking(shift, yesterday)) {
          markCoveredHours(
            covered,
            shift.startHour,
            shift.startMinute,
            shift.endHour,
            shift.endMinute,
            "morning",
          );
        }
      } else {
        // Normal shift (e.g., 07:00→15:00): only affects today
        if (isShiftWorking(shift, day.date)) {
          markCoveredHours(
            covered,
            shift.startHour,
            shift.startMinute,
            shift.endHour,
            shift.endMinute,
            "full",
          );
        }
      }
    }

    const uncoveredRanges = findUncoveredRanges(covered);
    if (uncoveredRanges.length > 0) {
      gaps.push({
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        uncoveredRanges,
      });
    }
  }

  return gaps;
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
