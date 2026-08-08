// @vitest-environment node
/**
 * MH override decision rules (OI-104).
 *
 * The rule worth pinning hardest is the redundancy one: an override equal to
 * the imported `work_packages.total_mh` must never be stored. It looks harmless
 * — the number is right — but it silently pins the work package, so a later
 * correction to the source data is masked by a value nobody remembers setting.
 */
import { describe, it, expect } from "vitest";
import {
  MAX_OVERRIDE_MH,
  parseMHValue,
  resolveClear,
  resolveSave,
  sameMH,
} from "@/lib/mh-overrides/rules";

describe("parseMHValue", () => {
  it("accepts numbers and numeric strings", () => {
    expect(parseMHValue(8.5)).toEqual({ value: 8.5 });
    expect(parseMHValue(" 8.5 ")).toEqual({ value: 8.5 });
    expect(parseMHValue(0)).toEqual({ value: 0 });
  });

  it.each([null, undefined, "", "   "])("rejects the empty value %p", (raw) => {
    expect(parseMHValue(raw)).toEqual({ error: "Man-hours value is required" });
  });

  it("rejects non-numeric text", () => {
    expect(parseMHValue("eight")).toEqual({ error: '"eight" is not a number' });
  });

  it("rejects negatives and absurd magnitudes", () => {
    expect(parseMHValue(-1)).toEqual({ error: "Man-hours cannot be negative" });
    expect(parseMHValue(MAX_OVERRIDE_MH + 1)).toEqual({
      error: `Man-hours cannot exceed ${MAX_OVERRIDE_MH}`,
    });
  });
});

describe("sameMH", () => {
  it("tolerates REAL round-tripping", () => {
    expect(sameMH(0.1 + 0.2, 0.3)).toBe(true);
    expect(sameMH(8.5, 8.6)).toBe(false);
  });

  it("treats null as its own value", () => {
    expect(sameMH(null, null)).toBe(true);
    expect(sameMH(null, 0)).toBe(false);
  });
});

describe("resolveSave — redundant values", () => {
  it("does not create an override that restates the imported MH", () => {
    const decision = resolveSave({ suppliedMH: 6, importedMH: 6, existingMH: null });

    expect(decision.action).toBe("noop");
    expect(decision.overrideMH).toBeNull();
    expect(decision.redundant).toBe(true);
  });

  it("clears an existing override that has become redundant", () => {
    const decision = resolveSave({ suppliedMH: 6, importedMH: 6, existingMH: 9 });

    expect(decision.action).toBe("clear");
    expect(decision.overrideMH).toBeNull();
    expect(decision.redundant).toBe(true);
  });

  it("still stores the value when the WP has no imported MH", () => {
    const decision = resolveSave({ suppliedMH: 6, importedMH: null, existingMH: null });

    expect(decision.action).toBe("create");
    expect(decision.overrideMH).toBe(6);
    expect(decision.redundant).toBe(false);
  });
});

describe("resolveSave — create / update / unchanged", () => {
  it("creates when no override exists", () => {
    expect(resolveSave({ suppliedMH: 8, importedMH: 3, existingMH: null }).action).toBe("create");
  });

  it("updates when the value differs", () => {
    const decision = resolveSave({ suppliedMH: 8, importedMH: 3, existingMH: 5 });
    expect(decision.action).toBe("update");
    expect(decision.overrideMH).toBe(8);
  });

  it("reports unchanged rather than rewriting the same value", () => {
    const decision = resolveSave({ suppliedMH: 5, importedMH: 3, existingMH: 5 });
    expect(decision.action).toBe("unchanged");
  });

  it("treats zero as a real override, not an absent one", () => {
    const decision = resolveSave({ suppliedMH: 0, importedMH: 3, existingMH: null });
    expect(decision.action).toBe("create");
    expect(decision.overrideMH).toBe(0);
  });
});

describe("resolveSave — minimum-hours transform", () => {
  it("raises a value below the floor and keeps the supplied original", () => {
    const decision = resolveSave({ suppliedMH: 2, importedMH: 9, existingMH: null, minHours: 4 });

    expect(decision.overrideMH).toBe(4);
    expect(decision.suppliedMH).toBe(2);
    expect(decision.minHours).toBe(4);
    expect(decision.minHoursApplied).toBe(true);
  });

  it("leaves a value at or above the floor alone", () => {
    const decision = resolveSave({ suppliedMH: 6, importedMH: 9, existingMH: null, minHours: 4 });

    expect(decision.overrideMH).toBe(6);
    expect(decision.minHoursApplied).toBe(false);
  });

  it("applies the floor before the redundancy check", () => {
    // 2 differs from the imported 4, but the floor raises it onto the imported
    // value — which makes the override redundant after all.
    const decision = resolveSave({ suppliedMH: 2, importedMH: 4, existingMH: null, minHours: 4 });

    expect(decision.redundant).toBe(true);
    expect(decision.action).toBe("noop");
    expect(decision.suppliedMH).toBe(2);
  });
});

describe("resolveClear", () => {
  it("clears an existing override", () => {
    expect(resolveClear(7).action).toBe("clear");
  });

  it("is a no-op when nothing is set", () => {
    expect(resolveClear(null).action).toBe("noop");
  });
});
