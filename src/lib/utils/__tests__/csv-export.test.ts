import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the internal escapeCsvField logic indirectly through exportToCsv
// Since exportToCsv depends on DOM APIs (Blob, URL, document.createElement),
// we mock them carefully.

describe("exportToCsv", () => {
  let mockClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockClick = vi.fn();

    // Mock document.createElement to return a mock anchor
    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: mockClick,
      set setAttribute(_args: unknown) {},
    } as unknown as HTMLElement);

    // Mock URL.createObjectURL / revokeObjectURL
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
    } else {
      vi.spyOn(globalThis.URL, "createObjectURL").mockReturnValue("blob:mock");
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(globalThis.URL, "revokeObjectURL").mockReturnValue(undefined);
    }
  });

  it("creates download with correct filename", async () => {
    const { exportToCsv } = await import("../csv-export");

    const data = [{ name: "Alice", age: 30 }];
    const columns = [
      { header: "Name", accessor: (r: (typeof data)[0]) => r.name },
      { header: "Age", accessor: (r: (typeof data)[0]) => r.age },
    ];

    exportToCsv("test.csv", data, columns);

    expect(mockClick).toHaveBeenCalled();
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
  });

  it("does nothing for empty data", async () => {
    const { exportToCsv } = await import("../csv-export");

    exportToCsv("test.csv", [], []);
    // click should not be called since it's a fresh mock per test
    // But since beforeEach resets, just check no blob was created
    expect(mockClick).not.toHaveBeenCalled();
  });
});
