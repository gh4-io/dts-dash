// @vitest-environment node
/**
 * Guards for the two halves of the v1.0.0 upgrade contract.
 *
 * 1. `createTables()` must SUCCEED against a pre-v1.0.0 database. It is called
 *    by `db:migrate` and by the app's own bootstrap, and it used to throw
 *    `no such column: group_id` there — because `CREATE TABLE IF NOT EXISTS` is
 *    a no-op on an existing older table, leaving `CREATE INDEX ... (group_id)`
 *    pointed at a column that was never added. That one statement broke
 *    `db:migrate`, the prod-db-snapshot restore, and app startup, against every
 *    database older than v1.0.0.
 *
 * 2. `assertSchemaCompatible()` must FAIL against that same database. Tolerating
 *    the old schema is only safe while something else refuses to serve it: an
 *    additive `createTables()` leaves moved columns where they were, and the app
 *    would come up healthy while returning blank work package identifiers and
 *    empty comment/notification/feedback lists — silently. That happened once
 *    during development and is why this gate exists.
 *
 * The two are deliberately in tension, and that tension is the design: tolerate
 * the schema so tooling works, refuse to serve it so data is never wrong.
 *
 * The fixture is built by running `createTables()` and then regressing the
 * result, rather than hand-writing an "old" schema. A hand-written one is a
 * guess about the past that rots, and a too-thin guess fails for reasons that
 * have nothing to do with what is under test.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type Database from "better-sqlite3";

let sqlite: Database.Database;
let init: typeof import("@/lib/db/schema-init");
let tmpDir: string;

function columnsOf(table: string): string[] {
  const rows = sqlite.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[];
  return rows.map((r) => r.name);
}

function indexExists(name: string): boolean {
  return (
    sqlite.prepare(`SELECT 1 FROM sqlite_master WHERE type='index' AND name = ?`).get(name) !==
    undefined
  );
}

/**
 * Undo the three v1.0.0 changes the gate looks for, turning a current schema
 * back into the shape a pre-v1.0.0 database still has:
 *
 * - `work_packages.title` restored (OI-086 folded it into `workpackage_no`)
 * - the `group_id` lineage columns removed (OI-101, OI-111)
 */
function regressToPreV1(db: Database.Database): void {
  db.exec(`ALTER TABLE work_packages ADD COLUMN title TEXT`);

  for (const table of ["rotation_patterns", "staffing_shifts"]) {
    const index = table === "rotation_patterns" ? "idx_rp_group" : "idx_ss_group";
    db.exec(`DROP INDEX IF EXISTS ${index}`);
    db.exec(`ALTER TABLE ${table} DROP COLUMN group_id`);
  }
}

beforeAll(async () => {
  // client.ts resolves DATABASE_PATH at module load, so point it at a throwaway
  // file before the dynamic import.
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dtsd-schema-compat-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "test.db");

  const client = await import("@/lib/db/client");
  init = await import("@/lib/db/schema-init");
  sqlite = client.sqlite;

  init.createTables();
});

afterAll(() => {
  sqlite?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// These run in order: the schema is current, then regressed. Splitting them
// into separate files would need a second database for no added coverage.
describe("a fresh v1.0.0 install", () => {
  it("satisfies every marker the gate requires", () => {
    expect(() => init.assertSchemaCompatible()).not.toThrow();
  });

  it("creates the lineage indexes, because their columns are present", () => {
    expect(columnsOf("staffing_shifts")).toContain("group_id");
    expect(indexExists("idx_ss_group")).toBe(true);
    expect(indexExists("idx_rp_group")).toBe(true);
  });
});

describe("after regressing to a pre-v1.0.0 shape", () => {
  beforeAll(() => regressToPreV1(sqlite));

  it("createTables() does not throw", () => {
    // The regression: this threw `no such column: group_id` and took
    // db:migrate, the snapshot restore and app startup down with it.
    expect(() => init.createTables()).not.toThrow();
  });

  it("createTables() skips the lineage index rather than failing on it", () => {
    expect(indexExists("idx_ss_group")).toBe(false);
    expect(indexExists("idx_rp_group")).toBe(false);
  });

  it("createTables() does not quietly re-add the missing columns", () => {
    // CREATE TABLE IF NOT EXISTS cannot alter an existing table, and it must not
    // start trying to. If this fails, createTables() has become a migration and
    // db:upgrade-v1 is no longer the single way a database moves forward.
    expect(columnsOf("staffing_shifts")).not.toContain("group_id");
    expect(columnsOf("work_packages")).toContain("title");
  });

  it("assertSchemaCompatible() refuses to let the app serve it", () => {
    expect(() => init.assertSchemaCompatible()).toThrow(/not compatible/i);
  });

  it("names the failing markers and the command that fixes them", () => {
    let message = "";
    try {
      init.assertSchemaCompatible();
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }

    // An operator has to be able to act on this without reading the source.
    expect(message).toContain("work_packages.title");
    expect(message).toContain("OI-086");
    expect(message).toContain("staffing_shifts.group_id");
    expect(message).toContain("OI-111");
    expect(message).toContain("db:upgrade-v1");
  });
});
