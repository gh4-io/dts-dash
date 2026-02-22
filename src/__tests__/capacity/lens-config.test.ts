import { describe, it, expect } from "vitest";
import { CAPACITY_LENSES, getAvailableLenses } from "@/lib/capacity/lens-config";
import type { CapacityOverviewResponse } from "@/types";

describe("CAPACITY_LENSES", () => {
  it("should have exactly 7 lens definitions", () => {
    expect(CAPACITY_LENSES).toHaveLength(7);
  });

  it("should have 'planned' as the first lens", () => {
    expect(CAPACITY_LENSES[0].id).toBe("planned");
  });

  it("should have no duplicate IDs", () => {
    const ids = CAPACITY_LENSES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have all required fields on every lens", () => {
    for (const lens of CAPACITY_LENSES) {
      expect(lens.id).toBeTruthy();
      expect(lens.label).toBeTruthy();
      expect(lens.icon).toBeTruthy();
      expect(lens.color).toBeTruthy();
      expect(lens.description).toBeTruthy();
    }
  });

  it("should contain all expected lens IDs", () => {
    const ids = CAPACITY_LENSES.map((l) => l.id);
    expect(ids).toContain("planned");
    expect(ids).toContain("allocated");
    expect(ids).toContain("events");
    expect(ids).toContain("forecast");
    expect(ids).toContain("worked");
    expect(ids).toContain("billed");
    expect(ids).toContain("concurrent");
  });
});

describe("getAvailableLenses", () => {
  it("should always include 'planned' even with empty data", () => {
    const result = getAvailableLenses({});
    expect(result.has("planned")).toBe(true);
    expect(result.size).toBe(1);
  });

  it("should include 'allocated' when contracts have data", () => {
    const result = getAvailableLenses({
      contracts: [
        { id: 1 } as CapacityOverviewResponse["contracts"] extends (infer T)[] | undefined
          ? T
          : never,
      ],
    });
    expect(result.has("planned")).toBe(true);
    expect(result.has("allocated")).toBe(true);
  });

  it("should NOT include 'allocated' with empty contracts array", () => {
    const result = getAvailableLenses({ contracts: [] });
    expect(result.has("allocated")).toBe(false);
  });

  it("should include 'events' when flightEvents have data", () => {
    const result = getAvailableLenses({
      flightEvents: [{ id: 1 }] as unknown as CapacityOverviewResponse["flightEvents"],
    });
    expect(result.has("events")).toBe(true);
  });

  it("should include 'forecast' when forecastRates have data", () => {
    const result = getAvailableLenses({
      forecastRates: [{ id: 1 }] as unknown as CapacityOverviewResponse["forecastRates"],
    });
    expect(result.has("forecast")).toBe(true);
  });

  it("should include 'worked' when timeBookings have data", () => {
    const result = getAvailableLenses({
      timeBookings: [{ id: 1 }] as unknown as CapacityOverviewResponse["timeBookings"],
    });
    expect(result.has("worked")).toBe(true);
  });

  it("should include 'billed' when billingEntries have data", () => {
    const result = getAvailableLenses({
      billingEntries: [{ id: 1 }] as unknown as CapacityOverviewResponse["billingEntries"],
    });
    expect(result.has("billed")).toBe(true);
  });

  it("should include 'concurrent' when concurrencyBuckets have data", () => {
    const result = getAvailableLenses({
      concurrencyBuckets: [
        { date: "2026-01-01" },
      ] as unknown as CapacityOverviewResponse["concurrencyBuckets"],
    });
    expect(result.has("concurrent")).toBe(true);
  });

  it("should return all 7 lenses when all data is present", () => {
    const result = getAvailableLenses({
      contracts: [{ id: 1 }] as unknown as CapacityOverviewResponse["contracts"],
      flightEvents: [{ id: 1 }] as unknown as CapacityOverviewResponse["flightEvents"],
      forecastRates: [{ id: 1 }] as unknown as CapacityOverviewResponse["forecastRates"],
      timeBookings: [{ id: 1 }] as unknown as CapacityOverviewResponse["timeBookings"],
      billingEntries: [{ id: 1 }] as unknown as CapacityOverviewResponse["billingEntries"],
      concurrencyBuckets: [
        { date: "2026-01-01" },
      ] as unknown as CapacityOverviewResponse["concurrencyBuckets"],
    });
    expect(result.size).toBe(7);
  });

  it("should not include lenses for undefined collections", () => {
    const result = getAvailableLenses({
      contracts: undefined,
      flightEvents: undefined,
    });
    expect(result.size).toBe(1);
    expect(result.has("planned")).toBe(true);
  });
});
