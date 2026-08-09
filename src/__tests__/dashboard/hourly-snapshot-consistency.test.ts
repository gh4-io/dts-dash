import { describe, it, expect } from "vitest";
import {
  computeHourlySnapshots,
  countArrivalsInHour,
  countDeparturesInHour,
  countOnGroundAtHour,
} from "@/lib/data/engines/hourly-snapshot";
import type { WorkPackage } from "@/types";

/**
 * The dashboard chart is counted twice: once by the engine on the server, and
 * once in the browser so the focused operator and the Actions column filters
 * are honoured. Those two implementations drifted — the client counted "on
 * ground" as overlapping anywhere inside the hour while the engine counted
 * presence at the boundary — so clicking an operator row moved the chart
 * without changing the underlying data. These tests pin the two paths together.
 */

function wp(arrival: string, departure: string): WorkPackage {
  return { arrival: new Date(arrival), departure: new Date(departure) } as WorkPackage;
}

/** What the client receives: the same rows, with the dates serialized. */
function serialize(w: WorkPackage) {
  return { arrival: w.arrival.toISOString(), departure: w.departure.toISOString() };
}

const FIXTURE: WorkPackage[] = [
  // Spans several whole hours — on ground at every boundary it covers.
  wp("2026-08-02T05:00:00Z", "2026-08-02T09:00:00Z"),
  // Arrives and departs strictly inside one hour, touching no boundary.
  wp("2026-08-02T06:10:00Z", "2026-08-02T06:50:00Z"),
  // Arrives mid-hour, so it is not on ground at 07:00 but is at 08:00.
  wp("2026-08-02T07:30:00Z", "2026-08-02T10:15:00Z"),
  // Departs exactly on a boundary — departure is exclusive for on-ground.
  wp("2026-08-02T08:00:00Z", "2026-08-02T09:00:00Z"),
];

const RANGE_START = new Date("2026-08-02T05:00:00Z");
const RANGE_END = new Date("2026-08-02T11:00:00Z");

describe("hourly snapshot — server and client agree", () => {
  it("recounting the engine's output client-side reproduces it exactly", () => {
    const snapshots = computeHourlySnapshots(FIXTURE, "UTC", RANGE_START, RANGE_END);
    const serialized = FIXTURE.map(serialize);

    expect(snapshots.length).toBeGreaterThan(0);

    for (const snapshot of snapshots) {
      const hourStart = new Date(snapshot.hour).getTime();
      expect({
        arrivals: countArrivalsInHour(serialized, hourStart),
        departures: countDeparturesInHour(serialized, hourStart),
        onGround: countOnGroundAtHour(serialized, hourStart),
      }).toEqual({
        arrivals: snapshot.arrivalsCount,
        departures: snapshot.departuresCount,
        onGround: snapshot.onGroundCount,
      });
    }
  });

  it("counts on ground at the boundary, not overlap within the hour", () => {
    const hour = Date.parse("2026-08-02T06:00:00Z");

    // Only the 05:00→09:00 package is present at 06:00 itself. The package that
    // lives entirely inside 06:00–07:00 is the one the old client formula
    // wrongly added — it is the whole reason the two views disagreed.
    expect(countOnGroundAtHour(FIXTURE, hour)).toBe(1);

    const overlapWithinHour = FIXTURE.filter(
      (w) => w.arrival.getTime() < hour + 3_600_000 && w.departure.getTime() > hour,
    ).length;
    expect(overlapWithinHour).toBe(2);
  });

  it("treats a departure landing on the boundary as gone", () => {
    const hour = Date.parse("2026-08-02T09:00:00Z");
    // 05:00→09:00 and 08:00→09:00 have both left; only 07:30→10:15 remains.
    expect(countOnGroundAtHour(FIXTURE, hour)).toBe(1);
  });

  it("counts an arrival in the hour it starts, exclusive of the next", () => {
    expect(countArrivalsInHour(FIXTURE, Date.parse("2026-08-02T07:00:00Z"))).toBe(1);
    expect(countArrivalsInHour(FIXTURE, Date.parse("2026-08-02T08:00:00Z"))).toBe(1);
    expect(countDeparturesInHour(FIXTURE, Date.parse("2026-08-02T09:00:00Z"))).toBe(2);
  });
});
