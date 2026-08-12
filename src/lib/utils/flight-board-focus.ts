import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

/**
 * The Flight Board "Focus view" — an isolated look at one subject, rendered by
 * the same component as the board itself (`FlightBoardView`).
 *
 * The subject travels as `scope` / `subject` query params and narrows the rows
 * locally. It is deliberately NOT written into the filter store: that is what
 * keeps the board's own state untouched, so the browser Back arrow returns to
 * the board as the user left it rather than to a board the link had rewritten.
 */

export type FocusScope = "aircraft" | "operator";

interface FocusScopeDef {
  /** The link's label AND the page's heading — one string, so they cannot drift. */
  label: (subject: string) => string;
  /** Font Awesome class for the page heading. */
  icon: string;
  /** Narrows the fetched rows to the subject. */
  match: (wp: SerializedWorkPackage, subject: string) => boolean;
}

export const FOCUS_SCOPES: Record<FocusScope, FocusScopeDef> = {
  aircraft: {
    label: (subject) => `All ${subject} visits`,
    icon: "fa-solid fa-plane",
    match: (wp, subject) => wp.aircraftReg === subject,
  },
  operator: {
    label: (subject) => `All ${subject} work packages`,
    icon: "fa-solid fa-building",
    match: (wp, subject) => wp.customer === subject,
  },
};

export const FOCUS_PATH = "/flight-board/focus";

function isFocusScope(value: string | null): value is FocusScope {
  return value !== null && Object.prototype.hasOwnProperty.call(FOCUS_SCOPES, value);
}

/**
 * Builds the Focus href, carrying the caller's current query string through
 * unchanged. That is how the date window is inherited: whatever start/end/tz
 * (and any filters) were active where the link was clicked come along, and the
 * Focus view's own date pickers widen them from there.
 *
 * `carry` is normally `new URLSearchParams(window.location.search)`.
 */
export function focusHref(scope: FocusScope, subject: string, carry?: URLSearchParams): string {
  const params = new URLSearchParams(carry);
  params.set("scope", scope);
  params.set("subject", subject);
  const qs = params.toString();
  return qs ? `${FOCUS_PATH}?${qs}` : FOCUS_PATH;
}

/**
 * Reads the subject back off the URL. Returns null when `scope`/`subject` are
 * missing or `scope` is not one we know — the page renders an empty state for
 * that rather than throwing on a hand-edited URL.
 */
export function parseFocus(params: URLSearchParams): { scope: FocusScope; subject: string } | null {
  const scope = params.get("scope");
  const subject = params.get("subject");
  if (!isFocusScope(scope) || !subject) return null;
  return { scope, subject };
}

/** Session-cache key for a view's remembered mode/zoom. */
export function focusViewKey(focus: { scope: FocusScope; subject: string } | null): string {
  return focus ? `flight-board:focus:${focus.scope}:${focus.subject}` : "flight-board";
}
