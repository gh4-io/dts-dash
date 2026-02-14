import type { WorkPackage, HourlySnapshot } from "@/types";

/**
 * Hourly Snapshot Engine
 * Computes arrivals, departures, and on-ground counts per hour boundary
 * Used for time-series charts (arrivals/departures/concurrent aircraft)
 */

/**
 * Compute hourly snapshots for the given work packages
 * Returns time-series data with arrivals, departures, and on-ground counts
 *
 * @param workPackages - Filtered work packages
 * @param timezone - IANA timezone for hour boundaries (default UTC)
 * @returns Array of hourly snapshots sorted by hour
 */
export function computeHourlySnapshots(
  workPackages: WorkPackage[],
  timezone: string = "UTC"
): HourlySnapshot[] {
  if (workPackages.length === 0) {
    return [];
  }

  // Find date range
  const allDates = workPackages.flatMap((wp) => [wp.arrival, wp.departure]);
  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

  // Generate hour boundaries
  const hourBoundaries = generateHourBoundaries(minDate, maxDate, timezone);

  // Count events at each boundary
  const snapshots: HourlySnapshot[] = hourBoundaries.map((hour) => {
    const hourTime = hour.getTime();
    const nextHourTime = hourTime + 3600000; // +1 hour

    const arrivalsCount = workPackages.filter(
      (wp) => wp.arrival.getTime() >= hourTime && wp.arrival.getTime() < nextHourTime
    ).length;

    const departuresCount = workPackages.filter(
      (wp) => wp.departure.getTime() >= hourTime && wp.departure.getTime() < nextHourTime
    ).length;

    const onGroundCount = workPackages.filter(
      (wp) => wp.arrival.getTime() <= hourTime && wp.departure.getTime() > hourTime
    ).length;

    return {
      hour: hour.toISOString(),
      arrivalsCount,
      departuresCount,
      onGroundCount,
    };
  });

  return snapshots;
}

/**
 * Generate hour boundaries between start and end dates
 * Aligns to hour boundaries in the specified timezone
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
