/**
 * Timezone conversion helpers for capacity shift calculations.
 * Pure functions — zero DB imports.
 */

// Cache formatters to avoid recreating per call
const hourFormatters = new Map<string, Intl.DateTimeFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function getHourFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = hourFormatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    hourFormatters.set(tz, fmt);
  }
  return fmt;
}

function getDateFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = dateFormatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatters.set(tz, fmt);
  }
  return fmt;
}

/**
 * Get the local hour (0-23) for a UTC Date in the given IANA timezone.
 */
export function getLocalHour(utcDate: Date, tz: string): number {
  if (tz === "UTC") return utcDate.getUTCHours();
  // Intl hour12:false returns "24" for midnight in some locales — normalize
  const raw = parseInt(getHourFormatter(tz).format(utcDate), 10);
  return raw === 24 ? 0 : raw;
}

/**
 * Get the local date string (YYYY-MM-DD) for a UTC Date in the given IANA timezone.
 * en-CA locale produces YYYY-MM-DD natively.
 */
export function getLocalDateStr(utcDate: Date, tz: string): string {
  if (tz === "UTC") return utcDate.toISOString().split("T")[0];
  return getDateFormatter(tz).format(utcDate);
}

/**
 * Convert JS day-of-week (0=Sun..6=Sat) to ISO 8601 (1=Mon..7=Sun).
 */
export function toIsoDayOfWeek(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Validate that a timezone string is a valid IANA timezone.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
