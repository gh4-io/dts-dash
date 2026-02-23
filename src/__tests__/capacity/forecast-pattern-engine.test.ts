/**
 * Forecast Pattern Engine Tests — Day-of-Week Aggregation
 */

import { describe, it, expect } from "vitest";
import { computeDayOfWeekPattern } from "@/lib/capacity/forecast-pattern-engine";
import type { DailyDemandV2, DailyCapacityV2 } from "@/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

/**
 * Create a DailyDemandV2 fixture. When byCustomer is provided, wpContributions
 * are populated per shift proportionally so the engine can derive customer×shift.
 */
function makeDay(
  date: string,
  totalDemandMH: number,
  shifts?: Array<{ code: string; mh: number }>,
  forecastedMH?: number,
  byCustomer?: Record<string, number>,
  allocatedMH?: number,
): DailyDemandV2 {
  const shiftDefs = shifts ?? [
    { code: "DAY", mh: totalDemandMH * 0.5 },
    { code: "SWING", mh: totalDemandMH * 0.33 },
    { code: "NIGHT", mh: totalDemandMH * 0.17 },
  ];

  const custEntries = byCustomer ?? { Acme: totalDemandMH };
  const totalCustMH = Object.values(custEntries).reduce((a, b) => a + b, 0);

  const byShift = shiftDefs.map((s) => {
    // Distribute customer MH across shifts proportionally
    const shiftFraction = totalCustMH > 0 ? s.mh / totalCustMH : 0;
    const wpContributions = Object.entries(custEntries).map(([customer, mh], idx) => ({
      wpId: idx + 1,
      aircraftReg: `REG-${idx}`,
      customer,
      allocatedMH: mh * shiftFraction,
      mhSource: "default",
    }));

    return {
      shiftCode: s.code,
      demandMH: s.mh,
      wpContributions,
      ...(forecastedMH != null ? { forecastedDemandMH: forecastedMH * shiftFraction } : {}),
      ...(allocatedMH != null ? { allocatedDemandMH: allocatedMH * shiftFraction } : {}),
    };
  });

  return {
    date,
    totalDemandMH,
    aircraftCount: 2,
    byCustomer: custEntries,
    byShift,
    ...(forecastedMH != null ? { totalForecastedDemandMH: forecastedMH } : {}),
  };
}

function makeCapDay(date: string, totalProductiveMH: number): DailyCapacityV2 {
  return {
    date,
    totalProductiveMH,
    totalPaidMH: totalProductiveMH * 1.1,
    byShift: [
      {
        shiftCode: "DAY",
        shiftName: "Day",
        rosterHeadcount: 8,
        effectiveHeadcount: 8,
        paidHoursPerPerson: 8,
        paidMH: totalProductiveMH * 0.44,
        availableMH: totalProductiveMH * 0.42,
        productiveMH: totalProductiveMH * 0.4,
        hasExceptions: false,
        belowMinHeadcount: false,
      },
      {
        shiftCode: "SWING",
        shiftName: "Swing",
        rosterHeadcount: 6,
        effectiveHeadcount: 6,
        paidHoursPerPerson: 8,
        paidMH: totalProductiveMH * 0.385,
        availableMH: totalProductiveMH * 0.37,
        productiveMH: totalProductiveMH * 0.35,
        hasExceptions: false,
        belowMinHeadcount: false,
      },
      {
        shiftCode: "NIGHT",
        shiftName: "Night",
        rosterHeadcount: 4,
        effectiveHeadcount: 4,
        paidHoursPerPerson: 8,
        paidMH: totalProductiveMH * 0.275,
        availableMH: totalProductiveMH * 0.26,
        productiveMH: totalProductiveMH * 0.25,
        hasExceptions: false,
        belowMinHeadcount: false,
      },
    ],
    hasExceptions: false,
  };
}

// ─── computeDayOfWeekPattern ─────────────────────────────────────────────────

