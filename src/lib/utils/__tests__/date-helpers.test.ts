import { describe, it, expect } from "vitest";
import {
  formatDuration,
  formatDurationHuman,
  toISO,
  fromISO,
  addDays,
  subtractDays,
  isSameDay,
  roundToHour,
  formatDateRange,
  formatInTimezone,
} from "../date-helpers";

describe("formatDuration", () => {
  it("formats whole hours", () => {
    expect(formatDuration(3)).toBe("3:00");
  });

  it("formats fractional hours", () => {
    expect(formatDuration(1.5)).toBe("1:30");
    expect(formatDuration(2.25)).toBe("2:15");
    expect(formatDuration(0.75)).toBe("0:45");
  });

  it("formats zero", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("handles NaN gracefully", () => {
    expect(formatDuration(NaN)).toBe("0:00");
    expect(formatDuration(Infinity)).toBe("0:00");
    expect(formatDuration(-Infinity)).toBe("0:00");
  });

  it("pads minutes to 2 digits", () => {
    expect(formatDuration(1.083)).toBe("1:05"); // 0.083 * 60 = 4.98 ≈ 5
  });
});

describe("formatDurationHuman", () => {
  it("formats hours and minutes", () => {
    expect(formatDurationHuman(1.5)).toBe("1h 30m");
  });

  it("formats whole hours only", () => {
    expect(formatDurationHuman(3)).toBe("3h");
  });

  it("formats minutes only when less than 1 hour", () => {
    expect(formatDurationHuman(0.5)).toBe("30m");
  });

  it("formats zero as 0m", () => {
    expect(formatDurationHuman(0)).toBe("0m");
  });
});

describe("toISO / fromISO", () => {
  it("round-trips a date", () => {
    const date = new Date("2026-02-15T12:30:00.000Z");
    const iso = toISO(date);
    const parsed = fromISO(iso);
    expect(parsed.getTime()).toBe(date.getTime());
  });

  it("produces ISO 8601 format", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    expect(toISO(date)).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("addDays / subtractDays", () => {
  it("adds days", () => {
    const date = new Date("2026-02-15T00:00:00Z");
    const result = addDays(date, 3);
    expect(result.getUTCDate()).toBe(18);
  });

  it("subtracts days", () => {
    const date = new Date("2026-02-15T00:00:00Z");
    const result = subtractDays(date, 5);
    expect(result.getUTCDate()).toBe(10);
  });

  it("does not mutate original date", () => {
    const date = new Date("2026-02-15T00:00:00Z");
    addDays(date, 10);
    expect(date.getUTCDate()).toBe(15);
  });

  it("handles month boundaries", () => {
    const date = new Date("2026-01-30T00:00:00Z");
    const result = addDays(date, 3);
    expect(result.getUTCMonth()).toBe(1); // February
    expect(result.getUTCDate()).toBe(2);
  });
});

describe("isSameDay", () => {
  it("returns true for same day", () => {
    const a = new Date("2026-02-15T08:00:00Z");
    const b = new Date("2026-02-15T22:00:00Z");
    expect(isSameDay(a, b)).toBe(true);
  });

  it("returns false for different days", () => {
    const a = new Date("2026-02-15T00:00:00Z");
    const b = new Date("2026-02-16T00:00:00Z");
    expect(isSameDay(a, b)).toBe(false);
  });
});

describe("roundToHour", () => {
  it("rounds down to hour", () => {
    const date = new Date("2026-02-15T14:35:22.500Z");
    const result = roundToHour(date);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
    expect(result.getHours()).toBe(date.getHours());
  });

  it("does not mutate original date", () => {
    const date = new Date("2026-02-15T14:35:22Z");
    roundToHour(date);
    expect(date.getMinutes()).toBe(35);
  });
});

describe("formatDateRange", () => {
  it("formats same day", () => {
    const start = new Date("2026-02-15T00:00:00Z");
    const end = new Date("2026-02-15T23:59:59Z");
    const result = formatDateRange(start, end);
    expect(result).toContain("Feb");
    expect(result).toContain("15");
  });

  it("formats different days same month", () => {
    // Use midday to avoid timezone offset shifting the day
    const start = new Date("2026-02-10T12:00:00Z");
    const end = new Date("2026-02-15T12:00:00Z");
    const result = formatDateRange(start, end);
    expect(result).toContain("Feb");
    expect(result).toContain("10");
    expect(result).toContain("15");
  });

  it("formats different months", () => {
    const start = new Date("2026-01-28T00:00:00Z");
    const end = new Date("2026-02-03T00:00:00Z");
    const result = formatDateRange(start, end);
    expect(result).toContain("Jan");
    expect(result).toContain("Feb");
  });
});

describe("formatInTimezone", () => {
  it("formats in UTC", () => {
    const date = new Date("2026-02-15T12:00:00Z");
    const result = formatInTimezone(date, "UTC");
    expect(result).toContain("12:00");
    expect(result).toContain("UTC");
  });

  it("formats in America/New_York", () => {
    const date = new Date("2026-02-15T12:00:00Z");
    const result = formatInTimezone(date, "America/New_York");
    // In Feb, EST = UTC-5, so 12:00 UTC = 07:00 EST
    expect(result).toContain("07:00");
  });
});
