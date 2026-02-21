import { describe, it, expect } from "vitest";
import {
  computeEventWindows,
  computeAllEventWindows,
  computeConcurrencyPressure,
  validateFlightEvent,
} from "@/lib/capacity/flight-events-engine";
import type { FlightEvent } from "@/types";

// ─── Test Fixtures ─────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<FlightEvent> = {}): FlightEvent {
  return {
    id: 1,
    workPackageId: null,
    aircraftReg: "N12345",
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
    createdAt: "2026-02-21T00:00:00.000Z",
    updatedAt: "2026-02-21T00:00:00.000Z",
    ...overrides,
  };
}

// ─── computeEventWindows ────────────────────────────────────────────────────

describe("computeEventWindows", () => {
  it("computes arrival and departure windows from scheduled times", () => {
    const event = makeEvent();
    const windows = computeEventWindows(event);

    expect(windows).toHaveLength(2);

    // Arrival window: 10:00 → 10:30
    const arrWin = windows.find((w) => w.windowType === "arrival")!;
    expect(arrWin.startTime).toBe("2026-03-01T10:00:00.000Z");
    expect(arrWin.endTime).toBe("2026-03-01T10:30:00.000Z");
    expect(arrWin.durationMinutes).toBe(30);
    expect(arrWin.aircraftReg).toBe("N12345");
    expect(arrWin.customer).toBe("DHL");

    // Departure window: 13:00 → 14:00
    const depWin = windows.find((w) => w.windowType === "departure")!;
    expect(depWin.startTime).toBe("2026-03-02T13:00:00.000Z");
    expect(depWin.endTime).toBe("2026-03-02T14:00:00.000Z");
    expect(depWin.durationMinutes).toBe(60);
  });

  it("produces only arrival window when no departure time", () => {
    const event = makeEvent({ scheduledDeparture: null });
    const windows = computeEventWindows(event);

    expect(windows).toHaveLength(1);
    expect(windows[0].windowType).toBe("arrival");
  });

  it("produces only departure window when no arrival time", () => {
    const event = makeEvent({ scheduledArrival: null });
    const windows = computeEventWindows(event);

    expect(windows).toHaveLength(1);
    expect(windows[0].windowType).toBe("departure");
  });

  it("produces no windows when no times set", () => {
    const event = makeEvent({
      scheduledArrival: null,
      scheduledDeparture: null,
    });
    const windows = computeEventWindows(event);
    expect(windows).toHaveLength(0);
  });

  it("uses actual times over scheduled when available", () => {
    const event = makeEvent({
      scheduledArrival: "2026-03-01T10:00:00.000Z",
      actualArrival: "2026-03-01T10:15:00.000Z",
      scheduledDeparture: "2026-03-02T14:00:00.000Z",
      actualDeparture: "2026-03-02T13:45:00.000Z",
    });
    const windows = computeEventWindows(event);

    const arrWin = windows.find((w) => w.windowType === "arrival")!;
    expect(arrWin.startTime).toBe("2026-03-01T10:15:00.000Z");
    expect(arrWin.endTime).toBe("2026-03-01T10:45:00.000Z");

    const depWin = windows.find((w) => w.windowType === "departure")!;
    expect(depWin.startTime).toBe("2026-03-02T12:45:00.000Z");
    expect(depWin.endTime).toBe("2026-03-02T13:45:00.000Z");
  });

  it("produces no windows for cancelled events", () => {
    const event = makeEvent({ status: "cancelled" });
    const windows = computeEventWindows(event);
    expect(windows).toHaveLength(0);
  });

  it("produces no windows for inactive events", () => {
    const event = makeEvent({ isActive: false });
    const windows = computeEventWindows(event);
    expect(windows).toHaveLength(0);
  });

  it("respects custom window durations", () => {
    const event = makeEvent({
      arrivalWindowMinutes: 45,
      departureWindowMinutes: 90,
    });
    const windows = computeEventWindows(event);

    const arrWin = windows.find((w) => w.windowType === "arrival")!;
    expect(arrWin.durationMinutes).toBe(45);
    expect(arrWin.endTime).toBe("2026-03-01T10:45:00.000Z");

    const depWin = windows.find((w) => w.windowType === "departure")!;
    expect(depWin.durationMinutes).toBe(90);
    expect(depWin.startTime).toBe("2026-03-02T12:30:00.000Z");
  });

  it("handles zero window durations", () => {
    const event = makeEvent({
      arrivalWindowMinutes: 0,
      departureWindowMinutes: 0,
    });
    const windows = computeEventWindows(event);

    const arrWin = windows.find((w) => w.windowType === "arrival")!;
    expect(arrWin.startTime).toBe(arrWin.endTime);
    expect(arrWin.durationMinutes).toBe(0);
  });

  it("handles overnight arrival windows", () => {
    const event = makeEvent({
      scheduledArrival: "2026-03-01T23:45:00.000Z",
      scheduledDeparture: null,
      arrivalWindowMinutes: 30,
    });
    const windows = computeEventWindows(event);

    expect(windows).toHaveLength(1);
    expect(windows[0].startTime).toBe("2026-03-01T23:45:00.000Z");
    expect(windows[0].endTime).toBe("2026-03-02T00:15:00.000Z");
  });

  it("includes eventId in windows", () => {
    const event = makeEvent({ id: 42 });
    const windows = computeEventWindows(event);
    for (const w of windows) {
      expect(w.eventId).toBe(42);
    }
  });
});

