/**
 * Shift computation utilities for the Actions system.
 * Pure functions — no React or store dependencies.
 */

export const SHIFT_NAMES = ["Day", "Swing", "Night"] as const;
export type ShiftName = (typeof SHIFT_NAMES)[number];

export const SHIFT_SORT_ORDER: Record<ShiftName, number> = {
  Day: 1,
  Swing: 2,
  Night: 3,
};

/** Shift windows in local hours [start, end). Night wraps midnight. */
const SHIFTS: readonly { name: ShiftName; start: number; end: number }[] = [
  { name: "Day", start: 7, end: 15 },
  { name: "Swing", start: 15, end: 23 },
  { name: "Night", start: 23, end: 31 }, // 31 = 07:00 next day (unwrapped)
];

/** Map a local hour (0–23) to its shift name. */
export function getShiftForHour(hour: number): ShiftName {
  if (hour >= 7 && hour < 15) return "Day";
  if (hour >= 15 && hour < 23) return "Swing";
  return "Night";
}

/** Extract the local hour from an ISO timestamp in the given timezone. */
function localHour(isoTime: string, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(fmt.format(new Date(isoTime)), 10);
}

/**
 * Primary shift = the shift at the arrival time.
 * Used for sort / control-break / group-by (single-value contexts).
 */
export function getPrimaryShift(arrivalIso: string, timezone: string): ShiftName {
  return getShiftForHour(localHour(arrivalIso, timezone));
}

/**
 * Returns all shifts the WP overlaps (aircraft on-ground during any part of that shift).
 * Used for highlight / column-filter (multi-value contexts).
 *
 * Approach: for each calendar day the WP spans, check each shift window
 * for overlap with the on-ground interval [arrivalMs, departureMs).
 */
export function getOverlappingShifts(
  arrivalIso: string,
  departureIso: string,
  timezone: string,
): ShiftName[] {
  const arrivalMs = new Date(arrivalIso).getTime();
  const departureMs = new Date(departureIso).getTime();
  if (departureMs <= arrivalMs) return [getPrimaryShift(arrivalIso, timezone)];

  const matched = new Set<ShiftName>();

  // Get the midnight (start of day) in the target timezone for the arrival date
  const dayFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // Find the first midnight at or before arrival
  const arrivalDateStr = dayFmt.format(new Date(arrivalMs));
  // Parse as timezone-local midnight
  const midnightMs = localMidnightToUtc(arrivalDateStr, timezone);

  // Walk day-by-day, checking each shift window for overlap
  // Safety bound: max 30 days (extremely long ground times)
  const maxDays = Math.min(Math.ceil((departureMs - midnightMs) / 86400000) + 1, 30);

  for (let d = 0; d < maxDays; d++) {
    const dayStart = midnightMs + d * 86400000;

    for (const shift of SHIFTS) {
      const shiftStart = dayStart + shift.start * 3600000;
      const shiftEnd = dayStart + shift.end * 3600000;

      // Overlap check: [arrivalMs, departureMs) ∩ [shiftStart, shiftEnd)
      if (arrivalMs < shiftEnd && departureMs > shiftStart) {
        matched.add(shift.name);
      }
    }

    // Early exit if all 3 shifts already matched
    if (matched.size === 3) break;

    // Stop if we've passed the departure
    if (dayStart + 31 * 3600000 > departureMs) break;
  }

  return [...matched];
}

/**
 * Convert a "YYYY-MM-DD" date string (representing midnight in the given timezone)
 * to a UTC millisecond timestamp.
 */
function localMidnightToUtc(dateStr: string, timezone: string): number {
  // Create a date at UTC midnight, then adjust for timezone offset
  const utcMidnight = new Date(`${dateStr}T00:00:00Z`).getTime();

  // Find the offset: what UTC time corresponds to midnight in this timezone?
  // Use binary-search-free approach: format a known UTC time in the target TZ
  const probe = new Date(utcMidnight);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(probe);

  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

  // If UTC midnight shows as e.g. 19:00 in the TZ, then TZ is UTC-5
  // So TZ midnight = UTC midnight + offset hours
  const offsetMs = (h * 60 + m) * 60000;

  // Adjust: if local time at UTC midnight is > 12, timezone is behind UTC
  // midnight in TZ = UTC midnight + (24h - localHour) if localHour > 12
  // midnight in TZ = UTC midnight - localHour if localHour <= 12
  if (h > 12) {
    return utcMidnight + (24 - h) * 3600000 - m * 60000;
  }
  return utcMidnight - offsetMs;
}
