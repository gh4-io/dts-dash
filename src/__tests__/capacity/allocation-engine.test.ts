import { describe, it, expect } from "vitest";
import {
  findMatchingAllocations,
  computeAllocatedMH,
  applyAllocations,
  validateAllocation,
} from "@/lib/capacity/allocation-engine";
import type { DemandAllocation, CapacityShift, DailyDemandV2 } from "@/types";

// ─── Test Fixtures ─────────────────────────────────────────────────────────

const shifts: CapacityShift[] = [
  {
    id: 1,
    code: "DAY",
    name: "Day",
    startHour: 7,
    endHour: 15,
    paidHours: 8.0,
    minHeadcount: 2,
    sortOrder: 0,
    isActive: true,
  },
  {
    id: 2,
    code: "SWING",
    name: "Swing",
    startHour: 15,
    endHour: 23,
    paidHours: 8.0,
    minHeadcount: 1,
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 3,
    code: "NIGHT",
    name: "Night",
    startHour: 23,
    endHour: 7,
    paidHours: 8.0,
    minHeadcount: 1,
    sortOrder: 2,
    isActive: true,
  },
];

function makeAllocation(overrides: Partial<DemandAllocation> = {}): DemandAllocation {
  return {
    id: 1,
    customerId: 100,
    shiftId: null,
    dayOfWeek: null,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    allocatedMh: 120,
    mode: "MINIMUM_FLOOR",
    reason: null,
    isActive: true,
    ...overrides,
  };
}

// ─── findMatchingAllocations ──────────────────────────────────────────────

