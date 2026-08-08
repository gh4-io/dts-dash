// @vitest-environment node
/**
 * Enforces that the six pre-v1.0.0 messaging tables are unreachable from code
 * (OI-099).
 *
 * The tables themselves are RETAINED on existing databases, read-only, for one
 * release — they are the only rollback for a bad remap, and they are dropped in
 * v1.1.0. "Read-only" has to be enforced by something, though, because SQLite
 * will happily serve a SELECT against `feedback_posts` forever and the result
 * would be stale data presented as current.
 *
 * Three mechanisms keep them unreachable, and this file is the third:
 *
 *   1. Removed from `createTables()`, so fresh installs never have them.
 *   2. Removed from `src/lib/db/schema.ts`, so any Drizzle reference is a
 *      compile error — that is the main safety net.
 *   3. This test, which catches what tsc cannot: raw SQL strings. A query built
 *      as a string against a dropped table name is invisible to the type checker
 *      and fails only at runtime, in production, on the one installation that
 *      still has the table.
 *
 * Only `messages-backfill.ts` may name them, because reading them is its entire
 * job.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/** The tables folded into messages/labels/message_labels by OI-099. */
const LEGACY_TABLES = [
  "flight_comments",
  "notifications",
  "feedback_posts",
  "feedback_comments",
  "feedback_labels",
  "feedback_post_labels",
] as const;

/**
 * The only files allowed to reference them, relative to the repo root.
 *
 * - The backfill module, because reading the legacy tables IS its job.
 * - The backfill's own test, which has to recreate the legacy schema by hand:
 *   `createTables()` no longer declares those tables, so there is no other way to
 *   build the shape the backfill has to cope with.
 *
 * Note this scan covers `src/` only. Two CLI scripts (`scripts/db/status.ts` and
 * `scripts/db/upgrade-to-v1.ts`) also name them deliberately — status.ts reports
 * their row counts with the "(legacy — drop in v1.1.0)" suffix — and they are
 * outside the application code this test is protecting.
 */
const ALLOWED = [
  "src/lib/db/backfill/messages-backfill.ts",
  "src/__tests__/db/messages-backfill.test.ts",
  // Asserts that createTables() does NOT declare them — it has to name them to
  // check they are absent.
  "src/__tests__/db/schema-consolidation.test.ts",
];

/** This test file names them all as data, so it must exempt itself. */
const SELF = "src/__tests__/db/no-legacy-message-refs.test.ts";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SRC = path.join(REPO_ROOT, "src");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Remove comments so prose about the migration does not register as a reference.
 *
 * The distinction matters: explaining in a comment why `feedback_posts` no longer
 * exists is exactly the documentation this migration needs, while a string
 * literal naming it is the bug being hunted. Both `//`-style and `--` SQL
 * comments are stripped, since the SQL lives inside template literals.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments (incl. JSDoc)
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1") // line comments, sparing "://" in URLs
    .replace(/^\s*--[^\n]*$/gm, ""); // SQL comments inside template literals
}

/**
 * Find places where a legacy name could actually BE a table reference.
 *
 * A bare word-boundary match is useless here. `notifications` is also a route
 * path, a logger name, a React hook, a button tooltip and — unavoidably — a key
 * in the API response contract (`{ notifications: items }`). Flagging those would
 * make this test pure noise, and a noisy guard is a guard someone deletes.
 *
 * So two precise rules, covering the two ways a dropped table stays reachable:
 *
 *   1. SQL position — `FROM notifications`, `INSERT INTO feedback_posts`. This is
 *      the dangerous case, because tsc cannot see inside a string literal.
 *   2. A quoted literal, which catches `sqliteTable("feedback_posts")` and the
 *      hand-maintained table-name arrays like the one in the admin status route.
 *
 * Rule 2 is applied only to the five distinctive snake_case names. A bare
 * `"notifications"` string is overwhelmingly a logger name or a label rather than
 * a table, so for that one name rule 1 plus the explicit `sqliteTable(...)` check
 * below carry the weight.
 */
