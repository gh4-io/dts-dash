/**
 * Allocation Engine Tests — Demand Contracts + Lines
 */

import { describe, it, expect } from "vitest";
import {
  findMatchingAllocations,
  computeAllocatedMH,
  applyAllocations,
  validateContract,
  computeContractProjection,
  getProjectionStatus,
} from "@/lib/capacity/allocation-engine";
import type {
  DemandContract,
  DemandAllocationLine,
  MatchedAllocation,
  CapacityShift,
  DailyDemandV2,
} from "@/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const shifts: CapacityShift[] = [
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

function makeLine(overrides: Partial<DemandAllocationLine> = {}): DemandAllocationLine {
  return {
    id: 1,
    contractId: 1,
    shiftId: null,
    dayOfWeek: null,
    allocatedMh: 10,
    label: null,
    ...overrides,
  };
}

function makeContract(overrides: Partial<DemandContract> = {}): DemandContract {
  return {
    id: 1,
    customerId: 100,
    name: "Test Contract",
    mode: "MINIMUM_FLOOR",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    contractedMh: null,
    periodType: null,
    reason: null,
    isActive: true,
    lines: [makeLine()],
    ...overrides,
  };
}

// ─── computeContractProjection ───────────────────────────────────────────────

describe("computeContractProjection", () => {
  it("returns null when contractedMh is null", () => {
    const contract = makeContract({ contractedMh: null, periodType: null });
    expect(computeContractProjection(contract, contract.lines)).toBeNull();
  });

  it("returns null when periodType is null but contractedMh is set", () => {
    const contract = makeContract({ contractedMh: 100, periodType: null });
    expect(computeContractProjection(contract, contract.lines)).toBeNull();
  });

  it("computes WEEKLY projection — all-day line", () => {
    // line: dayOfWeek=null → 7 occ/week, 10 MH each = 70/week
    const contract = makeContract({ contractedMh: 100, periodType: "WEEKLY" });
    expect(computeContractProjection(contract, contract.lines)).toBe(70);
  });

  it("computes WEEKLY projection — specific day line", () => {
    const lines = [makeLine({ dayOfWeek: 1, allocatedMh: 10 })]; // Monday only → 1×10 = 10/week
    const contract = makeContract({ contractedMh: 100, periodType: "WEEKLY", lines });
    expect(computeContractProjection(contract, lines)).toBe(10);
  });

  it("computes WEEKLY projection — multiple lines", () => {
    const lines = [
      makeLine({ id: 1, dayOfWeek: 1, allocatedMh: 8 }), // 1×8
      makeLine({ id: 2, dayOfWeek: 2, allocatedMh: 8 }), // 1×8
      makeLine({ id: 3, dayOfWeek: null, allocatedMh: 2 }), // 7×2
    ];
    // 8 + 8 + 14 = 30 weekly
    const contract = makeContract({ contractedMh: 30, periodType: "WEEKLY", lines });
    expect(computeContractProjection(contract, lines)).toBe(30);
  });

  it("computes MONTHLY projection", () => {
    const lines = [makeLine({ dayOfWeek: null, allocatedMh: 10 })]; // 70/week
    const contract = makeContract({ contractedMh: 300, periodType: "MONTHLY", lines });
    // 70 × 4.348 = 304.36
    expect(computeContractProjection(contract, lines)).toBeCloseTo(304.36, 1);
  });

  it("computes ANNUAL projection", () => {
    const lines = [makeLine({ dayOfWeek: null, allocatedMh: 10 })]; // 70/week
    const contract = makeContract({ contractedMh: 3000, periodType: "ANNUAL", lines });
    // 70 × 52.143 = 3650.01
    expect(computeContractProjection(contract, lines)).toBeCloseTo(3650.01, 0);
  });

  it("computes TOTAL projection with end date", () => {
    const lines = [makeLine({ dayOfWeek: null, allocatedMh: 10 })]; // 70/week
    // 2026-01-01 to 2026-01-15 = 14 days = 2 weeks
    const contract = makeContract({
      contractedMh: 140,
      periodType: "TOTAL",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-01-15",
      lines,
    });
    expect(computeContractProjection(contract, lines)).toBe(140);
  });

  it("computes TOTAL projection without end date (52-week lookahead)", () => {
    const lines = [makeLine({ dayOfWeek: null, allocatedMh: 10 })]; // 70/week
    const contract = makeContract({
      contractedMh: 3000,
      periodType: "TOTAL",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      lines,
    });
    // 70 × 52 = 3640
    expect(computeContractProjection(contract, lines)).toBe(3640);
  });

  it("returns null for PER_EVENT (no projection without event count)", () => {
    const lines = [makeLine({ dayOfWeek: null, allocatedMh: 6 })];
    const contract = makeContract({ contractedMh: 100, periodType: "PER_EVENT", lines });
    expect(computeContractProjection(contract, lines)).toBeNull();
  });
});

