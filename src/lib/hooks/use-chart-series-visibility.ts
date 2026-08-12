"use client";

import { useCallback, useState } from "react";

/**
 * Tracks which chart series the user has hidden by clicking a legend entry.
 *
 * Keys are opaque strings. A chart typically registers two kinds:
 *   - an entity key  — `shift:DAY`, `customer:Kalitta Air`
 *   - a role key     — `role:demand`, `role:capacity`, `role:utilization`
 *
 * A series is drawn only when none of its keys is hidden, so clicking "Day"
 * removes the Day bar, the Day capacity line and the Day utilization line
 * together, while clicking "Capacity" removes the capacity line of every shift.
 *
 * Pass `resetKey` (e.g. the chart's view mode) to clear hidden state when the
 * set of drawn series changes underneath.
 */
export function useChartSeriesVisibility(resetKey?: string) {
  // Reset during render when the key changes, rather than in an effect — see
  // https://react.dev/learn/you-might-not-need-an-effect
  const [state, setState] = useState<{ key: string | undefined; hidden: Set<string> }>(() => ({
    key: resetKey,
    hidden: new Set(),
  }));
  // React re-runs the render with the new state, so `state.hidden` below is
  // already the cleared set by the time it is read.
  if (state.key !== resetKey) {
    setState({ key: resetKey, hidden: new Set() });
  }
  const hidden = state.hidden;

  const toggle = useCallback((key: string) => {
    setState((prev) => {
      const next = new Set(prev.hidden);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { key: prev.key, hidden: next };
    });
  }, []);

  /** True when ANY of the supplied keys is hidden. */
  const isHidden = useCallback(
    (...keys: (string | null | undefined)[]) =>
      keys.some((k) => k != null && k !== "" && hidden.has(k)),
    [hidden],
  );

  const reset = useCallback(() => setState((prev) => ({ key: prev.key, hidden: new Set() })), []);

  return { hidden, toggle, isHidden, reset };
}
