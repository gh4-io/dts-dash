/**
 * MH Override Rules (OI-104) — pure decision logic, no database access.
 *
 * `effectiveMH` resolves by priority: manual override > WP MH (if include) >
 * contract PER_EVENT > default MH. An override is a deliberate step *off* that
 * chain, so writing one that merely restates the imported value is noise: it
 * looks like a decision, and it silently pins the WP if the source data later
 * changes. The rules here encode that — a supplied value equal to the imported
 * `work_packages.total_mh` clears the override rather than storing it.
 *
 * Kept free of DB imports so both the API routes and the bulk CSV schema can
 * reach the same verdict, and so it is testable in isolation.
 */

/** Tolerance for comparing man-hour values. REAL columns make exact `===` unsafe. */
const MH_EPSILON = 1e-6;

/** Upper sanity bound — a work package measured in thousands of hours is a typo. */
export const MAX_OVERRIDE_MH = 10000;

export type MHOverrideAction =
  /** No override existed; one was written. */
  | "create"
  /** An override existed with a different value; it was replaced. */
  | "update"
  /** An override existed and was removed (explicitly, or because it was redundant). */
  | "clear"
  /** An override existed with exactly this value; nothing to write. */
  | "unchanged"
  /** No override existed and none is wanted; nothing to write. */
  | "noop";

export interface MHOverrideDecision {
  action: MHOverrideAction;
  /** Value to persist. Null for `clear`, `noop`, and (unchanged) reads. */
  overrideMH: number | null;
  /** The value as supplied, before the minimum-hours transform. */
  suppliedMH: number | null;
  /** Minimum-hours floor that was in force, if any. */
  minHours: number | null;
  /** True when the floor actually raised the supplied value. */
  minHoursApplied: boolean;
  /** True when the resolved value matched the imported WP MH. */
  redundant: boolean;
  /** Human-readable justification, recorded in the audit trail. */
  reason: string;
}

/** Two man-hour values are the same number for override purposes. */
export function sameMH(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < MH_EPSILON;
}

/**
 * Parse and range-check a supplied man-hour value.
 * Returns the number, or an error message suitable for a 400 / row warning.
 */
export function parseMHValue(raw: unknown): { value: number } | { error: string } {
  if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) {
    return { error: "Man-hours value is required" };
  }

  const value = typeof raw === "number" ? raw : Number(String(raw).trim());

  if (!Number.isFinite(value)) {
    return { error: `"${String(raw)}" is not a number` };
  }
  if (value < 0) {
    return { error: "Man-hours cannot be negative" };
  }
  if (value > MAX_OVERRIDE_MH) {
    return { error: `Man-hours cannot exceed ${MAX_OVERRIDE_MH}` };
  }

  return { value };
}

export interface ResolveSaveInput {
  /** Value supplied by the user or CSV row, already parsed. */
  suppliedMH: number;
  /** `work_packages.total_mh` — null when the source never provided one. */
  importedMH: number | null;
  /** Current stored override, or null when none exists. */
  existingMH: number | null;
  /** Optional floor. Values below it are raised; the original is kept for audit. */
  minHours?: number | null;
}

/**
 * Decide what a save request should actually do.
 *
 * Order matters: the minimum-hours floor is applied *first*, so a floor that
 * happens to land on the imported value is still treated as redundant.
 */
export function resolveSave(input: ResolveSaveInput): MHOverrideDecision {
  const { suppliedMH, importedMH, existingMH } = input;
  const minHours = input.minHours ?? null;

  const minHoursApplied =
    minHours !== null && suppliedMH < minHours && !sameMH(suppliedMH, minHours);
  const resolved = minHoursApplied ? (minHours as number) : suppliedMH;

  const base = {
    suppliedMH,
    minHours,
    minHoursApplied,
  };

  // Redundant: the override would restate the imported value. Store nothing,
  // and remove any existing override so a later data change is not masked.
  if (importedMH !== null && sameMH(resolved, importedMH)) {
    return {
      ...base,
      action: existingMH === null ? "noop" : "clear",
      overrideMH: null,
      redundant: true,
      reason:
        existingMH === null
          ? `Matches imported MH (${importedMH}) — no override created`
          : `Matches imported MH (${importedMH}) — redundant override cleared`,
    };
  }

  if (existingMH !== null && sameMH(existingMH, resolved)) {
    return {
      ...base,
      action: "unchanged",
      overrideMH: resolved,
      redundant: false,
      reason: `Override already set to ${resolved}`,
    };
  }

  return {
    ...base,
    action: existingMH === null ? "create" : "update",
    overrideMH: resolved,
    redundant: false,
    reason: minHoursApplied
      ? `Raised from ${suppliedMH} to the ${minHours} MH minimum`
      : `Override set to ${resolved}`,
  };
}

/** Decide what an explicit clear request should do. */
export function resolveClear(existingMH: number | null): MHOverrideDecision {
  return {
    action: existingMH === null ? "noop" : "clear",
    overrideMH: null,
    suppliedMH: null,
    minHours: null,
    minHoursApplied: false,
    redundant: false,
    reason:
      existingMH === null
        ? "No override to clear"
        : `Override of ${existingMH} cleared — priority chain restored`,
  };
}

/** True when the decision requires a database write. */
export function isWrite(decision: MHOverrideDecision): boolean {
  return (
    decision.action === "create" || decision.action === "update" || decision.action === "clear"
  );
}
