import { describe, it, expect } from "vitest";

// Test the classification logic directly
function classifyDevice(width: number, maxTouchPoints: number): "phone" | "tablet" | "desktop" {
  const isTouchCapable = maxTouchPoints > 0;

  if (isTouchCapable && width < 768) return "phone";
  if (isTouchCapable && width >= 768 && width < 1280) return "tablet";

  if (width >= 1280) return "desktop";
  if (width >= 768) return "tablet";

  return "desktop";
}

describe("classifyDevice", () => {
  describe("Primary classification (touch + width)", () => {
    it("returns 'phone' for touch + width < 768", () => {
      expect(classifyDevice(375, 5)).toBe("phone");
      expect(classifyDevice(667, 1)).toBe("phone");
      expect(classifyDevice(400, 10)).toBe("phone");
    });

    it("returns 'tablet' for touch + 768 <= width < 1280", () => {
      expect(classifyDevice(768, 5)).toBe("tablet");
      expect(classifyDevice(900, 1)).toBe("tablet");
      expect(classifyDevice(1024, 10)).toBe("tablet");
      expect(classifyDevice(1279, 5)).toBe("tablet");
    });

    it("returns 'desktop' for touch + width >= 1280", () => {
      expect(classifyDevice(1280, 5)).toBe("desktop");
      expect(classifyDevice(1920, 1)).toBe("desktop");
      expect(classifyDevice(2560, 10)).toBe("desktop");
    });
  });

  describe("Fallback classification (width-only, no touch)", () => {
    it("returns 'desktop' for no touch + width >= 1280", () => {
      expect(classifyDevice(1280, 0)).toBe("desktop");
      expect(classifyDevice(1920, 0)).toBe("desktop");
    });

    it("returns 'tablet' for no touch + 768 <= width < 1280", () => {
      expect(classifyDevice(768, 0)).toBe("tablet");
      expect(classifyDevice(900, 0)).toBe("tablet");
      expect(classifyDevice(1024, 0)).toBe("tablet");
      expect(classifyDevice(1279, 0)).toBe("tablet");
    });

    it("returns 'desktop' for no touch + width < 768 (fallback to desktop, NOT phone)", () => {
      expect(classifyDevice(500, 0)).toBe("desktop");
      expect(classifyDevice(375, 0)).toBe("desktop");
      expect(classifyDevice(667, 0)).toBe("desktop");
    });
  });

  describe("Edge cases", () => {
    it("handles exact boundary at 768", () => {
      expect(classifyDevice(768, 5)).toBe("tablet");
      expect(classifyDevice(768, 0)).toBe("tablet");
    });

    it("handles exact boundary at 1280", () => {
      expect(classifyDevice(1280, 5)).toBe("desktop");
      expect(classifyDevice(1280, 0)).toBe("desktop");
      expect(classifyDevice(1279, 5)).toBe("tablet");
      expect(classifyDevice(1279, 0)).toBe("tablet");
    });

    it("handles very small widths", () => {
      expect(classifyDevice(0, 5)).toBe("phone");
      expect(classifyDevice(0, 0)).toBe("desktop");
      expect(classifyDevice(1, 5)).toBe("phone");
    });

    it("handles very large widths", () => {
      expect(classifyDevice(10000, 5)).toBe("desktop");
      expect(classifyDevice(10000, 0)).toBe("desktop");
    });
  });

  describe("Touch capability variations", () => {
    it("treats any maxTouchPoints > 0 as touch-capable", () => {
      expect(classifyDevice(375, 1)).toBe("phone");
      expect(classifyDevice(375, 5)).toBe("phone");
      expect(classifyDevice(375, 10)).toBe("phone");
      expect(classifyDevice(375, 100)).toBe("phone");
    });

    it("treats maxTouchPoints === 0 as not touch-capable", () => {
      expect(classifyDevice(375, 0)).toBe("desktop");
      expect(classifyDevice(1024, 0)).toBe("tablet");
    });
  });
});
