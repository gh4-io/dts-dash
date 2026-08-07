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

// ─── Effective Dating (OI-100) ──────────────────────────────────────────────

/**
 * Does this shift version apply to the given date?
 *
 * A shift is effective on `date` when the date falls inside its
 * [rotationStartDate, rotationEndDate] window. A null end date means open-ended.
 *
 * `isActive` gates only open-ended shifts. A shift that has been archived
 * (end date set, isActive cleared by `archiveStaffingShift`) is a *historical
 * fact*: it still applies to the dates it covered. Excluding archived versions
 * outright — as this engine did before OI-100 — made the current headcount
 * apply to all of history, so past capacity restated on every headcount edit.
 *
 * Note that `isWorkingDay` normalises negative offsets, so without the start
 * bound a rotation projects infinitely backwards past its own start date.
 */
export function isShiftEffectiveOn(
  shift: Pick<StaffingShift, "rotationStartDate" | "rotationEndDate" | "isActive">,
  date: string,
): boolean {
  // ISO dates (YYYY-MM-DD) compare correctly as strings
  if (date < shift.rotationStartDate) return false;
  if (shift.rotationEndDate !== null) return date <= shift.rotationEndDate;
  return shift.isActive;
}

/**
 * The date the shift's 21-day pattern is indexed from (pattern[0] == this date).
 *
 * OI-102: `rotationStartDate` used to serve as both the effective start and the
 * pattern anchor, which forced every new version onto a Sunday to preserve the
 * pattern phase — making a mid-week headcount change retroactive to the start of
 * the week. `patternAnchorDate` splits the two; null falls back to the old
 * behaviour so pre-M025 rows keep their phase exactly.
 */
export function getPatternAnchor(
  shift: Pick<StaffingShift, "rotationStartDate" | "patternAnchorDate">,
): string {
  return shift.patternAnchorDate ?? shift.rotationStartDate;
}

/**
 * Does this rotation pattern version apply to the given date? (OI-101)
 *
 * Mirrors `isShiftEffectiveOn`: a null `effectiveFrom` means "since the
 * beginning of time", a null `effectiveTo` means open-ended, and `isActive`
 * gates only open-ended versions so a superseded version still describes the
 * dates it covered.
 */
export function isPatternEffectiveOn(
  pattern: Pick<RotationPattern, "effectiveFrom" | "effectiveTo" | "isActive">,
  date: string,
): boolean {
  if (pattern.effectiveFrom !== null && date < pattern.effectiveFrom) return false;
  if (pattern.effectiveTo !== null) return date <= pattern.effectiveTo;
  return pattern.isActive;
}

/**
 * Date-aware lookup from a shift's `rotationId` to the pattern version in force.
 *
 * A shift references a specific pattern row. That row names a group, and the
 * group holds every version of the pattern over time; resolution picks the
 * version whose window contains the date. Before OI-101 a pattern was a single
 * mutable row, so editing it rewrote which days were worked for every past date.
 */
export interface PatternResolver {
  resolve(rotationId: number, date: string): RotationPattern | null;
  /** Every version, keyed by row id — for callers that need a specific row. */
  byId: Map<number, RotationPattern>;
}

export function buildPatternResolver(patterns: RotationPattern[]): PatternResolver {
  const byId = new Map<number, RotationPattern>();
  const byGroup = new Map<number, RotationPattern[]>();

  for (const p of patterns) {
    byId.set(p.id, p);
    const group = p.groupId ?? p.id;
    const bucket = byGroup.get(group);
    if (bucket) bucket.push(p);
    else byGroup.set(group, [p]);
  }

  return {
    byId,
    resolve(rotationId, date) {
      const row = byId.get(rotationId);
      if (!row) return null;

      const versions = byGroup.get(row.groupId ?? row.id);
      if (!versions) return null;

      // Windows should not overlap, but prefer the latest start if they do.
      let best: RotationPattern | null = null;
      for (const v of versions) {
        if (!isPatternEffectiveOn(v, date)) continue;
        if (best === null || (v.effectiveFrom ?? "") > (best.effectiveFrom ?? "")) best = v;
      }
      return best;
    },
  };
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
  patterns: PatternResolver,
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
    // OI-100: the effective-date window decides which version applies to this
    // date — not isActive alone, which erased archived versions from history.
    if (!isShiftEffectiveOn(shift, date)) continue;

    // OI-101: resolve the pattern *version* in force on this date, not the
    // single mutable row. isPatternEffectiveOn already applied isActive.
    const rotation = patterns.resolve(shift.rotationId, date);
    if (!rotation) continue;

    const working = isWorkingDay(date, rotation.pattern, getPatternAnchor(shift));
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
  return {
    rosterHeadcount: 0,
    effectiveHeadcount: 0,
    headcount: 0,
    paidMH: 0,
    availableMH: 0,
    productiveMH: 0,
  };
}

