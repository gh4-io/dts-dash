import { describe, it, expect } from "vitest";
import { aggregateMonthlyRollup } from "@/lib/capacity/monthly-rollup-engine";
import type { DailyDemandV2, DailyCapacityV2, DailyUtilizationV2, ShiftDemandV2 } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeShiftDemand(
  shiftCode: string,
  demandMH: number,
  overrides?: Partial<ShiftDemandV2>,
): ShiftDemandV2 {
  return {
    shiftCode,
    demandMH,
    wpContributions: [],
    ...overrides,
  };
}

function makeDemandDay(
  date: string,
  totalDemandMH: number,
  overrides?: Partial<DailyDemandV2>,
): DailyDemandV2 {
  return {
    date,
    totalDemandMH,
    aircraftCount: 2,
    byCustomer: {},
    byShift: [
      makeShiftDemand("DAY", totalDemandMH * 0.5),
      makeShiftDemand("SWING", totalDemandMH * 0.3),
      makeShiftDemand("NIGHT", totalDemandMH * 0.2),
    ],
    ...overrides,
  };
}

function makeCapacityDay(date: string, totalProductiveMH: number): DailyCapacityV2 {
  return {
    date,
    totalProductiveMH,
    totalPaidMH: totalProductiveMH * 1.2,
    hasExceptions: false,
    byShift: [
      {
        shiftCode: "DAY",
        shiftName: "Day",
        rosterHeadcount: 8,
        effectiveHeadcount: 8,
        paidHoursPerPerson: 8,
        paidMH: totalProductiveMH * 0.5,
        availableMH: totalProductiveMH * 0.5,
        productiveMH: totalProductiveMH * 0.5,
        hasExceptions: false,
        belowMinHeadcount: false,
      },
      {
        shiftCode: "SWING",
        shiftName: "Swing",
        rosterHeadcount: 6,
        effectiveHeadcount: 6,
        paidHoursPerPerson: 8,
        paidMH: totalProductiveMH * 0.3,
        availableMH: totalProductiveMH * 0.3,
        productiveMH: totalProductiveMH * 0.3,
        hasExceptions: false,
        belowMinHeadcount: false,
      },
      {
        shiftCode: "NIGHT",
        shiftName: "Night",
        rosterHeadcount: 4,
        effectiveHeadcount: 4,
        paidHoursPerPerson: 8,
        paidMH: totalProductiveMH * 0.2,
        availableMH: totalProductiveMH * 0.2,
        productiveMH: totalProductiveMH * 0.2,
        hasExceptions: false,
        belowMinHeadcount: false,
      },
    ],
  };
}

function makeUtilizationDay(
  date: string,
  demandMH: number,
  capacityMH: number,
): DailyUtilizationV2 {
  const gapMH = capacityMH - demandMH;
  const utilPct = capacityMH > 0 ? (demandMH / capacityMH) * 100 : null;
  return {
    date,
    utilizationPercent: utilPct,
    totalDemandMH: demandMH,
    totalProductiveMH: capacityMH,
    gapMH,
    overtimeFlag: utilPct !== null && utilPct > 100,
    criticalFlag: utilPct !== null && utilPct > 120,
    noCoverageDays: 0,
    byShift: [
      {
        shiftCode: "DAY",
        utilization: utilPct,
        gapMH: gapMH * 0.5,
        demandMH: demandMH * 0.5,
        productiveMH: capacityMH * 0.5,
        noCoverage: false,
      },
      {
        shiftCode: "SWING",
        utilization: utilPct,
        gapMH: gapMH * 0.3,
        demandMH: demandMH * 0.3,
        productiveMH: capacityMH * 0.3,
        noCoverage: false,
      },
      {
        shiftCode: "NIGHT",
        utilization: utilPct,
        gapMH: gapMH * 0.2,
        demandMH: demandMH * 0.2,
        productiveMH: capacityMH * 0.2,
        noCoverage: false,
      },
    ],
  };
}

