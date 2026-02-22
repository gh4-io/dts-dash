/**
 * Staffing Engine Unit Tests
 *
 * Tests rotation resolution, effective hours computation, daily aggregation,
 * weekly matrix computation, and pattern validation.
 */

import { describe, it, expect } from "vitest";
import {
  isWorkingDay,
  computeEffectivePaidHours,
  resolveStaffingDay,
  computeWeeklyMatrix,
  resolveStaffingForCapacity,
  buildPatternMap,
  validatePattern,
  countWorkingDays,
} from "./staffing-engine";
import type {
  RotationPattern,
  StaffingShift,
  CapacityAssumptions,
  StaffingShiftCategory,
} from "@/types";

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const PATTERN_5_2: RotationPattern = {
  id: 1,
  name: "Standard 5-2",
  description: null,
  pattern: "oxxxxoxoxxxxoxoxxxxox", // Mon-Fri every week (Sun=off)
  isActive: true,
  sortOrder: 0,
};

const PATTERN_ALL_ON: RotationPattern = {
  id: 2,
  name: "All On",
  description: null,
  pattern: "xxxxxxxxxxxxxxxxxxxxx",
  isActive: true,
  sortOrder: 1,
};

const PATTERN_ALL_OFF: RotationPattern = {
  id: 3,
  name: "All Off",
  description: null,
  pattern: "ooooooooooooooooooooo",
  isActive: true,
  sortOrder: 2,
};

const PATTERN_ALTERNATING: RotationPattern = {
  id: 4,
  name: "Alternating",
  description: null,
  pattern: "xoxoxoxoxoxoxoxoxoxox",
  isActive: true,
  sortOrder: 3,
};

const PATTERN_INACTIVE: RotationPattern = {
  id: 5,
  name: "Inactive",
  description: null,
  pattern: "xxxxxxxxxxxxxxxxxxxxx",
  isActive: false,
  sortOrder: 4,
};

