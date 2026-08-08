// @vitest-environment node
/**
 * MH override persistence, audit trail and cache propagation (OI-104).
 *
 * The acceptance criterion that is easy to get wrong is the last one: overrides
 * are resolved inside `transformWorkPackages()`, which memoises them at module
 * level. Writing the row is not enough — without invalidation the flight board
 * and `/capacity` keep serving the old `effectiveMH` until the server restarts.
 * These tests transform the same work packages before and after a write, in one
 * process, and assert the value moved.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { SharePointWorkPackage } from "@/types";

let tmpDir: string;
let sqlite: import("better-sqlite3").Database;
let data: typeof import("@/lib/mh-overrides/data");
let transformer: typeof import("@/lib/data/transformer");

const WP_GUID = "11111111-1111-1111-1111-111111111111";
const WP_NO = "AALA/L-201125-2";
/** Imported TotalMH for the fixture work package. */
const IMPORTED_MH = 6;

let userId: number;
let wpId: number;

/** The raw SharePoint shape the transformer consumes. */
function rawWorkPackage(): SharePointWorkPackage {
  return {
    GUID: WP_GUID,
    ID: 900001,
    Aircraft: { Title: "N123AA" },
    Customer: "AALA",
    Arrival: "2026-01-01T00:00:00Z",
    Departure: "2026-01-01T08:00:00Z",
    TotalMH: IMPORTED_MH,
    TotalGroundHours: "8",
    Workpackage_x0020_Status: "New",
    HasWorkpackage: true,
    WorkpackageNo: WP_NO,
  } as SharePointWorkPackage;
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mh-overrides-"));
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
  userId = (sqlite.prepare("SELECT id FROM users").get() as { id: number }).id;

  // wpMHMode defaults to "exclude"; these tests need rung 2 of the chain live
  // so that clearing an override visibly falls back to the imported WP MH.
  sqlite
    .prepare(
      "INSERT INTO app_config (key, value, updated_at) VALUES ('wpMHMode', 'include', '2026-01-01')",
    )
    .run();

  sqlite
    .prepare(
      `INSERT INTO work_packages
         (guid, sp_id, aircraft_reg, customer, arrival, departure, total_mh, total_ground_hours,
          status, has_workpackage, workpackage_no, imported_at)
       VALUES (?, 900001, 'N123AA', 'AALA', '2026-01-01T00:00:00Z', '2026-01-01T08:00:00Z',
               ?, '8', 'New', 1, ?, '2026-01-01')`,
    )
    .run(WP_GUID, IMPORTED_MH, WP_NO);
  wpId = (sqlite.prepare("SELECT id FROM work_packages").get() as { id: number }).id;

  data = await import("@/lib/mh-overrides/data");
  transformer = await import("@/lib/data/transformer");
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
  transformer.invalidateTransformerCache();
});

/** Resolve the fixture work package through the real transformer. */
async function effective(): Promise<{ effectiveMH: number; mhSource: string }> {
  const [wp] = await transformer.transformWorkPackages([rawWorkPackage()]);
  return { effectiveMH: wp.effectiveMH, mhSource: wp.mhSource };
}

describe("create / update / clear", () => {
  it("creates an override and records the acting user and timestamp", () => {
    const result = data.applyOverride({
      workPackageId: wpId,
      suppliedMH: 9,
      userId,
      source: "drawer",
    });

    expect(result.decision.action).toBe("create");
    expect(result.detail?.overrideMH).toBe(9);
    expect(result.detail?.updatedBy).toBe(userId);
    expect(result.detail?.updatedAt).toBeTruthy();
    expect(result.detail?.updatedByName).toBe("Admin One");
  });

  it("updates in place rather than accumulating rows", () => {
    data.applyOverride({ workPackageId: wpId, suppliedMH: 9, userId, source: "drawer" });
    const result = data.applyOverride({
      workPackageId: wpId,
      suppliedMH: 12,
      userId,
      source: "drawer",
    });

    expect(result.decision.action).toBe("update");
    expect(result.previousMH).toBe(9);
    expect(data.listOverrides()).toHaveLength(1);
    expect(data.getOverrideValue(wpId)).toBe(12);
  });

  it("clears an override and restores the priority chain", () => {
    data.applyOverride({ workPackageId: wpId, suppliedMH: 9, userId, source: "drawer" });
    const result = data.clearOverride({ workPackageId: wpId, userId, source: "drawer" });

    expect(result.decision.action).toBe("clear");
    expect(data.getOverrideValue(wpId)).toBeNull();
    expect(data.listOverrides()).toHaveLength(0);
  });

  it("is a no-op when clearing a work package that has no override", () => {
    const result = data.clearOverride({ workPackageId: wpId, userId, source: "api" });

    expect(result.decision.action).toBe("noop");
    expect(data.listHistory()).toHaveLength(0);
  });
});

