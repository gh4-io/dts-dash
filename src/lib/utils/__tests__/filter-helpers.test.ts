import { describe, it, expect } from "vitest";
import {
  applyFilters,
  buildFilterQuery,
  makeCustomerPredicate,
  parseFilterParams,
  parseColumnFilters,
  serializeColumnFilters,
} from "../filter-helpers";
import type { WorkPackage } from "@/types";

/** Minimal WP fixture — only the fields the entity filters read. */
function wp(overrides: Partial<WorkPackage>): WorkPackage {
  return {
    id: 1,
    documentSetId: 1,
    aircraftReg: "N123AA",
    aircraftId: 1,
    customer: "Kalitta Air",
    flightId: null,
    arrival: new Date("2026-08-07T00:00:00Z"),
    departure: new Date("2026-08-07T12:00:00Z"),
    totalMH: 10,
    groundHours: 12,
    status: "Closed",
    hasWorkpackage: true,
    workpackageNo: null,
    calendarComments: null,
    isActive: true,
    effectiveMH: 10,
    mhSource: "wp",
    manualMHOverride: null,
    inferredType: "B767",
    title: null,
    groundEventTypes: null,
    ...overrides,
  } as WorkPackage;
}

const kalitta = wp({ id: 1, customer: "Kalitta Air" });
const atlas = wp({ id: 2, customer: "Atlas Air", aircraftReg: "N456AA", inferredType: "B747" });
const dhl = wp({ id: 3, customer: "DHL Air UK", aircraftReg: "N789AA", inferredType: "B767" });
const all = [kalitta, atlas, dhl];

describe("applyFilters — exclusions", () => {
  it("drops excluded operators", () => {
    const result = applyFilters(all, { excludeOperators: ["Kalitta Air"] });
    expect(result.map((w) => w.id)).toEqual([2, 3]);
  });

  it("drops excluded aircraft and types", () => {
    expect(applyFilters(all, { excludeAircraft: ["N456AA"] }).map((w) => w.id)).toEqual([1, 3]);
    expect(applyFilters(all, { excludeTypes: ["B767"] }).map((w) => w.id)).toEqual([2]);
  });

  it("applies inclusions first, then exclusions", () => {
    const result = applyFilters(all, {
      operators: ["Kalitta Air", "Atlas Air"],
      excludeOperators: ["Atlas Air"],
    });
    expect(result.map((w) => w.id)).toEqual([1]);
  });

  it("lets an exclusion win over the same value in the inclusion list", () => {
    const result = applyFilters(all, {
      operators: ["Kalitta Air"],
      excludeOperators: ["Kalitta Air"],
    });
    expect(result).toEqual([]);
  });

  it("is a no-op when no exclusions are set", () => {
    expect(applyFilters(all, {})).toHaveLength(3);
  });
});

describe("parseFilterParams / buildFilterQuery", () => {
  it("round-trips inclusions and exclusions", () => {
    const query = buildFilterQuery({
      start: "2026-08-07T00:00:00.000Z",
      end: "2026-08-09T00:00:00.000Z",
      operators: ["Atlas Air"],
      excludeOperators: ["Kalitta Air", "DHL Air UK"],
      excludeAircraft: ["N456AA"],
      excludeTypes: ["B747"],
    });
    const parsed = parseFilterParams(new URLSearchParams(query));

    expect(parsed.operators).toEqual(["Atlas Air"]);
    expect(parsed.excludeOperators).toEqual(["Kalitta Air", "DHL Air UK"]);
    expect(parsed.excludeAircraft).toEqual(["N456AA"]);
    expect(parsed.excludeTypes).toEqual(["B747"]);
  });

  it("omits empty lists from the query", () => {
    const query = buildFilterQuery({ operators: [], excludeOperators: [] });
    expect(query).toEqual({});
  });
});

describe("makeCustomerPredicate", () => {
  it("keeps everything when nothing is filtered", () => {
    const keep = makeCustomerPredicate({});
    expect(keep("Kalitta Air")).toBe(true);
    expect(keep(null)).toBe(true);
  });

  it("drops excluded customers", () => {
    const keep = makeCustomerPredicate({ excludeOperators: ["Kalitta Air"] });
    expect(keep("Kalitta Air")).toBe(false);
    expect(keep("Atlas Air")).toBe(true);
  });

  it("keeps only included customers", () => {
    const keep = makeCustomerPredicate({ operators: ["Atlas Air"] });
    expect(keep("Atlas Air")).toBe(true);
    expect(keep("Kalitta Air")).toBe(false);
  });

  it("drops unattributed rows once an inclusion list exists", () => {
    expect(makeCustomerPredicate({ operators: ["Atlas Air"] })(null)).toBe(false);
    expect(makeCustomerPredicate({ excludeOperators: ["Atlas Air"] })(null)).toBe(true);
  });
});

describe("column filter serialization", () => {
  const rules = [
    { id: "a", column: "effectiveMH", operator: ">", value: "5", values: [] },
    { id: "b", column: "customer", operator: "not in", value: "", values: ["Kalitta Air"] },
  ];

  it("round-trips", () => {
    expect(parseColumnFilters(serializeColumnFilters(rules))).toEqual(rules);
  });

  it("returns [] for missing or malformed input", () => {
    expect(parseColumnFilters(null)).toEqual([]);
    expect(parseColumnFilters("")).toEqual([]);
    expect(parseColumnFilters("not json")).toEqual([]);
    expect(parseColumnFilters('{"column":"customer"}')).toEqual([]);
  });

  it("skips entries missing a column or operator", () => {
    expect(parseColumnFilters('[{"column":"customer"},{"operator":">"}]')).toEqual([]);
  });
});
