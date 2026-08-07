import { describe, it, expect } from "vitest";
import { applyColumnFiltersToRecords } from "../data-transforms";

/**
 * The capacity API runs the Columns dialog rules server-side, where
 * arrival/departure are Date objects rather than the ISO strings the client
 * store holds. These cover that projection.
 */
const records = [
  {
    id: 1,
    customer: "Kalitta Air",
    aircraftReg: "N123AA",
    inferredType: "B767",
    status: "Closed",
    groundHours: 12,
    effectiveMH: 10,
    arrival: new Date("2026-08-07T02:00:00Z"),
    departure: new Date("2026-08-07T14:00:00Z"),
  },
  {
    id: 2,
    customer: "Atlas Air",
    aircraftReg: "N456AA",
    inferredType: "B747",
    status: "Open",
    groundHours: 4,
    effectiveMH: 3,
    arrival: new Date("2026-08-08T02:00:00Z"),
    departure: new Date("2026-08-08T06:00:00Z"),
  },
];

describe("applyColumnFiltersToRecords", () => {
  it("returns the input unchanged when there are no rules", () => {
    expect(applyColumnFiltersToRecords(records, [])).toHaveLength(2);
  });

  it("applies a numeric rule", () => {
    const result = applyColumnFiltersToRecords(records, [
      { column: "effectiveMH", operator: ">", value: "5", values: [] },
    ]);
    expect(result.map((r) => r.id)).toEqual([1]);
  });

  it("applies a `not in` rule", () => {
    const result = applyColumnFiltersToRecords(records, [
      { column: "customer", operator: "not in", value: "", values: ["Kalitta Air"] },
    ]);
    expect(result.map((r) => r.id)).toEqual([2]);
  });

  it("ANDs multiple rules", () => {
    const result = applyColumnFiltersToRecords(records, [
      { column: "status", operator: "=", value: "Closed", values: [] },
      { column: "effectiveMH", operator: ">", value: "5", values: [] },
    ]);
    expect(result.map((r) => r.id)).toEqual([1]);
  });

  it("evaluates Date-valued arrival against a date rule", () => {
    const result = applyColumnFiltersToRecords(records, [
      { column: "arrival", operator: ">", value: "2026-08-07T12:00:00Z", values: [] },
    ]);
    expect(result.map((r) => r.id)).toEqual([2]);
  });

  it("resolves the shift rule using the supplied timezone", () => {
    const result = applyColumnFiltersToRecords(
      records,
      [{ column: "shift", operator: "in", value: "", values: ["Night"] }],
      "UTC",
    );
    // Both arrive at 02:00 UTC, which falls in the 23-07 Night shift
    expect(result.map((r) => r.id)).toEqual([1, 2]);
  });
});