// ─── getProjectionStatus ─────────────────────────────────────────────────────

describe("getProjectionStatus", () => {
  it("returns null when projected is null", () => {
    expect(getProjectionStatus(null, 100)).toBeNull();
  });

  it("returns null when contracted is null", () => {
    expect(getProjectionStatus(50, null)).toBeNull();
  });

  it("returns null when contracted is 0", () => {
    expect(getProjectionStatus(50, 0)).toBeNull();
  });

  it("returns SHORTFALL when projected < contracted", () => {
    expect(getProjectionStatus(50, 100)).toBe("SHORTFALL");
  });

  it("returns OK when projected equals contracted", () => {
    expect(getProjectionStatus(100, 100)).toBe("OK");
  });

  it("returns OK when projected slightly exceeds contracted (< 20%)", () => {
    expect(getProjectionStatus(115, 100)).toBe("OK");
  });

  it("returns OK at exactly 20% over", () => {
    expect(getProjectionStatus(120, 100)).toBe("OK");
  });

  it("returns EXCESS when projected > contracted × 1.20", () => {
    expect(getProjectionStatus(121, 100)).toBe("EXCESS");
  });
});

// ─── findMatchingAllocations ─────────────────────────────────────────────────

describe("findMatchingAllocations", () => {
  it("returns matching lines from active contracts within date range", () => {
    const contracts = [makeContract()];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ mode: "MINIMUM_FLOOR", allocatedMh: 10 });
  });

  it("skips inactive contracts", () => {
    const contracts = [makeContract({ isActive: false })];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(0);
  });

  it("skips contracts with wrong customer", () => {
    const contracts = [makeContract({ customerId: 999 })];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(0);
  });

  it("skips contracts not yet effective", () => {
    const contracts = [makeContract({ effectiveFrom: "2027-01-01" })];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(0);
  });

  it("skips contracts past effectiveTo", () => {
    const contracts = [makeContract({ effectiveTo: "2025-12-31" })];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(0);
  });

  it("matches on effectiveFrom boundary", () => {
    const contracts = [makeContract({ effectiveFrom: "2026-03-15" })];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(1);
  });

  it("matches on effectiveTo boundary", () => {
    const contracts = [makeContract({ effectiveTo: "2026-03-15" })];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(1);
  });

  it("skips lines with non-matching day of week", () => {
    // 2026-03-15 is a Sunday (dow=0)
    const lines = [makeLine({ dayOfWeek: 1 })]; // Monday only
    const contracts = [makeContract({ lines })];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(0);
  });

  it("matches lines with matching day of week", () => {
    // 2026-03-16 is a Monday (dow=1)
    const lines = [makeLine({ dayOfWeek: 1 })]; // Monday
    const contracts = [makeContract({ lines })];
    const result = findMatchingAllocations("2026-03-16", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(1);
  });

  it("matches lines with null dayOfWeek (all days)", () => {
    const lines = [makeLine({ dayOfWeek: null })];
    const contracts = [makeContract({ lines })];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(1);
  });

  it("skips lines with non-matching shift", () => {
    const lines = [makeLine({ shiftId: 2 })]; // SWING shift
    const contracts = [makeContract({ lines })];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(0);
  });

  it("matches lines with matching shift", () => {
    const lines = [makeLine({ shiftId: 1 })]; // DAY shift
    const contracts = [makeContract({ lines })];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(1);
  });

  it("matches lines with null shiftId (all shifts)", () => {
    const lines = [makeLine({ shiftId: null })];
    const contracts = [makeContract({ lines })];
    const result = findMatchingAllocations("2026-03-15", "SWING", 100, contracts, shifts);
    expect(result).toHaveLength(1);
  });

  it("returns multiple lines from one contract", () => {
    const lines = [
      makeLine({ id: 1, shiftId: null, allocatedMh: 5 }),
      makeLine({ id: 2, shiftId: null, allocatedMh: 8 }),
    ];
    const contracts = [makeContract({ lines })];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(2);
    expect(result[0].allocatedMh).toBe(5);
    expect(result[1].allocatedMh).toBe(8);
  });

  it("returns lines from multiple matching contracts", () => {
    const contracts = [
      makeContract({ id: 1, lines: [makeLine({ id: 1, allocatedMh: 5 })] }),
      makeContract({ id: 2, lines: [makeLine({ id: 2, allocatedMh: 8 })] }),
    ];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(2);
  });

  it("uses contractedMh for PER_EVENT contracts with no lines", () => {
    const contracts = [makeContract({ periodType: "PER_EVENT", contractedMh: 6, lines: [] })];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ mode: "MINIMUM_FLOOR", allocatedMh: 6 });
  });

  it("skips PER_EVENT contracts with no lines and null contractedMh", () => {
    const contracts = [makeContract({ periodType: "PER_EVENT", contractedMh: null, lines: [] })];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(0);
  });

  it("uses lines when PER_EVENT contract has lines", () => {
    const lines = [makeLine({ shiftId: 1, allocatedMh: 8 })];
    const contracts = [makeContract({ periodType: "PER_EVENT", contractedMh: 6, lines })];
    const result = findMatchingAllocations("2026-03-15", "DAY", 100, contracts, shifts);
    expect(result).toHaveLength(1);
    expect(result[0].allocatedMh).toBe(8); // Uses line MH, not contractedMh
  });
});

