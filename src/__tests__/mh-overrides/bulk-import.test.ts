// @vitest-environment node
/**
 * Bulk MH override CSV workflow (OI-104).
 *
 * The workflow rides the Universal Import Hub rather than a bespoke CSV path,
 * so these tests drive the same entry points the wizard does: `validateRecords`
 * for the pre-commit preview and `schema.commit()` for the write. The preview
 * has to report exactly what the commit will do — matches, duplicates, invalid
 * values, unchanged rows and unmatched identifiers — or approving it means
 * nothing.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { ImportContext, ImportSchema } from "@/lib/import/types";

let tmpDir: string;
let sqlite: import("better-sqlite3").Database;
let schema: ImportSchema;
let validateRecords: typeof import("@/lib/import/validator").validateRecords;
let parseContent: typeof import("@/lib/import/parser").parseContent;
let autoMap: typeof import("@/lib/import/mapping").autoMap;
let applyMapping: typeof import("@/lib/import/mapping").applyMapping;
let extractSourceFields: typeof import("@/lib/import/mapping").extractSourceFields;

const ctx: ImportContext = {
  userId: 1,
  source: "file",
  fileName: "overrides.csv",
  format: "csv",
  schemaId: "mh-overrides",
};

/** Fixtures: WP-1 has an imported MH of 6, WP-2 has none. */
const WP_ONE = "AALA/L-201125-2";
const WP_TWO = "AALA/L-201126-1";

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mh-overrides-import-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "dashboard.db");

  const client = await import("@/lib/db/client");
  sqlite = client.sqlite;
  const { createTables } = await import("@/lib/db/schema-init");
  createTables();

  sqlite
    .prepare(
      `INSERT INTO users (auth_id, email, display_name, password_hash, role, created_at, updated_at)
       VALUES ('u1', 'admin@example.com', 'Admin One', 'x', 'admin', '2026-01-01', '2026-01-01')`,
    )
    .run();

  const insertWp = sqlite.prepare(
    `INSERT INTO work_packages
       (guid, sp_id, aircraft_reg, customer, arrival, departure, total_mh, total_ground_hours,
        status, has_workpackage, workpackage_no, imported_at)
     VALUES (?, ?, ?, 'AALA', '2026-01-01T00:00:00Z', '2026-01-01T08:00:00Z',
             ?, '8', 'New', 1, ?, '2026-01-01')`,
  );
  insertWp.run("guid-1", 900001, "N123AA", 6, WP_ONE);
  insertWp.run("guid-2", 900002, "N456AA", null, WP_TWO);

  const { ensureSchemasLoaded, getSchema } = await import("@/lib/import/registry");
  await ensureSchemasLoaded();
  schema = getSchema("mh-overrides")!;

  ({ validateRecords } = await import("@/lib/import/validator"));
  ({ parseContent } = await import("@/lib/import/parser"));
  ({ autoMap, applyMapping, extractSourceFields } = await import("@/lib/import/mapping"));
});