// ─── computeAllEventWindows ─────────────────────────────────────────────────

describe("computeAllEventWindows", () => {
  it("computes windows for multiple events", () => {
    const events = [
      makeEvent({ id: 1, aircraftReg: "N111" }),
      makeEvent({ id: 2, aircraftReg: "N222" }),
    ];
    const windows = computeAllEventWindows(events);
    // 2 events x 2 windows each
    expect(windows).toHaveLength(4);
  });

  it("filters by date range", () => {
    const events = [
      makeEvent({
        id: 1,
        scheduledArrival: "2026-03-01T10:00:00.000Z",
        scheduledDeparture: "2026-03-01T18:00:00.000Z",
      }),
      makeEvent({
        id: 2,
        scheduledArrival: "2026-03-05T10:00:00.000Z",
        scheduledDeparture: "2026-03-05T18:00:00.000Z",
      }),
    ];
    const windows = computeAllEventWindows(events, "2026-03-01", "2026-03-02");
    // Only event 1's windows should be included
    expect(windows.every((w) => w.eventId === 1)).toBe(true);
    expect(windows).toHaveLength(2);
  });

  it("returns empty for empty input", () => {
    const windows = computeAllEventWindows([]);
    expect(windows).toHaveLength(0);
  });

  it("excludes cancelled events", () => {
    const events = [
      makeEvent({ id: 1, status: "cancelled" }),
      makeEvent({ id: 2, status: "scheduled" }),
    ];
    const windows = computeAllEventWindows(events);
    expect(windows.every((w) => w.eventId === 2)).toBe(true);
  });
});

// ─── computeConcurrencyPressure ─────────────────────────────────────────────

describe("computeConcurrencyPressure", () => {
  it("returns empty when no events", () => {
    const buckets = computeConcurrencyPressure([], "2026-03-01", "2026-03-02");
    expect(buckets).toHaveLength(0);
  });

  it("counts a single aircraft on ground", () => {
    const events = [
      makeEvent({
        scheduledArrival: "2026-03-01T10:00:00.000Z",
        scheduledDeparture: "2026-03-01T14:00:00.000Z",
      }),
    ];
    const buckets = computeConcurrencyPressure(events, "2026-03-01", "2026-03-01");

    // 10:00-14:00 = 4 hours of on-ground
    const onGround = buckets.filter((b) => b.aircraftCount > 0);
    expect(onGround.length).toBe(4);
    onGround.forEach((b) => {
      expect(b.aircraftCount).toBe(1);
      expect(b.eventIds).toEqual([1]);
    });
  });

  it("detects overlapping aircraft", () => {
    const events = [
      makeEvent({
        id: 1,
        scheduledArrival: "2026-03-01T10:00:00.000Z",
        scheduledDeparture: "2026-03-01T14:00:00.000Z",
      }),
      makeEvent({
        id: 2,
        scheduledArrival: "2026-03-01T12:00:00.000Z",
        scheduledDeparture: "2026-03-01T16:00:00.000Z",
      }),
    ];
    const buckets = computeConcurrencyPressure(events, "2026-03-01", "2026-03-01");

    // 12:00-14:00 should have 2 aircraft
    const overlapping = buckets.filter((b) => b.aircraftCount === 2);
    expect(overlapping.length).toBe(2);
    overlapping.forEach((b) => {
      expect(b.eventIds).toContain(1);
      expect(b.eventIds).toContain(2);
    });
  });

  it("handles sequential (non-overlapping) events", () => {
    const events = [
      makeEvent({
        id: 1,
        scheduledArrival: "2026-03-01T08:00:00.000Z",
        scheduledDeparture: "2026-03-01T10:00:00.000Z",
      }),
      makeEvent({
        id: 2,
        scheduledArrival: "2026-03-01T12:00:00.000Z",
        scheduledDeparture: "2026-03-01T14:00:00.000Z",
      }),
    ];
    const buckets = computeConcurrencyPressure(events, "2026-03-01", "2026-03-01");
    // No bucket should have more than 1 aircraft
    expect(buckets.every((b) => b.aircraftCount <= 1)).toBe(true);
  });

  it("excludes cancelled events", () => {
    const events = [
      makeEvent({
        id: 1,
        status: "cancelled",
        scheduledArrival: "2026-03-01T10:00:00.000Z",
        scheduledDeparture: "2026-03-01T14:00:00.000Z",
      }),
    ];
    const buckets = computeConcurrencyPressure(events, "2026-03-01", "2026-03-01");
    expect(buckets).toHaveLength(0);
  });

  it("skips events with missing times", () => {
    const events = [
      makeEvent({
        scheduledArrival: "2026-03-01T10:00:00.000Z",
        scheduledDeparture: null,
        actualDeparture: null,
      }),
    ];
    const buckets = computeConcurrencyPressure(events, "2026-03-01", "2026-03-01");
    expect(buckets).toHaveLength(0);
  });

  it("respects date range filter", () => {
    const events = [
      makeEvent({
        scheduledArrival: "2026-03-01T10:00:00.000Z",
        scheduledDeparture: "2026-03-01T14:00:00.000Z",
      }),
    ];
    // Query for a day after the event
    const buckets = computeConcurrencyPressure(events, "2026-03-02", "2026-03-02");
    expect(buckets).toHaveLength(0);
  });

  it("finds peak concurrency across many events", () => {
    const events = [
      makeEvent({
        id: 1,
        scheduledArrival: "2026-03-01T10:00:00.000Z",
        scheduledDeparture: "2026-03-01T16:00:00.000Z",
      }),
      makeEvent({
        id: 2,
        scheduledArrival: "2026-03-01T11:00:00.000Z",
        scheduledDeparture: "2026-03-01T15:00:00.000Z",
      }),
      makeEvent({
        id: 3,
        scheduledArrival: "2026-03-01T12:00:00.000Z",
        scheduledDeparture: "2026-03-01T14:00:00.000Z",
      }),
    ];
    const buckets = computeConcurrencyPressure(events, "2026-03-01", "2026-03-01");

    const peak = Math.max(...buckets.map((b) => b.aircraftCount));
    expect(peak).toBe(3);

    // Peak should be at 12:00-14:00
    const peakBuckets = buckets.filter((b) => b.aircraftCount === 3);
    expect(peakBuckets.length).toBe(2);
  });
});

