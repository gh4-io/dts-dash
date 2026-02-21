/**
 * Flight Events Engine (P2-1)
 *
 * Pure functions for computing coverage windows, concurrency pressure,
 * and validating flight event data. Zero DB imports.
 */

import type {
  FlightEvent,
  FlightEventStatus,
  FlightEventSource,
  EventCoverageWindow,
  ConcurrencyBucket,
  CapacityShift,
} from "@/types";
import { resolveShiftForHour } from "./demand-engine";

// ─── Coverage Window Computation ────────────────────────────────────────────

/**
 * Compute 0-2 coverage windows for a single flight event.
 * - Arrival window: [effectiveArrival, effectiveArrival + arrivalWindowMinutes]
 * - Departure window: [effectiveDeparture - departureWindowMinutes, effectiveDeparture]
 * - Cancelled events produce no windows.
 * - Events without effective arrival/departure skip that window.
 */
export function computeEventWindows(event: FlightEvent): EventCoverageWindow[] {
  if (event.status === "cancelled" || !event.isActive) return [];

  const windows: EventCoverageWindow[] = [];

  // Effective time: actual if available, else scheduled
  const effectiveArrival = event.actualArrival ?? event.scheduledArrival;
  const effectiveDeparture = event.actualDeparture ?? event.scheduledDeparture;

  if (effectiveArrival) {
    const start = new Date(effectiveArrival);
    const end = new Date(start.getTime() + event.arrivalWindowMinutes * 60_000);
    windows.push({
      eventId: event.id,
      aircraftReg: event.aircraftReg,
      customer: event.customer,
      windowType: "arrival",
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes: event.arrivalWindowMinutes,
    });
  }

  if (effectiveDeparture) {
    const end = new Date(effectiveDeparture);
    const start = new Date(end.getTime() - event.departureWindowMinutes * 60_000);
    windows.push({
      eventId: event.id,
      aircraftReg: event.aircraftReg,
      customer: event.customer,
      windowType: "departure",
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes: event.departureWindowMinutes,
    });
  }

  return windows;
}

/**
 * Batch-compute coverage windows for all events, with optional date filter.
 */
export function computeAllEventWindows(
  events: FlightEvent[],
  startDate?: string,
  endDate?: string,
): EventCoverageWindow[] {
  const windows: EventCoverageWindow[] = [];

  for (const event of events) {
    const eventWindows = computeEventWindows(event);
    for (const w of eventWindows) {
      if (startDate && w.endTime < startDate) continue;
      if (endDate) {
        // endDate is YYYY-MM-DD — compare against start of next day
        const endBound = endDate.includes("T") ? endDate : endDate + "T23:59:59.999Z";
        if (w.startTime > endBound) continue;
      }
      windows.push(w);
    }
  }

  return windows;
}

// ─── Coverage Requirements ──────────────────────────────────────────────────

interface CoverageRequirement {
  date: string; // YYYY-MM-DD
  shiftCode: string;
  coverageMinutes: number;
  windowCount: number;
}

/**
 * Aggregate coverage minutes per (date, shift) from coverage windows.
 * Uses resolveShiftForHour to map window times to shifts.
 */