afterAll(() => {
  try {
    sqlite.close();
  } catch {
    // already closed
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATABASE_PATH;
});

beforeEach(() => {
  sqlite.prepare("DELETE FROM mh_overrides").run();
  sqlite.prepare("DELETE FROM mh_override_history").run();
  sqlite.prepare("DELETE FROM import_log").run();
});

/** Parse + map a CSV string exactly as the validate and commit routes do. */
function mapCsv(csv: string): Record<string, unknown>[] {
  const parsed = parseContent(csv, "csv");
  const mapping = autoMap(extractSourceFields(parsed.records), schema.fields);
  return applyMapping(parsed.records, mapping, schema.fields);
}

async function preview(csv: string) {
  const parsed = parseContent(csv, "csv");
  const mapping = autoMap(extractSourceFields(parsed.records), schema.fields);
  return validateRecords(parsed.records, schema, mapping, ctx);
}

/** Badge value by label. */
function badge(badges: { label: string; value: string | number }[], label: string) {
  return badges.find((b) => b.label === label)?.value;
}

describe("registration", () => {
  it("is registered as a CSV-capable schema, not a parallel import path", () => {
    expect(schema.formats).toContain("csv");
    expect(schema.display.category).toBe("Operations");
    expect(schema.fields.find((f) => f.name === "workpackageNo")?.isKey).toBe(true);
  });
});

describe("preview", () => {
  it("counts matches, duplicates, invalid values and unmatched identifiers", async () => {
    const result = await preview(
      [
        "workpackageNo,overrideMH",
        `${WP_ONE},9`, // match
        `${WP_ONE},11`, // duplicate identifier within the file
        `NOPE/L-1,4`, // unmatched
        `${WP_TWO},abc`, // invalid — non-numeric
      ].join("\n"),
    );

    expect(badge(result.badges, "Matched")).toBe(1);
    expect(badge(result.badges, "Duplicates")).toBe(1);
    expect(badge(result.badges, "Unmatched")).toBe(1);
    // The per-field validator catches "abc" before postMapValidate runs, so the
    // preview is invalid overall — which is the point: it never reaches commit.
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain('expected number, got "abc"');
  });

  it("flags a value that merely restates the imported MH as redundant", async () => {
    const result = await preview(["workpackageNo,overrideMH", `${WP_ONE},6`].join("\n"));

    expect(badge(result.badges, "Redundant")).toBe(1);
    expect(badge(result.badges, "Matched")).toBe(0);
    expect(result.warnings.join(" ")).toContain("redundant");
  });

  it("reports rows that would change nothing as unchanged", async () => {
    const { applyOverride } = await import("@/lib/mh-overrides/data");
    const wpId = (
      sqlite.prepare("SELECT id FROM work_packages WHERE workpackage_no = ?").get(WP_ONE) as {
        id: number;
      }
    ).id;
    applyOverride({ workPackageId: wpId, suppliedMH: 9, userId: 1, source: "api" });

    const result = await preview(["workpackageNo,overrideMH", `${WP_ONE},9`].join("\n"));

    expect(badge(result.badges, "Unchanged")).toBe(1);
    expect(badge(result.badges, "Matched")).toBe(0);
  });

  it("matches case-insensitively and ignores surrounding whitespace", async () => {
    const result = await preview(
      ["workpackageNo,overrideMH", `  ${WP_ONE.toLowerCase()}  ,9`].join("\n"),
    );

    expect(badge(result.badges, "Matched")).toBe(1);
  });
});

describe("identifier fallbacks", () => {
  // work_packages.workpackage_no is optional in the source data — a real
  // database can hold ten thousand rows without a single one populated, which
  // would make a workpackageNo-only matcher useless.
  it("matches on spId when no work package number is supplied", async () => {
    const result = await preview(["workpackageNo,spId,overrideMH", `,900001,9`].join("\n"));
    expect(badge(result.badges, "Matched")).toBe(1);
  });

  it("matches on guid as a last resort", async () => {
    const result = await preview(["guid,overrideMH", `guid-2,4`].join("\n"));
    expect(badge(result.badges, "Matched")).toBe(1);
  });

  it("prefers the work package number when both are present", async () => {
    // spId 900002 is a different work package — the number must win.
    const records = mapCsv(["workpackageNo,spId,overrideMH", `${WP_ONE},900002,9`].join("\n"));
    await schema.commit(records, ctx);

    const row = sqlite
      .prepare(
        `SELECT wp.workpackage_no AS no FROM mh_overrides o
           JOIN work_packages wp ON wp.id = o.work_package_id`,
      )
      .get() as { no: string };
    expect(row.no).toBe(WP_ONE);
  });

  it("rejects a row with no identifier at all", async () => {
    const result = await preview(["workpackageNo,overrideMH", `,9`].join("\n"));

    expect(badge(result.badges, "Invalid")).toBe(1);
    expect(result.warnings.join(" ")).toContain("No identifier");
  });

  it("treats two rows resolving to the same work package as duplicates, whatever the identifier", async () => {
    const result = await preview(
      ["workpackageNo,spId,overrideMH", `${WP_ONE},,9`, `,900001,11`].join("\n"),
    );

    expect(badge(result.badges, "Duplicates")).toBe(1);
    expect(badge(result.badges, "Matched")).toBe(1);
  });
});

describe("commit", () => {
  it("applies matched rows and skips the rest without aborting the batch", async () => {
    const records = mapCsv(
      [
        "workpackageNo,overrideMH",
        `${WP_ONE},9`,
        `${WP_TWO},4`,
        `NOPE/L-1,4`,
        `${WP_ONE},11`, // duplicate — later value must not win
      ].join("\n"),
    );

    const result = await schema.commit(records, ctx);

    expect(result.success).toBe(true);
    expect(result.recordsInserted).toBe(2);
    expect(result.recordsSkipped).toBe(2);
    expect(result.warnings.join(" ")).toContain("unmatched");
    expect(result.warnings.join(" ")).toContain("duplicate");

    const rows = sqlite
      .prepare("SELECT override_mh FROM mh_overrides ORDER BY override_mh")
      .all() as { override_mh: number }[];
    expect(rows.map((r) => r.override_mh)).toEqual([4, 9]);
  });

  it("clears a redundant override instead of writing it", async () => {
    const { applyOverride, getOverrideValue } = await import("@/lib/mh-overrides/data");
    const wpId = (
      sqlite.prepare("SELECT id FROM work_packages WHERE workpackage_no = ?").get(WP_ONE) as {
        id: number;
      }
    ).id;
    applyOverride({ workPackageId: wpId, suppliedMH: 9, userId: 1, source: "api" });

    await schema.commit(mapCsv(["workpackageNo,overrideMH", `${WP_ONE},6`].join("\n")), ctx);

    expect(getOverrideValue(wpId)).toBeNull();
  });

  it("applies the minimum-hours floor and keeps the supplied value in the audit trail", async () => {
    const result = await schema.commit(
      mapCsv(["workpackageNo,overrideMH,minHours", `${WP_TWO},2,4`].join("\n")),
      ctx,
    );

    expect(result.warnings.join(" ")).toContain("raised to the 4 MH minimum");

    const entry = sqlite
      .prepare("SELECT new_mh, supplied_mh, min_hours FROM mh_override_history")
      .get() as { new_mh: number; supplied_mh: number; min_hours: number };
    expect(entry).toEqual({ new_mh: 4, supplied_mh: 2, min_hours: 4 });
  });

  it("records the acting user, the source and an import_log row", async () => {
    const result = await schema.commit(
      mapCsv(["workpackageNo,overrideMH", `${WP_ONE},9`].join("\n")),
      { ...ctx, userId: 1 },
    );

    const logRow = sqlite
      .prepare("SELECT data_type, imported_by, records_inserted FROM import_log WHERE id = ?")
      .get(result.logId);
    expect(logRow).toMatchObject({
      data_type: "mh-overrides",
      imported_by: 1,
      records_inserted: 1,
    });

    const entry = sqlite.prepare("SELECT source, changed_by FROM mh_override_history").get();
    expect(entry).toEqual({ source: "import", changed_by: 1 });
  });

  it("rolls the whole batch back when a row fails mid-commit", async () => {
    const records = mapCsv(["workpackageNo,overrideMH", `${WP_ONE},9`, `${WP_TWO},4`].join("\n"));

    // Fail on the second insert, after the first has already succeeded — the
    // exact shape of a part-applied batch.
    sqlite.exec(`
      CREATE TRIGGER fail_second_override BEFORE INSERT ON mh_overrides
      WHEN (SELECT COUNT(*) FROM mh_overrides) >= 1
      BEGIN SELECT RAISE(ABORT, 'simulated mid-batch failure'); END;
    `);

    let result;
    try {
      result = await schema.commit(records, ctx);
    } finally {
      sqlite.exec("DROP TRIGGER fail_second_override");
    }

    expect(result.success).toBe(false);
    expect(result.recordsInserted).toBe(0);
    // Nothing survived — not even the first row, which succeeded before the fault.
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM mh_overrides").get()).toEqual({ n: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM mh_override_history").get()).toEqual({ n: 0 });

    const logRow = sqlite
      .prepare("SELECT status FROM import_log WHERE id = ?")
      .get(result.logId) as { status: string };
    expect(logRow.status).toBe("failed");
  });
});
