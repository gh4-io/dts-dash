import { describe, it, expect } from "vitest";
import {
  isValidHex,
  relativeLuminance,
  contrastRatio,
  getContrastText,
  getWCAGLevel,
} from "../contrast";

describe("isValidHex", () => {
  it("accepts valid 6-digit hex", () => {
    expect(isValidHex("#ffffff")).toBe(true);
    expect(isValidHex("#000000")).toBe(true);
    expect(isValidHex("#FF5733")).toBe(true);
    expect(isValidHex("#abcdef")).toBe(true);
  });

  it("rejects invalid hex", () => {
    expect(isValidHex("ffffff")).toBe(false); // no hash
    expect(isValidHex("#fff")).toBe(false); // 3-digit
    expect(isValidHex("#gggggg")).toBe(false); // invalid chars
    expect(isValidHex("#12345")).toBe(false); // 5 digits
    expect(isValidHex("#1234567")).toBe(false); // 7 digits
    expect(isValidHex("")).toBe(false);
  });
});

describe("relativeLuminance", () => {
  it("white = 1.0", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1.0, 2);
  });

  it("black = 0.0", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0.0, 2);
  });

  it("mid-grey is between 0 and 1", () => {
    const lum = relativeLuminance("#808080");
    expect(lum).toBeGreaterThan(0);
    expect(lum).toBeLessThan(1);
  });
});

describe("contrastRatio", () => {
  it("black-on-white = 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("same color = 1:1", () => {
    expect(contrastRatio("#ff0000", "#ff0000")).toBeCloseTo(1, 0);
  });

  it("is commutative", () => {
    const a = contrastRatio("#123456", "#abcdef");
    const b = contrastRatio("#abcdef", "#123456");
    expect(a).toBeCloseTo(b, 5);
  });
});

describe("getContrastText", () => {
  it("returns white for dark backgrounds", () => {
    expect(getContrastText("#000000")).toBe("#ffffff");
    expect(getContrastText("#333333")).toBe("#ffffff");
    expect(getContrastText("#1a1a2e")).toBe("#ffffff");
  });

  it("returns black for light backgrounds", () => {
    expect(getContrastText("#ffffff")).toBe("#000000");
    expect(getContrastText("#f0f0f0")).toBe("#000000");
    expect(getContrastText("#ffff00")).toBe("#000000");
  });
});

describe("getWCAGLevel", () => {
  it("AAA for black on white", () => {
    expect(getWCAGLevel("#ffffff", "#000000")).toBe("AAA");
  });

  it("Fail for similar colors", () => {
    expect(getWCAGLevel("#cccccc", "#dddddd")).toBe("Fail");
  });

  it("AA for moderate contrast", () => {
    // Grey on white: ratio ~4.5-7
    const level = getWCAGLevel("#ffffff", "#767676");
    expect(["AA", "AAA"]).toContain(level);
  });
});
