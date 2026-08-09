"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

/** Minimal shape of the View Transition API — `lib.dom` does not ship it in
 *  every TS version we build against, so declare only what we use. */
interface ViewTransitionLike {
  skipTransition: () => void;
  finished: Promise<void>;
}
type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionLike;
};

function canAnimate(): boolean {
  if (typeof window === "undefined") return false;
  if (!(document as DocumentWithViewTransition).startViewTransition) return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Defers a rendering input by one frame and applies it inside a view
 * transition, so the boxes and whitespace that depend on it morph into their
 * new shape instead of snapping.
 *
 * Works for both synchronous changes (clicking an operator to cross-filter)
 * and asynchronous ones (the FilterBar refetching), because it keys off the
 * value itself rather than the event that produced it.
 *
 * `value` must be referentially stable between renders — memoize it — or the
 * effect will fire on every render. Falls back to a plain state update when
 * the browser lacks the API or the user prefers reduced motion.
 */
export function useSmoothUpdate<T>(value: T): T {
  const [shown, setShown] = useState(value);
  const running = useRef<ViewTransitionLike | null>(null);

  // react-hooks/set-state-in-effect is disabled deliberately below. The
  // external system this effect synchronizes with is the browser's view
  // transition: the commit has to happen inside startViewTransition's callback,
  // which only exists here. The extra render is the point — it is the frame the
  // browser snapshots as "before".
  useEffect(() => {
    if (Object.is(shown, value)) return;

    if (!canAnimate()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(value);
      return;
    }

    // A newer value supersedes an in-flight transition; without this the two
    // overlap and the second one captures a half-animated frame.
    running.current?.skipTransition();

    const transition = (document as DocumentWithViewTransition).startViewTransition!(() => {
      // The callback must leave the DOM in its final state before it returns,
      // so the update cannot be batched for later.
      flushSync(() => setShown(value));
    });
    running.current = transition;
    transition.finished.finally(() => {
      if (running.current === transition) running.current = null;
    });
  }, [value, shown]);

  return shown;
}
