import { describe, it, expect } from "vitest";
import {
  aggregateWorkedHours,
  applyWorkedHours,
  computeVariance,
  validateTimeBooking,
} from "@/lib/capacity/time-bookings-engine";
import type { TimeBooking, DailyDemandV2 } from "@/types";

// ─── Test Fixtures ─────────────────────────────────────────────────────────

function makeBooking(overrides: Partial<TimeBooking> = {}): TimeBooking {
  return {
    id: 1,
    workPackageId: null,
    aircraftReg: "N12345",
    customer: "DHL Air UK",
    bookingDate: "2026-03-01",
    shiftCode: "DAY",
    taskName: "Routine check",
    taskType: "routine",
    workedMh: 2.5,
    technicianCount: 2,
    notes: null,
    source: "manual",
    isActive: true,
    createdBy: 1,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeDemandDay(date: string, shifts: string[] = ["DAY", "SWING", "NIGHT"]): DailyDemandV2 {
  const byShift = shifts.map((sc) => ({
    shiftCode: sc,
    demandMH: 10,
    wpContributions: [],
  }));
  return {
    date,
    totalDemandMH: shifts.length * 10,
    aircraftCount: 3,
    byCustomer: { "DHL Air UK": 15, "Kalitta Air": 15 },
    byShift,
  };
}

// ─── aggregateWorkedHours ──────────────────────────────────────────────────

describe("aggregateWorkedHours", () => {
  it("returns empty map for empty bookings", () => {
    const result = aggregateWorkedHours([], "2026-03-01", "2026-03-07");
    expect(result.size).toBe(0);
  });

  it("aggregates a single booking", () => {
    const bookings = [makeBooking()];
    const result = aggregateWorkedHours(bookings, "2026-03-01", "2026-03-07");
    expect(result.size).toBe(1);
    expect(result.get("2026-03-01")?.get("DAY")).toBe(2.5);
  });

  it("sums multiple entries for same date+shift", () => {
    const bookings = [
      makeBooking({ id: 1, workedMh: 2.5 }),
      makeBooking({ id: 2, workedMh: 1.5, taskType: "non_routine", taskName: "AOG repair" }),
      makeBooking({ id: 3, workedMh: 0.75, taskType: "admin" }),
    ];
    const result = aggregateWorkedHours(bookings, "2026-03-01", "2026-03-07");
    expect(result.get("2026-03-01")?.get("DAY")).toBe(4.75);
  });

  it("separates different shifts on same date", () => {
    const bookings = [
      makeBooking({ id: 1, shiftCode: "DAY", workedMh: 3.0 }),
      makeBooking({ id: 2, shiftCode: "SWING", workedMh: 2.0 }),
      makeBooking({ id: 3, shiftCode: "NIGHT", workedMh: 1.0 }),
    ];
    const result = aggregateWorkedHours(bookings, "2026-03-01", "2026-03-07");
    const byShift = result.get("2026-03-01")!;
    expect(byShift.get("DAY")).toBe(3.0);
    expect(byShift.get("SWING")).toBe(2.0);
    expect(byShift.get("NIGHT")).toBe(1.0);
  });

  it("separates different dates", () => {
    const bookings = [
      makeBooking({ id: 1, bookingDate: "2026-03-01", workedMh: 5.0 }),
      makeBooking({ id: 2, bookingDate: "2026-03-02", workedMh: 3.0 }),
    ];
    const result = aggregateWorkedHours(bookings, "2026-03-01", "2026-03-07");
    expect(result.size).toBe(2);
    expect(result.get("2026-03-01")?.get("DAY")).toBe(5.0);
    expect(result.get("2026-03-02")?.get("DAY")).toBe(3.0);
  });

  it("excludes inactive bookings", () => {
    const bookings = [
      makeBooking({ id: 1, workedMh: 5.0 }),
      makeBooking({ id: 2, workedMh: 3.0, isActive: false }),
    ];
    const result = aggregateWorkedHours(bookings, "2026-03-01", "2026-03-07");
    expect(result.get("2026-03-01")?.get("DAY")).toBe(5.0);
  });

  it("excludes bookings outside date range", () => {
    const bookings = [
      makeBooking({ id: 1, bookingDate: "2026-02-28", workedMh: 5.0 }),
      makeBooking({ id: 2, bookingDate: "2026-03-01", workedMh: 3.0 }),
      makeBooking({ id: 3, bookingDate: "2026-03-08", workedMh: 2.0 }),
    ];
    const result = aggregateWorkedHours(bookings, "2026-03-01", "2026-03-07");
    expect(result.size).toBe(1);
    expect(result.get("2026-03-01")?.get("DAY")).toBe(3.0);
  });

  it("handles floating point precision", () => {
    const bookings = [makeBooking({ id: 1, workedMh: 0.1 }), makeBooking({ id: 2, workedMh: 0.2 })];
    const result = aggregateWorkedHours(bookings, "2026-03-01", "2026-03-07");
    expect(result.get("2026-03-01")?.get("DAY")).toBe(0.3);
  });
});

// ─── applyWorkedHours ──────────────────────────────────────────────────────

describe("applyWorkedHours", () => {
  it("returns demand unchanged when aggregated is empty", () => {
    const demand = [makeDemandDay("2026-03-01")];
    const result = applyWorkedHours(demand, new Map());
    expect(result).toBe(demand); // same reference — no copy needed
  });

  it("overlays workedMH on matching shift", () => {
    const demand = [makeDemandDay("2026-03-01")];
    const agg = new Map([["2026-03-01", new Map([["DAY", 8.5]])]]);
    const result = applyWorkedHours(demand, agg);

    expect(result[0].byShift[0].workedMH).toBe(8.5);
    expect(result[0].byShift[1].workedMH).toBeUndefined(); // SWING untouched
    expect(result[0].totalWorkedMH).toBe(8.5);
  });

  it("overlays multiple shifts", () => {
    const demand = [makeDemandDay("2026-03-01")];
    const agg = new Map([
      [
        "2026-03-01",
        new Map([
          ["DAY", 8.0],
          ["SWING", 6.5],
          ["NIGHT", 3.0],
        ]),
      ],
    ]);
    const result = applyWorkedHours(demand, agg);

    expect(result[0].byShift[0].workedMH).toBe(8.0);
    expect(result[0].byShift[1].workedMH).toBe(6.5);
    expect(result[0].byShift[2].workedMH).toBe(3.0);
    expect(result[0].totalWorkedMH).toBe(17.5);
  });

  it("does not modify original demand", () => {
    const demand = [makeDemandDay("2026-03-01")];
    const agg = new Map([["2026-03-01", new Map([["DAY", 5.0]])]]);
    applyWorkedHours(demand, agg);

    expect(demand[0].totalWorkedMH).toBeUndefined();
    expect(demand[0].byShift[0].workedMH).toBeUndefined();
  });

  it("skips days with no aggregated data", () => {
    const demand = [makeDemandDay("2026-03-01"), makeDemandDay("2026-03-02")];
    const agg = new Map([["2026-03-01", new Map([["DAY", 4.0]])]]);
    const result = applyWorkedHours(demand, agg);

    expect(result[0].totalWorkedMH).toBe(4.0);
    expect(result[1].totalWorkedMH).toBeUndefined();
  });

  it("preserves existing demand fields", () => {
    const demand = [makeDemandDay("2026-03-01")];
    demand[0].totalAllocatedDemandMH = 35;
    demand[0].totalForecastedDemandMH = 28;
    demand[0].byShift[0].allocatedDemandMH = 12;
    demand[0].byShift[0].forecastedDemandMH = 9;

    const agg = new Map([["2026-03-01", new Map([["DAY", 7.0]])]]);
    const result = applyWorkedHours(demand, agg);

    expect(result[0].totalAllocatedDemandMH).toBe(35);
    expect(result[0].totalForecastedDemandMH).toBe(28);
    expect(result[0].totalDemandMH).toBe(30); // unchanged
    expect(result[0].byShift[0].allocatedDemandMH).toBe(12);
    expect(result[0].byShift[0].forecastedDemandMH).toBe(9);
    expect(result[0].byShift[0].demandMH).toBe(10); // unchanged
  });

  it("rounds totalWorkedMH to 2 decimal places", () => {
    const demand = [makeDemandDay("2026-03-01")];
    const agg = new Map([
      [
        "2026-03-01",
        new Map([
          ["DAY", 1.333],
          ["SWING", 2.667],
        ]),
      ],
    ]);
    const result = applyWorkedHours(demand, agg);
    expect(result[0].totalWorkedMH).toBe(4.0);
  });

  it("handles demand with single shift", () => {
    const demand = [makeDemandDay("2026-03-01", ["DAY"])];
    const agg = new Map([["2026-03-01", new Map([["DAY", 5.5]])]]);
    const result = applyWorkedHours(demand, agg);
    expect(result[0].totalWorkedMH).toBe(5.5);
    expect(result[0].byShift[0].workedMH).toBe(5.5);
  });
});

// ─── computeVariance ───────────────────────────────────────────────────────

describe("computeVariance", () => {
  it("returns zero variance when planned equals actual", () => {
    const { variance, variancePct } = computeVariance(10, 10);
    expect(variance).toBe(0);
    expect(variancePct).toBe(0);
  });

  it("returns positive variance when under-worked", () => {
    const { variance, variancePct } = computeVariance(10, 7);
    expect(variance).toBe(3);
    expect(variancePct).toBe(30);
  });

  it("returns negative variance when over-worked", () => {
    const { variance, variancePct } = computeVariance(10, 13);
    expect(variance).toBe(-3);
    expect(variancePct).toBe(-30);
  });

  it("returns null variancePct when planned is zero", () => {
    const { variance, variancePct } = computeVariance(0, 5);
    expect(variance).toBe(-5);
    expect(variancePct).toBeNull();
  });

  it("handles large variance correctly", () => {
    const { variance, variancePct } = computeVariance(100, 1);
    expect(variance).toBe(99);
    expect(variancePct).toBe(99);
  });
});

// ─── validateTimeBooking ───────────────────────────────────────────────────

describe("validateTimeBooking", () => {
  it("accepts a valid complete booking", () => {
    const result = validateTimeBooking({
      aircraftReg: "N12345",
      customer: "DHL Air UK",
      bookingDate: "2026-03-01",
      shiftCode: "DAY",
      workedMh: 2.5,
      taskType: "routine",
      source: "manual",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts a valid minimal booking (only required fields)", () => {
    const result = validateTimeBooking({
      aircraftReg: "C-FOIJ",
      customer: "CargoJet Airways",
      bookingDate: "2026-03-15",
      shiftCode: "NIGHT",
      workedMh: 0.5,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing aircraftReg", () => {
    const result = validateTimeBooking({
      customer: "DHL",
      bookingDate: "2026-03-01",
      shiftCode: "DAY",
      workedMh: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("aircraftReg is required");
  });

  it("rejects empty aircraftReg", () => {
    const result = validateTimeBooking({
      aircraftReg: "  ",
      customer: "DHL",
      bookingDate: "2026-03-01",
      shiftCode: "DAY",
      workedMh: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("aircraftReg is required");
  });

  it("rejects missing customer", () => {
    const result = validateTimeBooking({
      aircraftReg: "N12345",
      bookingDate: "2026-03-01",
      shiftCode: "DAY",
      workedMh: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("customer is required");
  });

  it("rejects missing bookingDate", () => {
    const result = validateTimeBooking({
      aircraftReg: "N12345",
      customer: "DHL",
      shiftCode: "DAY",
      workedMh: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("bookingDate is required");
  });

  it("rejects invalid bookingDate format", () => {
    const result = validateTimeBooking({
      aircraftReg: "N12345",
      customer: "DHL",
      bookingDate: "03/01/2026",
      shiftCode: "DAY",
      workedMh: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("bookingDate must be YYYY-MM-DD format");
  });

  it("rejects missing shiftCode", () => {
    const result = validateTimeBooking({
      aircraftReg: "N12345",
      customer: "DHL",
      bookingDate: "2026-03-01",
      workedMh: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("shiftCode is required");
  });

  it("rejects invalid shiftCode", () => {
    const result = validateTimeBooking({
      aircraftReg: "N12345",
      customer: "DHL",
      bookingDate: "2026-03-01",
      shiftCode: "MORNING",
      workedMh: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("shiftCode must be one of");
  });

  it("rejects missing workedMh", () => {
    const result = validateTimeBooking({
      aircraftReg: "N12345",
      customer: "DHL",
      bookingDate: "2026-03-01",
      shiftCode: "DAY",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("workedMh is required");
  });

  it("rejects zero workedMh", () => {
    const result = validateTimeBooking({
      aircraftReg: "N12345",
      customer: "DHL",
      bookingDate: "2026-03-01",
      shiftCode: "DAY",
      workedMh: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("workedMh must be a positive number");
  });

  it("rejects negative workedMh", () => {
    const result = validateTimeBooking({
      aircraftReg: "N12345",
      customer: "DHL",
      bookingDate: "2026-03-01",
      shiftCode: "DAY",
      workedMh: -1.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("workedMh must be a positive number");
  });

  it("rejects invalid taskType", () => {
    const result = validateTimeBooking({
      aircraftReg: "N12345",
      customer: "DHL",
      bookingDate: "2026-03-01",
      shiftCode: "DAY",
      workedMh: 2.5,
      taskType: "unknown" as "routine",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("taskType must be one of");
  });

  it("rejects invalid source", () => {
    const result = validateTimeBooking({
      aircraftReg: "N12345",
      customer: "DHL",
      bookingDate: "2026-03-01",
      shiftCode: "DAY",
      workedMh: 2.5,
      source: "api" as "manual",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("source must be one of");
  });

  it("rejects negative technicianCount", () => {
    const result = validateTimeBooking({
      aircraftReg: "N12345",
      customer: "DHL",
      bookingDate: "2026-03-01",
      shiftCode: "DAY",
      workedMh: 2.5,
      technicianCount: -1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("technicianCount must be a non-negative integer");
  });

  it("rejects non-integer technicianCount", () => {
    const result = validateTimeBooking({
      aircraftReg: "N12345",
      customer: "DHL",
      bookingDate: "2026-03-01",
      shiftCode: "DAY",
      workedMh: 2.5,
      technicianCount: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("technicianCount must be a non-negative integer");
  });

  it("allows null technicianCount", () => {
    const result = validateTimeBooking({
      aircraftReg: "N12345",
      customer: "DHL",
      bookingDate: "2026-03-01",
      shiftCode: "DAY",
      workedMh: 2.5,
      technicianCount: null,
    });
    expect(result.valid).toBe(true);
  });

  it("collects multiple errors", () => {
    const result = validateTimeBooking({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
    expect(result.errors).toContain("aircraftReg is required");
    expect(result.errors).toContain("customer is required");
    expect(result.errors).toContain("bookingDate is required");
    expect(result.errors).toContain("shiftCode is required");
    expect(result.errors).toContain("workedMh is required");
  });

  it("accepts all valid task types", () => {
    for (const taskType of ["routine", "non_routine", "aog", "training", "admin"] as const) {
      const result = validateTimeBooking({
        aircraftReg: "N12345",
        customer: "DHL",
        bookingDate: "2026-03-01",
        shiftCode: "DAY",
        workedMh: 1.0,
        taskType,
      });
      expect(result.valid).toBe(true);
    }
  });

  it("accepts all valid shift codes", () => {
    for (const shiftCode of ["DAY", "SWING", "NIGHT"]) {
      const result = validateTimeBooking({
        aircraftReg: "N12345",
        customer: "DHL",
        bookingDate: "2026-03-01",
        shiftCode,
        workedMh: 1.0,
      });
      expect(result.valid).toBe(true);
    }
  });
});