describe("redundant values", () => {
  it("never stores an override equal to the imported MH", () => {
    const result = data.applyOverride({
      workPackageId: wpId,
      suppliedMH: IMPORTED_MH,
      userId,
      source: "drawer",
    });

    expect(result.decision.action).toBe("noop");
    expect(data.getOverrideValue(wpId)).toBeNull();
    // Nothing happened, so nothing is recorded — a no-op is not an audit event.
    expect(data.listHistory()).toHaveLength(0);
  });

  it("clears an existing override that is re-entered as the imported value", () => {
    data.applyOverride({ workPackageId: wpId, suppliedMH: 9, userId, source: "drawer" });
    const result = data.applyOverride({
      workPackageId: wpId,
      suppliedMH: IMPORTED_MH,
      userId,
      source: "drawer",
    });

    expect(result.decision.action).toBe("clear");
    expect(result.decision.redundant).toBe(true);
    expect(data.getOverrideValue(wpId)).toBeNull();
  });
});

describe("history", () => {
  it("captures before/after across the full lifecycle", () => {
    data.applyOverride({ workPackageId: wpId, suppliedMH: 9, userId, source: "drawer" });
    data.applyOverride({ workPackageId: wpId, suppliedMH: 12, userId, source: "api" });
    data.clearOverride({ workPackageId: wpId, userId, source: "drawer" });

    const history = data.listHistory({ workPackageId: wpId });
    expect(history).toHaveLength(3);

    // Newest first.
    const [cleared, updated, created] = history;

    expect(created.action).toBe("create");
    expect(created.previousMH).toBeNull();
    expect(created.newMH).toBe(9);
    expect(created.importedMH).toBe(IMPORTED_MH);
    expect(created.changedByName).toBe("Admin One");

    expect(updated.action).toBe("update");
    expect(updated.previousMH).toBe(9);
    expect(updated.newMH).toBe(12);
    expect(updated.source).toBe("api");

    expect(cleared.action).toBe("clear");
    expect(cleared.previousMH).toBe(12);
    expect(cleared.newMH).toBeNull();
  });

  it("keeps the value the user supplied when a minimum-hours floor raises it", () => {
    data.applyOverride({
      workPackageId: wpId,
      suppliedMH: 2,
      minHours: 4,
      userId,
      source: "import",
    });

    const [entry] = data.listHistory({ workPackageId: wpId });
    expect(entry.newMH).toBe(4);
    expect(entry.suppliedMH).toBe(2);
    expect(entry.minHours).toBe(4);
  });

  it("exports before/after as CSV", () => {
    data.applyOverride({ workPackageId: wpId, suppliedMH: 9, userId, source: "drawer" });

    const csv = data.toCsv(data.listHistory(), data.HISTORY_CSV_COLUMNS);
    const [header, row] = csv.split("\n");

    expect(header).toContain("previousMH,newMH");
    expect(row).toContain(WP_NO);
    expect(row).toContain("create");
  });
});

describe("effectiveMH propagation and cache invalidation", () => {
  it("labels the work package Override and uses the override value", async () => {
    expect(await effective()).toEqual({ effectiveMH: IMPORTED_MH, mhSource: "workpackage" });

    data.applyOverride({ workPackageId: wpId, suppliedMH: 9, userId, source: "drawer" });

    // No restart, no re-import — the write itself invalidated the transformer.
    expect(await effective()).toEqual({ effectiveMH: 9, mhSource: "manual" });
  });

  it("restores the priority chain on clear, again without a restart", async () => {
    data.applyOverride({ workPackageId: wpId, suppliedMH: 9, userId, source: "drawer" });
    expect((await effective()).mhSource).toBe("manual");

    data.clearOverride({ workPackageId: wpId, userId, source: "drawer" });

    expect(await effective()).toEqual({ effectiveMH: IMPORTED_MH, mhSource: "workpackage" });
  });

  it("leaves the cache stale when invalidation is deferred, and refreshes on the explicit call", async () => {
    await effective(); // prime the cache

    data.applyOverride({
      workPackageId: wpId,
      suppliedMH: 9,
      userId,
      source: "import",
      deferInvalidation: true,
    });

    // This is exactly the window the bulk import runs in — one invalidation for
    // the batch instead of one per row.
    expect((await effective()).mhSource).toBe("workpackage");

    data.invalidateMHOverrideCaches();
    expect((await effective()).mhSource).toBe("manual");
  });
});

describe("work package number lookup", () => {
  it("matches case-insensitively and ignores surrounding whitespace", () => {
    const lookup = data.buildWorkpackageNoLookup();
    expect(lookup.get(WP_NO.toLowerCase())).toBe(wpId);
  });

  it("maps an ambiguous number to null rather than guessing a row", () => {
    sqlite
      .prepare(
        `INSERT INTO work_packages
           (guid, sp_id, aircraft_reg, customer, arrival, departure, status, workpackage_no, imported_at)
         VALUES ('dup-guid', 900002, 'N456AA', 'AALA', '2026-01-02T00:00:00Z',
                 '2026-01-02T08:00:00Z', 'New', ?, '2026-01-01')`,
      )
      .run(WP_NO);

    try {
      expect(data.buildWorkpackageNoLookup().get(WP_NO.toLowerCase())).toBeNull();
    } finally {
      sqlite.prepare("DELETE FROM work_packages WHERE guid = 'dup-guid'").run();
    }
  });
});