// ─── computeAllocatedMH ─────────────────────────────────────────────────────

describe("computeAllocatedMH", () => {
  it("returns normalMH when no matching allocations", () => {
    expect(computeAllocatedMH(5, [])).toBe(5);
  });

  it("applies ADDITIVE: normal + sum", () => {
    const matched: MatchedAllocation[] = [
      { mode: "ADDITIVE", allocatedMh: 3 },
      { mode: "ADDITIVE", allocatedMh: 2 },
    ];
    // 5 + 3 + 2 = 10
    expect(computeAllocatedMH(5, matched)).toBe(10);
  });

  it("applies MINIMUM_FLOOR: max of floor vs normal", () => {
    const matched: MatchedAllocation[] = [{ mode: "MINIMUM_FLOOR", allocatedMh: 10 }];
    // max(5, 10) = 10
    expect(computeAllocatedMH(5, matched)).toBe(10);
  });

  it("MINIMUM_FLOOR does not reduce demand below normal", () => {
    const matched: MatchedAllocation[] = [{ mode: "MINIMUM_FLOOR", allocatedMh: 3 }];
    // max(5, 3) = 5 (no change)
    expect(computeAllocatedMH(5, matched)).toBe(5);
  });

  it("combines ADDITIVE and MINIMUM_FLOOR", () => {
    const matched: MatchedAllocation[] = [
      { mode: "ADDITIVE", allocatedMh: 3 },
      { mode: "MINIMUM_FLOOR", allocatedMh: 12 },
    ];
    // adjusted = 5 + 3 = 8, floor = 12 → max(8, 12) = 12
    expect(computeAllocatedMH(5, matched)).toBe(12);
  });

  it("ADDITIVE can exceed floor", () => {
    const matched: MatchedAllocation[] = [
      { mode: "ADDITIVE", allocatedMh: 10 },
      { mode: "MINIMUM_FLOOR", allocatedMh: 12 },
    ];
    // adjusted = 5 + 10 = 15, floor = 12 → max(15, 12) = 15
    expect(computeAllocatedMH(5, matched)).toBe(15);
  });

  it("handles zero normalMH (customer with no WPs)", () => {
    const matched: MatchedAllocation[] = [{ mode: "MINIMUM_FLOOR", allocatedMh: 10 }];
    expect(computeAllocatedMH(0, matched)).toBe(10);
  });
});

// ─── applyAllocations ───────────────────────────────────────────────────────

