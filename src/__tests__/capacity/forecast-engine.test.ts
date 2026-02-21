/**
 * Forecast Engine Tests — P2-5 Rate Forecast
 */

import { describe, it, expect } from "vitest";
import {
  computeMovingAverage,
  computeWeightedAverage,
  fitLinearRegression,
  extractHistoricalSeries,
  generateForecast,
  applyForecastRates,
  validateForecastModel,
  validateForecastRate,
} from "@/lib/capacity/forecast-engine";
import type { DailyDemandV2, ForecastModel, ForecastRate } from "@/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeDay(overrides: Partial<DailyDemandV2> & { date: string }): DailyDemandV2 {
  return {
    totalDemandMH: 30,
    aircraftCount: 2,
    byCustomer: { Acme: 20, Beta: 10 },
    byShift: [
      {
        shiftCode: "DAY",
        demandMH: 15,
        wpContributions: [
          { wpId: 1, aircraftReg: "N123", customer: "Acme", allocatedMH: 10, mhSource: "wp" },
          { wpId: 2, aircraftReg: "N456", customer: "Beta", allocatedMH: 5, mhSource: "wp" },
        ],
      },
      {
        shiftCode: "SWING",
        demandMH: 10,
        wpContributions: [
          { wpId: 1, aircraftReg: "N123", customer: "Acme", allocatedMH: 7, mhSource: "wp" },
          { wpId: 2, aircraftReg: "N456", customer: "Beta", allocatedMH: 3, mhSource: "wp" },
        ],
      },
      {
        shiftCode: "NIGHT",
        demandMH: 5,
        wpContributions: [
          { wpId: 1, aircraftReg: "N123", customer: "Acme", allocatedMH: 3, mhSource: "wp" },
          { wpId: 2, aircraftReg: "N456", customer: "Beta", allocatedMH: 2, mhSource: "wp" },
        ],
      },
    ],
    ...overrides,
  };
}

function makeModel(overrides?: Partial<ForecastModel>): ForecastModel {
  return {
    id: 1,
    name: "Test Model",
    description: null,
    method: "moving_average",
    lookbackDays: 30,
    forecastHorizonDays: 7,
    granularity: "shift",
    customerFilter: null,
    weightRecent: 0.7,
    isActive: true,
    ...overrides,
  };
}

function makeHistoricalDemand(days: number, baseMH: number = 30): DailyDemandV2[] {
  return Array.from({ length: days }, (_, i) => {
    const date = `2026-02-${String(i + 1).padStart(2, "0")}`;
    return makeDay({ date, totalDemandMH: baseMH + i });
  });
}

// ─── computeMovingAverage ────────────────────────────────────────────────────

describe("computeMovingAverage", () => {
  it("computes average of multiple values", () => {
    expect(computeMovingAverage([10, 20, 30])).toBe(20);
  });

  it("returns the value for a single-element array", () => {
    expect(computeMovingAverage([42])).toBe(42);
  });

  it("returns 0 for empty array", () => {
    expect(computeMovingAverage([])).toBe(0);
  });

  it("handles large arrays", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(computeMovingAverage(values)).toBe(50.5);
  });
});

// ─── computeWeightedAverage ──────────────────────────────────────────────────

describe("computeWeightedAverage", () => {
  it("with weight=0.5 gives more weight to recent values", () => {
    // values = [10, 20] → weights = [0.5^1, 0.5^0] = [0.5, 1.0]
    // weighted = (10*0.5 + 20*1.0) / (0.5+1.0) = 25/1.5 ≈ 16.67
    const result = computeWeightedAverage([10, 20], 0.5);
    expect(result).toBeCloseTo(16.67, 1);
  });

  it("with weight=1.0 all values weighted equally", () => {
    // All weights are 1.0^i = 1.0
    const result = computeWeightedAverage([10, 20, 30], 1.0);
    expect(result).toBeCloseTo(20, 5);
  });

  it("returns single value regardless of weight", () => {
    expect(computeWeightedAverage([42], 0.5)).toBe(42);
  });

  it("with weight=0.7 favors recent data", () => {
    // [10, 30] → weights = [0.7, 1.0]
    // weighted = (10*0.7 + 30*1.0) / (0.7+1.0) = 37/1.7 ≈ 21.76
    const result = computeWeightedAverage([10, 30], 0.7);
    expect(result).toBeCloseTo(21.76, 1);
  });

  it("returns 0 for empty array", () => {
    expect(computeWeightedAverage([], 0.7)).toBe(0);
  });
});

