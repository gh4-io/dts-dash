import { describe, it, expect } from "vitest";
import { applyDemandScenario, DEMAND_SCENARIOS } from "@/lib/capacity/scenario-engine";
import type { DailyDemandV2, DailyCapacityV2, DemandScenario } from "@/types";

// ─── Test Fixtures ─────────────────────────────────────────────────────────

function makeDemand(date: string, totalMH: number, opts?: Partial<DailyDemandV2>): DailyDemandV2 {
  return {
    date,
    totalDemandMH: totalMH,
    aircraftCount: 1,
    byCustomer: { TestCustomer: totalMH },
    byShift: [
      {
        shiftCode: "DAY",
        demandMH: totalMH * 0.5,
        allocatedDemandMH: 10,
        forecastedDemandMH: 15,
        workedMH: 8,
        billedMH: 7,
        peakConcurrency: 3,
        avgConcurrency: 1.5,
        wpContributions: [
          {
            wpId: 1,
            aircraftReg: "C-TEST",
            customer: "TestCustomer",
            allocatedMH: totalMH * 0.5,
            mhSource: "workpackage",
          },
        ],
      },
      {
        shiftCode: "SWING",
        demandMH: totalMH * 0.3,
        wpContributions: [
          {
            wpId: 2,
            aircraftReg: "C-TEST",
            customer: "TestCustomer",
            allocatedMH: totalMH * 0.3,
            mhSource: "workpackage",
          },
        ],
      },
      {
        shiftCode: "NIGHT",
        demandMH: totalMH * 0.2,
        wpContributions: [],
      },
    ],
    totalAllocatedDemandMH: 20,
    totalForecastedDemandMH: 30,
    totalWorkedMH: 16,
    totalBilledMH: 14,
    peakConcurrency: 3,
    avgConcurrency: 1.5,
    ...opts,
  };
}

function makeCapacity(date: string, productiveMH: number): DailyCapacityV2 {
  return {
    date,
    totalProductiveMH: productiveMH,
    totalPaidMH: productiveMH * 1.2,
    byShift: [
      {
        shiftCode: "DAY",
        shiftName: "Day",
        rosterHeadcount: 8,
        effectiveHeadcount: 8,
        paidHoursPerPerson: 8,
        paidMH: productiveMH * 0.5,
        availableMH: productiveMH * 0.5,
        productiveMH: productiveMH * 0.4,
        hasExceptions: false,
        belowMinHeadcount: false,
      },
      {
        shiftCode: "SWING",
        shiftName: "Swing",
        rosterHeadcount: 6,
        effectiveHeadcount: 6,
        paidHoursPerPerson: 8,
        paidMH: productiveMH * 0.35,
        availableMH: productiveMH * 0.35,
        productiveMH: productiveMH * 0.35,
        hasExceptions: false,
        belowMinHeadcount: false,
      },
      {
        shiftCode: "NIGHT",
        shiftName: "Night",
        rosterHeadcount: 4,
        effectiveHeadcount: 4,
        paidHoursPerPerson: 8,
        paidMH: productiveMH * 0.25,
        availableMH: productiveMH * 0.25,
        productiveMH: productiveMH * 0.25,
        hasExceptions: false,
        belowMinHeadcount: false,
      },
    ],
    hasExceptions: false,
  };
}

const baseline: DemandScenario = { id: "baseline", label: "Baseline", demandMultiplier: 1.0 };
const plus10: DemandScenario = { id: "plus10", label: "+10% Demand", demandMultiplier: 1.1 };

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("applyDemandScenario", () => {
  const demand = [makeDemand("2026-02-01", 100)];
  const capacity = [makeCapacity("2026-02-01", 100)];

  it("1. baseline returns demand unchanged", () => {
    const result = applyDemandScenario(demand, capacity, baseline);
    expect(result.scenarioId).toBe("baseline");
    expect(result.demand[0].totalDemandMH).toBe(100);
  });

  it("2. +10% scales totalDemandMH (100 → 110)", () => {
    const result = applyDemandScenario(demand, capacity, plus10);
    expect(result.demand[0].totalDemandMH).toBe(110);
  });

  it("3. +10% scales per-shift demandMH", () => {
    const result = applyDemandScenario(demand, capacity, plus10);
    const day = result.demand[0].byShift.find((s) => s.shiftCode === "DAY");
    expect(day?.demandMH).toBe(55); // 50 * 1.1
  });

  it("4. +10% scales per-customer demand", () => {
    const result = applyDemandScenario(demand, capacity, plus10);
    expect(result.demand[0].byCustomer["TestCustomer"]).toBe(110);
  });

  it("5. +10% scales wpContributions.allocatedMH", () => {
    const result = applyDemandScenario(demand, capacity, plus10);
    const day = result.demand[0].byShift.find((s) => s.shiftCode === "DAY");
    expect(day?.wpContributions[0].allocatedMH).toBe(55);
  });

  it("6. does NOT scale allocatedDemandMH", () => {
    const result = applyDemandScenario(demand, capacity, plus10);
    const day = result.demand[0].byShift.find((s) => s.shiftCode === "DAY");
    expect(day?.allocatedDemandMH).toBe(10);
    expect(result.demand[0].totalAllocatedDemandMH).toBe(20);
  });

  it("7. does NOT scale forecastedDemandMH", () => {
    const result = applyDemandScenario(demand, capacity, plus10);
    const day = result.demand[0].byShift.find((s) => s.shiftCode === "DAY");
    expect(day?.forecastedDemandMH).toBe(15);
    expect(result.demand[0].totalForecastedDemandMH).toBe(30);
  });

  it("8. does NOT scale workedMH / billedMH", () => {
    const result = applyDemandScenario(demand, capacity, plus10);
    const day = result.demand[0].byShift.find((s) => s.shiftCode === "DAY");
    expect(day?.workedMH).toBe(8);
    expect(day?.billedMH).toBe(7);
  });

  it("9. recomputes utilization (demand 100 × 1.1 = 110, capacity 100 → util 110%)", () => {
    const result = applyDemandScenario(demand, capacity, plus10);
    expect(result.utilization).toHaveLength(1);
    const u = result.utilization[0];
    expect(u.totalDemandMH).toBe(110);
    expect(u.utilizationPercent).toBeGreaterThan(100);
  });

  it("10. recomputes summary (overtimeFlag triggers)", () => {
    const result = applyDemandScenario(demand, capacity, plus10);
    expect(result.summary.overtimeDays).toBeGreaterThanOrEqual(1);
  });

  it("11. handles empty demand", () => {
    const result = applyDemandScenario([], capacity, plus10);
    expect(result.demand).toHaveLength(0);
    expect(result.summary.totalDemandMH).toBe(0);
  });

  it("12. rounds to 1 decimal", () => {
    const d = [makeDemand("2026-02-01", 33.333)];
    const result = applyDemandScenario(d, capacity, plus10);
    const decimals = result.demand[0].totalDemandMH.toString().split(".")[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(1);
  });

  it("13. DEMAND_SCENARIOS constant has correct entries", () => {
    expect(DEMAND_SCENARIOS).toHaveLength(2);
    expect(DEMAND_SCENARIOS[0].id).toBe("baseline");
    expect(DEMAND_SCENARIOS[0].demandMultiplier).toBe(1.0);
    expect(DEMAND_SCENARIOS[1].id).toBe("plus10");
    expect(DEMAND_SCENARIOS[1].demandMultiplier).toBe(1.1);
  });
});
