import { describe, it, expect } from "vitest";
import {
  aggregateCoverageByCustomer,
  summarizeEventsByCustomer,
  buildCustomerCoverageMap,
} from "@/lib/capacity/event-attribution-engine";
import type {
  EventCoverageWindow,
  CapacityShift,
  FlightEvent,
  CustomerCoverageAggregate,
} from "@/types";

// ─── Test Fixtures ─────────────────────────────────────────────────────────

const SHIFTS: CapacityShift[] = [
  {
    id: 1,
    code: "DAY",
    name: "Day",
    startHour: 7,
    endHour: 15,
    paidHours: 8,
    minHeadcount: 8,
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 2,
    code: "SWING",
    name: "Swing",
    startHour: 15,
    endHour: 23,
    paidHours: 8,
    minHeadcount: 6,
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 3,
    code: "NIGHT",
    name: "Night",
    startHour: 23,
    endHour: 7,
    paidHours: 8,
    minHeadcount: 4,
    sortOrder: 3,
    isActive: true,
  },
];

function makeWindow(overrides: Partial<EventCoverageWindow> = {}): EventCoverageWindow {
  return {
    eventId: 1,
    aircraftReg: "N12345",
    customer: "DHL",
    windowType: "arrival",
    startTime: "2026-03-01T10:00:00.000Z",
    endTime: "2026-03-01T10:30:00.000Z",
    durationMinutes: 30,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<FlightEvent> = {}): FlightEvent {
  return {
    id: 1,
    workPackageId: null,
    aircraftReg: "N12345",
    aircraftType: null,
    customer: "DHL",
    scheduledArrival: "2026-03-01T10:00:00.000Z",
    actualArrival: null,
    scheduledDeparture: "2026-03-02T14:00:00.000Z",
    actualDeparture: null,
    arrivalWindowMinutes: 30,
    departureWindowMinutes: 60,
    status: "scheduled",
    source: "manual",
    notes: null,
    isActive: true,
    isRecurring: false,
    dayPattern: null,
    recurrenceStart: null,
    recurrenceEnd: null,
    arrivalTimeUtc: null,
    departureTimeUtc: null,
    suppressedDates: [],
    createdAt: "2026-02-21T00:00:00.000Z",
    updatedAt: "2026-02-21T00:00:00.000Z",
    ...overrides,
  };
}

// ─── aggregateCoverageByCustomer ───────────────────────────────────────────

describe("aggregateCoverageByCustomer", () => {
  it("returns empty array for empty windows", () => {
    expect(aggregateCoverageByCustomer([], SHIFTS)).toEqual([]);
  });

  it("returns empty array for empty shifts", () => {
    const window = makeWindow();
    expect(aggregateCoverageByCustomer([window], [])).toEqual([]);
  });

  it("computes single customer single shift", () => {
    // 30 minutes within DAY shift (10:00-10:30)
    const window = makeWindow({
      startTime: "2026-03-01T10:00:00.000Z",
      endTime: "2026-03-01T10:30:00.000Z",
    });
    const result = aggregateCoverageByCustomer([window], SHIFTS);
    expect(result).toHaveLength(1);
    expect(result[0].customer).toBe("DHL");
    expect(result[0].shiftCode).toBe("DAY");
    expect(result[0].date).toBe("2026-03-01");
    expect(result[0].coverageMinutes).toBe(30);
    expect(result[0].coverageMH).toBeCloseTo(0.5, 5);
    expect(result[0].windowCount).toBe(1);
  });

  it("aggregates multiple windows for same customer+date+shift", () => {
    const w1 = makeWindow({
      eventId: 1,
      startTime: "2026-03-01T08:00:00.000Z",
      endTime: "2026-03-01T09:00:00.000Z",
    });
    const w2 = makeWindow({
      eventId: 2,
      startTime: "2026-03-01T11:00:00.000Z",
      endTime: "2026-03-01T12:00:00.000Z",
    });
    const result = aggregateCoverageByCustomer([w1, w2], SHIFTS);
    expect(result).toHaveLength(1);
    expect(result[0].coverageMinutes).toBe(120); // 60+60
    expect(result[0].coverageMH).toBeCloseTo(2.0, 5);
    expect(result[0].windowCount).toBe(2);
  });

  it("separates different customers on same date+shift", () => {
    const w1 = makeWindow({
      customer: "DHL",
      startTime: "2026-03-01T10:00:00.000Z",
      endTime: "2026-03-01T10:30:00.000Z",
    });
    const w2 = makeWindow({
      customer: "Amazon",
      startTime: "2026-03-01T10:00:00.000Z",
      endTime: "2026-03-01T11:00:00.000Z",
    });
    const result = aggregateCoverageByCustomer([w1, w2], SHIFTS);
    expect(result).toHaveLength(2);
    const dhl = result.find((r) => r.customer === "DHL")!;
    const amz = result.find((r) => r.customer === "Amazon")!;
    expect(dhl.coverageMinutes).toBe(30);
    expect(amz.coverageMinutes).toBe(60);
  });

  it("handles shift boundary crossing (DAY to SWING)", () => {
    // 14:30 to 15:30 — crosses DAY→SWING at 15:00
    const window = makeWindow({
      startTime: "2026-03-01T14:30:00.000Z",
      endTime: "2026-03-01T15:30:00.000Z",
    });
    const result = aggregateCoverageByCustomer([window], SHIFTS);
    expect(result).toHaveLength(2);
    const day = result.find((r) => r.shiftCode === "DAY")!;
    const swing = result.find((r) => r.shiftCode === "SWING")!;
    expect(day.coverageMinutes).toBe(30); // 14:30-15:00
    expect(swing.coverageMinutes).toBe(30); // 15:00-15:30
  });

  it("handles midnight crossing (NIGHT shift)", () => {
    // 23:30 to 00:30 — within NIGHT shift (23-07), crosses midnight
    const window = makeWindow({
      startTime: "2026-03-01T23:30:00.000Z",
      endTime: "2026-03-02T00:30:00.000Z",
    });
    const result = aggregateCoverageByCustomer([window], SHIFTS);
    // Both hour slices resolve to NIGHT, but different dates
    expect(result.length).toBeGreaterThanOrEqual(1);
    const totalMinutes = result.reduce((s, r) => s + r.coverageMinutes, 0);
    expect(totalMinutes).toBe(60);
    // All should be NIGHT shift
    for (const r of result) {
      expect(r.shiftCode).toBe("NIGHT");
    }
  });

  it("produces correct coverageMH (minutes / 60)", () => {
    const window = makeWindow({
      startTime: "2026-03-01T08:00:00.000Z",
      endTime: "2026-03-01T09:30:00.000Z", // 90 minutes
    });
    const result = aggregateCoverageByCustomer([window], SHIFTS);
    expect(result).toHaveLength(1);
    expect(result[0].coverageMinutes).toBe(90);
    expect(result[0].coverageMH).toBeCloseTo(1.5, 5);
  });

  it("handles multiple customers across multiple dates", () => {
    const w1 = makeWindow({
      customer: "DHL",
      startTime: "2026-03-01T10:00:00.000Z",
      endTime: "2026-03-01T11:00:00.000Z",
    });
    const w2 = makeWindow({
      customer: "Amazon",
      startTime: "2026-03-02T10:00:00.000Z",
      endTime: "2026-03-02T11:00:00.000Z",
    });
    const result = aggregateCoverageByCustomer([w1, w2], SHIFTS);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.customer === "DHL")!.date).toBe("2026-03-01");
    expect(result.find((r) => r.customer === "Amazon")!.date).toBe("2026-03-02");
  });
});

