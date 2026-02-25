import { describe, it, expect } from "vitest";
import {
  resolveHeadcount,
  computeProductiveHoursPerPerson,
  computeDailyCapacityV2,
  computeUtilizationV2,
  validateHeadcountCoverage,
  computeCapacitySummary,
} from "@/lib/capacity/capacity-core";
import type {
  CapacityShift,
  CapacityAssumptions,
  HeadcountPlan,
  HeadcountException,
  DailyDemandV2,
} from "@/types";

// ─── Test Fixtures ─────────────────────────────────────────────────────────

const shifts: CapacityShift[] = [
  {
    id: 1,
    code: "DAY",
    name: "Day",
    startHour: 7,
    endHour: 15,
    paidHours: 8.0,
    timezone: "UTC",
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
    timezone: "UTC",
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
    timezone: "UTC",
    minHeadcount: 1,
    sortOrder: 2,
    isActive: true,
  },
];

const defaultAssumptions: CapacityAssumptions = {
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

const basePlans: HeadcountPlan[] = [
  {
    id: 1,
    station: "CVG",
    shiftId: 1,
    headcount: 8,
    effectiveFrom: "2020-01-01",
    effectiveTo: null,
    dayOfWeek: null,
    label: "Day base",
    notes: null,
  },
  {
    id: 2,
    station: "CVG",
    shiftId: 2,
    headcount: 6,
    effectiveFrom: "2020-01-01",
    effectiveTo: null,
    dayOfWeek: null,
    label: "Swing base",
    notes: null,
  },
  {
    id: 3,
    station: "CVG",
    shiftId: 3,
    headcount: 4,
    effectiveFrom: "2020-01-01",
    effectiveTo: null,
    dayOfWeek: null,
    label: "Night base",
    notes: null,
  },
];

// ─── resolveHeadcount ──────────────────────────────────────────────────────

describe("resolveHeadcount", () => {
  it("returns base headcount when no exceptions", () => {
    const result = resolveHeadcount("2025-03-10", 1, basePlans, []);
    expect(result.headcount).toBe(8);
    expect(result.hasExceptions).toBe(false);
  });

  it("returns 0 when no plans match", () => {
    const result = resolveHeadcount("2025-03-10", 99, basePlans, []);
    expect(result.headcount).toBe(0);
  });

  it("prefers dayOfWeek-specific plan over generic", () => {
    // 2025-03-10 is a Monday (dayOfWeek = 1)
    const plans: HeadcountPlan[] = [
      ...basePlans,
      {
        id: 10,
        station: "CVG",
        shiftId: 1,
        headcount: 5,
        effectiveFrom: "2020-01-01",
        effectiveTo: null,
        dayOfWeek: 1,
        label: "Monday override",
        notes: null,
      },
    ];
    const result = resolveHeadcount("2025-03-10", 1, plans, []);
    expect(result.headcount).toBe(5);
  });

  it("latest effectiveFrom wins among ties", () => {
    const plans: HeadcountPlan[] = [
      ...basePlans,
      {
        id: 10,
        station: "CVG",
        shiftId: 1,
        headcount: 10,
        effectiveFrom: "2025-01-01",
        effectiveTo: null,
        dayOfWeek: null,
        label: "New plan",
        notes: null,
      },
    ];
    const result = resolveHeadcount("2025-03-10", 1, plans, []);
    expect(result.headcount).toBe(10);
  });

  it("applies positive exception deltas", () => {
    const exceptions: HeadcountException[] = [
      {
        id: 1,
        station: "CVG",
        shiftId: 1,
        exceptionDate: "2025-03-10",
        headcountDelta: 2,
        reason: "Overtime",
      },
    ];
    const result = resolveHeadcount("2025-03-10", 1, basePlans, exceptions);
    expect(result.headcount).toBe(10);
    expect(result.hasExceptions).toBe(true);
  });

  it("applies negative exception deltas and floors at 0", () => {
    const exceptions: HeadcountException[] = [
      {
        id: 1,
        station: "CVG",
        shiftId: 3,
        exceptionDate: "2025-03-10",
        headcountDelta: -10,
        reason: "Holiday",
      },
    ];
    const result = resolveHeadcount("2025-03-10", 3, basePlans, exceptions);
    expect(result.headcount).toBe(0); // 4 + (-10) = -6, floored to 0
    expect(result.hasExceptions).toBe(true);
  });

  it("sums multiple exception deltas", () => {
    const exceptions: HeadcountException[] = [
      {
        id: 1,
        station: "CVG",
        shiftId: 1,
        exceptionDate: "2025-03-10",
        headcountDelta: -2,
        reason: "PTO",
      },
      {
        id: 2,
        station: "CVG",
        shiftId: 1,
        exceptionDate: "2025-03-10",
        headcountDelta: 1,
        reason: "Coverage",
      },
    ];
    const result = resolveHeadcount("2025-03-10", 1, basePlans, exceptions);
    expect(result.headcount).toBe(7); // 8 + (-2) + 1
  });

  it("respects effectiveTo date range", () => {
    const plans: HeadcountPlan[] = [
      {
        id: 1,
        station: "CVG",
        shiftId: 1,
        headcount: 8,
        effectiveFrom: "2020-01-01",
        effectiveTo: "2025-02-28",
        dayOfWeek: null,
        label: "Expired",
        notes: null,
      },
      {
        id: 2,
        station: "CVG",
        shiftId: 1,
        headcount: 12,
        effectiveFrom: "2025-03-01",
        effectiveTo: null,
        dayOfWeek: null,
        label: "Current",
        notes: null,
      },
    ];
    const result = resolveHeadcount("2025-03-10", 1, plans, []);
    expect(result.headcount).toBe(12);
  });

  it("ignores exceptions for other shifts", () => {
    const exceptions: HeadcountException[] = [
      {
        id: 1,
        station: "CVG",
        shiftId: 2,
        exceptionDate: "2025-03-10",
        headcountDelta: -5,
        reason: null,
      },
    ];
    const result = resolveHeadcount("2025-03-10", 1, basePlans, exceptions);
    expect(result.headcount).toBe(8);
    expect(result.hasExceptions).toBe(false);
  });
});

// ─── computeProductiveHoursPerPerson ───────────────────────────────────────

describe("computeProductiveHoursPerPerson", () => {
  it("computes Day shift: 8.0 × 0.73 = 5.84 (paidToAvailable is on headcount now)", () => {
    const result = computeProductiveHoursPerPerson(shifts[0], defaultAssumptions);
    expect(result).toBeCloseTo(8.0 * 0.73, 2);
  });

  it("computes Night shift with factor: 8.0 × 0.73 × 0.85 = 4.96", () => {
    const result = computeProductiveHoursPerPerson(shifts[2], defaultAssumptions);
    expect(result).toBeCloseTo(8.0 * 0.73 * 0.85, 2);
  });

  it("does not apply night factor to non-night shifts", () => {
    const dayResult = computeProductiveHoursPerPerson(shifts[0], defaultAssumptions);
    const swingResult = computeProductiveHoursPerPerson(shifts[1], defaultAssumptions);
    expect(dayResult).toEqual(swingResult);
  });

  it("returns non-zero even when paidToAvailable is 0 (paidToAvailable is on headcount)", () => {
    const assumptions = { ...defaultAssumptions, paidToAvailable: 0 };
    const result = computeProductiveHoursPerPerson(shifts[0], assumptions);
    expect(result).toBeCloseTo(8.0 * 0.73, 2);
  });
});

// ─── computeDailyCapacityV2 ────────────────────────────────────────────────

describe("computeDailyCapacityV2", () => {
  it("computes capacity for a single date", () => {
    const result = computeDailyCapacityV2(
      ["2025-03-10"],
      shifts,
      basePlans,
      [],
      defaultAssumptions,
    );

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2025-03-10");
    expect(result[0].byShift).toHaveLength(3);

    // Day: roster 8, effective 8×0.89=7.12, productiveMH = 7.12 × 5.84 = 41.58
    expect(result[0].byShift[0].rosterHeadcount).toBe(8);
    expect(result[0].byShift[0].effectiveHeadcount).toBeCloseTo(8 * 0.89, 2);
    expect(result[0].byShift[0].paidHoursPerPerson).toBe(8.0);
    expect(result[0].byShift[0].paidMH).toBeCloseTo(8 * 0.89 * 8.0, 1);
    expect(result[0].byShift[0].availableMH).toBeCloseTo(result[0].byShift[0].paidMH, 4);
    // productiveMH total unchanged: 8 × 0.89 × 8.0 × 0.73 = 41.58
    expect(result[0].byShift[0].productiveMH).toBeCloseTo(8 * 0.89 * 8.0 * 0.73, 1);
    expect(result[0].byShift[0].belowMinHeadcount).toBe(false);
  });

  it("computes total productive MH as sum of shifts", () => {
    const result = computeDailyCapacityV2(
      ["2025-03-10"],
      shifts,
      basePlans,
      [],
      defaultAssumptions,
    );

    // Total unchanged: roster × p2a × paidHours × a2p [× nightFactor]
    const p2a = 0.89;
    const a2p = 0.73;
    const nf = 0.85;
    const expectedTotal =
      8 * p2a * 8.0 * a2p + // Day
      6 * p2a * 8.0 * a2p + // Swing
      4 * p2a * 8.0 * a2p * nf; // Night

    expect(result[0].totalProductiveMH).toBeCloseTo(expectedTotal, 0);
  });

  it("flags belowMinHeadcount when headcount < shift minimum", () => {
    const exceptions: HeadcountException[] = [
      {
        id: 1,
        station: "CVG",
        shiftId: 1,
        exceptionDate: "2025-03-10",
        headcountDelta: -7,
        reason: "Holiday",
      },
    ];
    const result = computeDailyCapacityV2(
      ["2025-03-10"],
      shifts,
      basePlans,
      exceptions,
      defaultAssumptions,
    );

    // Day: roster 8 + (-7) = 1, effective = 1 × 0.89 = 0.89
    // belowMinHeadcount compares roster (1) vs min (2) → true
    expect(result[0].byShift[0].rosterHeadcount).toBe(1);
    expect(result[0].byShift[0].effectiveHeadcount).toBeCloseTo(1 * 0.89, 2);
    expect(result[0].byShift[0].paidHoursPerPerson).toBe(8.0);
    expect(result[0].byShift[0].belowMinHeadcount).toBe(true);
  });

  it("handles empty data (no plans)", () => {
    const result = computeDailyCapacityV2(["2025-03-10"], shifts, [], [], defaultAssumptions);

    expect(result[0].byShift[0].rosterHeadcount).toBe(0);
    expect(result[0].byShift[0].effectiveHeadcount).toBe(0);
    expect(result[0].byShift[0].paidHoursPerPerson).toBe(8.0);
    expect(result[0].totalProductiveMH).toBe(0);
  });

  it("belowMinHeadcount compares roster, not effective", () => {
    // Roster = 3, effective = 3 × 0.89 = 2.67, minHeadcount = 2
    // Should NOT be below min because roster (3) >= min (2)
    const plans: HeadcountPlan[] = [
      {
        id: 10,
        station: "CVG",
        shiftId: 1,
        headcount: 3,
        effectiveFrom: "2020-01-01",
        effectiveTo: null,
        dayOfWeek: null,
        label: "Test",
        notes: null,
      },
    ];
    const result = computeDailyCapacityV2(["2025-03-10"], shifts, plans, [], defaultAssumptions);

    expect(result[0].byShift[0].rosterHeadcount).toBe(3);
    expect(result[0].byShift[0].effectiveHeadcount).toBeCloseTo(3 * 0.89, 2);
    expect(result[0].byShift[0].belowMinHeadcount).toBe(false);
  });

  it("availableMH equals paidMH (paidToAvailable absorbed into headcount)", () => {
    const result = computeDailyCapacityV2(
      ["2025-03-10"],
      shifts,
      basePlans,
      [],
      defaultAssumptions,
    );

    for (const shiftCap of result[0].byShift) {
      expect(shiftCap.availableMH).toBeCloseTo(shiftCap.paidMH, 4);
    }
  });
});

// ─── computeUtilizationV2 ─────────────────────────────────────────────────

describe("computeUtilizationV2", () => {
  it("computes utilization correctly", () => {
    const demand: DailyDemandV2[] = [
      {
        date: "2025-03-10",
        totalDemandMH: 50,
        aircraftCount: 5,
        byCustomer: { DHL: 30, FedEx: 20 },
        byShift: [
          { shiftCode: "DAY", demandMH: 25, wpContributions: [] },
          { shiftCode: "SWING", demandMH: 15, wpContributions: [] },
          { shiftCode: "NIGHT", demandMH: 10, wpContributions: [] },
        ],
      },
    ];

    const capacity = computeDailyCapacityV2(
      ["2025-03-10"],
      shifts,
      basePlans,
      [],
      defaultAssumptions,
    );

    const result = computeUtilizationV2(demand, capacity);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2025-03-10");
    expect(result[0].totalDemandMH).toBe(50);
    expect(result[0].utilizationPercent).toBeGreaterThan(0);
    expect(result[0].byShift).toHaveLength(3);
  });

  it("returns null utilization when productiveMH = 0", () => {
    const demand: DailyDemandV2[] = [
      {
        date: "2025-03-10",
        totalDemandMH: 10,
        aircraftCount: 1,
        byCustomer: { DHL: 10 },
        byShift: [{ shiftCode: "DAY", demandMH: 10, wpContributions: [] }],
      },
    ];

    // Zero capacity — no plans
    const capacity = computeDailyCapacityV2(["2025-03-10"], shifts, [], [], defaultAssumptions);

    const result = computeUtilizationV2(demand, capacity);

    expect(result[0].utilizationPercent).toBeNull();
    expect(result[0].gapMH).toBe(-10);
    expect(result[0].byShift[0].noCoverage).toBe(true);
    expect(result[0].byShift[0].utilization).toBeNull();
  });

  it("sets overtime flag when utilization > 100%", () => {
    const demand: DailyDemandV2[] = [
      {
        date: "2025-03-10",
        totalDemandMH: 200,
        aircraftCount: 20,
        byCustomer: { DHL: 200 },
        byShift: [
          { shiftCode: "DAY", demandMH: 80, wpContributions: [] },
          { shiftCode: "SWING", demandMH: 60, wpContributions: [] },
          { shiftCode: "NIGHT", demandMH: 60, wpContributions: [] },
        ],
      },
    ];

    const capacity = computeDailyCapacityV2(
      ["2025-03-10"],
      shifts,
      basePlans,
      [],
      defaultAssumptions,
    );

    const result = computeUtilizationV2(demand, capacity);
    expect(result[0].overtimeFlag).toBe(true);
  });

  it("handles dates with capacity but no demand", () => {
    const capacity = computeDailyCapacityV2(
      ["2025-03-10"],
      shifts,
      basePlans,
      [],
      defaultAssumptions,
    );

    const result = computeUtilizationV2([], capacity);
    expect(result).toHaveLength(1);
    expect(result[0].totalDemandMH).toBe(0);
    expect(result[0].utilizationPercent).toBe(0);
    expect(result[0].gapMH).toBeGreaterThan(0);
  });
});

// ─── validateHeadcountCoverage ─────────────────────────────────────────────

describe("validateHeadcountCoverage", () => {
  it("returns warnings for shifts below minimum headcount", () => {
    const exceptions: HeadcountException[] = [
      {
        id: 1,
        station: "CVG",
        shiftId: 1,
        exceptionDate: "2025-03-10",
        headcountDelta: -7,
        reason: null,
      },
    ];
    const capacity = computeDailyCapacityV2(
      ["2025-03-10"],
      shifts,
      basePlans,
      exceptions,
      defaultAssumptions,
    );

    const warnings = validateHeadcountCoverage(capacity, shifts);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Day");
    expect(warnings[0]).toContain("below minimum");
  });

  it("returns no warnings when all shifts meet minimum", () => {
    const capacity = computeDailyCapacityV2(
      ["2025-03-10"],
      shifts,
      basePlans,
      [],
      defaultAssumptions,
    );

    const warnings = validateHeadcountCoverage(capacity, shifts);
    expect(warnings).toHaveLength(0);
  });
});

// ─── computeCapacitySummary ────────────────────────────────────────────────

describe("computeCapacitySummary", () => {
  it("computes summary statistics", () => {
    const demand: DailyDemandV2[] = [
      {
        date: "2025-03-10",
        totalDemandMH: 50,
        aircraftCount: 5,
        byCustomer: {},
        byShift: [
          { shiftCode: "DAY", demandMH: 25, wpContributions: [] },
          { shiftCode: "SWING", demandMH: 15, wpContributions: [] },
          { shiftCode: "NIGHT", demandMH: 10, wpContributions: [] },
        ],
      },
    ];

    const capacity = computeDailyCapacityV2(
      ["2025-03-10"],
      shifts,
      basePlans,
      [],
      defaultAssumptions,
    );

    const utilization = computeUtilizationV2(demand, capacity);
    const summary = computeCapacitySummary(utilization);

    expect(summary.avgUtilization).not.toBeNull();
    expect(summary.totalDemandMH).toBe(50);
    expect(summary.totalCapacityMH).toBeGreaterThan(0);
    expect(summary.criticalDays).toBe(0);
    expect(summary.overtimeDays).toBe(0);
    expect(summary.worstDeficit).not.toBeNull();
  });

  it("returns empty summary for no data", () => {
    const summary = computeCapacitySummary([]);
    expect(summary.avgUtilization).toBeNull();
    expect(summary.totalDemandMH).toBe(0);
    expect(summary.worstDeficit).toBeNull();
  });
});