export function computeCoverageRequirements(
  windows: EventCoverageWindow[],
  shifts: CapacityShift[],
): CoverageRequirement[] {
  const map = new Map<string, CoverageRequirement>();

  for (const w of windows) {
    const start = new Date(w.startTime);
    const end = new Date(w.endTime);

    // Walk hour-by-hour through the window
    let current = new Date(start);
    while (current < end) {
      const hour = current.getUTCHours();
      const dateStr = current.toISOString().split("T")[0];
      const shift = resolveShiftForHour(hour, shifts);

      if (shift) {
        const key = `${dateStr}|${shift.code}`;
        // Minutes covered in this hour: min of (remaining window, 60)
        const nextHour = new Date(current);
        nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
        const sliceEnd = nextHour < end ? nextHour : end;
        const sliceStart = current > start ? current : start;
        const minutes = (sliceEnd.getTime() - sliceStart.getTime()) / 60_000;

        const existing = map.get(key);
        if (existing) {
          existing.coverageMinutes += minutes;
          existing.windowCount += 1;
        } else {
          map.set(key, {
            date: dateStr,
            shiftCode: shift.code,
            coverageMinutes: minutes,
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

// ─── Concurrency Pressure ───────────────────────────────────────────────────

/**
 * Compute per-hour aircraft-on-ground count within a date range.
 * An aircraft is "on ground" from effectiveArrival to effectiveDeparture.
 * Returns buckets sorted by hour.
 */
export function computeConcurrencyPressure(
  events: FlightEvent[],
  startDate: string,
  endDate: string,
): ConcurrencyBucket[] {
  // Build on-ground intervals from active, non-cancelled events
  const intervals: Array<{ eventId: number; start: Date; end: Date }> = [];

  for (const event of events) {
    if (event.status === "cancelled" || !event.isActive) continue;

    const arrival = event.actualArrival ?? event.scheduledArrival;
    const departure = event.actualDeparture ?? event.scheduledDeparture;

    if (!arrival || !departure) continue;

    const s = new Date(arrival);
    const e = new Date(departure);
    if (e <= s) continue;

    intervals.push({ eventId: event.id, start: s, end: e });
  }

  if (intervals.length === 0) return [];

  // Generate hourly buckets across the date range
  const rangeStart = new Date(startDate.includes("T") ? startDate : startDate + "T00:00:00.000Z");
  const rangeEnd = new Date(endDate.includes("T") ? endDate : endDate + "T23:59:59.999Z");
  const buckets: ConcurrencyBucket[] = [];

  const current = new Date(rangeStart);
  current.setUTCMinutes(0, 0, 0);

  while (current <= rangeEnd) {
    const hourEnd = new Date(current.getTime() + 3_600_000);
    const eventIds: number[] = [];

    for (const iv of intervals) {
      // Overlaps if interval.start < hourEnd AND interval.end > current
      if (iv.start < hourEnd && iv.end > current) {
        eventIds.push(iv.eventId);
      }
    }

    if (eventIds.length > 0) {
      buckets.push({
        hour: current.toISOString(),
        aircraftCount: eventIds.length,
        eventIds,
      });
    }

    current.setUTCHours(current.getUTCHours() + 1);
  }

  return buckets;
}

// ─── Validation ─────────────────────────────────────────────────────────────

const VALID_STATUSES: FlightEventStatus[] = ["scheduled", "actual", "cancelled"];
const VALID_SOURCES: FlightEventSource[] = ["work_package", "manual", "import"];

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateFlightEvent(data: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!data.aircraftReg || typeof data.aircraftReg !== "string" || !data.aircraftReg.trim()) {
    errors.push("aircraftReg is required");
  }
  if (!data.customer || typeof data.customer !== "string" || !data.customer.trim()) {
    errors.push("customer is required");
  }

  // Status enum
  if (!data.status || !VALID_STATUSES.includes(data.status as FlightEventStatus)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  // Source enum
  if (!data.source || !VALID_SOURCES.includes(data.source as FlightEventSource)) {
    errors.push(`source must be one of: ${VALID_SOURCES.join(", ")}`);
  }

  // Window durations
  if (data.arrivalWindowMinutes !== undefined && data.arrivalWindowMinutes !== null) {
    const n = Number(data.arrivalWindowMinutes);
    if (isNaN(n) || n < 0) {
      errors.push("arrivalWindowMinutes must be a non-negative number");
    }
  }
  if (data.departureWindowMinutes !== undefined && data.departureWindowMinutes !== null) {
    const n = Number(data.departureWindowMinutes);
    if (isNaN(n) || n < 0) {
      errors.push("departureWindowMinutes must be a non-negative number");
    }
  }

  // Datetime fields — check parseability
  const dtFields = [
    "scheduledArrival",
    "actualArrival",
    "scheduledDeparture",
    "actualDeparture",
  ] as const;
  for (const field of dtFields) {
    const val = data[field];
    if (val !== undefined && val !== null && val !== "") {
      const d = new Date(val as string);
      if (isNaN(d.getTime())) {
        errors.push(`${field} is not a valid datetime`);
      }
    }
  }

  // Departure must be after arrival when both effective times are present
  const effArr = (data.actualArrival ?? data.scheduledArrival) as string | undefined | null;
  const effDep = (data.actualDeparture ?? data.scheduledDeparture) as string | undefined | null;
  if (effArr && effDep) {
    const arrDate = new Date(effArr);
    const depDate = new Date(effDep);
    if (!isNaN(arrDate.getTime()) && !isNaN(depDate.getTime()) && depDate <= arrDate) {
      errors.push("effective departure must be after effective arrival");
    }
  }

  return { valid: errors.length === 0, errors };
}
