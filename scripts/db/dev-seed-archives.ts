#!/usr/bin/env tsx
/**
 * db:seed-archives — Generate synthetic ARCHIVED staffing shift and rotation
 * pattern versions, so the admin archive UI can be evaluated at realistic scale.
 *
 * Dev only. Every generated row is named with the `[FIXTURE]` prefix, and
 * `--clean` removes exactly those rows and nothing else.
 *
 * Shift versions are attached to the EXISTING shift lineages (group_id), filling
 * the span immediately BEFORE each lineage's earliest real version — so the
 * archive reads like genuine version history without restating any date that a
 * real version already covers.
 *
 * Rotation pattern versions are created in their own new lineages instead. The
 * real patterns all have a NULL effective_from, which `isPatternEffectiveOn`
 * treats as "since the beginning of time"; prepending history to them would
 * require rewriting real rows.
 *
 * Usage: npm run db:seed-archives
 *        npm run db:seed-archives -- --shifts=50 --patterns=50 --months=12
 *        npm run db:seed-archives -- --clean
 *        npm run db:seed-archives -- --yes
 */

import { sqlite } from "../../src/lib/db/client";
import {
  createStaffingShift,
  createRotationPattern,
  loadRotationPatterns,
} from "../../src/lib/capacity/staffing-data";
import { isShiftEffectiveOn, isPatternEffectiveOn } from "../../src/lib/capacity/staffing-engine";
import { banner, log, success, warn, error, confirm } from "./_cli-utils";

const FIXTURE_PREFIX = "[FIXTURE]";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function numArg(name: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const value = Number(arg.slice(name.length + 3));
  if (!Number.isFinite(value) || value < 0) {
    warn(`Invalid --${name} value "${arg}" — using ${fallback}`);
    return fallback;
  }
  return value;
}

