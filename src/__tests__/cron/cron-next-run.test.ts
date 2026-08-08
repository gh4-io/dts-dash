/**
 * Next-run calculation for the admin UI (OI-105).
 *
 * "Next run" is only useful if it is right — an approximate value is worse
 * than none, because it is exactly the kind of reassurance an administrator
 * would act on. Times are evaluated in the server's local zone, matching
 * node-cron, so these tests build their expectations the same way.
 */
import { describe, it, expect } from "vitest";
import { cronIntervalMs, nextCronRun } from "@/lib/utils/cron-helpers";

/** Local-time Date, mirroring how node-cron interprets an expression */
function local(y: number, m: number, d: number, h: number, min: number): Date {
  return new Date(y, m - 1, d, h, min, 0, 0);
}

describe("nextCronRun", () => {
  it("finds the next daily run later the same day", () => {
    const from = local(2026, 8, 7, 9, 15);
    expect(nextCronRun("0 23 * * *", from)).toEqual(local(2026, 8, 7, 23, 0));
  });

  it("rolls over to tomorrow once today's run has passed", () => {
    const from = local(2026, 8, 7, 23, 30);
    expect(nextCronRun("0 23 * * *", from)).toEqual(local(2026, 8, 8, 23, 0));
  });

  it("handles step expressions (every 6 hours)", () => {
    const from = local(2026, 8, 7, 7, 30);
    expect(nextCronRun("0 */6 * * *", from)).toEqual(local(2026, 8, 7, 12, 0));
  });

  it("handles minute steps", () => {
    const from = local(2026, 8, 7, 7, 31);
    expect(nextCronRun("*/15 * * * *", from)).toEqual(local(2026, 8, 7, 7, 45));
  });

  it("is exclusive of `from` — a run happening right now is not the next one", () => {
    const from = local(2026, 8, 7, 23, 0);
    expect(nextCronRun("0 23 * * *", from)).toEqual(local(2026, 8, 8, 23, 0));
  });

  it("handles day-of-week schedules", () => {
    // 2026-08-07 is a Friday; the next Monday is the 10th
    const from = local(2026, 8, 7, 12, 0);
    expect(nextCronRun("30 4 * * 1", from)).toEqual(local(2026, 8, 10, 4, 30));
  });

  it("treats day-of-week 7 as Sunday", () => {
    const from = local(2026, 8, 7, 12, 0);
    expect(nextCronRun("0 5 * * 7", from)).toEqual(local(2026, 8, 9, 5, 0));
  });

  it("fires when either day-of-month or day-of-week matches, as standard cron does", () => {
    const from = local(2026, 8, 7, 12, 0);
    // The 15th, or any Monday — Monday the 10th comes first
    expect(nextCronRun("0 1 15 * 1", from)).toEqual(local(2026, 8, 10, 1, 0));
  });

  it("crosses a month boundary", () => {
    const from = local(2026, 8, 31, 23, 59);
    expect(nextCronRun("0 0 1 * *", from)).toEqual(local(2026, 9, 1, 0, 0));
  });

  it("returns null for an invalid expression rather than guessing", () => {
    expect(nextCronRun("not a schedule")).toBeNull();
    expect(nextCronRun("0 0 * *")).toBeNull();
  });

  it("returns null for a date that never occurs", () => {
    expect(nextCronRun("0 0 30 2 *", local(2026, 1, 1, 0, 0))).toBeNull();
  });
});

describe("cronIntervalMs", () => {
  it("derives a daily interval", () => {
    expect(cronIntervalMs("0 0 * * *", local(2026, 8, 7, 12, 0))).toBe(24 * 3_600_000);
  });

  it("derives a six-hourly interval", () => {
    expect(cronIntervalMs("0 */6 * * *", local(2026, 8, 7, 1, 0))).toBe(6 * 3_600_000);
  });

  it("returns null when it cannot be derived", () => {
    expect(cronIntervalMs("garbage")).toBeNull();
  });
});
