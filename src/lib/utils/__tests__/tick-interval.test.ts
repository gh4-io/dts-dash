import { describe, it, expect } from "vitest";
import {
  computeTickInterval,
  ALLOWED_INTERVALS_MS,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
} from "../tick-interval";

const MS_15MIN = 15 * 60_000;
const MS_30MIN = 30 * 60_000;
const MS_1H = 3_600_000;
const MS_2H = 2 * 3_600_000;
const MS_3H = 3 * 3_600_000;
const MS_6H = 6 * 3_600_000;
const MS_12H = 12 * 3_600_000;
const MS_24H = 24 * 3_600_000;
const MS_48H = 48 * 3_600_000;

describe("computeTickInterval", () => {
  describe("standard scenarios (1080px available, targetMinPx=60)", () => {
    const availablePixels = 1080; // 1200px container - 120 padding

    it("6h visible → picks 30min (spacing ~90px)", () => {
      const result = computeTickInterval({
        availablePixels,
        visibleMs: 6 * MS_1H,
      });
      // 15min: (900K / 21.6M) * 1080 = 45px (too small)
      // 30min: (1.8M / 21.6M) * 1080 = 90px (ok)
      expect(result).toBe(MS_30MIN);
    });

    it("12h visible → picks 1h (spacing 90px)", () => {
      const result = computeTickInterval({
        availablePixels,
        visibleMs: 12 * MS_1H,
      });
      // 30min: (1.8M / 43.2M) * 1080 = 45px (too small)
      // 1h: (3.6M / 43.2M) * 1080 = 90px (ok)
      expect(result).toBe(MS_1H);
    });

    it("24h visible → picks 2h (spacing 90px)", () => {
      const result = computeTickInterval({
        availablePixels,
        visibleMs: 24 * MS_1H,
      });
      // 1h: (3.6M / 86.4M) * 1080 = 45px (too small)
      // 2h: (7.2M / 86.4M) * 1080 = 90px (ok)
      expect(result).toBe(MS_2H);
    });

    it("72h (3d) visible → picks 6h (spacing 90px)", () => {
      const result = computeTickInterval({
        availablePixels,
        visibleMs: 72 * MS_1H,
      });
      // 3h: (10.8M / 259.2M) * 1080 = 45px (too small)
      // 6h: (21.6M / 259.2M) * 1080 = 90px (ok)
      expect(result).toBe(MS_6H);
    });

    it("168h (1w) visible → picks 12h (spacing ~77px)", () => {
      const result = computeTickInterval({
        availablePixels,
        visibleMs: 168 * MS_1H,
      });
      // 6h: (21.6M / 604.8M) * 1080 = 38.6px (too small)
      // 12h: (43.2M / 604.8M) * 1080 = 77.1px (ok)
      expect(result).toBe(MS_12H);
    });

    it("336h (2w) visible → picks 24h (spacing ~77px)", () => {
      const result = computeTickInterval({
        availablePixels,
        visibleMs: 336 * MS_1H,
      });
      expect(result).toBe(MS_24H);
    });
  });

  describe("narrow screen (240px available)", () => {
    const availablePixels = 240; // 360px container - 120 padding

    it("6h visible → picks 2h (spacing 80px)", () => {
      const result = computeTickInterval({
        availablePixels,
        visibleMs: 6 * MS_1H,
      });
      // 15min: (900K / 21.6M) * 240 = 10px
      // 30min: 20px, 1h: 40px, 2h: 80px (ok)
      expect(result).toBe(MS_2H);
    });

    it("24h visible → picks 6h (spacing 60px)", () => {
      const result = computeTickInterval({
        availablePixels,
        visibleMs: 24 * MS_1H,
      });
      // 3h: (10.8M / 86.4M) * 240 = 30px (too small)
      // 6h: (21.6M / 86.4M) * 240 = 60px (ok)
      expect(result).toBe(MS_6H);
    });

    it("168h (1w) visible → picks 48h (spacing ~68.6px)", () => {
      const result = computeTickInterval({
        availablePixels,
        visibleMs: 168 * MS_1H,
      });
      // 24h: (86.4M / 604.8M) * 240 = 34.3px (too small)
      // 48h: (172.8M / 604.8M) * 240 = 68.6px (ok)
      expect(result).toBe(MS_48H);
    });
  });

  describe("wide screen (3720px available)", () => {
    const availablePixels = 3720; // 3840px container - 120 padding

    it("6h visible → picks 15min (spacing ~46.5px → actually 15min=46px, 30min qualifies)", () => {
      const result = computeTickInterval({
        availablePixels,
        visibleMs: 6 * MS_1H,
      });
      // 15min: (900K / 21.6M) * 3720 = 155px (ok!) — finest
      expect(result).toBe(MS_15MIN);
    });

    it("24h visible → picks 1h (spacing 155px)", () => {
      const result = computeTickInterval({
        availablePixels,
        visibleMs: 24 * MS_1H,
      });
      // 30min: (1.8M / 86.4M) * 3720 = 77.5px (ok) — but 15min first?
      // 15min: (900K / 86.4M) * 3720 = 38.75px (too small)
      // 30min: 77.5px (ok)
      expect(result).toBe(MS_30MIN);
    });

    it("168h (1w) visible → picks 3h (spacing ~66.4px)", () => {
      const result = computeTickInterval({
        availablePixels,
        visibleMs: 168 * MS_1H,
      });
      // 2h: (7.2M / 604.8M) * 3720 = 44.3px (too small)
      // 3h: (10.8M / 604.8M) * 3720 = 66.4px (ok)
      expect(result).toBe(MS_3H);
    });
  });

  describe("edge cases", () => {
    it("0 availablePixels → returns 6h fallback", () => {
      expect(computeTickInterval({ availablePixels: 0, visibleMs: MS_24H })).toBe(MS_6H);
    });

    it("negative availablePixels → returns 6h fallback", () => {
      expect(computeTickInterval({ availablePixels: -100, visibleMs: MS_24H })).toBe(MS_6H);
    });

    it("0 visibleMs → returns 6h fallback", () => {
      expect(computeTickInterval({ availablePixels: 1080, visibleMs: 0 })).toBe(MS_6H);
    });

    it("negative visibleMs → returns 6h fallback", () => {
      expect(computeTickInterval({ availablePixels: 1080, visibleMs: -1000 })).toBe(MS_6H);
    });

    it("extremely small visibleMs (1 min) → picks finest (15min)", () => {
      const result = computeTickInterval({
        availablePixels: 1080,
        visibleMs: 60_000, // 1 minute
      });
      // 15min: (900K / 60K) * 1080 = huge → ok
      expect(result).toBe(MS_15MIN);
    });

    it("extremely large visibleMs (90 days) → picks coarsest (48h)", () => {
      const result = computeTickInterval({
        availablePixels: 1080,
        visibleMs: 90 * 24 * MS_1H,
      });
      // 48h on tiny fraction of pixels → all too small except last
      expect(result).toBe(MS_48H);
    });
  });

  describe("min/max clamping", () => {
    it("minIntervalMs restricts finest allowed", () => {
      // Even though 15min would fit, min is set to 1h
      const result = computeTickInterval({
        availablePixels: 3720,
        visibleMs: 6 * MS_1H,
        minIntervalMs: MS_1H,
      });
      expect(result).toBe(MS_1H);
    });

    it("maxIntervalMs restricts coarsest allowed", () => {
      // 90 days visible on small screen — would want 48h but max is 24h
      const result = computeTickInterval({
        availablePixels: 240,
        visibleMs: 90 * 24 * MS_1H,
        maxIntervalMs: MS_24H,
      });
      expect(result).toBe(MS_24H);
    });

    it("custom targetMinPx changes selection", () => {
      // With 1080px and 24h visible:
      // targetMinPx=60 → 2h (90px)
      // targetMinPx=30 → 1h (45px)
      const result = computeTickInterval({
        availablePixels: 1080,
        visibleMs: 24 * MS_1H,
        targetMinPx: 30,
      });
      expect(result).toBe(MS_1H);
    });
  });

  describe("all intervals are reachable", () => {
    // For each allowed interval, construct a scenario where it's selected
    const testCases: [string, number, number, number][] = [
      // [label, availablePixels, visibleMs, expectedInterval]
      ["15min", 3720, 6 * MS_1H, MS_15MIN],
      ["30min", 1080, 6 * MS_1H, MS_30MIN],
      ["1h", 1080, 12 * MS_1H, MS_1H],
      ["2h", 1080, 24 * MS_1H, MS_2H],
      ["3h", 3720, 168 * MS_1H, MS_3H],
      ["6h", 1080, 72 * MS_1H, MS_6H],
      ["12h", 1080, 168 * MS_1H, MS_12H],
      ["24h", 1080, 336 * MS_1H, MS_24H],
      ["48h", 240, 168 * MS_1H, MS_48H],
    ];

    for (const [label, px, vis, expected] of testCases) {
      it(`can select ${label}`, () => {
        const result = computeTickInterval({ availablePixels: px, visibleMs: vis });
        expect(result).toBe(expected);
      });
    }
  });

  describe("constants", () => {
    it("ALLOWED_INTERVALS_MS is sorted ascending", () => {
      for (let i = 1; i < ALLOWED_INTERVALS_MS.length; i++) {
        expect(ALLOWED_INTERVALS_MS[i]).toBeGreaterThan(ALLOWED_INTERVALS_MS[i - 1]);
      }
    });

    it("MIN_INTERVAL_MS is 15 minutes", () => {
      expect(MIN_INTERVAL_MS).toBe(15 * 60_000);
    });

    it("MAX_INTERVAL_MS is 48 hours", () => {
      expect(MAX_INTERVAL_MS).toBe(48 * 3_600_000);
    });
  });
});
