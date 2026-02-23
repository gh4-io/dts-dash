/**
 * Forecast Pattern Engine Tests — Day-of-Week Aggregation
 */

import { describe, it, expect } from "vitest";
import { computeDayOfWeekPattern } from "@/lib/capacity/forecast-pattern-engine";
import type { DailyDemandV2, DailyCapacityV2 } from "@/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeDay(
  date: string,
  totalDemandMH: number,
  shifts?: Array<{ code: string; mh: number }>,
  forecastedMH?: number,
  byCustomer?: Record<string, number>,
): DailyDemandV2 {
  const byShift = (
    shifts ?? [
      { code: "DAY", mh: totalDemandMH * 0.5 },
      { code: "SWING", mh: totalDemandMH * 0.33 },
      { code: "NIGHT", mh: totalDemandMH * 0.17 },
    ]
  ).map((s) => ({
    shiftCode: s.code,
    demandMH: s.mh,
    wpContributions: [],
  }));

  return {
    date,
    totalDemandMH,
    aircraftCount: 2,
    byCustomer: byCustomer ?? { Acme: totalDemandMH },
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
        headcount: 8,
        productiveMH: totalProductiveMH * 0.4,
        paidMH: totalProductiveMH * 0.44,
        utilizationPercent: null,
        hasException: false,
      },
      {
        shiftCode: "SWING",
        headcount: 6,
        productiveMH: totalProductiveMH * 0.35,
        paidMH: totalProductiveMH * 0.385,
        utilizationPercent: null,
        hasException: false,
      },
      {
        shiftCode: "NIGHT",
        headcount: 4,
        productiveMH: totalProductiveMH * 0.25,
        paidMH: totalProductiveMH * 0.275,
        utilizationPercent: null,
        hasException: false,
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
    // 2026-02-23 = Monday, 2026-02-27 = Friday
    const demand = [
      makeDay("2026-02-23", 10), // Mon
      makeDay("2026-02-24", 20), // Tue
      makeDay("2026-02-25", 30), // Wed
      makeDay("2026-02-26", 40), // Thu
      makeDay("2026-02-27", 50), // Fri
    ];
    const capacity = demand.map((d) => makeCapDay(d.date, 60));

    const result = computeDayOfWeekPattern(demand, capacity);

    // Mon=10, Tue=20, Wed=30, Thu=40, Fri=50
    expect(result.pattern[0].avgDemandMH).toBe(10); // Mon
    expect(result.pattern[1].avgDemandMH).toBe(20); // Tue
    expect(result.pattern[2].avgDemandMH).toBe(30); // Wed
    expect(result.pattern[3].avgDemandMH).toBe(40); // Thu
    expect(result.pattern[4].avgDemandMH).toBe(50); // Fri

    // Sat and Sun: no data
    expect(result.pattern[5].sampleCount).toBe(0); // Sat
    expect(result.pattern[5].avgDemandMH).toBe(0);
    expect(result.pattern[6].sampleCount).toBe(0); // Sun
    expect(result.pattern[6].avgDemandMH).toBe(0);

    // Each weekday has 1 sample
    for (let i = 0; i < 5; i++) {
      expect(result.pattern[i].sampleCount).toBe(1);
    }
  });

  it("averages across two weeks correctly", () => {
    // Week 1: Mon Feb 23 – Fri Feb 27
    // Week 2: Mon Mar 2 – Fri Mar 6
    const demand = [
      makeDay("2026-02-23", 10), // Mon wk1
      makeDay("2026-02-24", 20), // Tue wk1
      makeDay("2026-03-02", 30), // Mon wk2
      makeDay("2026-03-03", 40), // Tue wk2
    ];
    const result = computeDayOfWeekPattern(demand, []);

    // Mon average: (10+30)/2 = 20
    expect(result.pattern[0].avgDemandMH).toBe(20);
    expect(result.pattern[0].sampleCount).toBe(2);

    // Tue average: (20+40)/2 = 30
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

    // Both are Monday — DAY avg: (15+21)/2 = 18
    const mon = result.pattern[0];
    expect(mon.avgDemandByShift["DAY"]).toBe(18);
    expect(mon.avgDemandByShift["SWING"]).toBe(8); // (10+6)/2
    expect(mon.avgDemandByShift["NIGHT"]).toBe(4); // (5+3)/2
  });

  it("computes forecast average only from entries that have forecast data", () => {
    const demand = [
      makeDay("2026-02-23", 10, undefined, 12), // Mon with forecast
      makeDay("2026-03-02", 20, undefined, undefined), // Mon without forecast
    ];
    const result = computeDayOfWeekPattern(demand, []);

    // Forecast: only 1 entry has it → avgForecastedMH = 12
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
      makeDay("2026-02-23", 10, undefined, 12), // Mon wk1 forecast=12
      makeDay("2026-03-02", 20, undefined, 18), // Mon wk2 forecast=18
    ];
    const result = computeDayOfWeekPattern(demand, []);

    // avg = (12+18)/2 = 15
    expect(result.pattern[0].avgForecastedMH).toBe(15);
  });

  it("computes capacity averages aligned with demand dates", () => {
    const demand = [
      makeDay("2026-02-23", 10), // Mon
      makeDay("2026-03-02", 20), // Mon
    ];
    const capacity = [makeCapDay("2026-02-23", 50), makeCapDay("2026-03-02", 70)];
    const result = computeDayOfWeekPattern(demand, capacity);

    // Mon avgCapacityMH: (50+70)/2 = 60
    expect(result.pattern[0].avgCapacityMH).toBe(60);
  });

  it("computes correct dateRange", () => {
    const demand = [
      makeDay("2026-02-25", 10), // Wed
      makeDay("2026-02-23", 20), // Mon (earlier)
      makeDay("2026-03-02", 30), // Mon (later)
    ];
    const result = computeDayOfWeekPattern(demand, []);

    expect(result.dateRange.start).toBe("2026-02-23");
    expect(result.dateRange.end).toBe("2026-03-02");
  });

  it("computes correct totalWeeks for dates spanning multiple ISO weeks", () => {
    // 2026-02-23 (Mon) = ISO week 9
    // 2026-03-02 (Mon) = ISO week 10
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
    // 3 Mondays: 10, 11, 12 → avg = 11.0
    // 3 Mondays: 10.1, 10.2, 10.3 → avg = 10.2
    const demand = [
      makeDay("2026-02-23", 10.1), // Mon wk1
      makeDay("2026-03-02", 10.2), // Mon wk2
      makeDay("2026-03-09", 10.3), // Mon wk3
    ];
    const result = computeDayOfWeekPattern(demand, []);

    // (10.1+10.2+10.3)/3 = 10.2
    expect(result.pattern[0].avgDemandMH).toBe(10.2);
  });

  it("computes per-customer demand averages", () => {
    const demand = [
      makeDay("2026-02-23", 30, undefined, undefined, { DHL: 20, FedEx: 10 }), // Mon wk1
      makeDay("2026-03-02", 40, undefined, undefined, { DHL: 22, FedEx: 18 }), // Mon wk2
    ];
    const result = computeDayOfWeekPattern(demand, []);

    const mon = result.pattern[0];
    // DHL avg: (20+22)/2 = 21
    expect(mon.avgDemandByCustomer["DHL"]).toBe(21);
    // FedEx avg: (10+18)/2 = 14
    expect(mon.avgDemandByCustomer["FedEx"]).toBe(14);
  });

  it("returns empty avgDemandByCustomer for zero-sample days", () => {
    const demand = [makeDay("2026-02-23", 10)]; // Mon only
    const result = computeDayOfWeekPattern(demand, []);

    // Tue has no data
    expect(result.pattern[1].avgDemandByCustomer).toEqual({});
  });
});
