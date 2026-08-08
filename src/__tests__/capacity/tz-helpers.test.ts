import { describe, it, expect } from "vitest";
import {
  getLocalHour,
  getLocalDateStr,
  toLocalDateStr,
  buildDayGrid,
  isValidTimezone,
} from "@/lib/capacity/tz-helpers";

describe("getLocalHour", () => {
  it("returns UTC hour for timezone UTC", () => {
    const d = new Date("2026-03-10T14:00:00.000Z");
    expect(getLocalHour(d, "UTC")).toBe(14);
  });

  it("returns Eastern hour during EST (UTC-5)", () => {
    // January is EST (UTC-5): UTC 14:00 = EST 09:00
    const d = new Date("2026-01-15T14:00:00.000Z");
    expect(getLocalHour(d, "America/New_York")).toBe(9);
  });

  it("returns Eastern hour during EDT (UTC-4)", () => {
    // July is EDT (UTC-4): UTC 14:00 = EDT 10:00
    const d = new Date("2026-07-15T14:00:00.000Z");
    expect(getLocalHour(d, "America/New_York")).toBe(10);
  });

  it("handles midnight UTC correctly", () => {
    const d = new Date("2026-01-15T00:00:00.000Z");
    expect(getLocalHour(d, "UTC")).toBe(0);
  });

  it("handles late UTC → previous Eastern day", () => {
    // UTC 04:00 Jan 16 = EST 23:00 Jan 15
    const d = new Date("2026-01-16T04:00:00.000Z");
    expect(getLocalHour(d, "America/New_York")).toBe(23);
  });
});

describe("getLocalDateStr", () => {
  it("returns ISO date for UTC timezone", () => {
    const d = new Date("2026-03-10T14:30:00.000Z");
    expect(getLocalDateStr(d, "UTC")).toBe("2026-03-10");
  });

  it("returns same date when within same day in Eastern", () => {
    // UTC 14:00 Jan 15 = EST 09:00 Jan 15
    const d = new Date("2026-01-15T14:00:00.000Z");
    expect(getLocalDateStr(d, "America/New_York")).toBe("2026-01-15");
  });

  it("returns previous day in Eastern for late UTC time", () => {
    // UTC 04:00 Jan 16 = EST 23:00 Jan 15
    const d = new Date("2026-01-16T04:00:00.000Z");
    expect(getLocalDateStr(d, "America/New_York")).toBe("2026-01-15");
  });

  it("handles midnight UTC boundary", () => {
    const d = new Date("2026-01-15T00:00:00.000Z");
    expect(getLocalDateStr(d, "UTC")).toBe("2026-01-15");
  });

  it("returns next day in Eastern for early UTC after midnight", () => {
    // UTC 05:00 = EST 00:00 same day (midnight)
    const d = new Date("2026-01-15T05:00:00.000Z");
    expect(getLocalDateStr(d, "America/New_York")).toBe("2026-01-15");
  });
});

describe("isValidTimezone", () => {
  it("accepts UTC", () => {
    expect(isValidTimezone("UTC")).toBe(true);
  });

  it("accepts America/New_York", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
  });

  it("accepts America/Chicago", () => {
    expect(isValidTimezone("America/Chicago")).toBe(true);
  });

  it("rejects invalid timezone", () => {
    expect(isValidTimezone("Not/A/Timezone")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidTimezone("")).toBe(false);
  });

  it("rejects partial timezone", () => {
    expect(isValidTimezone("Eastern")).toBe(false);
  });
});

// ─── toLocalDateStr ────────────────────────────────────────────────────────

describe("toLocalDateStr", () => {
  it("passes a date-only string through untouched", () => {
    // Reading it as midnight UTC would shift it a day west of Greenwich
    expect(toLocalDateStr("2026-08-01", "America/New_York")).toBe("2026-08-01");
    expect(toLocalDateStr("2026-08-01", "UTC")).toBe("2026-08-01");
  });

  it("resolves an instant to the calendar date on the given clock", () => {
    // 2026-08-01T00:00Z is still 2026-07-31 19:00 in Eastern
    expect(toLocalDateStr("2026-08-01T00:00:00.000Z", "UTC")).toBe("2026-08-01");
    expect(toLocalDateStr("2026-08-01T00:00:00.000Z", "America/New_York")).toBe("2026-07-31");
  });

  it("falls back to the leading date segment for an unparseable value", () => {
    expect(toLocalDateStr("not-a-date", "UTC")).toBe("not-a-date");
  });
});

// ─── buildDayGrid ──────────────────────────────────────────────────────────

describe("buildDayGrid", () => {
  it("produces different day buckets for UTC and Eastern over the same range", () => {
    const start = "2026-08-01T00:00:00.000Z";
    const end = "2026-08-03T00:00:00.000Z";

    expect(buildDayGrid(start, end, "UTC")).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
    expect(buildDayGrid(start, end, "America/New_York")).toEqual([
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  it("keeps one bucket per calendar day across the spring-forward transition", () => {
    // US DST begins 2026-03-08; the 8th is a 23-hour day in Eastern
    const grid = buildDayGrid(
      "2026-03-07T05:00:00.000Z", // 2026-03-07 00:00 EST
      "2026-03-10T04:00:00.000Z", // 2026-03-10 00:00 EDT
      "America/New_York",
    );
    expect(grid).toEqual(["2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"]);
  });

  it("keeps one bucket per calendar day across the fall-back transition", () => {
    // US DST ends 2026-11-01; the 1st is a 25-hour day in Eastern
    const grid = buildDayGrid(
      "2026-10-31T04:00:00.000Z", // 2026-10-31 00:00 EDT
      "2026-11-03T05:00:00.000Z", // 2026-11-03 00:00 EST
      "America/New_York",
    );
    expect(grid).toEqual(["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"]);
  });

  it("treats date-only bounds as calendar dates in every timezone", () => {
    expect(buildDayGrid("2026-08-01", "2026-08-02", "America/New_York")).toEqual([
      "2026-08-01",
      "2026-08-02",
    ]);
    expect(buildDayGrid("2026-08-01", "2026-08-02", "UTC")).toEqual(["2026-08-01", "2026-08-02"]);
  });

  it("returns a single day when both bounds land on the same date", () => {
    expect(buildDayGrid("2026-08-01T06:00:00.000Z", "2026-08-01T18:00:00.000Z", "UTC")).toEqual([
      "2026-08-01",
    ]);
  });

  it("returns an empty grid for an inverted range", () => {
    expect(buildDayGrid("2026-08-05", "2026-08-01", "UTC")).toEqual([]);
  });
});
