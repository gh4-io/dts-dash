import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Sidebar } from "@/components/layout/sidebar";
import * as deviceHook from "@/lib/hooks/use-device-type";

describe("Sidebar Device Responsive Behavior", () => {
  it("renders nothing on phone device type", () => {
    vi.spyOn(deviceHook, "useDeviceType").mockReturnValue({
      type: "phone",
      width: 375,
      height: 667,
      isTouchCapable: true,
      isLandscape: false,
      detectionMethod: "touch+width",
      setDevice: () => {},
    });

    const { container } = render(<Sidebar />);
    const aside = container.querySelector("aside");
    expect(aside).toBeNull();
  });

  it("renders sidebar on tablet device type", () => {
    vi.spyOn(deviceHook, "useDeviceType").mockReturnValue({
      type: "tablet",
      width: 768,
      height: 1024,
      isTouchCapable: true,
      isLandscape: false,
      detectionMethod: "touch+width",
      setDevice: () => {},
    });

    const { container } = render(<Sidebar />);
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
  });

  it("renders sidebar on desktop device type", () => {
    vi.spyOn(deviceHook, "useDeviceType").mockReturnValue({
      type: "desktop",
      width: 1920,
      height: 1080,
      isTouchCapable: false,
      isLandscape: true,
      detectionMethod: "width-only",
      setDevice: () => {},
    });

    const { container } = render(<Sidebar />);
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
  });
});
