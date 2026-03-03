"use client";

import { useDeviceType } from "@/lib/hooks/use-device-type";

interface DeviceTypeHydratorProps {
  children: React.ReactNode;
}

export function DeviceTypeHydrator({ children }: DeviceTypeHydratorProps) {
  // Trigger device detection on mount
  useDeviceType();

  return <>{children}</>;
}
