import { describe, it, expect } from "vitest";
import {
  resolveShiftForHour,
  enumerateGroundSlots,
  applyDemandCurve,
  validateDemandCurveWeights,
  computeDailyDemandV2,
} from "@/lib/capacity/demand-engine";
import type { DemandWorkPackage } from "@/lib/capacity/demand-engine";
import type { CapacityShift, CapacityAssumptions } from "@/types";

// ─── Test Fixtures ─────────────────────────────────────────────────────────

const shifts: CapacityShift[] = [
  {
    id: 1,
    code: "DAY",
    name: "Day",
    startHour: 7,
    endHour: 15,
    paidHours: 8.0,
    minHeadcount: 1,
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

const evenAssumptions: CapacityAssumptions = {
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

const weightedAssumptions: CapacityAssumptions = {
  ...evenAssumptions,
  demandCurve: "WEIGHTED",
  arrivalWeight: 0.15,
  departureWeight: 0.3,
};

// ─── resolveShiftForHour ───────────────────────────────────────────────────

describe("resolveShiftForHour", () => {
  it("maps hour 10 to Day shift", () => {
    const result = resolveShiftForHour(10, shifts);
    expect(result?.code).toBe("DAY");
  });

  it("maps hour 18 to Swing shift", () => {
    const result = resolveShiftForHour(18, shifts);
    expect(result?.code).toBe("SWING");
  });

  it("maps hour 23 to Night shift (start boundary)", () => {
    const result = resolveShiftForHour(23, shifts);
    expect(result?.code).toBe("NIGHT");
  });

  it("maps hour 3 to Night shift (overnight wrap)", () => {
    const result = resolveShiftForHour(3, shifts);
    expect(result?.code).toBe("NIGHT");
  });

  it("maps shift boundaries correctly — hour 7 is Day", () => {
    const result = resolveShiftForHour(7, shifts);
    expect(result?.code).toBe("DAY");
  });

  it("maps shift boundaries correctly — hour 15 is Swing", () => {
    const result = resolveShiftForHour(15, shifts);
    expect(result?.code).toBe("SWING");
  });

  it("returns null for empty shifts", () => {
    const result = resolveShiftForHour(10, []);
    expect(result).toBeNull();
  });
});

// ─── enumerateGroundSlots ─────────────────────────────────────────────────

describe("enumerateGroundSlots", () => {
  it("enumerates slots for a single-day stay within one shift", () => {
    // Arrives at 10:00 (Day), departs at 14:00 (Day) same day
    const slots = enumerateGroundSlots("2025-03-10T10:00:00Z", "2025-03-10T14:00:00Z", shifts);
    expect(slots.length).toBe(1);
    expect(slots[0].shift.code).toBe("DAY");
    expect(slots[0].date).toBe("2025-03-10");
  });

  it("enumerates slots for a multi-shift stay", () => {
    // Arrives at 10:00 (Day), departs at 20:00 (Swing) same day
    const slots = enumerateGroundSlots("2025-03-10T10:00:00Z", "2025-03-10T20:00:00Z", shifts);
    expect(slots.length).toBe(2);
    expect(slots.map((s) => s.shift.code)).toContain("DAY");
    expect(slots.map((s) => s.shift.code)).toContain("SWING");
  });

  it("enumerates slots for a multi-day stay", () => {
    // Arrives Mon 10:00, departs Wed 10:00 — covers 3 days × 3 shifts
    const slots = enumerateGroundSlots("2025-03-10T10:00:00Z", "2025-03-12T10:00:00Z", shifts);
    // Should cover Day/Swing/Night on 10th, all on 11th, Day on 12th + Night wraps
    expect(slots.length).toBeGreaterThanOrEqual(7);
  });

  it("returns empty for departure <= arrival", () => {
    const slots = enumerateGroundSlots("2025-03-10T10:00:00Z", "2025-03-10T10:00:00Z", shifts);
    expect(slots).toHaveLength(0);
  });

  it("returns empty for no active shifts", () => {
    const slots = enumerateGroundSlots("2025-03-10T10:00:00Z", "2025-03-10T14:00:00Z", []);
    expect(slots).toHaveLength(0);
  });

  it("marks arrival and departure shift flags", () => {
    // Arrives at 10:00 (Day), departs at 20:00 (Swing)
    const slots = enumerateGroundSlots("2025-03-10T10:00:00Z", "2025-03-10T20:00:00Z", shifts);

    const daySlot = slots.find((s) => s.shift.code === "DAY");
    const swingSlot = slots.find((s) => s.shift.code === "SWING");

    expect(daySlot?.isArrival).toBe(true);
    expect(swingSlot?.isDeparture).toBe(true);
  });
});

// ─── applyDemandCurve ─────────────────────────────────────────────────────

describe("applyDemandCurve", () => {
  it("EVEN: distributes MH equally across slots", () => {
    const slots = [
      { isArrival: true, isDeparture: false },
      { isArrival: false, isDeparture: false },
      { isArrival: false, isDeparture: true },
    ];

    const result = applyDemandCurve(6.0, slots, evenAssumptions);
    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(2.0);
    expect(result[1]).toBeCloseTo(2.0);
    expect(result[2]).toBeCloseTo(2.0);

    // Conservation law
    const total = result.reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(6.0);
  });

  it("WEIGHTED: boosts arrival and departure slots", () => {
    const slots = [
      { isArrival: true, isDeparture: false },
      { isArrival: false, isDeparture: false },
      { isArrival: false, isDeparture: true },
    ];

    const result = applyDemandCurve(6.0, slots, weightedAssumptions);

    // baseMH = (1 - 0.15 - 0.30) × 6 / 3 = 0.55 × 6 / 3 = 1.1
    // arrival = 1.1 + 0.15 × 6 = 1.1 + 0.9 = 2.0
    // middle = 1.1
    // departure = 1.1 + 0.30 × 6 = 1.1 + 1.8 = 2.9
    expect(result[0]).toBeCloseTo(2.0); // arrival
    expect(result[1]).toBeCloseTo(1.1); // middle
    expect(result[2]).toBeCloseTo(2.9); // departure

    // Conservation law
    const total = result.reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(6.0);
  });

  it("single-slot: all MH goes to one slot regardless of curve", () => {
    const result = applyDemandCurve(
      5.0,
      [{ isArrival: true, isDeparture: true }],
      weightedAssumptions,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBeCloseTo(5.0);
  });

  it("conservation: sum always equals totalMH", () => {
    const slots = [
      { isArrival: true, isDeparture: false },
      { isArrival: false, isDeparture: false },
      { isArrival: false, isDeparture: false },
      { isArrival: false, isDeparture: false },
      { isArrival: false, isDeparture: false },
      { isArrival: false, isDeparture: true },
    ];

    const resultEven = applyDemandCurve(3.0, slots, evenAssumptions);
    const totalEven = resultEven.reduce((sum, v) => sum + v, 0);
    expect(totalEven).toBeCloseTo(3.0);

    const resultWeighted = applyDemandCurve(3.0, slots, weightedAssumptions);
    const totalWeighted = resultWeighted.reduce((sum, v) => sum + v, 0);
    expect(totalWeighted).toBeCloseTo(3.0);
  });

  it("edge case: arrivalWeight + departureWeight = 1.0 → middle slots get 0 MH", () => {
    const fullWeightAssumptions: CapacityAssumptions = {
      ...evenAssumptions,
      demandCurve: "WEIGHTED",
      arrivalWeight: 0.5,
      departureWeight: 0.5,
    };

    const slots = [
      { isArrival: true, isDeparture: false },
      { isArrival: false, isDeparture: false },
      { isArrival: false, isDeparture: true },
    ];

    const result = applyDemandCurve(10.0, slots, fullWeightAssumptions);
    // baseMH = (1 - 1.0) × 10 / 3 = 0
    // arrival = 0 + 0.5 × 10 = 5
    // middle = 0
    // departure = 0 + 0.5 × 10 = 5
    expect(result[0]).toBeCloseTo(5.0);
    expect(result[1]).toBeCloseTo(0.0);
    expect(result[2]).toBeCloseTo(5.0);

    const total = result.reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(10.0);
  });

  it("returns empty array for empty slots", () => {
    const result = applyDemandCurve(5.0, [], evenAssumptions);
    expect(result).toHaveLength(0);
  });
});

// ─── validateDemandCurveWeights ───────────────────────────────────────────

describe("validateDemandCurveWeights", () => {
  it("returns null for valid weights", () => {
    expect(validateDemandCurveWeights(0.15, 0.3)).toBeNull();
  });

  it("allows weights summing to exactly 1.0", () => {
    expect(validateDemandCurveWeights(0.5, 0.5)).toBeNull();
  });

  it("rejects weights summing > 1.0", () => {
    const result = validateDemandCurveWeights(0.6, 0.5);
    expect(result).toContain("must be <= 1.0");
  });

  it("rejects negative weights", () => {
    expect(validateDemandCurveWeights(-0.1, 0.5)).toContain("non-negative");
  });
});

// ─── computeDailyDemandV2 ─────────────────────────────────────────────────

describe("computeDailyDemandV2", () => {
  it("distributes MH across slots (not duplicated per day)", () => {
    // 3 MH WP on ground 3 days → should be 3 MH total (NOT 9 MH)
    const wp: DemandWorkPackage = {
      id: 1,
      aircraftReg: "N123",
      customer: "DHL",
      arrival: "2025-03-10T10:00:00Z",
      departure: "2025-03-12T10:00:00Z",
      effectiveMH: 3.0,
      mhSource: "wp",
    };

    const result = computeDailyDemandV2([wp], shifts, evenAssumptions);
    const totalMH = result.reduce((sum, d) => sum + d.totalDemandMH, 0);

    // Total should be 3.0 (distributed), NOT 9.0 (duplicated)
    expect(totalMH).toBeCloseTo(3.0);
  });

  it("even distribution: 6 MH over 3 slots → 2 MH each", () => {
    // WP arrives 10:00, departs 14:00 — only one slot (Day on same day)
    // Let's use a 2-shift stay: 10:00 to 20:00 = Day + Swing
    const wp: DemandWorkPackage = {
      id: 1,
      aircraftReg: "N123",
      customer: "DHL",
      arrival: "2025-03-10T10:00:00Z",
      departure: "2025-03-10T20:00:00Z",
      effectiveMH: 6.0,
      mhSource: "wp",
    };

    const result = computeDailyDemandV2([wp], shifts, evenAssumptions);

    expect(result).toHaveLength(1);
    expect(result[0].totalDemandMH).toBeCloseTo(6.0);
    expect(result[0].byShift.length).toBe(2);
    // Each shift should get 3 MH
    for (const shift of result[0].byShift) {
      expect(shift.demandMH).toBeCloseTo(3.0);
    }
  });

  it("aggregates demand from multiple WPs", () => {
    const wps: DemandWorkPackage[] = [
      {
        id: 1,
        aircraftReg: "N123",
        customer: "DHL",
        arrival: "2025-03-10T10:00:00Z",
        departure: "2025-03-10T14:00:00Z",
        effectiveMH: 4.0,
        mhSource: "wp",
      },
      {
        id: 2,
        aircraftReg: "N456",
        customer: "FedEx",
        arrival: "2025-03-10T10:00:00Z",
        departure: "2025-03-10T14:00:00Z",
        effectiveMH: 2.0,
        mhSource: "default",
      },
    ];

    const result = computeDailyDemandV2(wps, shifts, evenAssumptions);

    expect(result).toHaveLength(1);
    expect(result[0].totalDemandMH).toBeCloseTo(6.0);
    expect(result[0].aircraftCount).toBe(2);
    expect(result[0].byCustomer["DHL"]).toBeCloseTo(4.0);
    expect(result[0].byCustomer["FedEx"]).toBeCloseTo(2.0);
  });

  it("returns empty for no work packages", () => {
    const result = computeDailyDemandV2([], shifts, evenAssumptions);
    expect(result).toHaveLength(0);
  });

  it("tracks WP contributions for drilldown", () => {
    const wp: DemandWorkPackage = {
      id: 42,
      aircraftReg: "N123",
      customer: "DHL",
      arrival: "2025-03-10T10:00:00Z",
      departure: "2025-03-10T14:00:00Z",
      effectiveMH: 5.0,
      mhSource: "override",
    };

    const result = computeDailyDemandV2([wp], shifts, evenAssumptions);
    const dayShift = result[0].byShift.find((s) => s.shiftCode === "DAY");
    expect(dayShift?.wpContributions).toHaveLength(1);
    expect(dayShift?.wpContributions[0].wpId).toBe(42);
    expect(dayShift?.wpContributions[0].mhSource).toBe("override");
  });

  it("byShift sums equal totalDemandMH", () => {
    const wps: DemandWorkPackage[] = [
      {
        id: 1,
        aircraftReg: "N123",
        customer: "DHL",
        arrival: "2025-03-10T08:00:00Z",
        departure: "2025-03-11T08:00:00Z",
        effectiveMH: 12.0,
        mhSource: "wp",
      },
    ];

    const result = computeDailyDemandV2(wps, shifts, evenAssumptions);

    for (const day of result) {
      const shiftSum = day.byShift.reduce((sum, s) => sum + s.demandMH, 0);
      expect(shiftSum).toBeCloseTo(day.totalDemandMH, 5);
    }

    // Total across all days should be 12.0
    const grandTotal = result.reduce((sum, d) => sum + d.totalDemandMH, 0);
    expect(grandTotal).toBeCloseTo(12.0);
  });

  it("byCustomer sums equal totalDemandMH per day", () => {
    const wps: DemandWorkPackage[] = [
      {
        id: 1,
        aircraftReg: "N123",
        customer: "DHL",
        arrival: "2025-03-10T10:00:00Z",
        departure: "2025-03-10T20:00:00Z",
        effectiveMH: 6.0,
        mhSource: "wp",
      },
      {
        id: 2,
        aircraftReg: "N456",
        customer: "FedEx",
        arrival: "2025-03-10T10:00:00Z",
        departure: "2025-03-10T20:00:00Z",
        effectiveMH: 4.0,
        mhSource: "wp",
      },
    ];

    const result = computeDailyDemandV2(wps, shifts, evenAssumptions);

    for (const day of result) {
      const custSum = Object.values(day.byCustomer).reduce((sum, v) => sum + v, 0);
      expect(custSum).toBeCloseTo(day.totalDemandMH, 5);
    }
  });
});
