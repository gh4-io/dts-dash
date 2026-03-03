"use client";

import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";
import { useDeviceType } from "@/lib/hooks/use-device-type";
import type { RefObject } from "react";

interface PrintButtonProps {
  contentRef: RefObject<HTMLDivElement | null>;
  documentTitle?: string;
  onBeforePrint?: () => Promise<void>;
  onAfterPrint?: () => void;
}

export function PrintButton({
  contentRef,
  documentTitle,
  onBeforePrint,
  onAfterPrint,
}: PrintButtonProps) {
  const device = useDeviceType();
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle,
    onBeforePrint,
    onAfterPrint,
  });

  // Hide print button on phone
  if (device.type === "phone") {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-9 gap-1.5 text-xs shrink-0 print-hide"
      onClick={() => handlePrint()}
    >
      <i className="fa-solid fa-print" />
      <span className="hidden sm:inline">Print</span>
    </Button>
  );
}