/** Generate N consecutive days starting from a date */
function generateDays(
  startDate: string,
  count: number,
  demandMH: number,
  capacityMH: number,
): { demand: DailyDemandV2[]; capacity: DailyCapacityV2[]; utilization: DailyUtilizationV2[] } {
  const demand: DailyDemandV2[] = [];
  const capacity: DailyCapacityV2[] = [];
  const utilization: DailyUtilizationV2[] = [];

  const start = new Date(startDate + "T00:00:00Z");
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    demand.push(makeDemandDay(dateStr, demandMH));
    capacity.push(makeCapacityDay(dateStr, capacityMH));
    utilization.push(makeUtilizationDay(dateStr, demandMH, capacityMH));
  }

  return { demand, capacity, utilization };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("aggregateMonthlyRollup", () => {
  it("returns empty result for empty arrays", () => {
    const result = aggregateMonthlyRollup([], [], []);
    expect(result.buckets).toHaveLength(0);
    expect(result.totalMonths).toBe(0);
    expect(result.dateRange).toEqual({ start: "", end: "" });
  });

  it("produces 1 bucket for a single day", () => {
    const d = [makeDemandDay("2026-02-15", 50)];
    const c = [makeCapacityDay("2026-02-15", 60)];
    const u = [makeUtilizationDay("2026-02-15", 50, 60)];
    const result = aggregateMonthlyRollup(d, c, u);

    expect(result.buckets).toHaveLength(1);
    expect(result.totalMonths).toBe(1);
    expect(result.buckets[0].monthKey).toBe("2026-02");
    expect(result.buckets[0].label).toBe("Feb 2026");
    expect(result.buckets[0].dayCount).toBe(1);
  });

  it("aggregates a full month of 28 days (Feb 2026)", () => {
    const { demand, capacity, utilization } = generateDays("2026-02-01", 28, 40, 52);
    const result = aggregateMonthlyRollup(demand, capacity, utilization);

    expect(result.buckets).toHaveLength(1);
    expect(result.buckets[0].dayCount).toBe(28);
    expect(result.buckets[0].totalDemandMH).toBe(28 * 40);
    expect(result.buckets[0].totalCapacityMH).toBe(28 * 52);
  });

  it("produces 2 sorted buckets for data spanning Jan + Feb", () => {
    const jan = generateDays("2026-01-20", 12, 30, 50);
    const feb = generateDays("2026-02-01", 10, 35, 55);
    const result = aggregateMonthlyRollup(
      [...jan.demand, ...feb.demand],
      [...jan.capacity, ...feb.capacity],
      [...jan.utilization, ...feb.utilization],
    );

    expect(result.buckets).toHaveLength(2);
    expect(result.buckets[0].monthKey).toBe("2026-01");
    expect(result.buckets[1].monthKey).toBe("2026-02");
    expect(result.buckets[0].dayCount).toBe(12);
    expect(result.buckets[1].dayCount).toBe(10);
  });

  it("handles partial months at boundaries", () => {
    // 5 days at end of March + 5 days at start of April
    const mar = generateDays("2026-03-27", 5, 20, 30);
    const apr = generateDays("2026-04-01", 5, 25, 35);
    const result = aggregateMonthlyRollup(
      [...mar.demand, ...apr.demand],
      [...mar.capacity, ...apr.capacity],
      [...mar.utilization, ...apr.utilization],
    );

    expect(result.buckets).toHaveLength(2);
    expect(result.buckets[0].dayCount).toBe(5);
    expect(result.buckets[1].dayCount).toBe(5);
  });

  it("sums demand MH correctly", () => {
    // 3 days with known demand: 10, 20, 30 = 60
    const d = [
      makeDemandDay("2026-03-01", 10),
      makeDemandDay("2026-03-02", 20),
      makeDemandDay("2026-03-03", 30),
    ];
    const c = [
      makeCapacityDay("2026-03-01", 50),
      makeCapacityDay("2026-03-02", 50),
      makeCapacityDay("2026-03-03", 50),
    ];
    const u = [
      makeUtilizationDay("2026-03-01", 10, 50),
      makeUtilizationDay("2026-03-02", 20, 50),
      makeUtilizationDay("2026-03-03", 30, 50),
    ];
    const result = aggregateMonthlyRollup(d, c, u);

    expect(result.buckets[0].totalDemandMH).toBe(60);
  });

  it("sums capacity MH correctly", () => {
    const d = [makeDemandDay("2026-04-01", 10), makeDemandDay("2026-04-02", 10)];
    const c = [makeCapacityDay("2026-04-01", 40), makeCapacityDay("2026-04-02", 60)];
    const u = [makeUtilizationDay("2026-04-01", 10, 40), makeUtilizationDay("2026-04-02", 10, 60)];
    const result = aggregateMonthlyRollup(d, c, u);

    expect(result.buckets[0].totalCapacityMH).toBe(100);
  });

  it("computes avgUtilizationPercent correctly", () => {
    // demand=80, capacity=100 → 80%
    const d = [makeDemandDay("2026-05-01", 40), makeDemandDay("2026-05-02", 40)];
    const c = [makeCapacityDay("2026-05-01", 50), makeCapacityDay("2026-05-02", 50)];
    const u = [makeUtilizationDay("2026-05-01", 40, 50), makeUtilizationDay("2026-05-02", 40, 50)];
    const result = aggregateMonthlyRollup(d, c, u);

    expect(result.buckets[0].avgUtilizationPercent).toBe(80);
  });

  it("returns null utilization when capacity is zero", () => {
    const d = [makeDemandDay("2026-06-01", 10)];
    const c = [makeCapacityDay("2026-06-01", 0)];
    const u = [makeUtilizationDay("2026-06-01", 10, 0)];
    const result = aggregateMonthlyRollup(d, c, u);

    expect(result.buckets[0].avgUtilizationPercent).toBeNull();
  });

  it("sums gap MH correctly", () => {
    // day1: gap = 50 - 30 = 20, day2: gap = 60 - 40 = 20 → total 40
    const d = [makeDemandDay("2026-07-01", 30), makeDemandDay("2026-07-02", 40)];
    const c = [makeCapacityDay("2026-07-01", 50), makeCapacityDay("2026-07-02", 60)];
    const u = [makeUtilizationDay("2026-07-01", 30, 50), makeUtilizationDay("2026-07-02", 40, 60)];
    const result = aggregateMonthlyRollup(d, c, u);

    expect(result.buckets[0].totalGapMH).toBe(40);
  });

  it("produces per-shift breakdown", () => {
    const { demand, capacity, utilization } = generateDays("2026-08-01", 5, 100, 120);
    const result = aggregateMonthlyRollup(demand, capacity, utilization);
    const bucket = result.buckets[0];

    expect(bucket.byShift).toHaveLength(3);
    const dayShift = bucket.byShift.find((s) => s.shiftCode === "DAY")!;
    const swingShift = bucket.byShift.find((s) => s.shiftCode === "SWING")!;
    const nightShift = bucket.byShift.find((s) => s.shiftCode === "NIGHT")!;

    // 5 days × 100 demand: DAY=50%, SWING=30%, NIGHT=20%
    expect(dayShift.totalDemandMH).toBe(250);
    expect(swingShift.totalDemandMH).toBe(150);
    expect(nightShift.totalDemandMH).toBe(100);

    // 5 days × 120 capacity: same split
    expect(dayShift.totalCapacityMH).toBe(300);
    expect(swingShift.totalCapacityMH).toBe(180);
    expect(nightShift.totalCapacityMH).toBe(120);
  });

  it("accumulates per-customer demand", () => {
    const d = [
      makeDemandDay("2026-09-01", 50, { byCustomer: { Acme: 30, Beta: 20 } }),
      makeDemandDay("2026-09-02", 40, { byCustomer: { Acme: 25, Beta: 15 } }),
    ];
    const c = [makeCapacityDay("2026-09-01", 60), makeCapacityDay("2026-09-02", 60)];
    const u = [makeUtilizationDay("2026-09-01", 50, 60), makeUtilizationDay("2026-09-02", 40, 60)];
    const result = aggregateMonthlyRollup(d, c, u);

    expect(result.buckets[0].byCustomer["Acme"]).toBe(55);
    expect(result.buckets[0].byCustomer["Beta"]).toBe(35);
  });

  it("includes allocated lens overlay when present", () => {
    const d = [
      makeDemandDay("2026-10-01", 50, { totalAllocatedDemandMH: 45 }),
      makeDemandDay("2026-10-02", 50, { totalAllocatedDemandMH: 40 }),
    ];
    const c = [makeCapacityDay("2026-10-01", 60), makeCapacityDay("2026-10-02", 60)];
    const u = [makeUtilizationDay("2026-10-01", 50, 60), makeUtilizationDay("2026-10-02", 50, 60)];
    const result = aggregateMonthlyRollup(d, c, u);

    expect(result.buckets[0].totalAllocatedMH).toBe(85);
  });

  it("returns null for lens overlays when no source data exists", () => {
    const { demand, capacity, utilization } = generateDays("2026-11-01", 3, 30, 40);
    const result = aggregateMonthlyRollup(demand, capacity, utilization);

    expect(result.buckets[0].totalAllocatedMH).toBeNull();
    expect(result.buckets[0].totalForecastedMH).toBeNull();
    expect(result.buckets[0].totalWorkedMH).toBeNull();
    expect(result.buckets[0].totalBilledMH).toBeNull();
  });

  it("rounds all output values to 1 decimal", () => {
    // Use values that produce repeating decimals
    const d = [makeDemandDay("2026-12-01", 33.333)];
    const c = [makeCapacityDay("2026-12-01", 66.666)];
    const u = [makeUtilizationDay("2026-12-01", 33.333, 66.666)];
    const result = aggregateMonthlyRollup(d, c, u);
    const bucket = result.buckets[0];

    // Check decimal places
    const demandStr = bucket.totalDemandMH.toString();
    const decimalPart = demandStr.split(".")[1];
    expect(!decimalPart || decimalPart.length <= 1).toBe(true);

    if (bucket.avgUtilizationPercent !== null) {
      const utilStr = bucket.avgUtilizationPercent.toString();
      const utilDecimal = utilStr.split(".")[1];
      expect(!utilDecimal || utilDecimal.length <= 1).toBe(true);
    }
  });

  it("reports correct dateRange", () => {
    const d = [
      makeDemandDay("2026-03-15", 10),
      makeDemandDay("2026-01-05", 10),
      makeDemandDay("2026-05-20", 10),
    ];
    const c = [
      makeCapacityDay("2026-03-15", 20),
      makeCapacityDay("2026-01-05", 20),
      makeCapacityDay("2026-05-20", 20),
    ];
    const u = [
      makeUtilizationDay("2026-03-15", 10, 20),
      makeUtilizationDay("2026-01-05", 10, 20),
      makeUtilizationDay("2026-05-20", 10, 20),
    ];
    const result = aggregateMonthlyRollup(d, c, u);

    expect(result.dateRange.start).toBe("2026-01-05");
    expect(result.dateRange.end).toBe("2026-05-20");
    expect(result.totalMonths).toBe(3);
  });
});
