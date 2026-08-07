/**
 * Tests for staffing shift versioning utilities:
 * - alignRotationStartToSunday()
 * - canArchiveShift()
 * - isShiftEffectiveOn()      (OI-100)
 * - resolveStaffingDay() across a version boundary (OI-100)
 * - getPatternAnchor() — anchor/effective-date split (OI-102)
 * - isPatternEffectiveOn() / buildPatternResolver() — pattern versioning (OI-101)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  alignRotationStartToSunday,
  canArchiveShift,
  isShiftEffectiveOn,
  resolveStaffingDay,
  buildPatternMap,
  getPatternAnchor,
  isWorkingDay,
  isPatternEffectiveOn,
  buildPatternResolver,
} from "@/lib/capacity/staffing-engine";
import type { RotationPattern, StaffingShift } from "@/types";

// ─── alignRotationStartToSunday ─────────────────────────────────────────────

describe("alignRotationStartToSunday", () => {
  it("returns same date when already Sunday", () => {
    // 2026-01-04 is a Sunday
    expect(alignRotationStartToSunday("2026-01-04")).toBe("2026-01-04");
  });

  it("aligns Monday to previous Sunday", () => {
    // 2026-01-05 is Monday → should align to 2026-01-04 (Sunday)
    expect(alignRotationStartToSunday("2026-01-05")).toBe("2026-01-04");
  });

  it("aligns Saturday to previous Sunday", () => {
    // 2026-01-10 is Saturday → should align to 2026-01-04 (Sunday)
    expect(alignRotationStartToSunday("2026-01-10")).toBe("2026-01-04");
  });

  it("aligns Wednesday to previous Sunday", () => {
    // 2026-01-07 is Wednesday → should align to 2026-01-04 (Sunday)
    expect(alignRotationStartToSunday("2026-01-07")).toBe("2026-01-04");
  });

  it("handles Jan 1 mid-week (crosses year boundary)", () => {
    // 2025-01-01 is Wednesday → should align to 2024-12-29 (Sunday)
    expect(alignRotationStartToSunday("2025-01-01")).toBe("2024-12-29");
  });
});

// ─── canArchiveShift ────────────────────────────────────────────────────────

describe("canArchiveShift", () => {
  // Fix "today" so tests are deterministic
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const target = { id: 1, configId: 1, category: "DAY" };

  it("returns safe:false when only shift in category", () => {
    const all = [{ id: 1, configId: 1, category: "DAY", isActive: true, rotationEndDate: null }];
    const result = canArchiveShift(target, all);
    expect(result.safe).toBe(false);
    expect(result.message).toContain("No active DAY replacement");
  });

  it("returns safe:true when active replacement exists (no end date)", () => {
    const all = [
      { id: 1, configId: 1, category: "DAY", isActive: true, rotationEndDate: null },
      { id: 2, configId: 1, category: "DAY", isActive: true, rotationEndDate: null },
    ];
    const result = canArchiveShift(target, all);
    expect(result.safe).toBe(true);
  });

  it("returns safe:false when replacement has past end date", () => {
    const all = [
      { id: 1, configId: 1, category: "DAY", isActive: true, rotationEndDate: null },
      { id: 2, configId: 1, category: "DAY", isActive: true, rotationEndDate: "2026-03-01" },
    ];
    const result = canArchiveShift(target, all);
    expect(result.safe).toBe(false);
  });

  it("returns safe:true when replacement has future end date", () => {
    const all = [
      { id: 1, configId: 1, category: "DAY", isActive: true, rotationEndDate: null },
      { id: 2, configId: 1, category: "DAY", isActive: true, rotationEndDate: "2026-12-31" },
    ];
    const result = canArchiveShift(target, all);
    expect(result.safe).toBe(true);
  });

  it("returns safe:false when replacement is different category", () => {
    const all = [
      { id: 1, configId: 1, category: "DAY", isActive: true, rotationEndDate: null },
      { id: 2, configId: 1, category: "NIGHT", isActive: true, rotationEndDate: null },
    ];
    const result = canArchiveShift(target, all);
    expect(result.safe).toBe(false);
  });

  it("returns safe:false when replacement is different configId", () => {
    const all = [
      { id: 1, configId: 1, category: "DAY", isActive: true, rotationEndDate: null },
      { id: 2, configId: 2, category: "DAY", isActive: true, rotationEndDate: null },
    ];
    const result = canArchiveShift(target, all);
    expect(result.safe).toBe(false);
  });

  it("returns safe:false when replacement is inactive", () => {
    const all = [
      { id: 1, configId: 1, category: "DAY", isActive: true, rotationEndDate: null },
      { id: 2, configId: 1, category: "DAY", isActive: false, rotationEndDate: null },
    ];
    const result = canArchiveShift(target, all);
    expect(result.safe).toBe(false);
  });
});

// ─── Effective Dating (OI-100) ──────────────────────────────────────────────

const ALWAYS_ON: RotationPattern = {
  id: 1,
  groupId: 1,
  name: "All On",
  description: null,
  effectiveFrom: null,
  effectiveTo: null,
  pattern: "xxxxxxxxxxxxxxxxxxxxx",
  isActive: true,
  sortOrder: 0,
};

function makeShift(overrides: Partial<StaffingShift> & { id: number }): StaffingShift {
  return {
    configId: 1,
    name: "Test Shift",
    description: null,
    category: "DAY",
    rotationId: 1,
    rotationStartDate: "2026-01-04", // a Sunday
    rotationEndDate: null,
    patternAnchorDate: null,
    startHour: 7,
    startMinute: 0,
    endHour: 15,
    endMinute: 0,
    breakMinutes: 0,
    lunchMinutes: 0,
    mhOverride: null,
    headcount: 10,
    isActive: true,
    sortOrder: 0,
    ...overrides,
  };
}

describe("isShiftEffectiveOn", () => {
  it("excludes dates before the rotation start", () => {
    const shift = makeShift({ id: 1, rotationStartDate: "2026-01-04" });
    expect(isShiftEffectiveOn(shift, "2026-01-03")).toBe(false);
  });

  it("includes the rotation start date itself", () => {
    const shift = makeShift({ id: 1, rotationStartDate: "2026-01-04" });
    expect(isShiftEffectiveOn(shift, "2026-01-04")).toBe(true);
  });

  it("includes any date after an open-ended start", () => {
    const shift = makeShift({ id: 1, rotationEndDate: null });
    expect(isShiftEffectiveOn(shift, "2030-06-15")).toBe(true);
  });

  it("includes the end date itself (inclusive)", () => {
    const shift = makeShift({ id: 1, rotationEndDate: "2026-03-01" });
    expect(isShiftEffectiveOn(shift, "2026-03-01")).toBe(true);
  });

  it("excludes dates after the end date", () => {
    const shift = makeShift({ id: 1, rotationEndDate: "2026-03-01" });
    expect(isShiftEffectiveOn(shift, "2026-03-02")).toBe(false);
  });

  it("includes an archived version inside its window despite isActive=false", () => {
    // archiveStaffingShift() sets both rotationEndDate and isActive=false;
    // the version is still a historical fact for the dates it covered
    const shift = makeShift({ id: 1, rotationEndDate: "2026-03-01", isActive: false });
    expect(isShiftEffectiveOn(shift, "2026-02-01")).toBe(true);
  });

  it("excludes an open-ended shift that was manually deactivated", () => {
    const shift = makeShift({ id: 1, rotationEndDate: null, isActive: false });
    expect(isShiftEffectiveOn(shift, "2026-06-01")).toBe(false);
  });
});

describe("resolveStaffingDay — version boundaries (OI-100)", () => {
  const patterns = buildPatternMap([ALWAYS_ON]);

  // Two versions of the same shift: 20 heads until 2026-03-01, 30 heads after.
  const oldVersion = makeShift({
    id: 1,
    headcount: 20,
    rotationStartDate: "2026-01-04",
    rotationEndDate: "2026-03-01",
    isActive: false, // archived
  });
  const newVersion = makeShift({
    id: 2,
    headcount: 30,
    rotationStartDate: "2026-03-02",
    rotationEndDate: null,
    isActive: true,
  });
  const shifts = [oldVersion, newVersion];

  it("resolves a past date to the historical headcount", () => {
    const result = resolveStaffingDay("2026-02-01", shifts, patterns);
    expect(result.totalHeadcount).toBe(20);
    expect(result.byCategory.DAY).toBe(20);
  });

  it("resolves a current date to the current headcount", () => {
    const result = resolveStaffingDay("2026-06-01", shifts, patterns);
    expect(result.totalHeadcount).toBe(30);
  });

  it("does not double-count on either side of the boundary", () => {
    expect(resolveStaffingDay("2026-03-01", shifts, patterns).totalHeadcount).toBe(20);
    expect(resolveStaffingDay("2026-03-02", shifts, patterns).totalHeadcount).toBe(30);
  });

  it("reports zero before any version was in force", () => {
    // Regression: isWorkingDay normalises negative offsets, so without the
    // start bound the rotation projected infinitely backwards.
    const result = resolveStaffingDay("2025-06-01", shifts, patterns);
    expect(result.totalHeadcount).toBe(0);
    expect(result.byShift).toHaveLength(0);
  });

  it("keeps history stable when a newer version is added", () => {
    const past = resolveStaffingDay("2026-02-01", shifts, patterns).totalHeadcount;

    const withAnother = [
      ...shifts,
      makeShift({ id: 3, headcount: 99, rotationStartDate: "2026-09-06", isActive: true }),
    ];
    const pastAfter = resolveStaffingDay("2026-02-01", withAnother, patterns).totalHeadcount;

    expect(pastAfter).toBe(past);
  });
});

// ─── Pattern Anchor vs Effective Start (OI-102) ─────────────────────────────

describe("getPatternAnchor", () => {
  it("falls back to rotationStartDate when no anchor is set", () => {
    const shift = makeShift({ id: 1, rotationStartDate: "2026-01-04", patternAnchorDate: null });
    expect(getPatternAnchor(shift)).toBe("2026-01-04");
  });

  it("prefers an explicit anchor over the effective start", () => {
    const shift = makeShift({
      id: 1,
      rotationStartDate: "2026-03-05", // Thursday — mid-week version start
      patternAnchorDate: "2026-03-01", // Sunday — pattern phase
    });
    expect(getPatternAnchor(shift)).toBe("2026-03-01");
  });
});

describe("version boundary preserves rotation phase (OI-102)", () => {
  // "oxxxxox..." — Sunday off, Mon-Fri on, Saturday off (anchored to a Sunday)
  const WEEKDAYS: RotationPattern = {
    id: 2,
    groupId: 2,
    name: "5-2",
    description: null,
    effectiveFrom: null,
    effectiveTo: null,
    pattern: "oxxxxoxoxxxxoxoxxxxox",
    isActive: true,
    sortOrder: 0,
  };
  const patterns = buildPatternMap([WEEKDAYS]);

  // v1 anchored (and started) on Sunday 2026-01-04.
  const v1 = makeShift({
    id: 1,
    rotationId: 2,
    headcount: 20,
    rotationStartDate: "2026-01-04",
    patternAnchorDate: null, // falls back to the start — legacy shape
    rotationEndDate: "2026-03-04", // closed the day before v2 opens
    isActive: false,
  });

  // v2 takes effect Thursday 2026-03-05 but keeps v1's Sunday anchor.
  const v2 = makeShift({
    id: 2,
    rotationId: 2,
    headcount: 30,
    rotationStartDate: "2026-03-05", // Thursday — the save date
    patternAnchorDate: "2026-01-04", // inherited anchor
    rotationEndDate: null,
    isActive: true,
  });

  const shifts = [v1, v2];

  it("keeps the same working days across the boundary", () => {
    // 2026-03-05 is a Thursday — a working day under this pattern both before
    // and after the split. Phase must not shift when the version changes.
    expect(isWorkingDay("2026-03-05", WEEKDAYS.pattern, getPatternAnchor(v1))).toBe(true);
    expect(isWorkingDay("2026-03-05", WEEKDAYS.pattern, getPatternAnchor(v2))).toBe(true);
  });

  it("agrees with v1's phase on every day of the changeover week", () => {
    for (const date of [
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-07",
    ]) {
      expect(isWorkingDay(date, WEEKDAYS.pattern, getPatternAnchor(v2))).toBe(
        isWorkingDay(date, WEEKDAYS.pattern, getPatternAnchor(v1)),
      );
    }
  });

  it("does not restate days before the save date", () => {
    // Wed 2026-03-04 is still v1 at 20 heads
    expect(resolveStaffingDay("2026-03-04", shifts, patterns).totalHeadcount).toBe(20);
  });

  it("applies the new headcount from the save date onward", () => {
    // Thu 2026-03-05 is v2 at 30 heads
    expect(resolveStaffingDay("2026-03-05", shifts, patterns).totalHeadcount).toBe(30);
  });

  it("never counts both versions on the same date", () => {
    for (const date of ["2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"]) {
      const result = resolveStaffingDay(date, shifts, patterns);
      expect(result.byShift.length).toBeLessThanOrEqual(1);
    }
  });
});

// ─── Rotation Pattern Versioning (OI-101) ───────────────────────────────────

function makePattern(o: Partial<RotationPattern> & { id: number }): RotationPattern {
  return {
    groupId: o.id,
    name: "P",
    description: null,
    pattern: "xxxxxxxxxxxxxxxxxxxxx",
    effectiveFrom: null,
    effectiveTo: null,
    isActive: true,
    sortOrder: 0,
    ...o,
  };
}

describe("isPatternEffectiveOn", () => {
  it("treats a null effectiveFrom as since-the-beginning", () => {
    const p = makePattern({ id: 1, effectiveFrom: null });
    expect(isPatternEffectiveOn(p, "1999-01-01")).toBe(true);
  });

  it("excludes dates before an explicit effectiveFrom", () => {
    const p = makePattern({ id: 1, effectiveFrom: "2026-03-01" });
    expect(isPatternEffectiveOn(p, "2026-02-28")).toBe(false);
    expect(isPatternEffectiveOn(p, "2026-03-01")).toBe(true);
  });

  it("includes a superseded version inside its window despite isActive=false", () => {
    const p = makePattern({ id: 1, effectiveTo: "2026-03-01", isActive: false });
    expect(isPatternEffectiveOn(p, "2026-02-01")).toBe(true);
    expect(isPatternEffectiveOn(p, "2026-03-02")).toBe(false);
  });

  it("excludes an open-ended version that was deactivated", () => {
    const p = makePattern({ id: 1, effectiveTo: null, isActive: false });
    expect(isPatternEffectiveOn(p, "2026-06-01")).toBe(false);
  });
});

describe("buildPatternResolver", () => {
  // Group 1: weekdays until 2026-03-04, then all-on from 2026-03-05.
  const v1 = makePattern({
    id: 1,
    groupId: 1,
    pattern: "oxxxxoxoxxxxoxoxxxxox",
    effectiveFrom: null,
    effectiveTo: "2026-03-04",
    isActive: false,
  });
  const v2 = makePattern({
    id: 9,
    groupId: 1,
    pattern: "xxxxxxxxxxxxxxxxxxxxx",
    effectiveFrom: "2026-03-05",
    effectiveTo: null,
    isActive: true,
  });
  const resolver = buildPatternResolver([v1, v2]);

  it("resolves a past date to the superseded version", () => {
    expect(resolver.resolve(1, "2026-02-01")?.id).toBe(1);
  });

  it("resolves a current date to the newest version", () => {
    expect(resolver.resolve(1, "2026-06-01")?.id).toBe(9);
  });

  it("follows the group even when the shift references the OLD row id", () => {
    // Shifts keep their original rotationId; resolution must still find v2.
    expect(resolver.resolve(1, "2026-03-05")?.id).toBe(9);
  });

  it("resolves identically whichever version id is referenced", () => {
    expect(resolver.resolve(9, "2026-02-01")?.id).toBe(resolver.resolve(1, "2026-02-01")?.id);
  });

  it("returns null for an unknown rotation id", () => {
    expect(resolver.resolve(404, "2026-06-01")).toBeNull();
  });

  it("returns null when no version covers the date", () => {
    const orphan = buildPatternResolver([
      makePattern({ id: 2, groupId: 2, effectiveFrom: "2030-01-01" }),
    ]);
    expect(orphan.resolve(2, "2026-01-01")).toBeNull();
  });

  it("keeps ungrouped legacy rows working as their own group", () => {
    const legacy = buildPatternResolver([makePattern({ id: 3 })]);
    expect(legacy.resolve(3, "2026-01-01")?.id).toBe(3);
  });
});

describe("pattern edits do not rewrite history (OI-101)", () => {
  const v1 = makePattern({
    id: 1,
    groupId: 1,
    pattern: "oxxxxoxoxxxxoxoxxxxox", // Sun off
    effectiveFrom: null,
    effectiveTo: "2026-03-04",
    isActive: false,
  });
  const v2 = makePattern({
    id: 9,
    groupId: 1,
    pattern: "xxxxxxxxxxxxxxxxxxxxx", // every day on
    effectiveFrom: "2026-03-05",
    effectiveTo: null,
    isActive: true,
  });
  const resolver = buildPatternResolver([v1, v2]);

  const shift = makeShift({
    id: 1,
    rotationId: 1,
    headcount: 10,
    rotationStartDate: "2026-01-04",
    patternAnchorDate: "2026-01-04",
  });

  it("a Sunday before the edit is still a day off", () => {
    // 2026-01-04 is a Sunday and pattern[0] === "o" under v1
    expect(resolveStaffingDay("2026-01-04", [shift], resolver).totalHeadcount).toBe(0);
  });

  it("a Sunday after the edit is a working day", () => {
    // 2026-03-08 is a Sunday, but v2 works every day
    expect(resolveStaffingDay("2026-03-08", [shift], resolver).totalHeadcount).toBe(10);
  });
});