// ─── fitLinearRegression ─────────────────────────────────────────────────────

describe("fitLinearRegression", () => {
  it("fits a perfect positive slope", () => {
    const reg = fitLinearRegression([0, 1, 2, 3, 4]);
    expect(reg.slope).toBeCloseTo(1, 5);
    expect(reg.intercept).toBeCloseTo(0, 5);
    expect(reg.rSquared).toBeCloseTo(1, 5);
  });

  it("fits a flat line with slope 0", () => {
    const reg = fitLinearRegression([5, 5, 5, 5]);
    expect(reg.slope).toBeCloseTo(0, 5);
    expect(reg.intercept).toBeCloseTo(5, 5);
    expect(reg.rSquared).toBeCloseTo(1, 5);
  });

  it("fits a negative slope", () => {
    const reg = fitLinearRegression([10, 8, 6, 4, 2]);
    expect(reg.slope).toBeCloseTo(-2, 5);
    expect(reg.intercept).toBeCloseTo(10, 5);
  });

  it("returns value itself for a single point", () => {
    const reg = fitLinearRegression([42]);
    expect(reg.slope).toBe(0);
    expect(reg.intercept).toBe(42);
    expect(reg.predict(5)).toBe(42);
  });

  it("extrapolates correctly", () => {
    const reg = fitLinearRegression([0, 2, 4, 6]);
    // slope=2, intercept=0 → predict(4) = 8
    expect(reg.predict(4)).toBeCloseTo(8, 5);
    expect(reg.predict(10)).toBeCloseTo(20, 5);
  });

  it("returns 0 for empty array", () => {
    const reg = fitLinearRegression([]);
    expect(reg.slope).toBe(0);
    expect(reg.predict(5)).toBe(0);
  });
});

// ─── extractHistoricalSeries ─────────────────────────────────────────────────

describe("extractHistoricalSeries", () => {
  const demand = [
    makeDay({ date: "2026-02-03" }),
    makeDay({ date: "2026-02-01" }),
    makeDay({ date: "2026-02-02" }),
  ];

  it("extracts aggregate demand sorted by date", () => {
    const series = extractHistoricalSeries(demand, null, null);
    expect(series).toHaveLength(3);
    expect(series[0].date).toBe("2026-02-01");
    expect(series[1].date).toBe("2026-02-02");
    expect(series[2].date).toBe("2026-02-03");
    expect(series[0].demandMH).toBe(30);
  });

  it("extracts specific shift demand", () => {
    const series = extractHistoricalSeries(demand, "DAY", null);
    expect(series[0].demandMH).toBe(15);
  });

  it("extracts specific customer demand", () => {
    const series = extractHistoricalSeries(demand, null, "Acme");
    expect(series[0].demandMH).toBe(20);
  });

  it("extracts specific shift + customer demand", () => {
    const series = extractHistoricalSeries(demand, "DAY", "Acme");
    expect(series[0].demandMH).toBe(10); // wpContributions for Acme in DAY shift
  });

  it("returns 0 for non-existent customer", () => {
    const series = extractHistoricalSeries(demand, null, "NoSuchCustomer");
    expect(series[0].demandMH).toBe(0);
  });
});

// ─── generateForecast ────────────────────────────────────────────────────────

