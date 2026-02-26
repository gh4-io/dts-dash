/**
 * Flight Events Engine (P2-1)
 *
 * Pure functions for computing coverage windows, concurrency pressure,
 * validating flight event data, and expanding recurring schedules.
 * Zero DB imports.
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
import { getLocalHour, getLocalDateStr, toIsoDayOfWeek } from "./tz-helpers";

// ─── Constants ───────────────────────────────────────────────────────────────

export const VALID_STATUSES: FlightEventStatus[] = ["planned", "scheduled", "actual", "cancelled"];
const VALID_SOURCES: FlightEventSource[] = ["work_package", "manual", "import"];
export const DAY_PATTERN_LENGTH = 7;
export const DAY_PATTERN_REGEX = /^[1-7.]{7}$/;

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
 *
 * @param timezone - IANA timezone for shift hour interpretation (default: "UTC")
 */
export function computeCoverageRequirements(
  windows: EventCoverageWindow[],
  shifts: CapacityShift[],
): CoverageRequirement[] {
  const map = new Map<string, CoverageRequirement>();

  // Read timezone from shift data — engines never accept tz as a parameter (D-049)
  const timezone = shifts[0]?.timezone ?? "UTC";

  for (const w of windows) {
    const start = new Date(w.startTime);
    const end = new Date(w.endTime);

    // Walk hour-by-hour through the window
    let current = new Date(start);
    while (current < end) {
      const hour = getLocalHour(current, timezone);
      const dateStr = getLocalDateStr(current, timezone);
      const jsDay = new Date(dateStr + "T12:00:00Z").getUTCDay();
      const isoDow = toIsoDayOfWeek(jsDay);
      const shift = resolveShiftForHour(hour, shifts, isoDow);

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

// ─── Recurrence Expansion ───────────────────────────────────────────────────

/**
 * Expands a recurring FlightEvent template into concrete single-day instances
 * within [queryStart, queryEnd] (ISO date strings "YYYY-MM-DD").
 * Honors suppressedDates on the template — those dates are skipped.
 * Auto-suppress (flight number + date matching) is handled at the call site.
 */
export function expandRecurringEvent(
  event: FlightEvent,
  queryStart: string,
  queryEnd: string,
): FlightEvent[] {
  if (!event.isRecurring || !event.dayPattern || !event.recurrenceStart || !event.recurrenceEnd) {
    return [];
  }

  const suppressed = new Set(event.suppressedDates ?? []);
  const instances: FlightEvent[] = [];

  const start = new Date(
    Math.max(
      new Date(event.recurrenceStart + "T00:00:00.000Z").getTime(),
      new Date(queryStart + "T00:00:00.000Z").getTime(),
    ),
  );
  const end = new Date(
    Math.min(
      new Date(event.recurrenceEnd + "T00:00:00.000Z").getTime(),
      new Date(queryEnd + "T00:00:00.000Z").getTime(),
    ),
  );

  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor <= end) {
    const dow = cursor.getUTCDay(); // 0=Sun
    const patternIdx = dow === 0 ? 6 : dow - 1; // map to 0=Mon...6=Sun
    const patternChar = event.dayPattern[patternIdx];
    const dateStr = cursor.toISOString().slice(0, 10); // "YYYY-MM-DD"

    if (patternChar !== "." && !suppressed.has(dateStr)) {
      let scheduledArrival: string | null = null;
      let scheduledDeparture: string | null = null;

      if (event.arrivalTimeUtc) {
        scheduledArrival = `${dateStr}T${event.arrivalTimeUtc}:00.000Z`;
      }
      if (event.departureTimeUtc) {
        // Handle cross-midnight: if departure time < arrival time, departure is next day
        let depDate = dateStr;
        if (event.arrivalTimeUtc && event.departureTimeUtc < event.arrivalTimeUtc) {
          const nextDay = new Date(cursor);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          depDate = nextDay.toISOString().slice(0, 10);
        }
        scheduledDeparture = `${depDate}T${event.departureTimeUtc}:00.000Z`;
      }

      instances.push({
        ...event,
        scheduledArrival,
        scheduledDeparture,
        actualArrival: null,
        actualDeparture: null,
        isRecurring: false, // mark as expanded instance
        dayPattern: null,
        recurrenceStart: null,
        recurrenceEnd: null,
        arrivalTimeUtc: null,
        departureTimeUtc: null,
        suppressedDates: [],
      });
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return instances;
}

// ─── Validation ─────────────────────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateFlightEvent(data: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  // Customer is always required
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

  const isRecurring = !!data.isRecurring;

  if (isRecurring) {
    // ── Recurring event validation ───────────────────────────────────────
    // Recurring events must NOT have specific datetime fields
    if (
      data.scheduledArrival ||
      data.actualArrival ||
      data.scheduledDeparture ||
      data.actualDeparture
    ) {
      errors.push("Recurring events must not have specific datetime fields set");
    }

    // dayPattern required and valid
    if (!data.dayPattern || !DAY_PATTERN_REGEX.test(data.dayPattern as string)) {
      errors.push("dayPattern must be a 7-character string (e.g. '12345..')");
    } else if ((data.dayPattern as string).replace(/\./g, "").length === 0) {
      errors.push("dayPattern must have at least one operating day");
    }

    // Date range required
    if (!data.recurrenceStart) errors.push("recurrenceStart is required for recurring events");
    if (!data.recurrenceEnd) errors.push("recurrenceEnd is required for recurring events");
    if (
      data.recurrenceStart &&
      data.recurrenceEnd &&
      (data.recurrenceEnd as string) < (data.recurrenceStart as string)
    ) {
      errors.push("recurrenceEnd must be on or after recurrenceStart");
    }

    // At least one time required
    if (!data.arrivalTimeUtc && !data.departureTimeUtc) {
      errors.push("At least one of arrivalTimeUtc or departureTimeUtc is required");
    }

    // Validate HH:MM format
    const timeRegex = /^\d{2}:\d{2}$/;
    if (data.arrivalTimeUtc && !timeRegex.test(data.arrivalTimeUtc as string)) {
      errors.push("arrivalTimeUtc must be in HH:MM format");
    }
    if (data.departureTimeUtc && !timeRegex.test(data.departureTimeUtc as string)) {
      errors.push("departureTimeUtc must be in HH:MM format");
    }
  } else {
    // ── One-off event validation ─────────────────────────────────────────
    // Recurrence fields must be absent
    if (data.dayPattern || data.recurrenceStart || data.recurrenceEnd) {
      errors.push("Non-recurring events must not have recurrence fields set");
    }

    // aircraftReg required for non-planned one-off events
    if (data.status !== "planned") {
      if (!data.aircraftReg || typeof data.aircraftReg !== "string" || !data.aircraftReg.trim()) {
        errors.push(
          "Aircraft Reg / Flight No. is required for scheduled, actual, and cancelled events",
        );
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
  }

  return { valid: errors.length === 0, errors };
}
