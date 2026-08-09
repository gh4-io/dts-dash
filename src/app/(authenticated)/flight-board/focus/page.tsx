"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FlightBoardView } from "@/components/flight-board/flight-board-view";
import { EmptyState } from "@/components/shared/empty-state";
import { FOCUS_SCOPES, parseFocus, focusViewKey } from "@/lib/utils/flight-board-focus";

/**
 * The Focus view — an isolated look at one aircraft or operator, reached from
 * the flight detail drawer's links. It is the Flight Board itself, pinned to a
 * subject that lives in the URL rather than in the shared filter store, so the
 * board it was opened from is left untouched and Back returns to it intact.
 */
function FocusPageInner() {
  const searchParams = useSearchParams();
  const focus = parseFocus(new URLSearchParams(searchParams.toString()));

  if (!focus) {
    return (
      <div className="flex flex-col gap-3">
        <Link
          href="/flight-board"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-fit"
        >
          <i className="fa-solid fa-arrow-left" />
          Flight Board
        </Link>
        <EmptyState
          icon="fa-magnifying-glass"
          title="Nothing to focus on"
          message="This view needs a subject to isolate. Open it from an aircraft or operator link in the flight detail panel."
        />
      </div>
    );
  }

  const scope = FOCUS_SCOPES[focus.scope];

  return (
    <FlightBoardView
      title={scope.label(focus.subject)}
      icon={scope.icon}
      viewKey={focusViewKey(focus)}
      focus={focus}
      backHref="/flight-board"
    />
  );
}

export default function FocusPage() {
  return (
    <Suspense fallback={null}>
      <FocusPageInner />
    </Suspense>
  );
}