describe("findMatchingAllocations", () => {
  it("matches allocation within date range", () => {
    const allocs = [makeAllocation({ effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31" })];
    const result = findMatchingAllocations("2026-06-15", "DAY", 100, allocs, shifts);
    expect(result).toHaveLength(1);
  });

  it("matches allocation with null effectiveTo (indefinite)", () => {
    const allocs = [makeAllocation({ effectiveFrom: "2026-01-01", effectiveTo: null })];
    const result = findMatchingAllocations("2030-12-31", "DAY", 100, allocs, shifts);
    expect(result).toHaveLength(1);
  });

  it("excludes expired allocations", () => {
    const allocs = [makeAllocation({ effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31" })];
    const result = findMatchingAllocations("2026-06-15", "DAY", 100, allocs, shifts);
    expect(result).toHaveLength(0);
  });

  it("excludes future allocations", () => {
    const allocs = [makeAllocation({ effectiveFrom: "2027-01-01" })];
    const result = findMatchingAllocations("2026-06-15", "DAY", 100, allocs, shifts);
    expect(result).toHaveLength(0);
  });

  it("excludes inactive allocations", () => {
    const allocs = [makeAllocation({ isActive: false })];
    const result = findMatchingAllocations("2026-06-15", "DAY", 100, allocs, shifts);
    expect(result).toHaveLength(0);
  });

  it("matches when shiftId is null (all shifts)", () => {
    const allocs = [makeAllocation({ shiftId: null })];
    const result = findMatchingAllocations("2026-06-15", "NIGHT", 100, allocs, shifts);
    expect(result).toHaveLength(1);
  });

  it("filters by specific shiftId", () => {
    const allocs = [makeAllocation({ shiftId: 3 })]; // NIGHT only
    expect(findMatchingAllocations("2026-06-15", "NIGHT", 100, allocs, shifts)).toHaveLength(1);
    expect(findMatchingAllocations("2026-06-15", "DAY", 100, allocs, shifts)).toHaveLength(0);
  });

  it("matches when dayOfWeek is null (all days)", () => {
    const allocs = [makeAllocation({ dayOfWeek: null })];
    // 2026-06-15 is a Monday (DOW=1)
    const result = findMatchingAllocations("2026-06-15", "DAY", 100, allocs, shifts);
    expect(result).toHaveLength(1);
  });

  it("filters by specific dayOfWeek", () => {
    // 2026-06-15 is Monday (DOW=1)
    const allocs = [makeAllocation({ dayOfWeek: 1 })]; // Monday only
    expect(findMatchingAllocations("2026-06-15", "DAY", 100, allocs, shifts)).toHaveLength(1);
    // 2026-06-14 is Sunday (DOW=0)
    expect(findMatchingAllocations("2026-06-14", "DAY", 100, allocs, shifts)).toHaveLength(0);
  });

  it("excludes wrong customerId", () => {
    const allocs = [makeAllocation({ customerId: 200 })];
    const result = findMatchingAllocations("2026-06-15", "DAY", 100, allocs, shifts);
    expect(result).toHaveLength(0);
  });
});

// ─── computeAllocatedMH ──────────────────────────────────────────────────

describe("computeAllocatedMH", () => {
  it("returns normalMH when no allocations", () => {
    expect(computeAllocatedMH(50, [])).toBe(50);
  });

  it("applies ADDITIVE mode", () => {
    const allocs = [makeAllocation({ mode: "ADDITIVE", allocatedMh: 30 })];
    expect(computeAllocatedMH(50, allocs)).toBe(80); // 50 + 30
  });

  it("applies MINIMUM_FLOOR mode when floor > normal", () => {
    const allocs = [makeAllocation({ mode: "MINIMUM_FLOOR", allocatedMh: 120 })];
    expect(computeAllocatedMH(50, allocs)).toBe(120); // max(50, 120)
  });

  it("applies MINIMUM_FLOOR mode when normal > floor", () => {
    const allocs = [makeAllocation({ mode: "MINIMUM_FLOOR", allocatedMh: 30 })];
    expect(computeAllocatedMH(50, allocs)).toBe(50); // max(50, 30)
  });

  it("stacks multiple ADDITIVE allocations", () => {
    const allocs = [
      makeAllocation({ id: 1, mode: "ADDITIVE", allocatedMh: 10 }),
      makeAllocation({ id: 2, mode: "ADDITIVE", allocatedMh: 20 }),
    ];
    expect(computeAllocatedMH(50, allocs)).toBe(80); // 50 + 10 + 20
  });

  it("takes max of MINIMUM_FLOOR allocations", () => {
    const allocs = [
      makeAllocation({ id: 1, mode: "MINIMUM_FLOOR", allocatedMh: 80 }),
      makeAllocation({ id: 2, mode: "MINIMUM_FLOOR", allocatedMh: 120 }),
    ];
    expect(computeAllocatedMH(50, allocs)).toBe(120); // max(50, max(80, 120))
  });

  it("handles mixed ADDITIVE and MINIMUM_FLOOR", () => {
    const allocs = [
      makeAllocation({ id: 1, mode: "ADDITIVE", allocatedMh: 20 }),
      makeAllocation({ id: 2, mode: "MINIMUM_FLOOR", allocatedMh: 100 }),
    ];
    // adjusted = 50 + 20 = 70; max(70, 100) = 100
    expect(computeAllocatedMH(50, allocs)).toBe(100);
  });

  it("handles zero normalMH with MINIMUM_FLOOR", () => {
    const allocs = [makeAllocation({ mode: "MINIMUM_FLOOR", allocatedMh: 120 })];
    expect(computeAllocatedMH(0, allocs)).toBe(120);
  });
});

// ─── applyAllocations ────────────────────────────────────────────────────

describe("applyAllocations", () => {
  const customerMap = new Map<number, string>([
    [100, "Cargojet"],
    [200, "DHL"],
  ]);

  function makeDemandDay(
    date: string,
    byShift: Array<{ shiftCode: string; demandMH: number; customer: string }>,
  ): DailyDemandV2 {
    const shiftData: DailyDemandV2["byShift"] = byShift.map((s) => ({
      shiftCode: s.shiftCode,
      demandMH: s.demandMH,
      wpContributions: [
        {
          wpId: 1,
          aircraftReg: "C-TEST",
          customer: s.customer,
          allocatedMH: s.demandMH,
          mhSource: "wp",
        },
      ],
    }));
    return {
      date,
      totalDemandMH: byShift.reduce((sum, s) => sum + s.demandMH, 0),
      aircraftCount: 1,
      byCustomer: byShift.reduce(
        (acc, s) => {
          acc[s.customer] = (acc[s.customer] ?? 0) + s.demandMH;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byShift: shiftData,
    };
  }

  it("returns demand unchanged when no allocations", () => {
    const demand = [
      makeDemandDay("2026-06-15", [{ shiftCode: "DAY", demandMH: 50, customer: "Cargojet" }]),
    ];
    const result = applyAllocations(demand, [], shifts, customerMap);
    expect(result).toEqual(demand);
  });

  it("applies MINIMUM_FLOOR to raise demand for a customer", () => {
    const demand = [
      makeDemandDay("2026-06-15", [{ shiftCode: "NIGHT", demandMH: 30, customer: "Cargojet" }]),
    ];
    // Scope to NIGHT shift only (shiftId: 3) so only NIGHT demand is affected
    const allocs = [
      makeAllocation({ customerId: 100, shiftId: 3, mode: "MINIMUM_FLOOR", allocatedMh: 120 }),
    ];
    const result = applyAllocations(demand, allocs, shifts, customerMap);

    expect(result[0].byShift.find((s) => s.shiftCode === "NIGHT")!.demandMH).toBe(120);
    expect(result[0].totalDemandMH).toBe(120);
  });

  it("does not reduce demand below normal with MINIMUM_FLOOR", () => {
    const demand = [
      makeDemandDay("2026-06-15", [{ shiftCode: "NIGHT", demandMH: 150, customer: "Cargojet" }]),
    ];
    const allocs = [makeAllocation({ customerId: 100, mode: "MINIMUM_FLOOR", allocatedMh: 120 })];
    const result = applyAllocations(demand, allocs, shifts, customerMap);

    expect(result[0].byShift.find((s) => s.shiftCode === "NIGHT")!.demandMH).toBe(150);
  });

  it("applies ADDITIVE allocation", () => {
    const demand = [
      makeDemandDay("2026-06-15", [{ shiftCode: "DAY", demandMH: 50, customer: "Cargojet" }]),
    ];
    const allocs = [makeAllocation({ customerId: 100, mode: "ADDITIVE", allocatedMh: 20 })];
    const result = applyAllocations(demand, allocs, shifts, customerMap);

    expect(result[0].byShift.find((s) => s.shiftCode === "DAY")!.demandMH).toBe(70);
  });

  it("applies allocation to customer with no WPs (zero normalMH)", () => {
    const demand = [
      makeDemandDay("2026-06-15", [{ shiftCode: "DAY", demandMH: 50, customer: "DHL" }]),
    ];
    // Cargojet has floor but no WPs
    const allocs = [makeAllocation({ customerId: 100, mode: "MINIMUM_FLOOR", allocatedMh: 80 })];
    const result = applyAllocations(demand, allocs, shifts, customerMap);

    // DAY shift should have DHL's 50 + Cargojet's floor 80
    const dayShift = result[0].byShift.find((s) => s.shiftCode === "DAY")!;
    expect(dayShift.demandMH).toBe(130); // 50 + 80 (Cargojet floor from 0)
  });

  it("respects dayOfWeek filter", () => {
    // 2026-06-15 is Monday (DOW=1), 2026-06-14 is Sunday (DOW=0)
    const demand = [
      makeDemandDay("2026-06-14", [{ shiftCode: "DAY", demandMH: 30, customer: "Cargojet" }]),
      makeDemandDay("2026-06-15", [{ shiftCode: "DAY", demandMH: 30, customer: "Cargojet" }]),
    ];
    const allocs = [
      makeAllocation({ customerId: 100, dayOfWeek: 1, mode: "MINIMUM_FLOOR", allocatedMh: 100 }),
    ];
    const result = applyAllocations(demand, allocs, shifts, customerMap);

    // Sunday: no change
    expect(result[0].byShift.find((s) => s.shiftCode === "DAY")!.demandMH).toBe(30);
    // Monday: floor applies
    expect(result[1].byShift.find((s) => s.shiftCode === "DAY")!.demandMH).toBe(100);
  });

  it("respects shift filter", () => {
    const demand = [
      makeDemandDay("2026-06-15", [
        { shiftCode: "DAY", demandMH: 30, customer: "Cargojet" },
        { shiftCode: "NIGHT", demandMH: 30, customer: "Cargojet" },
      ]),
    ];
    const allocs = [
      makeAllocation({ customerId: 100, shiftId: 3, mode: "MINIMUM_FLOOR", allocatedMh: 100 }),
    ];
    const result = applyAllocations(demand, allocs, shifts, customerMap);

    // DAY: no change
    expect(result[0].byShift.find((s) => s.shiftCode === "DAY")!.demandMH).toBe(30);
    // NIGHT: floor applies
    expect(result[0].byShift.find((s) => s.shiftCode === "NIGHT")!.demandMH).toBe(100);
  });

  it("handles multiple customers with allocations", () => {
    const demand = [
      makeDemandDay("2026-06-15", [{ shiftCode: "NIGHT", demandMH: 20, customer: "Cargojet" }]),
    ];
    const allocs = [
      makeAllocation({ id: 1, customerId: 100, mode: "MINIMUM_FLOOR", allocatedMh: 50 }),
      makeAllocation({ id: 2, customerId: 200, mode: "MINIMUM_FLOOR", allocatedMh: 80 }),
    ];
    const result = applyAllocations(demand, allocs, shifts, customerMap);

    // Cargojet: max(20, 50) = 50 → delta 30
    // DHL: max(0, 80) = 80 → delta 80
    // Total: 20 + 30 + 80 = 130
    const nightShift = result[0].byShift.find((s) => s.shiftCode === "NIGHT")!;
    expect(nightShift.demandMH).toBe(130);
  });

  it("sets allocatedDemandMH on affected shifts", () => {
    const demand = [
      makeDemandDay("2026-06-15", [{ shiftCode: "NIGHT", demandMH: 30, customer: "Cargojet" }]),
    ];
    const allocs = [makeAllocation({ customerId: 100, mode: "MINIMUM_FLOOR", allocatedMh: 100 })];
    const result = applyAllocations(demand, allocs, shifts, customerMap);

    const nightShift = result[0].byShift.find((s) => s.shiftCode === "NIGHT")!;
    expect(nightShift.allocatedDemandMH).toBe(100);
  });

  it("sets totalAllocatedDemandMH on affected days", () => {
    const demand = [
      makeDemandDay("2026-06-15", [{ shiftCode: "NIGHT", demandMH: 30, customer: "Cargojet" }]),
    ];
    const allocs = [makeAllocation({ customerId: 100, mode: "MINIMUM_FLOOR", allocatedMh: 100 })];
    const result = applyAllocations(demand, allocs, shifts, customerMap);

    expect(result[0].totalAllocatedDemandMH).toBeDefined();
  });
});

// ─── validateAllocation ──────────────────────────────────────────────────

describe("validateAllocation", () => {
  it("passes for valid allocation data", () => {
    const result = validateAllocation({
      customerId: 100,
      effectiveFrom: "2026-01-01",
      allocatedMh: 120,
      mode: "MINIMUM_FLOOR",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when customerId is missing", () => {
    const result = validateAllocation({
      effectiveFrom: "2026-01-01",
      allocatedMh: 120,
      mode: "MINIMUM_FLOOR",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("customerId is required");
  });

  it("fails for invalid dayOfWeek", () => {
    const result = validateAllocation({
      customerId: 100,
      dayOfWeek: 7,
      effectiveFrom: "2026-01-01",
      allocatedMh: 120,
      mode: "MINIMUM_FLOOR",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("dayOfWeek must be 0-6 (Sun-Sat) or null");
  });

  it("fails for invalid date format", () => {
    const result = validateAllocation({
      customerId: 100,
      effectiveFrom: "01-01-2026",
      allocatedMh: 120,
      mode: "MINIMUM_FLOOR",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("effectiveFrom must be YYYY-MM-DD format");
  });

  it("fails when effectiveTo < effectiveFrom", () => {
    const result = validateAllocation({
      customerId: 100,
      effectiveFrom: "2026-06-01",
      effectiveTo: "2026-01-01",
      allocatedMh: 120,
      mode: "MINIMUM_FLOOR",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("effectiveTo must be >= effectiveFrom");
  });

  it("fails for negative allocatedMh", () => {
    const result = validateAllocation({
      customerId: 100,
      effectiveFrom: "2026-01-01",
      allocatedMh: -10,
      mode: "MINIMUM_FLOOR",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("allocatedMh must be a positive number");
  });

  it("fails for invalid mode", () => {
    const result = validateAllocation({
      customerId: 100,
      effectiveFrom: "2026-01-01",
      allocatedMh: 120,
      mode: "INVALID" as "ADDITIVE",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("mode must be ADDITIVE or MINIMUM_FLOOR");
  });
});
