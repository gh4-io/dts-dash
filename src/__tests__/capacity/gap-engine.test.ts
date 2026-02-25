import { describe, it, expect } from "vitest";
import { computeGapSummary } from "@/lib/capacity/gap-engine";
import type { DailyUtilizationV2, ShiftUtilizationV2 } from "@/types";

// ─── Test Helpers ──────────────────────────────────────────────────────────

function makeUtil(
  date: string,
  gapMH: number,
  opts?: {
    byShift?: ShiftUtilizationV2[];
    demandMH?: number;
    productiveMH?: number;
  },
): DailyUtilizationV2 {
  const demandMH = opts?.demandMH ?? 100;
  const productiveMH = opts?.productiveMH ?? demandMH + gapMH;
  const utilPct = productiveMH > 0 ? (demandMH / productiveMH) * 100 : null;

  return {
    date,
    utilizationPercent: utilPct,
    totalDemandMH: demandMH,
    totalProductiveMH: productiveMH,
    gapMH,
    overtimeFlag: utilPct !== null && utilPct > 100,
    criticalFlag: utilPct !== null && utilPct > 120,
    noCoverageDays: 0,
    byShift: opts?.byShift ?? [
      {
        shiftCode: "DAY",
        utilization: 80,
        gapMH: gapMH * 0.5,
        demandMH: 50,
        productiveMH: 50 + gapMH * 0.5,
        noCoverage: false,
      },
      {
        shiftCode: "SWING",
        utilization: 90,
        gapMH: gapMH * 0.3,
        demandMH: 30,
        productiveMH: 30 + gapMH * 0.3,
        noCoverage: false,
      },
      {
        shiftCode: "NIGHT",
        utilization: 100,
        gapMH: gapMH * 0.2,
        demandMH: 20,
        productiveMH: 20 + gapMH * 0.2,
        noCoverage: false,
      },
    ],
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("computeGapSummary", () => {
  it("1. empty utilization → zeros, 'balanced'", () => {
    const result = computeGapSummary([]);
    expect(result.avgDailyGapMH).toBe(0);
    expect(result.totalGapMH).toBe(0);
    expect(result.deficitDays).toBe(0);
    expect(result.surplusDays).toBe(0);
    expect(result.worstDayDeficit).toBeNull();
    expect(result.worstShiftDeficit).toBeNull();
    expect(result.avgGapByShift).toEqual({});
    expect(result.classification).toBe("balanced");
  });

  it("2. correct totalGapMH", () => {
    const data = [makeUtil("2026-02-01", 10), makeUtil("2026-02-02", -5)];
    const result = computeGapSummary(data);
    expect(result.totalGapMH).toBe(5);
  });

  it("3. correct avgDailyGapMH (rounded)", () => {
    const data = [
      makeUtil("2026-02-01", 10),
      makeUtil("2026-02-02", -5),
      makeUtil("2026-02-03", 7),
    ];
    const result = computeGapSummary(data);
    // (10 + -5 + 7) / 3 = 4.0
    expect(result.avgDailyGapMH).toBe(4);
  });

  it("4. correct deficit/surplus day counts", () => {
    const data = [
      makeUtil("2026-02-01", 10), // surplus
      makeUtil("2026-02-02", -5), // deficit
      makeUtil("2026-02-03", -10), // deficit
      makeUtil("2026-02-04", 0), // neither
      makeUtil("2026-02-05", 20), // surplus
    ];
    const result = computeGapSummary(data);
    expect(result.deficitDays).toBe(2);
    expect(result.surplusDays).toBe(2);
  });

  it("5. finds worst day deficit", () => {
    const data = [
      makeUtil("2026-02-01", -5),
      makeUtil("2026-02-02", -20),
      makeUtil("2026-02-03", -10),
    ];
    const result = computeGapSummary(data);
    expect(result.worstDayDeficit).toEqual({ date: "2026-02-02", gapMH: -20 });
  });

  it("6. null worstDayDeficit when no deficits", () => {
    const data = [makeUtil("2026-02-01", 10), makeUtil("2026-02-02", 5)];
    const result = computeGapSummary(data);
    expect(result.worstDayDeficit).toBeNull();
  });

  it("7. finds worst shift deficit", () => {
    const data = [
      makeUtil("2026-02-01", -10, {
        byShift: [
          {
            shiftCode: "DAY",
            utilization: 120,
            gapMH: -2,
            demandMH: 60,
            productiveMH: 58,
            noCoverage: false,
          },
          {
            shiftCode: "SWING",
            utilization: 150,
            gapMH: -8,
            demandMH: 45,
            productiveMH: 37,
            noCoverage: false,
          },
        ],
      }),
    ];
    const result = computeGapSummary(data);
    expect(result.worstShiftDeficit).toEqual({ date: "2026-02-01", shiftCode: "SWING", gapMH: -8 });
  });

  it("8. per-shift gap averages", () => {
    const data = [
      makeUtil("2026-02-01", 10), // DAY gap = 5, SWING gap = 3, NIGHT gap = 2
      makeUtil("2026-02-02", -10), // DAY gap = -5, SWING gap = -3, NIGHT gap = -2
    ];
    const result = computeGapSummary(data);
    expect(result.avgGapByShift["DAY"]).toBe(0);
    expect(result.avgGapByShift["SWING"]).toBe(0);
    expect(result.avgGapByShift["NIGHT"]).toBe(0);
  });

  it("9. classification: 'surplus' (0 deficit days)", () => {
    const data = [makeUtil("2026-02-01", 10), makeUtil("2026-02-02", 5)];
    const result = computeGapSummary(data);
    expect(result.classification).toBe("surplus");
  });

  it("10. classification: 'balanced' (<20%)", () => {
    // 1 deficit out of 10 = 10% → balanced
    const data: DailyUtilizationV2[] = [];
    for (let i = 0; i < 10; i++) {
      data.push(makeUtil(`2026-02-${String(i + 1).padStart(2, "0")}`, i === 0 ? -5 : 10));
    }
    const result = computeGapSummary(data);
    expect(result.classification).toBe("balanced");
  });

  it("11. classification: 'tight' (20-50%)", () => {
    // 3 deficit out of 10 = 30% → tight
    const data: DailyUtilizationV2[] = [];
    for (let i = 0; i < 10; i++) {
      data.push(makeUtil(`2026-02-${String(i + 1).padStart(2, "0")}`, i < 3 ? -5 : 10));
    }
    const result = computeGapSummary(data);
    expect(result.classification).toBe("tight");
  });

  it("12. classification: 'deficit' (>50%)", () => {
    // 6 deficit out of 10 = 60% → deficit
    const data: DailyUtilizationV2[] = [];
    for (let i = 0; i < 10; i++) {
      data.push(makeUtil(`2026-02-${String(i + 1).padStart(2, "0")}`, i < 6 ? -5 : 10));
    }
    const result = computeGapSummary(data);
    expect(result.classification).toBe("deficit");
  });

  it("13. zero-gap days count as neither", () => {
    const data = [makeUtil("2026-02-01", 0), makeUtil("2026-02-02", 0)];
    const result = computeGapSummary(data);
    expect(result.deficitDays).toBe(0);
    expect(result.surplusDays).toBe(0);
    expect(result.classification).toBe("surplus"); // 0 deficit days → surplus
  });
});