describe("generateForecast", () => {
  it("generates rates with moving_average for shift granularity", () => {
    const demand = makeHistoricalDemand(10);
    const model = makeModel({ forecastHorizonDays: 3 });
    const rates = generateForecast(demand, model, "2026-02-20");

    // shift granularity → DAY, SWING, NIGHT × 3 days = 9 rates
    expect(rates).toHaveLength(9);
    expect(rates[0].forecastDate).toBe("2026-02-20");
  });

  it("generates rates with daily granularity", () => {
    const demand = makeHistoricalDemand(10);
    const model = makeModel({ granularity: "daily", forecastHorizonDays: 5 });
    const rates = generateForecast(demand, model, "2026-02-20");

    // daily → null shiftCode × 5 days = 5 rates (aggregate, no customer filter)
    expect(rates).toHaveLength(5);
    expect(rates[0].shiftCode).toBeNull();
  });

  it("applies customerFilter to limit customers", () => {
    const demand = makeHistoricalDemand(10);
    const model = makeModel({
      customerFilter: "Acme,Beta",
      forecastHorizonDays: 2,
    });
    const rates = generateForecast(demand, model, "2026-02-20");

    // 2 customers × 3 shifts × 2 days = 12 rates
    expect(rates).toHaveLength(12);
    const customers = new Set(rates.map((r) => r.customer));
    expect(customers).toContain("Acme");
    expect(customers).toContain("Beta");
  });

  it("returns empty for empty historical data", () => {
    const model = makeModel();
    const rates = generateForecast([], model, "2026-02-20");
    expect(rates).toHaveLength(0);
  });

  it("generates rates with weighted_average", () => {
    const demand = makeHistoricalDemand(10);
    const model = makeModel({ method: "weighted_average", forecastHorizonDays: 2 });
    const rates = generateForecast(demand, model, "2026-02-20");

    // 3 shifts × 2 days = 6
    expect(rates).toHaveLength(6);
    expect(rates[0].forecastedMh).toBeGreaterThan(0);
  });

  it("generates rates with linear_trend", () => {
    const demand = makeHistoricalDemand(10);
    const model = makeModel({ method: "linear_trend", forecastHorizonDays: 2 });
    const rates = generateForecast(demand, model, "2026-02-20");

    expect(rates).toHaveLength(6);
    expect(rates[0].forecastedMh).toBeGreaterThan(0);
  });

  it("linear_trend clamps negative forecasts to 0", () => {
    // Steep downward trend that would go negative
    const demand = [
      makeDay({
        date: "2026-02-01",
        totalDemandMH: 100,
        byShift: [{ shiftCode: "DAY", demandMH: 100, wpContributions: [] }],
      }),
      makeDay({
        date: "2026-02-02",
        totalDemandMH: 50,
        byShift: [{ shiftCode: "DAY", demandMH: 50, wpContributions: [] }],
      }),
      makeDay({
        date: "2026-02-03",
        totalDemandMH: 10,
        byShift: [{ shiftCode: "DAY", demandMH: 10, wpContributions: [] }],
      }),
    ];
    const model = makeModel({ method: "linear_trend", forecastHorizonDays: 5 });
    const rates = generateForecast(demand, model, "2026-02-04");

    for (const rate of rates) {
      expect(rate.forecastedMh).toBeGreaterThanOrEqual(0);
    }
  });

  it("confidence is proportional to sample completeness", () => {
    // 5 days of history with lookback=30 → confidence ≈ 5/30 = 0.17
    const demand = makeHistoricalDemand(5);
    const model = makeModel({ lookbackDays: 30, forecastHorizonDays: 1 });
    const rates = generateForecast(demand, model, "2026-02-20");

    // Moving average confidence = sampleCount / lookbackDays
    expect(rates[0].confidence).toBeCloseTo(5 / 30, 1);
  });

  it("works with single day of history", () => {
    const demand = [makeDay({ date: "2026-02-01" })];
    const model = makeModel({ forecastHorizonDays: 3 });
    const rates = generateForecast(demand, model, "2026-02-02");

    expect(rates.length).toBeGreaterThan(0);
    expect(rates[0].forecastedMh).toBeGreaterThan(0);
  });
});

// ─── applyForecastRates ──────────────────────────────────────────────────────

