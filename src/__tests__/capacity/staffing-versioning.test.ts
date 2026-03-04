/**
 * Tests for staffing shift versioning utilities:
 * - alignRotationStartToSunday()
 * - canArchiveShift()
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { alignRotationStartToSunday, canArchiveShift } from "@/lib/capacity/staffing-engine";

// ─── alignRotationStartToSunday ─────────────────────────────────────────────

describe("alignRotationStartToSunday", () => {
  it("returns same date when already Sunday", () => {
    // 2026-01-04 is a Sunday
    expect(alignRotationStartToSunday("2026-01-04")).toBe("2026-01-04");
  });

  it("aligns Monday to previous Sunday", () => {
    // 2026-01-05 is Monday → should align to 2026-01-04 (Sunday)
    expect(alignRotationStartToSunday("2026-01-05")).toBe("2026-01-04");
  });

  it("aligns Saturday to previous Sunday", () => {
    // 2026-01-10 is Saturday → should align to 2026-01-04 (Sunday)
    expect(alignRotationStartToSunday("2026-01-10")).toBe("2026-01-04");
  });

  it("aligns Wednesday to previous Sunday", () => {
    // 2026-01-07 is Wednesday → should align to 2026-01-04 (Sunday)
    expect(alignRotationStartToSunday("2026-01-07")).toBe("2026-01-04");
  });

  it("handles Jan 1 mid-week (crosses year boundary)", () => {
    // 2025-01-01 is Wednesday → should align to 2024-12-29 (Sunday)
    expect(alignRotationStartToSunday("2025-01-01")).toBe("2024-12-29");
  });
});

// ─── canArchiveShift ────────────────────────────────────────────────────────

describe("canArchiveShift", () => {
  // Fix "today" so tests are deterministic
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const target = { id: 1, configId: 1, category: "DAY" };

  it("returns safe:false when only shift in category", () => {
    const all = [{ id: 1, configId: 1, category: "DAY", isActive: true, rotationEndDate: null }];
    const result = canArchiveShift(target, all);
    expect(result.safe).toBe(false);
    expect(result.message).toContain("No active DAY replacement");
  });

  it("returns safe:true when active replacement exists (no end date)", () => {
    const all = [
      { id: 1, configId: 1, category: "DAY", isActive: true, rotationEndDate: null },
      { id: 2, configId: 1, category: "DAY", isActive: true, rotationEndDate: null },
    ];
    const result = canArchiveShift(target, all);
    expect(result.safe).toBe(true);
  });

  it("returns safe:false when replacement has past end date", () => {
    const all = [
      { id: 1, configId: 1, category: "DAY", isActive: true, rotationEndDate: null },
      { id: 2, configId: 1, category: "DAY", isActive: true, rotationEndDate: "2026-03-01" },
    ];
    const result = canArchiveShift(target, all);
    expect(result.safe).toBe(false);
  });

  it("returns safe:true when replacement has future end date", () => {
    const all = [
      { id: 1, configId: 1, category: "DAY", isActive: true, rotationEndDate: null },
      { id: 2, configId: 1, category: "DAY", isActive: true, rotationEndDate: "2026-12-31" },
    ];
    const result = canArchiveShift(target, all);
    expect(result.safe).toBe(true);
  });

  it("returns safe:false when replacement is different category", () => {
    const all = [
      { id: 1, configId: 1, category: "DAY", isActive: true, rotationEndDate: null },
      { id: 2, configId: 1, category: "NIGHT", isActive: true, rotationEndDate: null },
    ];
    const result = canArchiveShift(target, all);
    expect(result.safe).toBe(false);
  });

  it("returns safe:false when replacement is different configId", () => {
    const all = [
      { id: 1, configId: 1, category: "DAY", isActive: true, rotationEndDate: null },
      { id: 2, configId: 2, category: "DAY", isActive: true, rotationEndDate: null },
    ];
    const result = canArchiveShift(target, all);
    expect(result.safe).toBe(false);
  });

  it("returns safe:false when replacement is inactive", () => {
    const all = [
      { id: 1, configId: 1, category: "DAY", isActive: true, rotationEndDate: null },
      { id: 2, configId: 1, category: "DAY", isActive: false, rotationEndDate: null },
    ];
    const result = canArchiveShift(target, all);
    expect(result.safe).toBe(false);
  });
});