function makeShift(overrides: Partial<StaffingShift> & { id: number }): StaffingShift {
  return {
    configId: 1,
    name: "Test Shift",
    description: null,
    category: "DAY",
    rotationId: 1,
    rotationStartDate: "2026-01-04", // a Sunday
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

const DEFAULT_ASSUMPTIONS: CapacityAssumptions = {
  id: 1,
  station: "CVG",
  paidToAvailable: 0.89,
  availableToProductive: 0.73,
  defaultMhNoWp: 3.0,
  nightProductivityFactor: 0.85,
  demandCurve: "EVEN",
  arrivalWeight: 0.0,
  departureWeight: 0.0,
  allocationMode: "DISTRIBUTE",
  isActive: true,
  effectiveFrom: null,
  effectiveTo: null,
};

// ─── isWorkingDay ───────────────────────────────────────────────────────────

describe("isWorkingDay", () => {
  it("returns correct value for day 0 (start date)", () => {
    // Pattern starts with 'o' (off) on position 0
    expect(isWorkingDay("2026-01-04", PATTERN_5_2.pattern, "2026-01-04")).toBe(false);
  });

  it("returns correct value for day 1 (Mon = work in 5-2)", () => {
    expect(isWorkingDay("2026-01-05", PATTERN_5_2.pattern, "2026-01-04")).toBe(true);
  });

  it("wraps correctly at day 21 (same as day 0)", () => {
    // 21 days later = same position
    expect(isWorkingDay("2026-01-25", PATTERN_5_2.pattern, "2026-01-04")).toBe(
      isWorkingDay("2026-01-04", PATTERN_5_2.pattern, "2026-01-04"),
    );
  });

  it("wraps correctly at day 42 (same as day 0)", () => {
    expect(isWorkingDay("2026-02-15", PATTERN_5_2.pattern, "2026-01-04")).toBe(
      isWorkingDay("2026-01-04", PATTERN_5_2.pattern, "2026-01-04"),
    );
  });

  it("handles dates before start date (negative offset)", () => {
    // 7 days before start = position ((−7 % 21) + 21) % 21 = 14
    // Pattern "oxxxxoxoxxxxoxoxxxxox"[14] = 'o' (off)
    const result = isWorkingDay("2025-12-28", PATTERN_5_2.pattern, "2026-01-04");
    expect(typeof result).toBe("boolean");
    expect(result).toBe(false);
  });

  it("all-on pattern returns true for every day", () => {
    for (let i = 0; i < 21; i++) {
      const d = new Date("2026-01-04T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      expect(isWorkingDay(dateStr, PATTERN_ALL_ON.pattern, "2026-01-04")).toBe(true);
    }
  });

  it("all-off pattern returns false for every day", () => {
    for (let i = 0; i < 21; i++) {
      const d = new Date("2026-01-04T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      expect(isWorkingDay(dateStr, PATTERN_ALL_OFF.pattern, "2026-01-04")).toBe(false);
    }
  });

  it("alternating pattern alternates correctly", () => {
    expect(isWorkingDay("2026-01-04", PATTERN_ALTERNATING.pattern, "2026-01-04")).toBe(true);
    expect(isWorkingDay("2026-01-05", PATTERN_ALTERNATING.pattern, "2026-01-04")).toBe(false);
    expect(isWorkingDay("2026-01-06", PATTERN_ALTERNATING.pattern, "2026-01-04")).toBe(true);
  });
});

// ─── computeEffectivePaidHours ──────────────────────────────────────────────

describe("computeEffectivePaidHours", () => {
  it("uses mhOverride when set", () => {
    const shift = makeShift({ id: 1, mhOverride: 10.0 });
    expect(computeEffectivePaidHours(shift)).toBe(10.0);
  });

  it("computes from shift duration when no override (8hr shift)", () => {
    const shift = makeShift({ id: 1, startHour: 7, endHour: 15 }); // 8 hours
    expect(computeEffectivePaidHours(shift)).toBe(8.0);
  });

  it("computes from shift duration with breaks/lunch", () => {
    const shift = makeShift({
      id: 1,
      startHour: 7,
      endHour: 17, // 10 hours
      breakMinutes: 30,
      lunchMinutes: 30,
    });
    // 10h - 30min - 30min = 9h
    expect(computeEffectivePaidHours(shift)).toBe(9.0);
  });

  it("handles overnight shift (23:00-07:00)", () => {
    const shift = makeShift({ id: 1, startHour: 23, endHour: 7 }); // 8 hours
    expect(computeEffectivePaidHours(shift)).toBe(8.0);
  });

  it("handles overnight shift with minutes", () => {
    const shift = makeShift({
      id: 1,
      startHour: 22,
      startMinute: 30,
      endHour: 7,
      endMinute: 0,
    }); // 8.5 hours
    expect(computeEffectivePaidHours(shift)).toBe(8.5);
  });

  it("floors at 0 if breaks exceed duration", () => {
    const shift = makeShift({
      id: 1,
      startHour: 7,
      endHour: 8, // 1 hour
      breakMinutes: 90, // 1.5 hours
    });
    expect(computeEffectivePaidHours(shift)).toBe(0);
  });
});

// ─── resolveStaffingDay ─────────────────────────────────────────────────────

describe("resolveStaffingDay", () => {
  const patterns = buildPatternMap([PATTERN_5_2, PATTERN_ALL_ON, PATTERN_ALL_OFF]);

  it("resolves headcount for a working day", () => {
    const shifts = [makeShift({ id: 1, rotationId: 1, headcount: 10, category: "DAY" })];
    // 2026-01-05 = Monday (day 1 from start). Pattern position 1 = 'x' (work)
    const result = resolveStaffingDay("2026-01-05", shifts, patterns);
    expect(result.byCategory.DAY).toBe(10);
    expect(result.totalHeadcount).toBe(10);
  });

  it("resolves 0 for an off day", () => {
    const shifts = [makeShift({ id: 1, rotationId: 1, headcount: 10, category: "DAY" })];
    // 2026-01-04 = Sunday (day 0). Pattern position 0 = 'o' (off)
    const result = resolveStaffingDay("2026-01-04", shifts, patterns);
    expect(result.byCategory.DAY).toBe(0);
    expect(result.totalHeadcount).toBe(0);
  });

  it("aggregates multiple shifts in same category", () => {
    const shifts = [
      makeShift({ id: 1, rotationId: 2, headcount: 10, category: "DAY" }), // all-on
      makeShift({ id: 2, rotationId: 2, headcount: 5, category: "DAY" }), // all-on
    ];
    const result = resolveStaffingDay("2026-01-05", shifts, patterns);
    expect(result.byCategory.DAY).toBe(15);
  });

  it("aggregates across categories", () => {
    const shifts = [
      makeShift({ id: 1, rotationId: 2, headcount: 10, category: "DAY" }),
      makeShift({ id: 2, rotationId: 2, headcount: 6, category: "SWING" }),
      makeShift({ id: 3, rotationId: 2, headcount: 4, category: "NIGHT" }),
    ];
    const result = resolveStaffingDay("2026-01-05", shifts, patterns);
    expect(result.byCategory.DAY).toBe(10);
    expect(result.byCategory.SWING).toBe(6);
    expect(result.byCategory.NIGHT).toBe(4);
    expect(result.totalHeadcount).toBe(20);
  });

  it("excludes inactive shifts", () => {
    const shifts = [
      makeShift({ id: 1, rotationId: 2, headcount: 10, category: "DAY", isActive: false }),
    ];
    const result = resolveStaffingDay("2026-01-05", shifts, patterns);
    expect(result.byCategory.DAY).toBe(0);
    expect(result.totalHeadcount).toBe(0);
  });

  it("excludes shifts with inactive rotation patterns", () => {
    const patternsWithInactive = buildPatternMap([PATTERN_5_2, PATTERN_INACTIVE]);
    const shifts = [
      makeShift({ id: 1, rotationId: 5, headcount: 10, category: "DAY" }), // inactive pattern
    ];
    const result = resolveStaffingDay("2026-01-05", shifts, patternsWithInactive);
    expect(result.byCategory.DAY).toBe(0);
  });

  it("returns per-shift breakdown", () => {
    const shifts = [
      makeShift({ id: 1, rotationId: 2, headcount: 10, category: "DAY", name: "Day Standard" }),
      makeShift({ id: 2, rotationId: 3, headcount: 5, category: "DAY", name: "Day Off" }), // all-off
    ];
    const result = resolveStaffingDay("2026-01-05", shifts, patterns);
    expect(result.byShift).toHaveLength(2);
    expect(result.byShift[0].isWorking).toBe(true);
    expect(result.byShift[0].headcount).toBe(10);
    expect(result.byShift[1].isWorking).toBe(false);
    expect(result.byShift[1].headcount).toBe(0);
  });

  it("handles empty shifts array", () => {
    const result = resolveStaffingDay("2026-01-05", [], patterns);
    expect(result.totalHeadcount).toBe(0);
    expect(result.byCategory.DAY).toBe(0);
    expect(result.byShift).toHaveLength(0);
  });
});

// ─── computeWeeklyMatrix ────────────────────────────────────────────────────

describe("computeWeeklyMatrix", () => {
  const patterns = buildPatternMap([PATTERN_5_2, PATTERN_ALL_ON]);

  it("computes 7 days of data", () => {
    const shifts = [makeShift({ id: 1, rotationId: 2, headcount: 10, category: "DAY" })];
    const result = computeWeeklyMatrix("2026-01-04", shifts, patterns, DEFAULT_ASSUMPTIONS);
    expect(result.days).toHaveLength(7);
  });

  it("computes correct headcount for all-on pattern", () => {
    const shifts = [
      makeShift({ id: 1, rotationId: 2, headcount: 10, category: "DAY" }), // all-on
    ];
    const result = computeWeeklyMatrix("2026-01-04", shifts, patterns, DEFAULT_ASSUMPTIONS);

    // All 7 days should have effective headcount = 10 * 0.89 = 8.9
    for (const day of result.days) {
      expect(day.byCategory.DAY.headcount).toBeCloseTo(10 * 0.89);
    }
  });

  it("applies productivity chain correctly", () => {
    const shifts = [
      makeShift({ id: 1, rotationId: 2, headcount: 10, category: "DAY" }), // all-on, 8hr shift
    ];
    const result = computeWeeklyMatrix("2026-01-04", shifts, patterns, DEFAULT_ASSUMPTIONS);

    const dayCell = result.days[0].byCategory.DAY;
    expect(dayCell.headcount).toBeCloseTo(10 * 0.89); // effective = roster * paidToAvailable
    expect(dayCell.paidMH).toBeCloseTo(10 * 0.89 * 8); // effective * hours = 71.2
    expect(dayCell.availableMH).toBeCloseTo(10 * 0.89 * 8); // availableMH = paidMH
    expect(dayCell.productiveMH).toBeCloseTo(10 * 0.89 * 8 * 0.73); // paidMH * a2p = 51.976
  });

  it("applies night factor for NIGHT category", () => {
    const shifts = [
      makeShift({
        id: 1,
        rotationId: 2,
        headcount: 4,
        category: "NIGHT",
        startHour: 23,
        endHour: 7,
      }),
    ];
    const result = computeWeeklyMatrix("2026-01-04", shifts, patterns, DEFAULT_ASSUMPTIONS);

    const nightCell = result.days[0].byCategory.NIGHT;
    expect(nightCell.headcount).toBeCloseTo(4 * 0.89); // effective = roster * paidToAvailable
    expect(nightCell.paidMH).toBeCloseTo(4 * 0.89 * 8); // effective * hours = 28.48
    expect(nightCell.productiveMH).toBeCloseTo(4 * 0.89 * 8 * 0.73 * 0.85);
  });

  it("computes category totals across the week", () => {
    const shifts = [makeShift({ id: 1, rotationId: 2, headcount: 10, category: "DAY" })];
    const result = computeWeeklyMatrix("2026-01-04", shifts, patterns, DEFAULT_ASSUMPTIONS);

    // 7 days * 10 roster * 0.89 = 62.3 effective headcount
    expect(result.categoryTotals.DAY.headcount).toBeCloseTo(70 * 0.89);
    expect(result.grandTotal.headcount).toBeCloseTo(70 * 0.89);
  });

  it("tracks totalConfigHeadcount", () => {
    const shifts = [
      makeShift({ id: 1, rotationId: 2, headcount: 10, category: "DAY" }),
      makeShift({ id: 2, rotationId: 2, headcount: 6, category: "SWING" }),
      makeShift({ id: 3, rotationId: 2, headcount: 4, category: "NIGHT" }),
    ];
    const result = computeWeeklyMatrix("2026-01-04", shifts, patterns, DEFAULT_ASSUMPTIONS);
    expect(result.totalConfigHeadcount).toBe(20);
  });

  it("handles mixed working/off patterns", () => {
    const shifts = [
      makeShift({ id: 1, rotationId: 1, headcount: 10, category: "DAY" }), // 5-2 pattern
    ];
    const result = computeWeeklyMatrix("2026-01-04", shifts, patterns, DEFAULT_ASSUMPTIONS);

    // Sun (day 0) = off, Mon-Fri (days 1-5) = on, Sat (day 6) = off
    // For the 5-2 pattern "oxxxxoxoxxxxoxoxxxxox":
    // Pos 0 (Sun): o=off, Pos 1 (Mon): x=on, ... Pos 5 (Fri): o=off, Pos 6 (Sat): x=on
    const headcounts = result.days.map((d) => d.byCategory.DAY.headcount);
    // Sum should be less than 70 * 0.89 = 62.3 (some off days reduce further)
    expect(headcounts.reduce((a, b) => a + b, 0)).toBeLessThan(70 * 0.89);
  });
});

// ─── resolveStaffingForCapacity ─────────────────────────────────────────────

describe("resolveStaffingForCapacity", () => {
  const patterns = buildPatternMap([PATTERN_ALL_ON]);

  it("maps categories to shift codes", () => {
    const shifts = [
      makeShift({ id: 1, rotationId: 2, headcount: 10, category: "DAY" }),
      makeShift({ id: 2, rotationId: 2, headcount: 6, category: "SWING" }),
    ];
    const result = resolveStaffingForCapacity(["2026-01-05"], shifts, patterns);

    const dayData = result.get("2026-01-05");
    expect(dayData).toBeDefined();
    expect(dayData!.get("DAY")?.headcount).toBe(10);
    expect(dayData!.get("SWING")?.headcount).toBe(6);
  });

  it("excludes OTHER category", () => {
    const shifts = [makeShift({ id: 1, rotationId: 2, headcount: 10, category: "OTHER" })];
    const result = resolveStaffingForCapacity(["2026-01-05"], shifts, patterns);

    const dayData = result.get("2026-01-05");
    expect(dayData!.has("OTHER")).toBe(false);
  });

  it("aggregates multiple shifts in same category", () => {
    const shifts = [
      makeShift({ id: 1, rotationId: 2, headcount: 10, category: "DAY", mhOverride: 8 }),
      makeShift({ id: 2, rotationId: 2, headcount: 5, category: "DAY", mhOverride: 10 }),
    ];
    const result = resolveStaffingForCapacity(["2026-01-05"], shifts, patterns);

    const dayData = result.get("2026-01-05")!.get("DAY")!;
    expect(dayData.headcount).toBe(15);
    // Weighted average: (8*10 + 10*5) / 15 = 130/15 ≈ 8.667
    expect(dayData.effectivePaidHours).toBeCloseTo(130 / 15);
  });
});

// ─── Pattern Validation ─────────────────────────────────────────────────────

describe("validatePattern", () => {
  it("accepts valid 21-char pattern", () => {
    expect(validatePattern("xxxxxxxxxxxxxxxxxxxxx")).toBeNull();
    expect(validatePattern("ooooooooooooooooooooo")).toBeNull();
    expect(validatePattern("xoxoxoxoxoxoxoxoxoxox")).toBeNull();
  });

  it("rejects wrong length", () => {
    expect(validatePattern("xxx")).not.toBeNull();
    expect(validatePattern("xxxxxxxxxxxxxxxxxxxxxxxxxxxx")).not.toBeNull();
  });

  it("rejects invalid characters", () => {
    expect(validatePattern("xxx---xxx---xxx---xxx")).not.toBeNull(); // dashes
    expect(validatePattern("xxx111xxx111xxx111xxx")).not.toBeNull(); // numbers
  });
});

describe("countWorkingDays", () => {
  it("counts correctly", () => {
    expect(countWorkingDays("xxxxxxxxxxxxxxxxxxxxx")).toBe(21);
    expect(countWorkingDays("ooooooooooooooooooooo")).toBe(0);
    expect(countWorkingDays("xoxoxoxoxoxoxoxoxoxox")).toBe(11);
  });
});
