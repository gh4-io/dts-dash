/**
 * Tests for computeEffectiveMH — the 4-level priority chain.
 *
 * Priority: manual override > WP MH (if include) > contract PER_EVENT > default MH
 */
import { computeEffectiveMH } from "@/lib/data/transformer";

const DEFAULT_MH = 3.0;

describe("computeEffectiveMH", () => {
  describe("priority 1: manual override", () => {
    it("returns manual override when present", () => {
      const result = computeEffectiveMH(5.0, 2.0, true, DEFAULT_MH, "include", 4.0);
      expect(result).toEqual({ effectiveMH: 5.0, mhSource: "manual" });
    });

    it("returns manual override even when zero", () => {
      // manualOverride !== null is the check, so 0 should still win
      const result = computeEffectiveMH(0, 2.0, true, DEFAULT_MH, "include", 4.0);
      expect(result).toEqual({ effectiveMH: 0, mhSource: "manual" });
    });
  });

  describe("priority 2: WP MH", () => {
    it("returns WP MH when include mode + hasWorkpackage + wpMH > 0", () => {
      const result = computeEffectiveMH(null, 2.5, true, DEFAULT_MH, "include", 4.0);
      expect(result).toEqual({ effectiveMH: 2.5, mhSource: "workpackage" });
    });

    it("skips WP MH when mode is exclude", () => {
      const result = computeEffectiveMH(null, 2.5, true, DEFAULT_MH, "exclude", 4.0);
      expect(result).toEqual({ effectiveMH: 4.0, mhSource: "contract" });
    });

    it("skips WP MH when hasWorkpackage is false", () => {
      const result = computeEffectiveMH(null, 2.5, false, DEFAULT_MH, "include", 4.0);
      expect(result).toEqual({ effectiveMH: 4.0, mhSource: "contract" });
    });

    it("skips WP MH when wpMH is null", () => {
      const result = computeEffectiveMH(null, null, true, DEFAULT_MH, "include", 4.0);
      expect(result).toEqual({ effectiveMH: 4.0, mhSource: "contract" });
    });

    it("skips WP MH when wpMH is 0", () => {
      const result = computeEffectiveMH(null, 0, true, DEFAULT_MH, "include", 4.0);
      expect(result).toEqual({ effectiveMH: 4.0, mhSource: "contract" });
    });
  });

  describe("priority 3: contract PER_EVENT MH", () => {
    it("returns contract MH when no manual override or valid WP MH", () => {
      const result = computeEffectiveMH(null, null, false, DEFAULT_MH, "include", 6.5);
      expect(result).toEqual({ effectiveMH: 6.5, mhSource: "contract" });
    });

    it("skips contract MH when null", () => {
      const result = computeEffectiveMH(null, null, false, DEFAULT_MH, "include", null);
      expect(result).toEqual({ effectiveMH: DEFAULT_MH, mhSource: "default" });
    });

    it("skips contract MH when 0", () => {
      const result = computeEffectiveMH(null, null, false, DEFAULT_MH, "include", 0);
      expect(result).toEqual({ effectiveMH: DEFAULT_MH, mhSource: "default" });
    });

    it("skips contract MH when negative", () => {
      const result = computeEffectiveMH(null, null, false, DEFAULT_MH, "include", -1);
      expect(result).toEqual({ effectiveMH: DEFAULT_MH, mhSource: "default" });
    });
  });

  describe("priority 4: default MH", () => {
    it("returns default MH when nothing else matches", () => {
      const result = computeEffectiveMH(null, null, false, DEFAULT_MH, "include", null);
      expect(result).toEqual({ effectiveMH: DEFAULT_MH, mhSource: "default" });
    });

    it("returns default MH with custom value", () => {
      const result = computeEffectiveMH(null, null, false, 5.0, "include", null);
      expect(result).toEqual({ effectiveMH: 5.0, mhSource: "default" });
    });
  });

  describe("full priority chain", () => {
    it("manual wins when all values present", () => {
      const result = computeEffectiveMH(10.0, 8.0, true, DEFAULT_MH, "include", 6.0);
      expect(result).toEqual({ effectiveMH: 10.0, mhSource: "manual" });
    });

    it("WP MH wins when manual is null", () => {
      const result = computeEffectiveMH(null, 8.0, true, DEFAULT_MH, "include", 6.0);
      expect(result).toEqual({ effectiveMH: 8.0, mhSource: "workpackage" });
    });

    it("contract wins when manual and WP MH are null", () => {
      const result = computeEffectiveMH(null, null, true, DEFAULT_MH, "include", 6.0);
      expect(result).toEqual({ effectiveMH: 6.0, mhSource: "contract" });
    });

    it("default wins when everything else is null/invalid", () => {
      const result = computeEffectiveMH(null, null, false, DEFAULT_MH, "include", null);
      expect(result).toEqual({ effectiveMH: DEFAULT_MH, mhSource: "default" });
    });
  });

  describe("backwards compatibility", () => {
    it("works without contractMH parameter (defaults to null)", () => {
      const result = computeEffectiveMH(null, null, false, DEFAULT_MH, "include");
      expect(result).toEqual({ effectiveMH: DEFAULT_MH, mhSource: "default" });
    });

    it("original 3-level chain still works (manual > WP > default)", () => {
      expect(computeEffectiveMH(5.0, 2.0, true, DEFAULT_MH, "include")).toEqual({
        effectiveMH: 5.0,
        mhSource: "manual",
      });
      expect(computeEffectiveMH(null, 2.0, true, DEFAULT_MH, "include")).toEqual({
        effectiveMH: 2.0,
        mhSource: "workpackage",
      });
      expect(computeEffectiveMH(null, null, false, DEFAULT_MH, "include")).toEqual({
        effectiveMH: DEFAULT_MH,
        mhSource: "default",
      });
    });
  });
});
