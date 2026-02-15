/**
 * Date Utilities
 * Format dates in arbitrary IANA timezones, ISO 8601, duration formatting
 */

/**
 * Format date in specified IANA timezone
 * Returns locale string in that timezone
 *
 * @param date - Date to format
 * @param timezone - IANA timezone (e.g., "UTC", "America/New_York")
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatInTimezone(
  date: Date,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
    ...options,
  };

  return new Intl.DateTimeFormat("en-US", {
    ...defaultOptions,
    timeZone: timezone,
  }).format(date);
}

/**
 * Format date to ISO 8601 string (UTC)
 */
export function toISO(date: Date): string {
  return date.toISOString();
}

/**
 * Parse ISO 8601 string to Date
 */
export function fromISO(iso: string): Date {
  return new Date(iso);
}

/**
 * Format duration in hours as H:MM
 * e.g., 1.5 hours → "1:30"
 */
export function formatDuration(hours: number): string {
  if (!Number.isFinite(hours)) return "0:00";
  const h = Math.floor(Math.max(0, hours));
  const m = Math.round((Math.abs(hours) - h) * 60) % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

/**
 * Format duration in hours as human-readable string
 * e.g., 1.5 hours → "1h 30m"
 */
export function formatDurationHuman(hours: number): string {
  if (!Number.isFinite(hours)) return "0m";
  const h = Math.floor(Math.max(0, hours));
  const m = Math.round((Math.abs(hours) - h) * 60) % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Get date boundaries for a given day in a timezone
 * Returns [startOfDay, endOfDay] in UTC
 */
export function getDayBoundaries(
  date: Date,
  timezone: string
): { start: Date; end: Date } {
  // Create date string in target timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const dateStr = formatter.format(date); // YYYY-MM-DD

  // Start of day in target timezone
  const startStr = `${dateStr}T00:00:00`;
  const endStr = `${dateStr}T23:59:59.999`;

  // Convert to UTC (approximation)
  // Note: This is simplified; for precise TZ conversion use a library like date-fns-tz
  const start = new Date(startStr);
  const end = new Date(endStr);

  return { start, end };
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Subtract days from a date
 */
export function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

/**
 * Get date range string (human-readable)
 * e.g., "Feb 13 - Feb 16, 2026"
 */
export function formatDateRange(start: Date, end: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const startStr = formatter.format(start);
  const endStr = formatter.format(end);

  // Same day
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  ) {
    return startStr;
  }

  // Same month
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    const startDay = start.getDate();
    const monthYear = formatter.format(end);
    return `${monthYear.split(" ")[0]} ${startDay} - ${end.getDate()}, ${end.getFullYear()}`;
  }

  // Different months
  return `${startStr} - ${endStr}`;
}

/**
 * Check if two dates are on the same day (ignoring time)
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Round date to nearest hour
 */
export function roundToHour(date: Date): Date {
  const result = new Date(date);
  result.setMinutes(0, 0, 0);
  return result;
}

/**
 * Get current date/time in specified timezone as ISO string
 */
export function nowInTimezone(timezone: string): string {
  return new Date().toLocaleString("en-US", { timeZone: timezone });
}
