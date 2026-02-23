import { describe, it, expect } from "vitest";
import { getLocalHour, getLocalDateStr, isValidTimezone } from "@/lib/capacity/tz-helpers";

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