describe("applyForecastRates", () => {
  function makeRate(overrides?: Partial<ForecastRate>): ForecastRate {
    return {
      id: 1,
      modelId: 1,
      forecastDate: "2026-02-01",
      shiftCode: "DAY",
      customer: null,
      forecastedMh: 20,
      confidence: 0.8,
      isManualOverride: false,
      notes: null,
      isActive: true,
      ...overrides,
    };
  }

  it("adds forecastedDemandMH to existing demand entries", () => {
    const demand = [makeDay({ date: "2026-02-01" })];
    const rates = [makeRate({ forecastDate: "2026-02-01", forecastedMh: 25 })];

    const result = applyForecastRates(demand, rates, "shift");
    expect(result[0].totalForecastedDemandMH).toBe(25);
  });

  it("creates synthetic entries for future dates", () => {
    const demand = [makeDay({ date: "2026-02-01" })];
    const rates = [makeRate({ forecastDate: "2026-02-05", forecastedMh: 15 })];

    const result = applyForecastRates(demand, rates, "shift");
    expect(result).toHaveLength(2);
    const futureEntry = result.find((d) => d.date === "2026-02-05");
    expect(futureEntry).toBeDefined();
    expect(futureEntry!.totalDemandMH).toBe(0);
    expect(futureEntry!.totalForecastedDemandMH).toBe(15);
  });

  it("does not modify original demand array", () => {
    const demand = [makeDay({ date: "2026-02-01" })];
    const originalLength = demand.length;
    const rates = [makeRate({ forecastDate: "2026-02-05" })];

    applyForecastRates(demand, rates, "shift");
    expect(demand).toHaveLength(originalLength);
    expect(
      (demand[0] as DailyDemandV2 & { totalForecastedDemandMH?: number }).totalForecastedDemandMH,
    ).toBeUndefined();
  });

  it("returns demand unchanged for empty rates", () => {
    const demand = [makeDay({ date: "2026-02-01" })];
    const result = applyForecastRates(demand, [], "shift");
    expect(result).toBe(demand);
  });

  it("handles daily granularity by distributing evenly across shifts", () => {
    const demand = [makeDay({ date: "2026-02-01" })];
    const rates = [makeRate({ forecastDate: "2026-02-01", shiftCode: null, forecastedMh: 30 })];

    const result = applyForecastRates(demand, rates, "daily");
    // 30 MH / 3 shifts = 10 per shift
    expect(result[0].byShift[0].forecastedDemandMH).toBe(10);
    expect(result[0].byShift[1].forecastedDemandMH).toBe(10);
    expect(result[0].byShift[2].forecastedDemandMH).toBe(10);
  });
});

// ─── validateForecastModel ───────────────────────────────────────────────────

describe("validateForecastModel", () => {
  it("validates a complete valid model", () => {
    const result = validateForecastModel({
      name: "Test Model",
      method: "moving_average",
      lookbackDays: 30,
      forecastHorizonDays: 14,
      granularity: "shift",
      weightRecent: 0.7,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing name", () => {
    const result = validateForecastModel({ method: "moving_average" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("name is required");
  });

  it("rejects invalid method", () => {
    const result = validateForecastModel({ name: "Test", method: "magic" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("method"))).toBe(true);
  });

  it("rejects lookbackDays out of range", () => {
    const result = validateForecastModel({
      name: "Test",
      method: "moving_average",
      lookbackDays: 3,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("lookbackDays"))).toBe(true);
  });

  it("rejects invalid weightRecent", () => {
    const result = validateForecastModel({
      name: "Test",
      method: "weighted_average",
      weightRecent: 1.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("weightRecent"))).toBe(true);
  });
});

// ─── validateForecastRate ────────────────────────────────────────────────────

describe("validateForecastRate", () => {
  it("validates a complete valid rate", () => {
    const result = validateForecastRate({
      modelId: 1,
      forecastDate: "2026-03-01",
      shiftCode: "DAY",
      forecastedMh: 10.5,
      confidence: 0.85,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = validateForecastRate({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects invalid date format", () => {
    const result = validateForecastRate({
      modelId: 1,
      forecastDate: "02/03/2026",
      forecastedMh: 10,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("forecastDate"))).toBe(true);
  });

  it("rejects confidence out of range", () => {
    const result = validateForecastRate({
      modelId: 1,
      forecastDate: "2026-03-01",
      forecastedMh: 10,
      confidence: 2.0,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("confidence"))).toBe(true);
  });
});