function hasFlagArg(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** Shift a YYYY-MM-DD date by whole days (UTC-safe). Mirrors staffing-data.ts. */
function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

/** Evenly split `total` into `buckets` parts, distributing the remainder. */
function split(total: number, buckets: number): number[] {
  const base = Math.floor(total / buckets);
  const extra = total % buckets;
  return Array.from({ length: buckets }, (_, i) => base + (i < extra ? 1 : 0));
}

// ─── Clean ───────────────────────────────────────────────────────────────────

function countFixtures(): { shifts: number; patterns: number } {
  const like = `${FIXTURE_PREFIX}%`;
  const shifts = (
    sqlite.prepare("SELECT COUNT(*) AS n FROM staffing_shifts WHERE name LIKE ?").get(like) as {
      n: number;
    }
  ).n;
  const patterns = (
    sqlite.prepare("SELECT COUNT(*) AS n FROM rotation_patterns WHERE name LIKE ?").get(like) as {
      n: number;
    }
  ).n;
  return { shifts, patterns };
}

async function clean(): Promise<void> {
  const { shifts, patterns } = countFixtures();
  log(`  Fixture shifts:   ${shifts}`);
  log(`  Fixture patterns: ${patterns}`);
  log("");

  if (shifts + patterns === 0) {
    log("  Nothing to clean.");
    log("");
    return;
  }

  if (!(await confirm(`Delete ${shifts + patterns} fixture rows? [y/N]:`))) {
    log("Cancelled.", "blue");
    return;
  }

  const like = `${FIXTURE_PREFIX}%`;
  sqlite.prepare("DELETE FROM staffing_shifts WHERE name LIKE ?").run(like);
  sqlite.prepare("DELETE FROM rotation_patterns WHERE name LIKE ?").run(like);

  log("");
  success(`Removed ${shifts} fixture shift(s) and ${patterns} fixture pattern(s)`);
  log("");
}

// ─── Generate: shift version history ─────────────────────────────────────────

interface ShiftRow {
  id: number;
  config_id: number;
  group_id: number | null;
  name: string;
  category: string;
  rotation_id: number | null;
  rotation_start_date: string;
  pattern_anchor_date: string | null;
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
  break_minutes: number;
  lunch_minutes: number;
  headcount: number;
  sort_order: number;
}

function seedShiftVersions(count: number, months: number): number {
  // Earliest real version per lineage — generated history must end before it.
  const anchors = sqlite
    .prepare(
      `SELECT s.* FROM staffing_shifts s
        WHERE s.name NOT LIKE ?
          AND s.rotation_start_date = (
            SELECT MIN(s2.rotation_start_date) FROM staffing_shifts s2
             WHERE COALESCE(s2.group_id, s2.id) = COALESCE(s.group_id, s.id)
               AND s2.name NOT LIKE ?
          )
        GROUP BY COALESCE(s.group_id, s.id)`,
    )
    .all(`${FIXTURE_PREFIX}%`, `${FIXTURE_PREFIX}%`) as ShiftRow[];

  if (anchors.length === 0) {
    warn("No staffing shifts found — nothing to attach version history to.");
    return 0;
  }

  const perGroup = split(count, anchors.length);
  let created = 0;

  anchors.forEach((anchor, i) => {
    const versions = perGroup[i];
    if (versions === 0) return;

    const groupId = anchor.group_id ?? anchor.id;
    // The generated chain occupies [spanStart, spanEnd], strictly before the
    // earliest real version, so no real date is restated.
    const spanEnd = addDays(anchor.rotation_start_date, -1);
    const spanStart = addDays(spanEnd, -Math.round(months * 30.4));
    const totalDays = daysBetween(spanStart, spanEnd) + 1;

    if (totalDays < versions) {
      warn(`Span too short for ${versions} versions of ${anchor.name} — skipping`);
      return;
    }

    const lengths = split(totalDays, versions);
    let cursor = spanStart;

    for (let v = 0; v < versions; v++) {
      const start = cursor;
      const end = addDays(start, lengths[v] - 1);

      createStaffingShift({
        configId: anchor.config_id,
        groupId,
        name: `${FIXTURE_PREFIX} ${anchor.name}`,
        description: `Synthetic archived version ${v + 1} of ${versions}`,
        category: anchor.category as "DAY" | "SWING" | "NIGHT" | "OTHER",
        rotationId: anchor.rotation_id ?? 0,
        rotationStartDate: start,
        rotationEndDate: end,
        // Inherit the lineage's anchor so the rotation phase stays intact even
        // though each version starts mid-cycle.
        patternAnchorDate: anchor.pattern_anchor_date ?? anchor.rotation_start_date,
        startHour: anchor.start_hour,
        startMinute: anchor.start_minute,
        endHour: anchor.end_hour,
        endMinute: anchor.end_minute,
        breakMinutes: anchor.break_minutes,
        lunchMinutes: anchor.lunch_minutes,
        // Vary headcount so the archive shows meaningful effective changes.
        headcount: Math.max(1, anchor.headcount - versions + v),
        isActive: false,
        sortOrder: anchor.sort_order,
      });

      created++;
      cursor = addDays(end, 1);
    }
  });

  return created;
}

// ─── Generate: rotation pattern version history ──────────────────────────────

const FIXTURE_PATTERNS = [
  "oxxxxoxoxxxxoxoxxxxox",
  "oxxxxoooxxxxoooxxxxoo",
  "xoooooxxoooooxxooooox",
  "xxooxxxooxxoooxxooxxx",
  "oxxxooxooxxxoxoxxooox",
  "xooooxxxooooxxxooooxx",
];

function seedPatternVersions(count: number, months: number, lineages: number): number {
  if (count === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const spanStart = addDays(today, -Math.round(months * 30.4));
  const perLineage = split(count, lineages);
  let created = 0;

  for (let g = 0; g < lineages; g++) {
    const versions = perLineage[g];
    if (versions === 0) continue;

    const totalDays = daysBetween(spanStart, today) + 1;
    const lengths = split(totalDays, versions);
    let cursor = spanStart;
    let groupId: number | null = null;

    for (let v = 0; v < versions; v++) {
      const isLast = v === versions - 1;
      const start = cursor;
      const end = isLast ? null : addDays(start, lengths[v] - 1);

      const row = createRotationPattern({
        name: `${FIXTURE_PREFIX} Rotation ${String.fromCharCode(65 + g)}`,
        description: `Synthetic version ${v + 1} of ${versions}`,
        pattern: FIXTURE_PATTERNS[(g + v) % FIXTURE_PATTERNS.length],
        groupId,
        effectiveFrom: start,
        effectiveTo: end,
        // Only the open-ended tail of a lineage stays active; the rest is archive.
        isActive: isLast,
        sortOrder: 100 + g,
      });

      // The founding version seeds the lineage its successors join.
      if (groupId === null) groupId = row.groupId ?? row.id;

      created++;
      if (end !== null) cursor = addDays(end, 1);
    }
  }

  return created;
}

// ─── Invariant check ─────────────────────────────────────────────────────────

/**
 * Assert that no two versions of one lineage are effective on the same date.
 * Overlapping versions double-count the roster — the OI-108 defect — so a
 * generator that produced them would fake the very bug the archive guards against.
 */
function verifyInvariant(months: number): boolean {
  const today = new Date().toISOString().slice(0, 10);
  const from = addDays(today, -Math.round(months * 30.4) - 400);
  const days = daysBetween(from, today);
  let failures = 0;

  const shifts = sqlite
    .prepare(
      `SELECT COALESCE(group_id, id) AS grp, rotation_start_date, rotation_end_date, is_active
         FROM staffing_shifts`,
    )
    .all() as {
    grp: number;
    rotation_start_date: string;
    rotation_end_date: string | null;
    is_active: number;
  }[];

  const patterns = loadRotationPatterns();

  const byGroup = new Map<number, typeof shifts>();
  for (const s of shifts) {
    const list = byGroup.get(s.grp) ?? [];
    list.push(s);
    byGroup.set(s.grp, list);
  }

  for (let d = 0; d <= days; d++) {
    const date = addDays(from, d);

    for (const [grp, versions] of byGroup) {
      const live = versions.filter((s) =>
        isShiftEffectiveOn(
          {
            rotationStartDate: s.rotation_start_date,
            rotationEndDate: s.rotation_end_date,
            isActive: s.is_active === 1,
          },
          date,
        ),
      );
      if (live.length > 1) {
        error(`Shift lineage ${grp} has ${live.length} versions effective on ${date}`);
        if (++failures > 5) return false;
      }
    }

    const patternGroups = new Map<number, number>();
    for (const p of patterns) {
      if (!isPatternEffectiveOn(p, date)) continue;
      const grp = p.groupId ?? p.id;
      patternGroups.set(grp, (patternGroups.get(grp) ?? 0) + 1);
    }
    for (const [grp, n] of patternGroups) {
      if (n > 1) {
        error(`Rotation lineage ${grp} has ${n} versions effective on ${date}`);
        if (++failures > 5) return false;
      }
    }
  }

  return failures === 0;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  banner("Seed Archived Staffing Fixtures");

  if (process.env.NODE_ENV === "production") {
    error("Refusing to run with NODE_ENV=production — this inserts synthetic data.");
    process.exit(1);
  }

  if (hasFlagArg("clean")) {
    await clean();
    process.exit(0);
  }

  const shiftCount = numArg("shifts", 50);
  const patternCount = numArg("patterns", 50);
  const months = numArg("months", 12);
  const lineages = Math.max(1, numArg("lineages", 6));

  const existing = countFixtures();
  if (existing.shifts + existing.patterns > 0) {
    warn(
      `${existing.shifts + existing.patterns} fixture row(s) already present. ` +
        "Run with --clean first to avoid stacking generations.",
    );
    log("");
  }

  log(`  Archived shift versions:   ${shiftCount}`);
  log(`  Archived pattern versions: ${patternCount} across ${lineages} lineage(s)`);
  log(`  Span:                      last ${months} month(s)`);
  log("");

  if (!(await confirm(`Insert ${shiftCount + patternCount} synthetic rows? [y/N]:`))) {
    log("Cancelled.", "blue");
    process.exit(0);
  }

  const shiftsCreated = seedShiftVersions(shiftCount, months);
  const patternsCreated = seedPatternVersions(patternCount, months, lineages);

  log("");
  log("  Verifying one-version-per-date invariant…");

  if (!verifyInvariant(months)) {
    error("Invariant FAILED — generated versions overlap. Run --clean and investigate.");
    process.exit(1);
  }

  success(`Created ${shiftsCreated} shift version(s) and ${patternsCreated} pattern version(s)`);
  log("  Invariant holds: no lineage has two versions effective on the same date.");
  log("");
  log("  Remove with: npm run db:seed-archives -- --clean", "blue");
  log("");
}

main();
