import { describe, it, expect } from "vitest";
import {
  aggregateConcurrencyByDay,
  aggregateConcurrencyByShift,
  applyConcurrencyPressure,
  computeConcurrencyPressureIndex,
} from "@/lib/capacity/concurrency-engine";
import type { ConcurrencyBucket, CapacityShift, DailyDemandV2 } from "@/types";

// ─── Test Fixtures ─────────────────────────────────────────────────────────

function makeBucket(
  hour: string,
  aircraftCount: number,
  eventIds: number[] = [1],
): ConcurrencyBucket {
  return { hour, aircraftCount, eventIds: eventIds.slice(0, aircraftCount) };
}

function makeShifts(): CapacityShift[] {
  return [
    {
      id: 1,
      code: "DAY",
      name: "Day",
      startHour: 7,
      endHour: 15,
      paidHours: 8,
      timezone: "UTC",
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
      paidHours: 8,
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
      paidHours: 8,
      timezone: "UTC",
      minHeadcount: 1,
      sortOrder: 2,
      isActive: true,
    },
  ];
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

// ─── aggregateConcurrencyByDay ────────────────────────────────────────────

describe("aggregateConcurrencyByDay", () => {
  it("returns empty map for empty input", () => {
    const result = aggregateConcurrencyByDay([]);
    expect(result.size).toBe(0);
  });

  it("aggregates single day with single bucket", () => {
    const buckets = [makeBucket("2026-03-01T10:00:00.000Z", 2, [1, 2])];
    const result = aggregateConcurrencyByDay(buckets);

    expect(result.size).toBe(1);
    const day = result.get("2026-03-01")!;
    expect(day.peakAircraft).toBe(2);
    expect(day.avgAircraft).toBe(2);
    expect(day.concurrencyHours).toBe(1);
    expect(day.peakHour).toBe("2026-03-01T10:00:00.000Z");
  });

  it("aggregates single day with multiple buckets", () => {
    const buckets = [
      makeBucket("2026-03-01T10:00:00.000Z", 1, [1]),
      makeBucket("2026-03-01T11:00:00.000Z", 3, [1, 2, 3]),
      makeBucket("2026-03-01T12:00:00.000Z", 2, [1, 2]),
      makeBucket("2026-03-01T13:00:00.000Z", 1, [2]),
    ];
    const result = aggregateConcurrencyByDay(buckets);

    const day = result.get("2026-03-01")!;
    expect(day.peakAircraft).toBe(3);
    expect(day.peakHour).toBe("2026-03-01T11:00:00.000Z");
    // avg = (1+3+2+1)/4 = 1.75
    expect(day.avgAircraft).toBe(1.75);
    // hours with 2+ aircraft: 11:00 (3) and 12:00 (2)
    expect(day.concurrencyHours).toBe(2);
  });

  it("aggregates multiple days separately", () => {
    const buckets = [
      makeBucket("2026-03-01T10:00:00.000Z", 2, [1, 2]),
      makeBucket("2026-03-01T11:00:00.000Z", 1, [1]),
      makeBucket("2026-03-02T08:00:00.000Z", 4, [1, 2, 3, 4]),
    ];
    const result = aggregateConcurrencyByDay(buckets);

    expect(result.size).toBe(2);

    const day1 = result.get("2026-03-01")!;
    expect(day1.peakAircraft).toBe(2);
    // avg = (2+1)/2 = 1.5
    expect(day1.avgAircraft).toBe(1.5);

    const day2 = result.get("2026-03-02")!;
    expect(day2.peakAircraft).toBe(4);
    expect(day2.avgAircraft).toBe(4);
  });

  it("identifies peak hour correctly when multiple hours tie", () => {
    const buckets = [
      makeBucket("2026-03-01T10:00:00.000Z", 3, [1, 2, 3]),
      makeBucket("2026-03-01T11:00:00.000Z", 3, [1, 2, 3]),
    ];
    const result = aggregateConcurrencyByDay(buckets);
    const day = result.get("2026-03-01")!;
    expect(day.peakAircraft).toBe(3);
    // First occurrence wins
    expect(day.peakHour).toBe("2026-03-01T10:00:00.000Z");
  });

  it("counts zero concurrencyHours when all buckets have 1 aircraft", () => {
    const buckets = [
      makeBucket("2026-03-01T10:00:00.000Z", 1, [1]),
      makeBucket("2026-03-01T11:00:00.000Z", 1, [2]),
    ];
    const result = aggregateConcurrencyByDay(buckets);
    const day = result.get("2026-03-01")!;
    expect(day.concurrencyHours).toBe(0);
    expect(day.peakAircraft).toBe(1);
  });

  it("rounds avgAircraft to 2 decimal places", () => {
    const buckets = [
      makeBucket("2026-03-01T10:00:00.000Z", 1, [1]),
      makeBucket("2026-03-01T11:00:00.000Z", 2, [1, 2]),
      makeBucket("2026-03-01T12:00:00.000Z", 1, [1]),
    ];
    const result = aggregateConcurrencyByDay(buckets);
    const day = result.get("2026-03-01")!;
    // avg = (1+2+1)/3 = 1.333...
    expect(day.avgAircraft).toBe(1.33);
  });
});

// ─── aggregateConcurrencyByShift ──────────────────────────────────────────

describe("aggregateConcurrencyByShift", () => {
  const shifts = makeShifts();

  it("returns empty map for empty input", () => {
    const result = aggregateConcurrencyByShift([], shifts);
    expect(result.size).toBe(0);
  });

  it("returns empty map when shifts array is empty", () => {
    const buckets = [makeBucket("2026-03-01T10:00:00.000Z", 2, [1, 2])];
    const result = aggregateConcurrencyByShift(buckets, []);
    expect(result.size).toBe(0);
  });

  it("maps DAY shift hours (07-15 UTC) correctly", () => {
    const buckets = [
      makeBucket("2026-03-01T08:00:00.000Z", 2, [1, 2]),
      makeBucket("2026-03-01T09:00:00.000Z", 3, [1, 2, 3]),
      makeBucket("2026-03-01T14:00:00.000Z", 1, [1]),
    ];
    const result = aggregateConcurrencyByShift(buckets, shifts);

    const dayShift = result.get("2026-03-01")!.get("DAY")!;
    expect(dayShift.peakAircraft).toBe(3);
    // avg = (2+3+1)/3 = 2
    expect(dayShift.avgAircraft).toBe(2);
    expect(dayShift.concurrencyHours).toBe(2); // 08:00 (2) and 09:00 (3)
  });

  it("maps SWING shift hours (15-23 UTC) correctly", () => {
    const buckets = [
      makeBucket("2026-03-01T16:00:00.000Z", 2, [1, 2]),
      makeBucket("2026-03-01T20:00:00.000Z", 1, [1]),
    ];
    const result = aggregateConcurrencyByShift(buckets, shifts);

    const swingShift = result.get("2026-03-01")!.get("SWING")!;
    expect(swingShift.peakAircraft).toBe(2);
    expect(swingShift.concurrencyHours).toBe(1);
  });

  it("maps NIGHT shift hours (23-07 UTC) correctly", () => {
    const buckets = [
      makeBucket("2026-03-01T23:00:00.000Z", 2, [1, 2]),
      makeBucket("2026-03-01T00:00:00.000Z", 3, [1, 2, 3]),
      makeBucket("2026-03-01T05:00:00.000Z", 1, [1]),
    ];
    const result = aggregateConcurrencyByShift(buckets, shifts);

    // All three should be in NIGHT shift
    const nightShift = result.get("2026-03-01")!.get("NIGHT")!;
    expect(nightShift.peakAircraft).toBe(3);
    expect(nightShift.concurrencyHours).toBe(2); // 23:00 (2) and 00:00 (3)
  });

  it("distributes buckets across multiple shifts in one day", () => {
    const buckets = [
      makeBucket("2026-03-01T10:00:00.000Z", 2, [1, 2]), // DAY
      makeBucket("2026-03-01T18:00:00.000Z", 3, [1, 2, 3]), // SWING
      makeBucket("2026-03-01T02:00:00.000Z", 1, [1]), // NIGHT
    ];
    const result = aggregateConcurrencyByShift(buckets, shifts);

    const dateMap = result.get("2026-03-01")!;
    expect(dateMap.get("DAY")!.peakAircraft).toBe(2);
    expect(dateMap.get("SWING")!.peakAircraft).toBe(3);
    expect(dateMap.get("NIGHT")!.peakAircraft).toBe(1);
  });

  it("aggregates multiple days independently", () => {
    const buckets = [
      makeBucket("2026-03-01T10:00:00.000Z", 2, [1, 2]),
      makeBucket("2026-03-02T10:00:00.000Z", 4, [1, 2, 3, 4]),
    ];
    const result = aggregateConcurrencyByShift(buckets, shifts);

    expect(result.size).toBe(2);
    expect(result.get("2026-03-01")!.get("DAY")!.peakAircraft).toBe(2);
    expect(result.get("2026-03-02")!.get("DAY")!.peakAircraft).toBe(4);
  });

  it("rounds avgAircraft to 2 decimal places", () => {
    const buckets = [
      makeBucket("2026-03-01T08:00:00.000Z", 1, [1]),
      makeBucket("2026-03-01T09:00:00.000Z", 2, [1, 2]),
      makeBucket("2026-03-01T10:00:00.000Z", 1, [1]),
    ];
    const result = aggregateConcurrencyByShift(buckets, shifts);
    const dayShift = result.get("2026-03-01")!.get("DAY")!;
    // avg = (1+2+1)/3 = 1.333...
    expect(dayShift.avgAircraft).toBe(1.33);
  });
});

// ─── applyConcurrencyPressure ─────────────────────────────────────────────

describe("applyConcurrencyPressure", () => {
  it("returns demand unchanged when dailyAgg is empty", () => {
    const demand = [makeDemandDay("2026-03-01")];
    const result = applyConcurrencyPressure(demand, new Map(), new Map());
    expect(result).toBe(demand); // same reference
  });

  it("overlays day-level concurrency onto matching demand day", () => {
    const demand = [makeDemandDay("2026-03-01")];
    const dailyAgg = new Map([
      [
        "2026-03-01",
        {
          peakAircraft: 3,
          avgAircraft: 2.1,
          concurrencyHours: 4,
          peakHour: "2026-03-01T11:00:00.000Z",
        },
      ],
    ]);

    const result = applyConcurrencyPressure(demand, dailyAgg, new Map());
    expect(result[0].peakConcurrency).toBe(3);
    expect(result[0].avgConcurrency).toBe(2.1);
  });

  it("overlays shift-level concurrency onto matching shifts", () => {
    const demand = [makeDemandDay("2026-03-01")];
    const dailyAgg = new Map([
      ["2026-03-01", { peakAircraft: 3, avgAircraft: 2, concurrencyHours: 2, peakHour: null }],
    ]);
    const shiftAgg = new Map([
      [
        "2026-03-01",
        new Map([
          ["DAY", { shiftCode: "DAY", peakAircraft: 3, avgAircraft: 2, concurrencyHours: 2 }],
          ["SWING", { shiftCode: "SWING", peakAircraft: 1, avgAircraft: 1, concurrencyHours: 0 }],
        ]),
      ],
    ]);

    const result = applyConcurrencyPressure(demand, dailyAgg, shiftAgg);
    const dayShift = result[0].byShift.find((s) => s.shiftCode === "DAY")!;
    const swingShift = result[0].byShift.find((s) => s.shiftCode === "SWING")!;
    const nightShift = result[0].byShift.find((s) => s.shiftCode === "NIGHT")!;

    expect(dayShift.peakConcurrency).toBe(3);
    expect(dayShift.avgConcurrency).toBe(2);
    expect(swingShift.peakConcurrency).toBe(1);
    expect(swingShift.avgConcurrency).toBe(1);
    // NIGHT has no shift concurrency data — should remain undefined
    expect(nightShift.peakConcurrency).toBeUndefined();
    expect(nightShift.avgConcurrency).toBeUndefined();
  });

  it("leaves days without concurrency data unchanged", () => {
    const demand = [makeDemandDay("2026-03-01"), makeDemandDay("2026-03-02")];
    const dailyAgg = new Map([
      ["2026-03-01", { peakAircraft: 2, avgAircraft: 1.5, concurrencyHours: 1, peakHour: null }],
    ]);

    const result = applyConcurrencyPressure(demand, dailyAgg, new Map());
    expect(result[0].peakConcurrency).toBe(2);
    // March 2 has no concurrency data — same object reference
    expect(result[1].peakConcurrency).toBeUndefined();
    expect(result[1]).toBe(demand[1]);
  });

  it("does not mutate original demand array", () => {
    const demand = [makeDemandDay("2026-03-01")];
    const dailyAgg = new Map([
      ["2026-03-01", { peakAircraft: 2, avgAircraft: 1.5, concurrencyHours: 1, peakHour: null }],
    ]);

    const result = applyConcurrencyPressure(demand, dailyAgg, new Map());
    expect(result).not.toBe(demand);
    expect(demand[0].peakConcurrency).toBeUndefined();
    expect(result[0].peakConcurrency).toBe(2);
  });

  it("handles multiple days with mixed concurrency data", () => {
    const demand = [
      makeDemandDay("2026-03-01"),
      makeDemandDay("2026-03-02"),
      makeDemandDay("2026-03-03"),
    ];
    const dailyAgg = new Map([
      ["2026-03-01", { peakAircraft: 2, avgAircraft: 1.5, concurrencyHours: 1, peakHour: null }],
      ["2026-03-03", { peakAircraft: 5, avgAircraft: 3.2, concurrencyHours: 4, peakHour: null }],
    ]);

    const result = applyConcurrencyPressure(demand, dailyAgg, new Map());
    expect(result[0].peakConcurrency).toBe(2);
    expect(result[1].peakConcurrency).toBeUndefined();
    expect(result[2].peakConcurrency).toBe(5);
    expect(result[2].avgConcurrency).toBe(3.2);
  });
});

// ─── computeConcurrencyPressureIndex ──────────────────────────────────────

describe("computeConcurrencyPressureIndex", () => {
  it("returns 0 when peak is 0", () => {
    expect(computeConcurrencyPressureIndex(0, 8)).toBe(0);
  });

  it("returns 0 when capacityHeadcount is 0", () => {
    expect(computeConcurrencyPressureIndex(3, 0)).toBe(0);
  });

  it("returns 0 when both are 0", () => {
    expect(computeConcurrencyPressureIndex(0, 0)).toBe(0);
  });

  it("returns 0 when peak is negative", () => {
    expect(computeConcurrencyPressureIndex(-1, 8)).toBe(0);
  });

  it("returns 0 when capacityHeadcount is negative", () => {
    expect(computeConcurrencyPressureIndex(3, -5)).toBe(0);
  });

  it("computes correct index when peak < capacity", () => {
    // 4 aircraft / 8 heads = 50%
    expect(computeConcurrencyPressureIndex(4, 8)).toBe(50);
  });

  it("computes 100 when peak equals capacity", () => {
    expect(computeConcurrencyPressureIndex(8, 8)).toBe(100);
  });

  it("computes > 100 when peak exceeds capacity", () => {
    // 12 aircraft / 8 heads = 150%
    expect(computeConcurrencyPressureIndex(12, 8)).toBe(150);
  });

  it("rounds to 2 decimal places", () => {
    // 1 / 3 = 33.333...%
    expect(computeConcurrencyPressureIndex(1, 3)).toBe(33.33);
  });

  it("handles small fractional results", () => {
    // 1 / 7 = 14.2857...%
    expect(computeConcurrencyPressureIndex(1, 7)).toBe(14.29);
  });
});
