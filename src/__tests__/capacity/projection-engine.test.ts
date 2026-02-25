/**
 * Projection Engine Tests — Weekly MH Projections (TEMPORARY — OI-067)
 */

import { describe, it, expect } from "vitest";
import {
  validateProjectionEntry,
  buildProjectionOverlay,
  hasProjectionData,
} from "@/lib/capacity/projection-engine";
import type { WeeklyProjection } from "@/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeProjection(
  overrides: Partial<WeeklyProjection> & {
    customer: string;
    dayOfWeek: number;
    shiftCode: string;
    projectedMh: number;
  },
): WeeklyProjection {
  return {
    id: 1,
    notes: null,
    isActive: true,
    createdBy: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as WeeklyProjection;
}

// ─── Validation Tests ────────────────────────────────────────────────────────

describe("validateProjectionEntry", () => {
  it("accepts a valid entry", () => {
    const result = validateProjectionEntry({
      customer: "ACME Corp",
      dayOfWeek: 1,
      shiftCode: "DAY",
      projectedMh: 10.5,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing customer", () => {
    const result = validateProjectionEntry({
      customer: "",
      dayOfWeek: 1,
      shiftCode: "DAY",
      projectedMh: 5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Customer name is required");
  });

  it("rejects dayOfWeek out of range (0)", () => {
    const result = validateProjectionEntry({
      customer: "Test",
      dayOfWeek: 0,
      shiftCode: "DAY",
      projectedMh: 5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Day of week/);
  });

  it("rejects dayOfWeek out of range (8)", () => {
    const result = validateProjectionEntry({
      customer: "Test",
      dayOfWeek: 8,
      shiftCode: "NIGHT",
      projectedMh: 5,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects invalid shift code", () => {
    const result = validateProjectionEntry({
      customer: "Test",
      dayOfWeek: 3,
      shiftCode: "MORNING",
      projectedMh: 5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Shift code/);
  });

  it("rejects negative projectedMh", () => {
    const result = validateProjectionEntry({
      customer: "Test",
      dayOfWeek: 1,
      shiftCode: "DAY",
      projectedMh: -1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Projected MH/);
  });

  it("accepts zero projectedMh", () => {
    const result = validateProjectionEntry({
      customer: "Test",
      dayOfWeek: 1,
      shiftCode: "DAY",
      projectedMh: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("collects multiple errors", () => {
    const result = validateProjectionEntry({
      customer: "",
      dayOfWeek: 99,
      shiftCode: "INVALID",
      projectedMh: -5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── Overlay Builder Tests ───────────────────────────────────────────────────

describe("buildProjectionOverlay", () => {
  it("returns 7 elements for Mon–Sun", () => {
    const overlay = buildProjectionOverlay([]);
    expect(overlay).toHaveLength(7);
    expect(overlay[0].dayOfWeek).toBe(1);
    expect(overlay[0].label).toBe("Mon");
    expect(overlay[6].dayOfWeek).toBe(7);
    expect(overlay[6].label).toBe("Sun");
  });

  it("all zeroes for empty input", () => {
    const overlay = buildProjectionOverlay([]);
    for (const day of overlay) {
      expect(day.projectedTotal).toBe(0);
      expect(Object.keys(day.projectedByShift)).toHaveLength(0);
      expect(Object.keys(day.projectedByCustomer)).toHaveLength(0);
    }
  });

  it("aggregates single customer single day", () => {
    const projections = [
      makeProjection({ customer: "Alpha", dayOfWeek: 1, shiftCode: "DAY", projectedMh: 10 }),
      makeProjection({ customer: "Alpha", dayOfWeek: 1, shiftCode: "NIGHT", projectedMh: 5 }),
    ];
    const overlay = buildProjectionOverlay(projections);
    const mon = overlay[0]; // dayOfWeek=1 → index 0
    expect(mon.projectedTotal).toBe(15);
    expect(mon.projectedByShift["DAY"]).toBe(10);
    expect(mon.projectedByShift["NIGHT"]).toBe(5);
    expect(mon.projectedByCustomer["Alpha"]).toBe(15);
  });

  it("aggregates multiple customers same day", () => {
    const projections = [
      makeProjection({ customer: "Alpha", dayOfWeek: 3, shiftCode: "DAY", projectedMh: 8 }),
      makeProjection({ customer: "Beta", dayOfWeek: 3, shiftCode: "DAY", projectedMh: 4 }),
      makeProjection({ customer: "Alpha", dayOfWeek: 3, shiftCode: "SWING", projectedMh: 2 }),
    ];
    const overlay = buildProjectionOverlay(projections);
    const wed = overlay[2]; // dayOfWeek=3 → index 2
    expect(wed.projectedTotal).toBe(14);
    expect(wed.projectedByShift["DAY"]).toBe(12);
    expect(wed.projectedByShift["SWING"]).toBe(2);
    expect(wed.projectedByCustomer["Alpha"]).toBe(10);
    expect(wed.projectedByCustomer["Beta"]).toBe(4);
  });

  it("distributes across multiple days correctly", () => {
    const projections = [
      makeProjection({ customer: "X", dayOfWeek: 1, shiftCode: "DAY", projectedMh: 10 }),
      makeProjection({ customer: "X", dayOfWeek: 5, shiftCode: "DAY", projectedMh: 20 }),
    ];
    const overlay = buildProjectionOverlay(projections);
    expect(overlay[0].projectedTotal).toBe(10); // Mon
    expect(overlay[4].projectedTotal).toBe(20); // Fri
    expect(overlay[2].projectedTotal).toBe(0); // Wed — no data
  });

  it("rounds values to 1 decimal place", () => {
    const projections = [
      makeProjection({ customer: "A", dayOfWeek: 1, shiftCode: "DAY", projectedMh: 1.15 }),
      makeProjection({ customer: "A", dayOfWeek: 1, shiftCode: "NIGHT", projectedMh: 2.25 }),
    ];
    const overlay = buildProjectionOverlay(projections);
    expect(overlay[0].projectedTotal).toBe(3.4);
    expect(overlay[0].projectedByShift["DAY"]).toBe(1.2);
    expect(overlay[0].projectedByShift["NIGHT"]).toBe(2.3);
  });
});

// ─── hasProjectionData Tests ─────────────────────────────────────────────────

describe("hasProjectionData", () => {
  it("returns false for empty overlay", () => {
    const overlay = buildProjectionOverlay([]);
    expect(hasProjectionData(overlay)).toBe(false);
  });

  it("returns true when any day has data", () => {
    const projections = [
      makeProjection({ customer: "A", dayOfWeek: 4, shiftCode: "SWING", projectedMh: 3 }),
    ];
    const overlay = buildProjectionOverlay(projections);
    expect(hasProjectionData(overlay)).toBe(true);
  });
});
