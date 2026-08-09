import type { WorkPackage, HourlySnapshot } from "@/types";

/**
 * Hourly Snapshot Engine
 * Computes arrivals, departures, and on-ground counts per hour boundary
 * Used for time-series charts (arrivals/departures/concurrent aircraft)
 */

/** Anything with an arrival/departure, in either Date or serialized-string form. */
type Occupancy = { arrival: Date | string; departure: Date | string };

const ms = (v: Date | string) => new Date(v).getTime();

/**
 * The single definitions of the three hourly series. They are exported because
 * the dashboard recounts them client-side (to honour the focused operator and
 * the Actions column filters, neither of which the server snapshot knows about)
 * and the two implementations had drifted: the client counted "on ground" as
 * overlapping anywhere inside the hour, the engine as present at the boundary.
 * Clicking an operator therefore changed the chart without changing the data.
 * Both callers now go through these.
 */
export function countArrivalsInHour(wps: readonly Occupancy[], hourStart: number): number {
  const hourEnd = hourStart + 3_600_000;
  return wps.filter((wp) => ms(wp.arrival) >= hourStart && ms(wp.arrival) < hourEnd).length;
}

export function countDeparturesInHour(wps: readonly Occupancy[], hourStart: number): number {
  const hourEnd = hourStart + 3_600_000;
  return wps.filter((wp) => ms(wp.departure) >= hourStart && ms(wp.departure) < hourEnd).length;
}

/** On ground AT the hour boundary — not merely overlapping somewhere inside it. */
export function countOnGroundAtHour(wps: readonly Occupancy[], hourStart: number): number {
  return wps.filter((wp) => ms(wp.arrival) <= hourStart && ms(wp.departure) > hourStart).length;
}

/**
 * Compute hourly snapshots for the given work packages
 * Returns time-series data with arrivals, departures, and on-ground counts
 *
 * @param workPackages - Filtered work packages
 * @param timezone - IANA timezone for hour boundaries (default UTC)
 * @param filterStart - Optional filter start date to clamp chart range
 * @param filterEnd - Optional filter end date to clamp chart range
 * @returns Array of hourly snapshots sorted by hour
 */
export function computeHourlySnapshots(
  workPackages: WorkPackage[],
  timezone: string = "UTC",
  filterStart?: Date,
  filterEnd?: Date,
): HourlySnapshot[] {
  if (workPackages.length === 0) {
    return [];
  }

  // Use filter dates as bounds when provided, otherwise fall back to data range
  let minDate: Date;
  let maxDate: Date;

  if (filterStart && filterEnd) {
    minDate = filterStart;
    maxDate = filterEnd;
  } else {
    const allDates = workPackages.flatMap((wp) => [wp.arrival, wp.departure]);
    minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
  }

  // Generate hour boundaries
  const hourBoundaries = generateHourBoundaries(minDate, maxDate, timezone);

  // Count events at each boundary
  const snapshots: HourlySnapshot[] = hourBoundaries.map((hour) => {
    const hourTime = hour.getTime();

    return {
      hour: hour.toISOString(),
      arrivalsCount: countArrivalsInHour(workPackages, hourTime),
      departuresCount: countDeparturesInHour(workPackages, hourTime),
      onGroundCount: countOnGroundAtHour(workPackages, hourTime),
    };
  });

  return snapshots;
}

/**
 * Generate hour boundaries between start and end dates
 * Aligns to hour boundaries in the specified timezone
 */
function generateHourBoundaries(start: Date, end: Date, _timezone: string): Date[] {
  const boundaries: Date[] = [];

  // Round start down to hour boundary
  const current = new Date(start);
  current.setMinutes(0, 0, 0);

  // Round end up to hour boundary
  const endTime = new Date(end);
  endTime.setMinutes(0, 0, 0);
  if (end.getMinutes() > 0 || end.getSeconds() > 0 || end.getMilliseconds() > 0) {
    endTime.setHours(endTime.getHours() + 1);
  }

  // Generate boundaries
  while (current <= endTime) {
    boundaries.push(new Date(current));
    current.setHours(current.getHours() + 1);
  }

  return boundaries;
}
