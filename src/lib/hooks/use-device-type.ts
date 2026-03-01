"use client";

import { useEffect } from "react";
import { create } from "zustand";

export interface DeviceContext {
  type: "phone" | "tablet" | "desktop";
  width: number;
  height: number;
  isTouchCapable: boolean;
  isLandscape: boolean;
  detectionMethod: "touch+width" | "width-only";
  setDevice: (ctx: Partial<DeviceContext>) => void;
}

function classifyDevice(width: number, maxTouchPoints: number): "phone" | "tablet" | "desktop" {
  const isTouchCapable = maxTouchPoints > 0;

  // Primary: Touch capability + width
  if (isTouchCapable && width < 768) return "phone";
  if (isTouchCapable && width >= 768 && width < 1280) return "tablet";

  // Fallback: Width only (default to Desktop if width >= 1280)
  if (width >= 1280) return "desktop";
  if (width >= 768) return "tablet";

  // Width < 768 + no touch detected = assume desktop (resized desktop browser)
  return "desktop";
}

const useDeviceTypeStore = create<DeviceContext>()((set) => ({
  type: "desktop",
  width: 1280,
  height: 720,
  isTouchCapable: false,
  isLandscape: false,
  detectionMethod: "width-only",
  setDevice: (ctx) => set(ctx),
}));

// Simple debounce implementation for resize handler
function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null;
  return ((...args: unknown[]) => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

export function useDeviceType(): DeviceContext {
  const device = useDeviceTypeStore();

  useEffect(() => {
    const detect = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isTouchCapable = navigator.maxTouchPoints > 0;
      const type = classifyDevice(width, navigator.maxTouchPoints);
      const isLandscape = width > height;
      const detectionMethod: "touch+width" | "width-only" = isTouchCapable
        ? "touch+width"
        : "width-only";

      // Use getState() to avoid depending on reactive store in the effect
      const current = useDeviceTypeStore.getState();
      // Only update if something actually changed (prevents re-render loops)
      if (
        current.type !== type ||
        current.width !== width ||
        current.height !== height ||
        current.isTouchCapable !== isTouchCapable ||
        current.isLandscape !== isLandscape
      ) {
        current.setDevice({
          type,
          width,
          height,
          isTouchCapable,
          isLandscape,
          detectionMethod,
        });
      }
    };

    // Initial detection
    detect();

    // Listen for resize + orientation change (debounced)
    const debouncedDetect = debounce(detect, 300);
    window.addEventListener("resize", debouncedDetect);
    window.addEventListener("orientationchange", debouncedDetect);

    return () => {
      window.removeEventListener("resize", debouncedDetect);
      window.removeEventListener("orientationchange", debouncedDetect);
    };
  }, []); // Empty deps — runs once on mount, resize/orientation listeners handle updates

  return device;
}