// ─── validateFlightEvent ────────────────────────────────────────────────────

describe("validateFlightEvent", () => {
  it("validates a complete valid event", () => {
    const result = validateFlightEvent({
      aircraftReg: "N12345",
      customer: "DHL",
      status: "scheduled",
      source: "manual",
      scheduledArrival: "2026-03-01T10:00:00.000Z",
      scheduledDeparture: "2026-03-02T14:00:00.000Z",
      arrivalWindowMinutes: 30,
      departureWindowMinutes: 60,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("requires aircraftReg", () => {
    const result = validateFlightEvent({
      customer: "DHL",
      status: "scheduled",
      source: "manual",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("aircraftReg is required");
  });

  it("requires customer", () => {
    const result = validateFlightEvent({
      aircraftReg: "N12345",
      status: "scheduled",
      source: "manual",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("customer is required");
  });

  it("rejects invalid status enum", () => {
    const result = validateFlightEvent({
      aircraftReg: "N12345",
      customer: "DHL",
      status: "bogus",
      source: "manual",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("status"))).toBe(true);
  });

  it("rejects invalid source enum", () => {
    const result = validateFlightEvent({
      aircraftReg: "N12345",
      customer: "DHL",
      status: "scheduled",
      source: "bogus",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("source"))).toBe(true);
  });

  it("rejects negative window durations", () => {
    const result = validateFlightEvent({
      aircraftReg: "N12345",
      customer: "DHL",
      status: "scheduled",
      source: "manual",
      arrivalWindowMinutes: -10,
      departureWindowMinutes: -5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("arrivalWindowMinutes"))).toBe(true);
    expect(result.errors.some((e) => e.includes("departureWindowMinutes"))).toBe(true);
  });

  it("rejects invalid datetime strings", () => {
    const result = validateFlightEvent({
      aircraftReg: "N12345",
      customer: "DHL",
      status: "scheduled",
      source: "manual",
      scheduledArrival: "not-a-date",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("scheduledArrival"))).toBe(true);
  });

  it("rejects departure <= arrival", () => {
    const result = validateFlightEvent({
      aircraftReg: "N12345",
      customer: "DHL",
      status: "scheduled",
      source: "manual",
      scheduledArrival: "2026-03-02T14:00:00.000Z",
      scheduledDeparture: "2026-03-01T10:00:00.000Z",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("departure must be after"))).toBe(true);
  });

  it("allows null datetime fields", () => {
    const result = validateFlightEvent({
      aircraftReg: "N12345",
      customer: "DHL",
      status: "scheduled",
      source: "manual",
      scheduledArrival: null,
      scheduledDeparture: null,
    });
    expect(result.valid).toBe(true);
  });

  it("collects multiple errors at once", () => {
    const result = validateFlightEvent({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