describe("applyAllocations", () => {
  const customerMap = new Map<number, string>([[100, "Acme Corp"]]);

  function makeDemand(overrides: Partial<DailyDemandV2> = {}): DailyDemandV2 {
    return {
      date: "2026-03-16",
      totalDemandMH: 5,
      aircraftCount: 1,
      byCustomer: { "Acme Corp": 5 },
      byShift: [
        {
          shiftCode: "DAY",
          demandMH: 5,
          wpContributions: [{ customer: "Acme Corp", wpId: "WP1", allocatedMH: 5 }],
        },
      ],
      ...overrides,
    };
  }

  it("returns same array when no contracts", () => {
    const demand = [makeDemand()];
    const result = applyAllocations(demand, [], shifts, customerMap);
    expect(result).toBe(demand);
  });

  it("sets allocatedDemandMH when floor exceeds normal", () => {
    const demand = [makeDemand()]; // 5 MH on DAY shift
    const contracts = [
      makeContract({ mode: "MINIMUM_FLOOR", lines: [makeLine({ shiftId: 1, allocatedMh: 10 })] }),
    ];
    const result = applyAllocations(demand, contracts, shifts, customerMap);

    const dayShift = result[0].byShift.find((s) => s.shiftCode === "DAY")!;
    expect(dayShift.allocatedDemandMH).toBe(10); // was 5, floor=10
    expect(dayShift.demandMH).toBe(10);
    expect(result[0].totalAllocatedDemandMH).toBe(10);
  });

  it("sets allocatedDemandMH with ADDITIVE", () => {
    const demand = [makeDemand()]; // 5 MH on DAY
    const contracts = [
      makeContract({ mode: "ADDITIVE", lines: [makeLine({ shiftId: 1, allocatedMh: 3 })] }),
    ];
    const result = applyAllocations(demand, contracts, shifts, customerMap);

    const dayShift = result[0].byShift.find((s) => s.shiftCode === "DAY")!;
    expect(dayShift.allocatedDemandMH).toBe(8); // 5 + 3
    expect(dayShift.demandMH).toBe(8);
  });

  it("handles customer with contract but zero normal demand", () => {
    const demand = [
      makeDemand({
        byCustomer: {},
        byShift: [{ shiftCode: "DAY", demandMH: 0, wpContributions: [] }],
        totalDemandMH: 0,
        aircraftCount: 0,
      }),
    ];
    const contracts = [
      makeContract({ mode: "MINIMUM_FLOOR", lines: [makeLine({ shiftId: 1, allocatedMh: 10 })] }),
    ];
    const result = applyAllocations(demand, contracts, shifts, customerMap);

    const dayShift = result[0].byShift.find((s) => s.shiftCode === "DAY")!;
    expect(dayShift.allocatedDemandMH).toBe(10);
    expect(dayShift.demandMH).toBe(10);
  });

  it("does not modify original demand", () => {
    const demand = [makeDemand()];
    const original = demand[0].byShift[0].demandMH;
    const contracts = [
      makeContract({ mode: "MINIMUM_FLOOR", lines: [makeLine({ shiftId: 1, allocatedMh: 10 })] }),
    ];
    applyAllocations(demand, contracts, shifts, customerMap);
    expect(demand[0].byShift[0].demandMH).toBe(original);
  });

  it("handles multiple contracts for different customers", () => {
    const cm = new Map<number, string>([
      [100, "Acme Corp"],
      [200, "Beta Inc"],
    ]);
    const demand = [
      makeDemand({
        byCustomer: { "Acme Corp": 5, "Beta Inc": 3 },
        totalDemandMH: 8,
        byShift: [
          {
            shiftCode: "DAY",
            demandMH: 8,
            wpContributions: [
              { customer: "Acme Corp", wpId: "WP1", allocatedMH: 5 },
              { customer: "Beta Inc", wpId: "WP2", allocatedMH: 3 },
            ],
          },
        ],
      }),
    ];
    const contracts = [
      makeContract({
        id: 1,
        customerId: 100,
        mode: "MINIMUM_FLOOR",
        lines: [makeLine({ id: 1, shiftId: 1, allocatedMh: 10 })],
      }),
      makeContract({
        id: 2,
        customerId: 200,
        mode: "ADDITIVE",
        lines: [makeLine({ id: 2, shiftId: 1, allocatedMh: 4 })],
      }),
    ];

    const result = applyAllocations(demand, contracts, shifts, cm);
    const dayShift = result[0].byShift.find((s) => s.shiftCode === "DAY")!;
    // Acme: max(5, 10) = 10 → delta 5
    // Beta: 3 + 4 = 7 → delta 4
    // Total shift delta = 9, original = 8, new = 17
    expect(dayShift.demandMH).toBe(17);
    expect(dayShift.allocatedDemandMH).toBe(17);
  });

  // ── wpContributions contract delta propagation ──

  it("adds synthetic wpContribution for MINIMUM_FLOOR delta", () => {
    const demand = [makeDemand()]; // 5 MH on DAY, customer "Acme Corp"
    const contracts = [
      makeContract({ mode: "MINIMUM_FLOOR", lines: [makeLine({ shiftId: 1, allocatedMh: 10 })] }),
    ];
    const result = applyAllocations(demand, contracts, shifts, customerMap);
    const dayShift = result[0].byShift.find((s) => s.shiftCode === "DAY")!;

    // Original WP contribution (5 MH) + synthetic contract entry (delta = 5)
    expect(dayShift.wpContributions).toHaveLength(2);
    const synthetic = dayShift.wpContributions[1];
    expect(synthetic.wpId).toBe(-1);
    expect(synthetic.customer).toBe("Acme Corp");
    expect(synthetic.allocatedMH).toBe(5); // 10 - 5 = 5
    expect(synthetic.mhSource).toBe("contract");
    expect(synthetic.aircraftReg).toBe("");
  });

  it("adds synthetic wpContribution for ADDITIVE delta", () => {
    const demand = [makeDemand()]; // 5 MH on DAY
    const contracts = [
      makeContract({ mode: "ADDITIVE", lines: [makeLine({ shiftId: 1, allocatedMh: 3 })] }),
    ];
    const result = applyAllocations(demand, contracts, shifts, customerMap);
    const dayShift = result[0].byShift.find((s) => s.shiftCode === "DAY")!;

    expect(dayShift.wpContributions).toHaveLength(2);
    const synthetic = dayShift.wpContributions[1];
    expect(synthetic.wpId).toBe(-1);
    expect(synthetic.customer).toBe("Acme Corp");
    expect(synthetic.allocatedMH).toBe(3);
    expect(synthetic.mhSource).toBe("contract");
  });

  it("adds synthetic wpContribution when customer has zero baseline demand", () => {
    const demand = [
      makeDemand({
        byCustomer: {},
        byShift: [{ shiftCode: "DAY", demandMH: 0, wpContributions: [] }],
        totalDemandMH: 0,
        aircraftCount: 0,
      }),
    ];
    const contracts = [
      makeContract({ mode: "MINIMUM_FLOOR", lines: [makeLine({ shiftId: 1, allocatedMh: 10 })] }),
    ];
    const result = applyAllocations(demand, contracts, shifts, customerMap);
    const dayShift = result[0].byShift.find((s) => s.shiftCode === "DAY")!;

    // No original WPs, just the synthetic contract entry
    expect(dayShift.wpContributions).toHaveLength(1);
    expect(dayShift.wpContributions[0]).toEqual({
      wpId: -1,
      aircraftReg: "",
      customer: "Acme Corp",
      allocatedMH: 10,
      mhSource: "contract",
    });
  });

  it("maintains invariant: sum(wpContributions.allocatedMH) === demandMH", () => {
    const cm = new Map<number, string>([
      [100, "Acme Corp"],
      [200, "Beta Inc"],
    ]);
    const demand = [
      makeDemand({
        byCustomer: { "Acme Corp": 5, "Beta Inc": 3 },
        totalDemandMH: 8,
        byShift: [
          {
            shiftCode: "DAY",
            demandMH: 8,
            wpContributions: [
              { customer: "Acme Corp", wpId: "WP1", allocatedMH: 5 },
              { customer: "Beta Inc", wpId: "WP2", allocatedMH: 3 },
            ],
          },
        ],
      }),
    ];
    const contracts = [
      makeContract({
        id: 1,
        customerId: 100,
        mode: "MINIMUM_FLOOR",
        lines: [makeLine({ id: 1, shiftId: 1, allocatedMh: 10 })],
      }),
      makeContract({
        id: 2,
        customerId: 200,
        mode: "ADDITIVE",
        lines: [makeLine({ id: 2, shiftId: 1, allocatedMh: 4 })],
      }),
    ];

    const result = applyAllocations(demand, contracts, shifts, cm);
    const dayShift = result[0].byShift.find((s) => s.shiftCode === "DAY")!;

    const wpSum = dayShift.wpContributions.reduce((sum, wp) => sum + wp.allocatedMH, 0);
    expect(wpSum).toBe(dayShift.demandMH);
  });

  it("does not add synthetic entry when floor is below normal (delta = 0)", () => {
    const demand = [makeDemand()]; // 5 MH on DAY
    const contracts = [
      makeContract({ mode: "MINIMUM_FLOOR", lines: [makeLine({ shiftId: 1, allocatedMh: 3 })] }),
    ];
    const result = applyAllocations(demand, contracts, shifts, customerMap);
    const dayShift = result[0].byShift.find((s) => s.shiftCode === "DAY")!;

    // Floor (3) < normal (5), so no delta, no synthetic entry
    expect(dayShift.wpContributions).toHaveLength(1);
    expect(dayShift.demandMH).toBe(5); // unchanged
  });
});

