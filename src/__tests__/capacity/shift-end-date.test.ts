/**
 * Shift End Date Classification Tests (OI-080)
 *
 * Tests the classification logic that determines whether a shift is
 * active, expired, or disabled based on isActive and effectiveEndDate.
 */

import { describe, it, expect } from "vitest";
import {
  classifyShift,
  classifyShifts,
  type ShiftStatus,
} from "@/components/admin/capacity/shift-matrix-section";
import type { CapacityShift } from "@/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeShift(overrides: Partial<CapacityShift> = {}): CapacityShift {
  return {
    id: 1,
    code: "DAY",
    name: "Day",
    startHour: 7,
    endHour: 15,
    paidHours: 8,
    timezone: "UTC",
    minHeadcount: 2,
    sortOrder: 0,
    isActive: true,
    effectiveEndDate: null,
    ...overrides,
  };
}

const TODAY = "2026-03-03";

// ─── classifyShift ───────────────────────────────────────────────────────────

describe("classifyShift", () => {
  it("active shift with no end date → active", () => {
    const shift = makeShift({ isActive: true, effectiveEndDate: null });
    expect(classifyShift(shift, TODAY)).toBe("active" satisfies ShiftStatus);
  });

  it("active shift with future end date → active", () => {
    const shift = makeShift({ isActive: true, effectiveEndDate: "2026-12-31" });
    expect(classifyShift(shift, TODAY)).toBe("active");
  });

  it("active shift with today's date → active (inclusive)", () => {
    const shift = makeShift({ isActive: true, effectiveEndDate: TODAY });
    expect(classifyShift(shift, TODAY)).toBe("active");
  });

  it("active shift with past end date → expired", () => {
    const shift = makeShift({ isActive: true, effectiveEndDate: "2026-01-15" });
    expect(classifyShift(shift, TODAY)).toBe("expired");
  });

  it("inactive shift with no end date → disabled", () => {
    const shift = makeShift({ isActive: false, effectiveEndDate: null });
    expect(classifyShift(shift, TODAY)).toBe("disabled");
  });

  it("inactive shift with future end date → disabled (isActive takes precedence)", () => {
    const shift = makeShift({ isActive: false, effectiveEndDate: "2026-12-31" });
    expect(classifyShift(shift, TODAY)).toBe("disabled");
  });

  it("inactive shift with past end date → disabled", () => {
    const shift = makeShift({ isActive: false, effectiveEndDate: "2025-06-01" });
    expect(classifyShift(shift, TODAY)).toBe("disabled");
  });
});

// ─── classifyShifts ──────────────────────────────────────────────────────────

describe("classifyShifts", () => {
  it("separates a mixed set into active and archived", () => {
    const shifts: CapacityShift[] = [
      makeShift({ id: 1, code: "DAY", isActive: true, effectiveEndDate: null }),
      makeShift({ id: 2, code: "SWING", isActive: true, effectiveEndDate: "2026-12-31" }),
      makeShift({ id: 3, code: "NIGHT", isActive: true, effectiveEndDate: "2026-01-01" }),
      makeShift({ id: 4, code: "EARLY", isActive: false, effectiveEndDate: null }),
    ];

    const { active, archived } = classifyShifts(shifts, TODAY);

    expect(active).toHaveLength(2);
    expect(active.map((s) => s.code)).toEqual(["DAY", "SWING"]);

    expect(archived).toHaveLength(2);
    expect(archived.map((s) => s.code)).toEqual(["NIGHT", "EARLY"]);
  });

  it("returns all active when no shifts are archived", () => {
    const shifts: CapacityShift[] = [
      makeShift({ id: 1, code: "DAY", isActive: true, effectiveEndDate: null }),
      makeShift({ id: 2, code: "SWING", isActive: true, effectiveEndDate: "2027-01-01" }),
    ];

    const { active, archived } = classifyShifts(shifts, TODAY);
    expect(active).toHaveLength(2);
    expect(archived).toHaveLength(0);
  });

  it("handles empty array", () => {
    const { active, archived } = classifyShifts([], TODAY);
    expect(active).toHaveLength(0);
    expect(archived).toHaveLength(0);
  });
});