function addCells(a: WeeklyMatrixCell, b: WeeklyMatrixCell): WeeklyMatrixCell {
  return {
    rosterHeadcount: a.rosterHeadcount + b.rosterHeadcount,
    effectiveHeadcount: a.effectiveHeadcount + b.effectiveHeadcount,
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
  patterns: PatternResolver,
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

  // Total config headcount (sum of all shift headcounts, regardless of working day).
  // OI-100: scoped to the week being viewed, so a past week reports the headcount
  // that was in force then rather than today's.
  const totalConfigHeadcount = shifts
    .filter((s) => isShiftEffectiveOn(s, weekStart))
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

      // The three stages are distinct (see capacity-core's header):
      //   paid      = every rostered body × their paid hours — what payroll covers
      //   available = paid × paidToAvailable — after PTO, training, absence
      //   productive = available × availableToProductive × nightFactor — wrench time
      // paidToAvailable used to be folded into the headcount, which understated
      // Paid MH by that factor and left Available MH an exact copy of it.
      // Productive MH is unchanged, so utilization and every chart hold.
      const effectiveHC = shiftResult.headcount * assumptions.paidToAvailable;
      const paidMH = shiftResult.headcount * shiftResult.effectivePaidHours;
      const availableMH = paidMH * assumptions.paidToAvailable;
      const productiveMH = availableMH * assumptions.availableToProductive * nightFactor;

      const cell: WeeklyMatrixCell = {
        // Roster stays undiscounted — it is the number of people on the schedule,
        // and it is what the "HC" column and the shift grid footer must agree on.
        // Folding paidToAvailable in here made every displayed headcount read ~11%
        // low against a roster the user had just typed in.
        rosterHeadcount: shiftResult.headcount,
        effectiveHeadcount: effectiveHC,
        headcount: effectiveHC, // deprecated alias
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
  patterns: PatternResolver,
): CoverageGap[] {
  const gaps: CoverageGap[] = [];

  /**
   * Check if a shift is working on the given date.
   *
   * OI-100: the effective-date window is evaluated per date, not once up
   * front — an overnight shift is tested against both today and yesterday,
   * and a version boundary can fall between them.
   */
  function isShiftWorking(shift: StaffingShift, dateStr: string): boolean {
    if (!isShiftEffectiveOn(shift, dateStr)) return false;
    const pat = shift.rotationId ? patterns.resolve(shift.rotationId, dateStr) : null;
    if (pat) return isWorkingDay(dateStr, pat.pattern, getPatternAnchor(shift));
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

    for (const shift of shifts) {
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

// ─── Rotation Alignment ──────────────────────────────────────────────────────

/** Align a date to the preceding Sunday (pattern[0] = Sunday) */
export function alignRotationStartToSunday(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

// ─── Archive Safety ──────────────────────────────────────────────────────────

export interface ArchiveSafetyResult {
  safe: boolean;
  message?: string;
}

/** Check whether archiving a shift leaves a gap — another active shift must exist in same config+category */
export function canArchiveShift(
  shift: { id: number; configId: number; category: string },
  allShifts: Array<{
    id: number;
    configId: number;
    category: string;
    isActive: boolean;
    rotationEndDate: string | null;
  }>,
): ArchiveSafetyResult {
  const today = new Date().toISOString().slice(0, 10);
  const hasReplacement = allShifts.some(
    (s) =>
      s.id !== shift.id &&
      s.configId === shift.configId &&
      s.category === shift.category &&
      s.isActive &&
      (s.rotationEndDate === null || s.rotationEndDate >= today),
  );
  if (hasReplacement) return { safe: true };
  return {
    safe: false,
    message: `No active ${shift.category} replacement exists. Archive anyway?`,
  };
}

// ─── Version Overlap Detection ───────────────────────────────────────────────

export interface ShiftOverlap {
  name: string;
  shiftIds: number[];
  /** First date on which every listed version is simultaneously effective. */
  fromDate: string;
  combinedHeadcount: number;
}

/**
 * Find shifts that share a name within a config and are effective at the same time.
 *
 * Two versions of one shift must never be effective on the same date — the engine
 * sums whatever it finds, so an overlap silently double-counts that shift's roster.
 * `versionStaffingShift` closes the old version the day before the new one opens, but
 * a version created any other way (Add Shift, a direct PUT, an import) leaves the
 * predecessor open-ended, and nothing has flagged that until now.
 *
 * Detection is by name because that is the only lineage marker `staffing_shifts`
 * carries — unlike `rotation_patterns`, it has no `group_id` (see OI-101).
 */
export function findShiftOverlaps(shifts: StaffingShift[]): ShiftOverlap[] {
  const byKey = new Map<string, StaffingShift[]>();
  for (const s of shifts) {
    const key = `${s.configId} ${s.name}`;
    const list = byKey.get(key);
    if (list) list.push(s);
    else byKey.set(key, [s]);
  }

  const overlaps: ShiftOverlap[] = [];
  for (const group of byKey.values()) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        // Windows intersect when each starts on or before the other ends.
        const start = a.rotationStartDate > b.rotationStartDate ? a : b;
        const overlapStart = start.rotationStartDate;
        if (!isShiftEffectiveOn(a, overlapStart) || !isShiftEffectiveOn(b, overlapStart)) {
          continue;
        }
        overlaps.push({
          name: a.name,
          shiftIds: [a.id, b.id],
          fromDate: overlapStart,
          combinedHeadcount: a.headcount + b.headcount,
        });
      }
    }
  }
  return overlaps;
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
  patterns: PatternResolver,
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

/**
 * Build a date-aware pattern lookup.
 *
 * Named "map" for history — it returned a plain `Map<id, RotationPattern>` before
 * OI-101 made patterns versioned. It now returns a {@link PatternResolver}; use
 * `.resolve(rotationId, date)`, or `.byId` when you genuinely want one row.
 */
export function buildPatternMap(patterns: RotationPattern[]): PatternResolver {
  return buildPatternResolver(patterns);
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
