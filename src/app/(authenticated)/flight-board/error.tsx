"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function FlightBoardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[FlightBoard] Error:", error);
  }, [error]);

  return (
    <div className="rounded-lg border border-border bg-card p-12 text-center">
      <i className="fa-solid fa-plane-slash text-4xl text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold">Flight Board Error</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset} className="mt-4" size="sm">
        <i className="fa-solid fa-rotate-right mr-1.5" />
        Try Again
      </Button>
    </div>
  );
}