function findTableRefs(code: string, table: string): number {
  let hits = 0;

  // Keywords may be upper or lower case; table names are always lowercase
  // snake_case, so matching against a lowercased copy is safe for this rule.
  const sqlRe = new RegExp(`\\b(?:from|join|into|update|table)\\s+"?${table}"?(?![\\w-])`, "g");
  hits += [...code.toLowerCase().matchAll(sqlRe)].length;

  // Case-sensitive, so a `title="Notifications"` tooltip is not a finding.
  if (table.includes("_")) {
    hits += [...code.matchAll(new RegExp(`["']${table}["']`, "g"))].length;
  }

  // Always forbidden regardless of name shape.
  hits += [...code.matchAll(new RegExp(`sqliteTable\\(\\s*["']${table}["']`, "g"))].length;

  return hits;
}

describe("OI-099 — legacy messaging tables are unreachable from code", () => {
  const files = walk(SRC);

  it("finds source files to scan (guards against a broken walk)", () => {
    // A silently empty file list would make every assertion below vacuously pass.
    expect(files.length).toBeGreaterThan(100);
  });

  it("names none of the six legacy tables outside the backfill module", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
      if (ALLOWED.includes(rel) || rel === SELF) continue;

      const code = stripComments(fs.readFileSync(file, "utf-8"));

      for (const table of LEGACY_TABLES) {
        const hits = findTableRefs(code, table);
        for (let i = 0; i < hits; i++) offenders.push(`${rel} → ${table}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("still allows the backfill module to reference them", () => {
    // If this ever fails, the backfill stopped reading the legacy tables — which
    // means it cannot be migrating anything.
    const code = fs.readFileSync(path.join(REPO_ROOT, ALLOWED[0]), "utf-8");
    for (const table of LEGACY_TABLES) {
      expect(code).toContain(table);
    }
  });

  it("would actually catch a reintroduced raw-SQL reference", () => {
    // Guards the guard: a detector that matches nothing passes silently forever.
    const samples = [
      `db.prepare("SELECT * FROM flight_comments").all()`,
      `sqlite.exec("INSERT INTO feedback_posts (id) VALUES (1)")`,
      `const TABLES = ["users", "feedback_labels"];`,
      `UPDATE notifications SET read_at = ?`,
      `sqliteTable("feedback_post_labels", {`,
    ];

    for (const sample of samples) {
      const hit = LEGACY_TABLES.some((t) => findTableRefs(sample, t) > 0);
      expect(hit, sample).toBe(true);
    }

    // And does not fire on the legitimate identifiers that made a naive
    // word-boundary match unusable.
    const benign = [
      `import { listNotifications } from "@/lib/messages/repository";`,
      `createChildLogger("api/notifications")`,
      `return NextResponse.json({ notifications: items, total });`,
      `export function useNotifications() {`,
      `const log = createChildLogger("notifications");`,
      `<button title="Notifications" />`,
    ];

    for (const sample of benign) {
      const hit = LEGACY_TABLES.some((t) => findTableRefs(sample, t) > 0);
      expect(hit, sample).toBe(false);
    }
  });

  it("exports none of the six from the Drizzle schema", () => {
    // The compile-error safety net. A stale `feedbackPosts` import must not
    // resolve to anything.
    const schema = fs.readFileSync(path.join(REPO_ROOT, "src/lib/db/schema.ts"), "utf-8");
    const code = stripComments(schema);

    for (const name of [
      "flightComments",
      "feedbackPosts",
      "feedbackComments",
      "feedbackLabels",
      "feedbackPostLabels",
    ]) {
      expect(code).not.toContain(`export const ${name} `);
      expect(code).not.toContain(`export const ${name}=`);
    }

    // A table declaration may wrap onto the next line, so match whitespace-
    // tolerantly rather than on an exact substring.
    const declares = (table: string) => new RegExp(`sqliteTable\\(\\s*"${table}"`).test(code);

    // `notifications` is checked separately: the identifier also appears as a
    // relation field name, so only the table export is forbidden.
    expect(declares("notifications")).toBe(false);

    // And the replacements must actually be there.
    expect(declares("messages")).toBe(true);
    expect(declares("labels")).toBe(true);
    expect(declares("message_labels")).toBe(true);
  });
});
