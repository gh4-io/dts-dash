"use client";

import { Suspense } from "react";
import { FlightBoardView } from "@/components/flight-board/flight-board-view";

export default function FlightBoardPage() {
  return (
    <Suspense fallback={null}>
      <FlightBoardView
        title="Flight Board"
        icon="fa-solid fa-plane-departure"
        viewKey="flight-board"
      />
    </Suspense>
  );
}