// ─── validateContract ───────────────────────────────────────────────────────

describe("validateContract", () => {
  it("passes with valid complete data", () => {
    const result = validateContract({
      customerId: 1,
      name: "Q1 Base",
      mode: "ADDITIVE",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-03-31",
      contractedMh: 500,
      periodType: "WEEKLY",
      lines: [{ allocatedMh: 10, dayOfWeek: null }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("requires customerId", () => {
    const result = validateContract({
      name: "Test",
      mode: "ADDITIVE",
      effectiveFrom: "2026-01-01",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("customerId is required");
  });

  it("requires name", () => {
    const result = validateContract({
      customerId: 1,
      name: "",
      mode: "ADDITIVE",
      effectiveFrom: "2026-01-01",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("name is required");
  });

  it("requires effectiveFrom", () => {
    const result = validateContract({ customerId: 1, name: "X", mode: "ADDITIVE" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("effectiveFrom is required");
  });

  it("validates effectiveFrom format", () => {
    const result = validateContract({
      customerId: 1,
      name: "X",
      mode: "ADDITIVE",
      effectiveFrom: "bad",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("effectiveFrom must be YYYY-MM-DD format");
  });

  it("validates effectiveTo >= effectiveFrom", () => {
    const result = validateContract({
      customerId: 1,
      name: "X",
      mode: "ADDITIVE",
      effectiveFrom: "2026-06-01",
      effectiveTo: "2026-01-01",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("effectiveTo must be >= effectiveFrom");
  });

  it("requires mode", () => {
    const result = validateContract({ customerId: 1, name: "X", effectiveFrom: "2026-01-01" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("mode is required");
  });

  it("validates mode value", () => {
    const result = validateContract({
      customerId: 1,
      name: "X",
      mode: "INVALID",
      effectiveFrom: "2026-01-01",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("mode must be ADDITIVE or MINIMUM_FLOOR");
  });

  it("requires periodType when contractedMh is set", () => {
    const result = validateContract({
      customerId: 1,
      name: "X",
      mode: "ADDITIVE",
      effectiveFrom: "2026-01-01",
      contractedMh: 100,
      periodType: null,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("periodType is required when contractedMh is set");
  });

  it("requires contractedMh when periodType is set", () => {
    const result = validateContract({
      customerId: 1,
      name: "X",
      mode: "ADDITIVE",
      effectiveFrom: "2026-01-01",
      contractedMh: null,
      periodType: "WEEKLY",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("contractedMh is required when periodType is set");
  });

  it("allows both contractedMh and periodType null", () => {
    const result = validateContract({
      customerId: 1,
      name: "X",
      mode: "ADDITIVE",
      effectiveFrom: "2026-01-01",
      contractedMh: null,
      periodType: null,
    });
    expect(result.valid).toBe(true);
  });

  it("validates line allocatedMh > 0", () => {
    const result = validateContract({
      customerId: 1,
      name: "X",
      mode: "ADDITIVE",
      effectiveFrom: "2026-01-01",
      lines: [{ allocatedMh: 0, dayOfWeek: null }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("lines[0].allocatedMh must be a positive number");
  });

  it("validates line dayOfWeek range", () => {
    const result = validateContract({
      customerId: 1,
      name: "X",
      mode: "ADDITIVE",
      effectiveFrom: "2026-01-01",
      lines: [{ allocatedMh: 5, dayOfWeek: 7 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("lines[0].dayOfWeek must be 0-6");
  });

  it("validates periodType value", () => {
    const result = validateContract({
      customerId: 1,
      name: "X",
      mode: "ADDITIVE",
      effectiveFrom: "2026-01-01",
      contractedMh: 100,
      periodType: "INVALID",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "periodType must be WEEKLY, MONTHLY, ANNUAL, TOTAL, or PER_EVENT",
    );
  });

  it("accepts PER_EVENT as valid periodType", () => {
    const result = validateContract({
      customerId: 1,
      name: "Aerologic Per-Event",
      mode: "MINIMUM_FLOOR",
      effectiveFrom: "2026-01-01",
      contractedMh: 100,
      periodType: "PER_EVENT",
      lines: [{ allocatedMh: 6, dayOfWeek: null }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("validates contractedMh must be positive", () => {
    const result = validateContract({
      customerId: 1,
      name: "X",
      mode: "ADDITIVE",
      effectiveFrom: "2026-01-01",
      contractedMh: -5,
      periodType: "WEEKLY",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("contractedMh must be a positive number");
  });
});
