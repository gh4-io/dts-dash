import { describe, it, expect } from "vitest";
import {
  aggregateBilledHours,
  applyBilledHours,
  computeBillingVariance,
  validateBillingEntry,
} from "@/lib/capacity/billing-engine";
import type { BillingEntry, DailyDemandV2 } from "@/types";

// ─── Test Fixtures ─────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<BillingEntry> = {}): BillingEntry {
  return {
    id: 1,
    workPackageId: null,
    aircraftReg: "N12345",
    customer: "DHL Air UK",
    billingDate: "2026-03-01",
    shiftCode: "DAY",
    description: "Routine check billing",
    billedMh: 2.5,
    invoiceRef: null,
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

// ─── aggregateBilledHours ──────────────────────────────────────────────────

describe("aggregateBilledHours", () => {
  it("returns empty map for empty entries", () => {
    const result = aggregateBilledHours([], "2026-03-01", "2026-03-07");
    expect(result.size).toBe(0);
  });

  it("aggregates a single entry", () => {
    const entries = [makeEntry()];
    const result = aggregateBilledHours(entries, "2026-03-01", "2026-03-07");
    expect(result.size).toBe(1);
    expect(result.get("2026-03-01")?.get("DAY")).toBe(2.5);
  });

  it("sums multiple entries for same date+shift", () => {
    const entries = [
      makeEntry({ id: 1, billedMh: 2.5 }),
      makeEntry({ id: 2, billedMh: 1.5, description: "AOG repair billing" }),
      makeEntry({ id: 3, billedMh: 0.75 }),
    ];
    const result = aggregateBilledHours(entries, "2026-03-01", "2026-03-07");
    expect(result.get("2026-03-01")?.get("DAY")).toBe(4.75);
  });

  it("separates different shifts on same date", () => {
    const entries = [
      makeEntry({ id: 1, shiftCode: "DAY", billedMh: 3.0 }),
      makeEntry({ id: 2, shiftCode: "SWING", billedMh: 2.0 }),
      makeEntry({ id: 3, shiftCode: "NIGHT", billedMh: 1.0 }),
    ];
    const result = aggregateBilledHours(entries, "2026-03-01", "2026-03-07");
    const byShift = result.get("2026-03-01")!;
    expect(byShift.get("DAY")).toBe(3.0);
    expect(byShift.get("SWING")).toBe(2.0);
    expect(byShift.get("NIGHT")).toBe(1.0);
  });

  it("separates different dates", () => {
    const entries = [
      makeEntry({ id: 1, billingDate: "2026-03-01", billedMh: 5.0 }),
      makeEntry({ id: 2, billingDate: "2026-03-02", billedMh: 3.0 }),
    ];
    const result = aggregateBilledHours(entries, "2026-03-01", "2026-03-07");
    expect(result.size).toBe(2);
    expect(result.get("2026-03-01")?.get("DAY")).toBe(5.0);
    expect(result.get("2026-03-02")?.get("DAY")).toBe(3.0);
  });

  it("excludes inactive entries", () => {
    const entries = [
      makeEntry({ id: 1, billedMh: 5.0 }),
      makeEntry({ id: 2, billedMh: 3.0, isActive: false }),
    ];
    const result = aggregateBilledHours(entries, "2026-03-01", "2026-03-07");
    expect(result.get("2026-03-01")?.get("DAY")).toBe(5.0);
  });

  it("excludes entries outside date range", () => {
    const entries = [
      makeEntry({ id: 1, billingDate: "2026-02-28", billedMh: 5.0 }),
      makeEntry({ id: 2, billingDate: "2026-03-01", billedMh: 3.0 }),
      makeEntry({ id: 3, billingDate: "2026-03-08", billedMh: 2.0 }),
    ];
    const result = aggregateBilledHours(entries, "2026-03-01", "2026-03-07");
    expect(result.size).toBe(1);
    expect(result.get("2026-03-01")?.get("DAY")).toBe(3.0);
  });

  it("handles floating point precision", () => {
    const entries = [makeEntry({ id: 1, billedMh: 0.1 }), makeEntry({ id: 2, billedMh: 0.2 })];
    const result = aggregateBilledHours(entries, "2026-03-01", "2026-03-07");
    expect(result.get("2026-03-01")?.get("DAY")).toBe(0.3);
  });
});

// ─── applyBilledHours ──────────────────────────────────────────────────────

describe("applyBilledHours", () => {
  it("returns demand unchanged when aggregated is empty", () => {
    const demand = [makeDemandDay("2026-03-01")];
    const result = applyBilledHours(demand, new Map());
    expect(result).toBe(demand); // same reference — no copy needed
  });

  it("overlays billedMH on matching shift", () => {
    const demand = [makeDemandDay("2026-03-01")];
    const agg = new Map([["2026-03-01", new Map([["DAY", 8.5]])]]);
    const result = applyBilledHours(demand, agg);

    expect(result[0].byShift[0].billedMH).toBe(8.5);
    expect(result[0].byShift[1].billedMH).toBeUndefined(); // SWING untouched
    expect(result[0].totalBilledMH).toBe(8.5);
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
    const result = applyBilledHours(demand, agg);

    expect(result[0].byShift[0].billedMH).toBe(8.0);
    expect(result[0].byShift[1].billedMH).toBe(6.5);
    expect(result[0].byShift[2].billedMH).toBe(3.0);
    expect(result[0].totalBilledMH).toBe(17.5);
  });

  it("does not modify original demand", () => {
    const demand = [makeDemandDay("2026-03-01")];
    const agg = new Map([["2026-03-01", new Map([["DAY", 5.0]])]]);
    applyBilledHours(demand, agg);

    expect(demand[0].totalBilledMH).toBeUndefined();
    expect(demand[0].byShift[0].billedMH).toBeUndefined();
  });

  it("skips days with no aggregated data", () => {
    const demand = [makeDemandDay("2026-03-01"), makeDemandDay("2026-03-02")];
    const agg = new Map([["2026-03-01", new Map([["DAY", 4.0]])]]);
    const result = applyBilledHours(demand, agg);

    expect(result[0].totalBilledMH).toBe(4.0);
    expect(result[1].totalBilledMH).toBeUndefined();
  });

  it("preserves existing demand fields", () => {
    const demand = [makeDemandDay("2026-03-01")];
    demand[0].totalAllocatedDemandMH = 35;
    demand[0].totalForecastedDemandMH = 28;
    demand[0].totalWorkedMH = 22;
    demand[0].byShift[0].allocatedDemandMH = 12;
    demand[0].byShift[0].forecastedDemandMH = 9;
    demand[0].byShift[0].workedMH = 7;

    const agg = new Map([["2026-03-01", new Map([["DAY", 6.0]])]]);
    const result = applyBilledHours(demand, agg);

    expect(result[0].totalAllocatedDemandMH).toBe(35);
    expect(result[0].totalForecastedDemandMH).toBe(28);
    expect(result[0].totalWorkedMH).toBe(22);
    expect(result[0].totalDemandMH).toBe(30); // unchanged
    expect(result[0].byShift[0].allocatedDemandMH).toBe(12);
    expect(result[0].byShift[0].forecastedDemandMH).toBe(9);
    expect(result[0].byShift[0].workedMH).toBe(7);
    expect(result[0].byShift[0].demandMH).toBe(10); // unchanged
    expect(result[0].byShift[0].billedMH).toBe(6.0);
  });

  it("rounds totalBilledMH to 2 decimal places", () => {
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
    const result = applyBilledHours(demand, agg);
    expect(result[0].totalBilledMH).toBe(4.0);
  });

  it("handles demand with single shift", () => {
    const demand = [makeDemandDay("2026-03-01", ["DAY"])];
    const agg = new Map([["2026-03-01", new Map([["DAY", 5.5]])]]);
    const result = applyBilledHours(demand, agg);
    expect(result[0].totalBilledMH).toBe(5.5);
    expect(result[0].byShift[0].billedMH).toBe(5.5);
  });
});

// ─── computeBillingVariance ───────────────────────────────────────────────

describe("computeBillingVariance", () => {
  it("returns zero variance when billed equals worked", () => {
    const { variance, variancePct } = computeBillingVariance(10, 10);
    expect(variance).toBe(0);
    expect(variancePct).toBe(0);
  });

  it("returns positive variance when under-billed (worked more than billed)", () => {
    const { variance, variancePct } = computeBillingVariance(7, 10);
    expect(variance).toBe(3);
    expect(variancePct).toBe(30);
  });

  it("returns negative variance when over-billed (billed more than worked)", () => {
    const { variance, variancePct } = computeBillingVariance(13, 10);
    expect(variance).toBe(-3);
    expect(variancePct).toBe(-30);
  });

  it("returns null variancePct when worked is zero", () => {
    const { variance, variancePct } = computeBillingVariance(5, 0);
    expect(variance).toBe(-5);
    expect(variancePct).toBeNull();
  });

  it("handles large variance correctly", () => {
    const { variance, variancePct } = computeBillingVariance(1, 100);
    expect(variance).toBe(99);
    expect(variancePct).toBe(99);
  });

  it("handles both zero values", () => {
    const { variance, variancePct } = computeBillingVariance(0, 0);
    expect(variance).toBe(0);
    expect(variancePct).toBeNull();
  });
});

// ─── validateBillingEntry ───────────────────────────────────────────────────

describe("validateBillingEntry", () => {
  it("accepts a valid complete entry", () => {
    const result = validateBillingEntry({
      aircraftReg: "N12345",
      customer: "DHL Air UK",
      billingDate: "2026-03-01",
      shiftCode: "DAY",
      billedMh: 2.5,
      source: "manual",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts a valid minimal entry (only required fields)", () => {
    const result = validateBillingEntry({
      aircraftReg: "C-FOIJ",
      customer: "CargoJet Airways",
      billingDate: "2026-03-15",
      shiftCode: "NIGHT",
      billedMh: 0.5,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing aircraftReg", () => {
    const result = validateBillingEntry({
      customer: "DHL",
      billingDate: "2026-03-01",
      shiftCode: "DAY",
      billedMh: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("aircraftReg is required");
  });

  it("rejects empty aircraftReg", () => {
    const result = validateBillingEntry({
      aircraftReg: "  ",
      customer: "DHL",
      billingDate: "2026-03-01",
      shiftCode: "DAY",
      billedMh: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("aircraftReg is required");
  });

  it("rejects missing customer", () => {
    const result = validateBillingEntry({
      aircraftReg: "N12345",
      billingDate: "2026-03-01",
      shiftCode: "DAY",
      billedMh: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("customer is required");
  });

  it("rejects missing billingDate", () => {
    const result = validateBillingEntry({
      aircraftReg: "N12345",
      customer: "DHL",
      shiftCode: "DAY",
      billedMh: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("billingDate is required");
  });

  it("rejects invalid billingDate format", () => {
    const result = validateBillingEntry({
      aircraftReg: "N12345",
      customer: "DHL",
      billingDate: "03/01/2026",
      shiftCode: "DAY",
      billedMh: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("billingDate must be YYYY-MM-DD format");
  });

  it("rejects missing shiftCode", () => {
    const result = validateBillingEntry({
      aircraftReg: "N12345",
      customer: "DHL",
      billingDate: "2026-03-01",
      billedMh: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("shiftCode is required");
  });

  it("rejects invalid shiftCode", () => {
    const result = validateBillingEntry({
      aircraftReg: "N12345",
      customer: "DHL",
      billingDate: "2026-03-01",
      shiftCode: "MORNING",
      billedMh: 2.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("shiftCode must be one of");
  });

  it("rejects missing billedMh", () => {
    const result = validateBillingEntry({
      aircraftReg: "N12345",
      customer: "DHL",
      billingDate: "2026-03-01",
      shiftCode: "DAY",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("billedMh is required");
  });

  it("rejects zero billedMh", () => {
    const result = validateBillingEntry({
      aircraftReg: "N12345",
      customer: "DHL",
      billingDate: "2026-03-01",
      shiftCode: "DAY",
      billedMh: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("billedMh must be a positive number");
  });

  it("rejects negative billedMh", () => {
    const result = validateBillingEntry({
      aircraftReg: "N12345",
      customer: "DHL",
      billingDate: "2026-03-01",
      shiftCode: "DAY",
      billedMh: -1.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("billedMh must be a positive number");
  });

  it("rejects invalid source", () => {
    const result = validateBillingEntry({
      aircraftReg: "N12345",
      customer: "DHL",
      billingDate: "2026-03-01",
      shiftCode: "DAY",
      billedMh: 2.5,
      source: "api" as "manual",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("source must be one of");
  });

  it("collects multiple errors", () => {
    const result = validateBillingEntry({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
    expect(result.errors).toContain("aircraftReg is required");
    expect(result.errors).toContain("customer is required");
    expect(result.errors).toContain("billingDate is required");
    expect(result.errors).toContain("shiftCode is required");
    expect(result.errors).toContain("billedMh is required");
  });

  it("accepts all valid shift codes", () => {
    for (const shiftCode of ["DAY", "SWING", "NIGHT"]) {
      const result = validateBillingEntry({
        aircraftReg: "N12345",
        customer: "DHL",
        billingDate: "2026-03-01",
        shiftCode,
        billedMh: 1.0,
      });
      expect(result.valid).toBe(true);
    }
  });

  it("accepts all valid sources", () => {
    for (const source of ["manual", "import"] as const) {
      const result = validateBillingEntry({
        aircraftReg: "N12345",
        customer: "DHL",
        billingDate: "2026-03-01",
        shiftCode: "DAY",
        billedMh: 1.0,
        source,
      });
      expect(result.valid).toBe(true);
    }
  });

  it("allows optional fields to be null", () => {
    const result = validateBillingEntry({
      aircraftReg: "N12345",
      customer: "DHL",
      billingDate: "2026-03-01",
      shiftCode: "DAY",
      billedMh: 2.5,
      description: null,
      invoiceRef: null,
      notes: null,
    } as Partial<BillingEntry>);
    expect(result.valid).toBe(true);
  });
});