describe("computeDayOfWeekPattern", () => {
  it("returns 7 zero-entries for empty demand", () => {
    const result = computeDayOfWeekPattern([], []);
    expect(result.pattern).toHaveLength(7);
    expect(result.totalWeeks).toBe(0);
    expect(result.dateRange).toEqual({ start: "", end: "" });
    for (const p of result.pattern) {
      expect(p.avgDemandMH).toBe(0);
      expect(p.avgCapacityMH).toBe(0);
      expect(p.avgForecastedMH).toBeNull();
      expect(p.sampleCount).toBe(0);
      expect(p.avgDemandByCustomerByShift).toEqual({});
      expect(p.avgCapacityByShift).toEqual({});
      expect(p.avgForecastedByShift).toEqual({});
      expect(p.avgAllocatedByShift).toEqual({});
    }
  });

  it("orders Monday first through Sunday last", () => {
    const demand = [makeDay("2026-02-23", 10)]; // Mon Feb 23 2026
    const result = computeDayOfWeekPattern(demand, []);
    expect(result.pattern[0].dayOfWeek).toBe(1);
    expect(result.pattern[0].label).toBe("Mon");
    expect(result.pattern[6].dayOfWeek).toBe(7);
    expect(result.pattern[6].label).toBe("Sun");
  });

  it("handles a single week (Mon-Fri) — weekends have zero samples", () => {
    const demand = [
      makeDay("2026-02-23", 10),
      makeDay("2026-02-24", 20),
      makeDay("2026-02-25", 30),
      makeDay("2026-02-26", 40),
      makeDay("2026-02-27", 50),
    ];
    const capacity = demand.map((d) => makeCapDay(d.date, 60));
    const result = computeDayOfWeekPattern(demand, capacity);

    expect(result.pattern[0].avgDemandMH).toBe(10);
    expect(result.pattern[1].avgDemandMH).toBe(20);
    expect(result.pattern[2].avgDemandMH).toBe(30);
    expect(result.pattern[3].avgDemandMH).toBe(40);
    expect(result.pattern[4].avgDemandMH).toBe(50);
    expect(result.pattern[5].sampleCount).toBe(0);
    expect(result.pattern[6].sampleCount).toBe(0);

    for (let i = 0; i < 5; i++) {
      expect(result.pattern[i].sampleCount).toBe(1);
    }
  });

  it("averages across two weeks correctly", () => {
    const demand = [
      makeDay("2026-02-23", 10),
      makeDay("2026-02-24", 20),
      makeDay("2026-03-02", 30),
      makeDay("2026-03-03", 40),
    ];
    const result = computeDayOfWeekPattern(demand, []);

    expect(result.pattern[0].avgDemandMH).toBe(20);
    expect(result.pattern[0].sampleCount).toBe(2);
    expect(result.pattern[1].avgDemandMH).toBe(30);
    expect(result.pattern[1].sampleCount).toBe(2);
    expect(result.totalWeeks).toBe(2);
  });

  it("computes shift breakdown averages", () => {
    const demand = [
      makeDay("2026-02-23", 30, [
        { code: "DAY", mh: 15 },
        { code: "SWING", mh: 10 },
        { code: "NIGHT", mh: 5 },
      ]),
      makeDay("2026-03-02", 30, [
        { code: "DAY", mh: 21 },
        { code: "SWING", mh: 6 },
        { code: "NIGHT", mh: 3 },
      ]),
    ];
    const result = computeDayOfWeekPattern(demand, []);

    const mon = result.pattern[0];
    expect(mon.avgDemandByShift["DAY"]).toBe(18);
    expect(mon.avgDemandByShift["SWING"]).toBe(8);
    expect(mon.avgDemandByShift["NIGHT"]).toBe(4);
  });

  it("computes forecast average only from entries that have forecast data", () => {
    const demand = [
      makeDay("2026-02-23", 10, undefined, 12),
      makeDay("2026-03-02", 20, undefined, undefined),
    ];
    const result = computeDayOfWeekPattern(demand, []);
    expect(result.pattern[0].avgForecastedMH).toBe(12);
  });

  it("returns null forecast when no entries have forecast data", () => {
    const demand = [makeDay("2026-02-23", 10), makeDay("2026-02-24", 20)];
    const result = computeDayOfWeekPattern(demand, []);
    expect(result.pattern[0].avgForecastedMH).toBeNull();
    expect(result.pattern[1].avgForecastedMH).toBeNull();
  });

  it("averages forecasted MH when multiple entries have forecast data", () => {
    const demand = [
      makeDay("2026-02-23", 10, undefined, 12),
      makeDay("2026-03-02", 20, undefined, 18),
    ];
    const result = computeDayOfWeekPattern(demand, []);
    expect(result.pattern[0].avgForecastedMH).toBe(15);
  });

  it("computes capacity averages aligned with demand dates", () => {
    const demand = [makeDay("2026-02-23", 10), makeDay("2026-03-02", 20)];
    const capacity = [makeCapDay("2026-02-23", 50), makeCapDay("2026-03-02", 70)];
    const result = computeDayOfWeekPattern(demand, capacity);
    expect(result.pattern[0].avgCapacityMH).toBe(60);
  });

  it("computes correct dateRange", () => {
    const demand = [
      makeDay("2026-02-25", 10),
      makeDay("2026-02-23", 20),
      makeDay("2026-03-02", 30),
    ];
    const result = computeDayOfWeekPattern(demand, []);
    expect(result.dateRange.start).toBe("2026-02-23");
    expect(result.dateRange.end).toBe("2026-03-02");
  });

  it("computes correct totalWeeks for dates spanning multiple ISO weeks", () => {
    const demand = [
      makeDay("2026-02-23", 10),
      makeDay("2026-02-24", 20),
      makeDay("2026-03-02", 30),
      makeDay("2026-03-03", 40),
    ];
    const result = computeDayOfWeekPattern(demand, []);
    expect(result.totalWeeks).toBe(2);
  });

  it("rounds averages to 1 decimal place", () => {
    const demand = [
      makeDay("2026-02-23", 10.1),
      makeDay("2026-03-02", 10.2),
      makeDay("2026-03-09", 10.3),
    ];
    const result = computeDayOfWeekPattern(demand, []);
    expect(result.pattern[0].avgDemandMH).toBe(10.2);
  });

  it("computes per-customer-per-shift demand averages", () => {
    const demand = [
      makeDay(
        "2026-02-23",
        30,
        [
          { code: "DAY", mh: 15 },
          { code: "SWING", mh: 10 },
          { code: "NIGHT", mh: 5 },
        ],
        undefined,
        { DHL: 20, FedEx: 10 },
      ),
      makeDay(
        "2026-03-02",
        30,
        [
          { code: "DAY", mh: 15 },
          { code: "SWING", mh: 10 },
          { code: "NIGHT", mh: 5 },
        ],
        undefined,
        { DHL: 22, FedEx: 8 },
      ),
    ];
    const result = computeDayOfWeekPattern(demand, []);
    const mon = result.pattern[0];

    // DAY fraction = 15/30 = 0.5
    // DHL DAY wk1: 20*0.5=10, wk2: 22*0.5=11 → sum=21, avg=21/2=10.5
    expect(mon.avgDemandByCustomerByShift["DAY"]).toBeDefined();
    expect(mon.avgDemandByCustomerByShift["DAY"]["DHL"]).toBe(10.5);
    // FedEx DAY wk1: 10*0.5=5, wk2: 8*0.5=4 → sum=9, avg=9/2=4.5
    expect(mon.avgDemandByCustomerByShift["DAY"]["FedEx"]).toBe(4.5);
  });

  it("returns empty avgDemandByCustomerByShift for zero-sample days", () => {
    const demand = [makeDay("2026-02-23", 10)];
    const result = computeDayOfWeekPattern(demand, []);
    expect(result.pattern[1].avgDemandByCustomerByShift).toEqual({});
  });

  it("computes per-shift capacity averages", () => {
    const demand = [makeDay("2026-02-23", 10), makeDay("2026-03-02", 20)];
    const capacity = [makeCapDay("2026-02-23", 100), makeCapDay("2026-03-02", 60)];
    const result = computeDayOfWeekPattern(demand, capacity);
    const mon = result.pattern[0];

    // DAY: wk1=100*0.4=40, wk2=60*0.4=24 → avg=32
    expect(mon.avgCapacityByShift["DAY"]).toBe(32);
    // SWING: wk1=100*0.35=35, wk2=60*0.35=21 → avg=28
    expect(mon.avgCapacityByShift["SWING"]).toBe(28);
    // NIGHT: wk1=100*0.25=25, wk2=60*0.25=15 → avg=20
    expect(mon.avgCapacityByShift["NIGHT"]).toBe(20);
  });

  it("computes per-shift forecasted averages", () => {
    const demand = [
      makeDay("2026-02-23", 20, undefined, 24),
      makeDay("2026-03-02", 20, undefined, 30),
    ];
    const result = computeDayOfWeekPattern(demand, []);
    const mon = result.pattern[0];

    // DAY fraction = 0.5 → wk1=12, wk2=15 → avg=13.5
    expect(mon.avgForecastedByShift["DAY"]).toBe(13.5);
  });

  it("computes per-shift allocated averages", () => {
    const demand = [
      makeDay("2026-02-23", 20, undefined, undefined, undefined, 16),
      makeDay("2026-03-02", 20, undefined, undefined, undefined, 20),
    ];
    const result = computeDayOfWeekPattern(demand, []);
    const mon = result.pattern[0];

    // DAY fraction = 0.5 → wk1=8, wk2=10 → avg=9
    expect(mon.avgAllocatedByShift["DAY"]).toBe(9);
  });
});
