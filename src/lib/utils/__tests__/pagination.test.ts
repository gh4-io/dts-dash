import { describe, it, expect } from "vitest";
import { paginate, parsePaginationParams } from "../pagination";

const items = Array.from({ length: 100 }, (_, i) => i + 1);

describe("paginate", () => {
  it("returns first page by default", () => {
    const result = paginate(items);
    expect(result.data).toHaveLength(30);
    expect(result.data[0]).toBe(1);
    expect(result.meta.page).toBe(1);
    expect(result.meta.pageSize).toBe(30);
    expect(result.meta.total).toBe(100);
    expect(result.meta.totalPages).toBe(4);
    expect(result.meta.hasMore).toBe(true);
  });

  it("returns correct page", () => {
    const result = paginate(items, { page: 2, pageSize: 10 });
    expect(result.data[0]).toBe(11);
    expect(result.data).toHaveLength(10);
    expect(result.meta.page).toBe(2);
  });

  it("returns last page with partial data", () => {
    const result = paginate(items, { page: 4, pageSize: 30 });
    expect(result.data).toHaveLength(10); // 100 - 90
    expect(result.meta.hasMore).toBe(false);
  });

  it("clamps page below 1 to 1", () => {
    const result = paginate(items, { page: -5, pageSize: 10 });
    expect(result.meta.page).toBe(1);
    expect(result.data[0]).toBe(1);
  });

  it("clamps page above totalPages", () => {
    const result = paginate(items, { page: 999, pageSize: 10 });
    expect(result.meta.page).toBe(10);
    expect(result.data[0]).toBe(91);
  });

  it("clamps pageSize to minimum 1", () => {
    const result = paginate(items, { page: 1, pageSize: 0 });
    expect(result.meta.pageSize).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it("clamps pageSize to maximum 200", () => {
    const result = paginate(items, { page: 1, pageSize: 500 });
    expect(result.meta.pageSize).toBe(200);
  });

  it("handles empty array", () => {
    const result = paginate([]);
    expect(result.data).toHaveLength(0);
    expect(result.meta.total).toBe(0);
    expect(result.meta.totalPages).toBe(0);
    expect(result.meta.hasMore).toBe(false);
  });

  it("handles single item", () => {
    const result = paginate([42]);
    expect(result.data).toEqual([42]);
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
    expect(result.meta.hasMore).toBe(false);
  });
});

describe("parsePaginationParams", () => {
  it("parses valid params", () => {
    const params = parsePaginationParams(new URLSearchParams("page=3&pageSize=20"));
    expect(params.page).toBe(3);
    expect(params.pageSize).toBe(20);
  });

  it("returns undefined for missing params", () => {
    const params = parsePaginationParams(new URLSearchParams(""));
    expect(params.page).toBeUndefined();
    expect(params.pageSize).toBeUndefined();
  });

  it("parses NaN strings as NaN", () => {
    const params = parsePaginationParams(new URLSearchParams("page=abc&pageSize=xyz"));
    expect(params.page).toBeNaN();
    expect(params.pageSize).toBeNaN();
  });
});
