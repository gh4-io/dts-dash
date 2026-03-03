/**
 * Event Attribution Engine (G-10)
 *
 * Pure functions for attributing flight event coverage to individual customers.
 * Mirrors computeCoverageRequirements() but keyed by (date, shift, customer).
 *
 * Zero DB imports — all inputs are plain typed objects.
 */

import type {
  EventCoverageWindow,
  CapacityShift,
  FlightEvent,
  CustomerCoverageAggregate,
  CustomerEventSummary,
} from "@/types";
import { resolveShiftForHour } from "./demand-engine";

/**
 * Aggregate coverage minutes per (date, shift, customer) from coverage windows.
 * Same hour-by-hour walk as computeCoverageRequirements() but with an extra customer dimension.
 */
export function aggregateCoverageByCustomer(
  windows: EventCoverageWindow[],
  shifts: CapacityShift[],
  nonOperatingShifts?: Map<string, Set<string>>,
): CustomerCoverageAggregate[] {
  const map = new Map<string, CustomerCoverageAggregate>();

  for (const w of windows) {
    const start = new Date(w.startTime);
    const end = new Date(w.endTime);

    // Walk hour-by-hour through the window
    let current = new Date(start);
    while (current < end) {
      const hour = current.getUTCHours();
      const dateStr = current.toISOString().split("T")[0];

      // Filter out non-operating shifts for this date
      const nonOp = nonOperatingShifts?.get(dateStr);
      const availableShifts = nonOp ? shifts.filter((s) => !nonOp.has(s.code)) : shifts;

      const shift = resolveShiftForHour(hour, availableShifts);

      if (shift) {
        const key = `${dateStr}|${shift.code}|${w.customer}`;
        // Minutes covered in this hour slice
        const nextHour = new Date(current);
        nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
        const sliceEnd = nextHour < end ? nextHour : end;
        const sliceStart = current > start ? current : start;
        const minutes = (sliceEnd.getTime() - sliceStart.getTime()) / 60_000;

        const existing = map.get(key);
        if (existing) {
          existing.coverageMinutes += minutes;
          existing.coverageMH = existing.coverageMinutes / 60;
          existing.windowCount += 1;
        } else {
          map.set(key, {
            date: dateStr,
            shiftCode: shift.code,
            customer: w.customer,
            coverageMinutes: minutes,
            coverageMH: minutes / 60,
            windowCount: 1,
          });
        }
      }

      // Advance to next hour boundary
      current = new Date(current);
      current.setUTCHours(current.getUTCHours() + 1, 0, 0, 0);
    }
  }

  return Array.from(map.values());
}

/**
 * Summarize events by customer — counts + total coverage MH.
 * Filters to active, non-cancelled events only.
 */
export function summarizeEventsByCustomer(events: FlightEvent[]): CustomerEventSummary[] {
  const map = new Map<string, CustomerEventSummary>();

  for (const e of events) {
    if (!e.isActive || e.status === "cancelled") continue;

    const existing = map.get(e.customer);
    if (existing) {
      existing.eventCount += 1;
    } else {
      map.set(e.customer, {
        customer: e.customer,
        eventCount: 1,
        totalCoverageMH: 0,
        windowCount: 0,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Build a date → customer → total coverage MH lookup map.
 * Useful for table/chart rendering of per-customer breakdown.
 */
export function buildCustomerCoverageMap(
  aggregates: CustomerCoverageAggregate[],
): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>();

  for (const agg of aggregates) {
    let dateEntry = map.get(agg.date);
    if (!dateEntry) {
      dateEntry = {};
      map.set(agg.date, dateEntry);
    }
    dateEntry[agg.customer] = (dateEntry[agg.customer] ?? 0) + agg.coverageMH;
  }

  return map;
}