// ─── summarizeEventsByCustomer ─────────────────────────────────────────────

describe("summarizeEventsByCustomer", () => {
  it("returns empty array for empty events", () => {
    expect(summarizeEventsByCustomer([])).toEqual([]);
  });

  it("filters out cancelled events", () => {
    const events = [makeEvent({ status: "cancelled" })];
    expect(summarizeEventsByCustomer(events)).toEqual([]);
  });

  it("filters out inactive events", () => {
    const events = [makeEvent({ isActive: false })];
    expect(summarizeEventsByCustomer(events)).toEqual([]);
  });

  it("counts events per customer", () => {
    const events = [
      makeEvent({ id: 1, customer: "DHL" }),
      makeEvent({ id: 2, customer: "DHL" }),
      makeEvent({ id: 3, customer: "Amazon" }),
    ];
    const result = summarizeEventsByCustomer(events);
    expect(result).toHaveLength(2);
    const dhl = result.find((r) => r.customer === "DHL")!;
    const amz = result.find((r) => r.customer === "Amazon")!;
    expect(dhl.eventCount).toBe(2);
    expect(amz.eventCount).toBe(1);
  });

  it("excludes cancelled but keeps other statuses", () => {
    const events = [
      makeEvent({ id: 1, customer: "DHL", status: "scheduled" }),
      makeEvent({ id: 2, customer: "DHL", status: "cancelled" }),
      makeEvent({ id: 3, customer: "DHL", status: "actual" }),
      makeEvent({ id: 4, customer: "DHL", status: "planned" }),
    ];
    const result = summarizeEventsByCustomer(events);
    expect(result).toHaveLength(1);
    expect(result[0].eventCount).toBe(3);
  });
});

// ─── buildCustomerCoverageMap ──────────────────────────────────────────────

describe("buildCustomerCoverageMap", () => {
  it("returns empty map for empty aggregates", () => {
    const result = buildCustomerCoverageMap([]);
    expect(result.size).toBe(0);
  });

  it("builds correct date→customer→MH mapping", () => {
    const aggregates: CustomerCoverageAggregate[] = [
      {
        date: "2026-03-01",
        shiftCode: "DAY",
        customer: "DHL",
        coverageMinutes: 60,
        coverageMH: 1.0,
        windowCount: 1,
      },
      {
        date: "2026-03-01",
        shiftCode: "SWING",
        customer: "DHL",
        coverageMinutes: 120,
        coverageMH: 2.0,
        windowCount: 2,
      },
      {
        date: "2026-03-01",
        shiftCode: "DAY",
        customer: "Amazon",
        coverageMinutes: 30,
        coverageMH: 0.5,
        windowCount: 1,
      },
    ];
    const result = buildCustomerCoverageMap(aggregates);
    expect(result.size).toBe(1);
    const day = result.get("2026-03-01")!;
    expect(day["DHL"]).toBeCloseTo(3.0, 5); // 1.0 + 2.0 across shifts
    expect(day["Amazon"]).toBeCloseTo(0.5, 5);
  });

  it("separates entries by date", () => {
    const aggregates: CustomerCoverageAggregate[] = [
      {
        date: "2026-03-01",
        shiftCode: "DAY",
        customer: "DHL",
        coverageMinutes: 60,
        coverageMH: 1.0,
        windowCount: 1,
      },
      {
        date: "2026-03-02",
        shiftCode: "DAY",
        customer: "DHL",
        coverageMinutes: 120,
        coverageMH: 2.0,
        windowCount: 1,
      },
    ];
    const result = buildCustomerCoverageMap(aggregates);
    expect(result.size).toBe(2);
    expect(result.get("2026-03-01")!["DHL"]).toBeCloseTo(1.0, 5);
    expect(result.get("2026-03-02")!["DHL"]).toBeCloseTo(2.0, 5);
  });
});
