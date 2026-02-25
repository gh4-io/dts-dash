import { describe, it, expect } from "vitest";
import { computeRollingForecast } from "@/lib/capacity/rolling-forecast-engine";
import type { DailyDemandV2 } from "@/types";

// ─── Test Helpers ──────────────────────────────────────────────────────────

function makeDemandDay(
  date: string,
  totalMH: number,
  shifts?: Record<string, number>,
): DailyDemandV2 {
  const byShift = Object.entries(
    shifts ?? { DAY: totalMH * 0.5, SWING: totalMH * 0.3, NIGHT: totalMH * 0.2 },
  ).map(([code, mh]) => ({
    shiftCode: code,
    demandMH: mh,
    wpContributions: [],
  }));
  return {
    date,
    totalDemandMH: totalMH,
    aircraftCount: 1,
    byCustomer: { TestCustomer: totalMH },
    byShift,
  };
}

/** Generate N consecutive days of demand starting from a date */
function generateDemandDays(startDate: string, days: number, totalMH: number): DailyDemandV2[] {
  const result: DailyDemandV2[] = [];
  const d = new Date(startDate + "T12:00:00Z");
  for (let i = 0; i < days; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    result.push(makeDemandDay(dateStr, totalMH));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return result;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("computeRollingForecast", () => {
  it("1. empty demand → empty forecast, basedOnWeeks: 0", () => {
    const result = computeRollingForecast([]);
    expect(result.forecastDays).toHaveLength(0);
    expect(result.basedOnWeeks).toBe(0);
    expect(result.weeksAhead).toBe(8);
    expect(result.patternSource).toBe("dayOfWeek");
  });

  it("2. 14 days history → 56 forecast days", () => {
    const demand = generateDemandDays("2026-02-01", 14, 100);
    const result = computeRollingForecast(demand);
    expect(result.forecastDays).toHaveLength(56);
  });

  it("3. forecast starts day after last historical date", () => {
    const demand = generateDemandDays("2026-02-01", 7, 100);
    const result = computeRollingForecast(demand);
    // Last demand date is 2026-02-07
    expect(result.forecastDays[0].date).toBe("2026-02-08");
  });

  it("4. correct DOW assignment (known Monday → dayOfWeek mapping)", () => {
    // 2026-02-02 is a Monday (ISO DOW 1)
    // Create 7 days Mon-Sun with different values per day
    const demand: DailyDemandV2[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date("2026-02-02T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      demand.push(makeDemandDay(dateStr, (i + 1) * 10)); // Mon=10, Tue=20, ..., Sun=70
    }
    const result = computeRollingForecast(demand);
    // First forecast day is 2026-02-09 (Monday) → should match Monday's average (10)
    expect(result.forecastDays[0].date).toBe("2026-02-09");
    expect(result.forecastDays[0].forecastedDemandMH).toBe(10);
    // Second day (Tue) → 20
    expect(result.forecastDays[1].forecastedDemandMH).toBe(20);
  });

  it("5. recency weighting: recent week=100, old week=50 → avg closer to 100", () => {
    // Create two Mondays: recent=100, 4 weeks ago=50
    const demand: DailyDemandV2[] = [
      makeDemandDay("2026-01-05", 50), // Monday, ~4 weeks ago
      makeDemandDay("2026-02-02", 100), // Monday, recent
    ];
    const result = computeRollingForecast(demand);

    // Find the first Monday in forecast
    const firstMonday = result.forecastDays.find((d) => {
      const day = new Date(d.date + "T12:00:00Z").getUTCDay();
      return day === 1; // Monday
    });
    expect(firstMonday).toBeDefined();
    // Weight for recent (0 weeks ago): 1/(1+0*0.15) = 1.0
    // Weight for old (4 weeks ago): 1/(1+4*0.15) = 1/1.6 = 0.625
    // Weighted avg = (100*1.0 + 50*0.625) / (1.0 + 0.625) = 131.25/1.625 ≈ 80.8
    expect(firstMonday!.forecastedDemandMH).toBeGreaterThan(70); // closer to 100 than 50
    expect(firstMonday!.forecastedDemandMH).toBeLessThan(90);
  });

  it("6. per-shift sums approximately equal total (within rounding)", () => {
    const demand = generateDemandDays("2026-02-01", 14, 100);
    const result = computeRollingForecast(demand);

    for (const day of result.forecastDays) {
      const shiftTotal = Object.values(day.forecastedByShift).reduce((s, v) => s + v, 0);
      // Allow 1.0 MH tolerance for rounding
      expect(Math.abs(shiftTotal - day.forecastedDemandMH)).toBeLessThanOrEqual(1.0);
    }
  });

  it("7. confidence levels: 8+ = high, 4-7 = medium, <4 = low", () => {
    // 8 Mondays = high, 4 Tuesdays = medium, 2 Wednesdays = low
    const demand: DailyDemandV2[] = [];
    for (let w = 0; w < 8; w++) {
      const d = new Date("2026-02-02T12:00:00Z"); // Monday
      d.setUTCDate(d.getUTCDate() - w * 7);
      demand.push(makeDemandDay(d.toISOString().slice(0, 10), 100));
    }
    for (let w = 0; w < 4; w++) {
      const d = new Date("2026-02-03T12:00:00Z"); // Tuesday
      d.setUTCDate(d.getUTCDate() - w * 7);
      demand.push(makeDemandDay(d.toISOString().slice(0, 10), 100));
    }
    for (let w = 0; w < 2; w++) {
      const d = new Date("2026-02-04T12:00:00Z"); // Wednesday
      d.setUTCDate(d.getUTCDate() - w * 7);
      demand.push(makeDemandDay(d.toISOString().slice(0, 10), 100));
    }

    const result = computeRollingForecast(demand);

    // Find forecast days by DOW
    const mondays = result.forecastDays.filter(
      (d) => new Date(d.date + "T12:00:00Z").getUTCDay() === 1,
    );
    const tuesdays = result.forecastDays.filter(
      (d) => new Date(d.date + "T12:00:00Z").getUTCDay() === 2,
    );
    const wednesdays = result.forecastDays.filter(
      (d) => new Date(d.date + "T12:00:00Z").getUTCDay() === 3,
    );

    expect(mondays[0].confidence).toBe("high");
    expect(tuesdays[0].confidence).toBe("medium");
    expect(wednesdays[0].confidence).toBe("low");
  });

  it("8. single day history → still produces forecast", () => {
    const demand = [makeDemandDay("2026-02-02", 75)];
    const result = computeRollingForecast(demand);
    expect(result.forecastDays).toHaveLength(56);
    // The DOW of 2026-02-02 (Monday) should be 75, others 0
    const mondays = result.forecastDays.filter(
      (d) => new Date(d.date + "T12:00:00Z").getUTCDay() === 1,
    );
    expect(mondays[0].forecastedDemandMH).toBe(75);
    // Non-Monday days should have 0
    const tuesdays = result.forecastDays.filter(
      (d) => new Date(d.date + "T12:00:00Z").getUTCDay() === 2,
    );
    expect(tuesdays[0].forecastedDemandMH).toBe(0);
  });

  it("9. all values rounded to 1 decimal", () => {
    const demand = [makeDemandDay("2026-02-02", 33.333), makeDemandDay("2026-02-09", 66.667)];
    const result = computeRollingForecast(demand);
    for (const day of result.forecastDays) {
      const decimals = day.forecastedDemandMH.toString().split(".")[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(1);
      for (const val of Object.values(day.forecastedByShift)) {
        const d = val.toString().split(".")[1]?.length ?? 0;
        expect(d).toBeLessThanOrEqual(1);
      }
    }
  });

  it("10. maxHistoryWeeks option respected", () => {
    // Create data spanning 10 weeks — but only allow 3 weeks of history
    const demand: DailyDemandV2[] = [];
    for (let w = 0; w < 10; w++) {
      const d = new Date("2026-02-02T12:00:00Z"); // Monday
      d.setUTCDate(d.getUTCDate() - w * 7);
      // Old weeks (w>=4) get value 200, recent (w<4) get 100
      demand.push(makeDemandDay(d.toISOString().slice(0, 10), w >= 4 ? 200 : 100));
    }

    const result = computeRollingForecast(demand, { maxHistoryWeeks: 3 });
    // With only 3 weeks of history, only w=0,1,2 (all value=100) are included
    const mondays = result.forecastDays.filter(
      (d) => new Date(d.date + "T12:00:00Z").getUTCDay() === 1,
    );
    expect(mondays[0].forecastedDemandMH).toBe(100);
  });
});
