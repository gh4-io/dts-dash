// @vitest-environment node
/**
 * Server-side enforcement and behaviour of the MH override endpoints (OI-104).
 *
 * A disabled button in the drawer is presentation. What matters is that a
 * request which never went near the UI — a stale tab, a `curl`, a plain user —
 * is refused by the route itself, and that the redundancy rule cannot be
 * bypassed by calling the API directly.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  session: null as { user: { id: string; role: string } } | null,
}));

vi.mock("@/lib/auth", () => ({
  auth: async () => state.session,
}));

const BASE = "http://localhost/api/admin/mh-overrides";
const SP_ID = 900001;
const IMPORTED_MH = 6;

let tmpDir: string;
let sqlite: import("better-sqlite3").Database;
let collection: typeof import("@/app/api/admin/mh-overrides/route");
let item: typeof import("@/app/api/admin/mh-overrides/[spId]/route");
let history: typeof import("@/app/api/admin/mh-overrides/history/route");

/** Route params arrive as a promise in Next.js 15+. */
const params = (spId: number | string) => ({ params: Promise.resolve({ spId: String(spId) }) });

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mh-overrides-api-"));
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

  sqlite
    .prepare(
      `INSERT INTO work_packages
         (guid, sp_id, aircraft_reg, customer, arrival, departure, total_mh, total_ground_hours,
          status, has_workpackage, workpackage_no, imported_at)
       VALUES ('guid-1', ?, 'N123AA', 'AALA', '2026-01-01T00:00:00Z', '2026-01-01T08:00:00Z',
               ?, '8', 'New', 1, 'AALA/L-201125-2', '2026-01-01')`,
    )
    .run(SP_ID, IMPORTED_MH);

  collection = await import("@/app/api/admin/mh-overrides/route");
  item = await import("@/app/api/admin/mh-overrides/[spId]/route");
  history = await import("@/app/api/admin/mh-overrides/history/route");
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
  state.session = { user: { id: "1", role: "admin" } };
  sqlite.prepare("DELETE FROM mh_overrides").run();
  sqlite.prepare("DELETE FROM mh_override_history").run();
});

describe("permissions", () => {
  it.each(["admin", "superadmin"] as const)("permits %s", async (role) => {
    state.session = { user: { id: "1", role } };
    expect((await collection.GET(new NextRequest(BASE))).status).toBe(200);
  });

  it.each([
    ["a plain user", { user: { id: "1", role: "user" } }],
    ["an unauthenticated caller", null],
  ])("refuses %s on every verb", async (_label, session) => {
    state.session = session as typeof state.session;

    expect((await collection.GET(new NextRequest(BASE))).status).toBe(403);
    expect(
      (await collection.POST(jsonRequest(BASE, "POST", { spId: SP_ID, overrideMH: 9 }))).status,
    ).toBe(403);
    expect(
      (await collection.DELETE(new NextRequest(`${BASE}?spId=${SP_ID}`, { method: "DELETE" })))
        .status,
    ).toBe(403);
    expect(
      (await item.PUT(jsonRequest(`${BASE}/${SP_ID}`, "PUT", { overrideMH: 9 }), params(SP_ID)))
        .status,
    ).toBe(403);
    expect(
      (await item.DELETE(new NextRequest(`${BASE}/${SP_ID}`, { method: "DELETE" }), params(SP_ID)))
        .status,
    ).toBe(403);
    expect((await history.GET(new NextRequest(`${BASE}/history`))).status).toBe(403);
  });

  it("refuses a plain user even when the override would be valid", async () => {
    state.session = { user: { id: "1", role: "user" } };
    await collection.POST(jsonRequest(BASE, "POST", { spId: SP_ID, overrideMH: 9 }));

    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM mh_overrides").get()).toEqual({ n: 0 });
  });
});

describe("PUT /[spId] — save", () => {
  it("creates an override and reports the decision", async () => {
    const res = await item.PUT(
      jsonRequest(`${BASE}/${SP_ID}`, "PUT", { overrideMH: 9 }),
      params(SP_ID),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.decision.action).toBe("create");
    expect(body.detail.overrideMH).toBe(9);
  });

  it("refuses to store a value equal to the imported MH", async () => {
    const res = await item.PUT(
      jsonRequest(`${BASE}/${SP_ID}`, "PUT", { overrideMH: IMPORTED_MH }),
      params(SP_ID),
    );
    const body = await res.json();

    expect(body.decision.action).toBe("noop");
    expect(body.decision.redundant).toBe(true);
    expect(body.detail.overrideMH).toBeNull();
  });

  it("rejects a non-numeric value with 400", async () => {
    const res = await item.PUT(
      jsonRequest(`${BASE}/${SP_ID}`, "PUT", { overrideMH: "eight" }),
      params(SP_ID),
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown work package", async () => {
    const res = await item.PUT(
      jsonRequest(`${BASE}/999999`, "PUT", { overrideMH: 9 }),
      params(999999),
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE — clear", () => {
  it("clears via the item route", async () => {
    await item.PUT(jsonRequest(`${BASE}/${SP_ID}`, "PUT", { overrideMH: 9 }), params(SP_ID));

    const res = await item.DELETE(
      new NextRequest(`${BASE}/${SP_ID}`, { method: "DELETE" }),
      params(SP_ID),
    );
    const body = await res.json();

    expect(body.decision.action).toBe("clear");
    expect(body.detail.overrideMH).toBeNull();
  });

  it("clears via the collection route by workPackageId", async () => {
    await item.PUT(jsonRequest(`${BASE}/${SP_ID}`, "PUT", { overrideMH: 9 }), params(SP_ID));
    const wpId = (sqlite.prepare("SELECT id FROM work_packages").get() as { id: number }).id;

    const res = await collection.DELETE(
      new NextRequest(`${BASE}?workPackageId=${wpId}`, { method: "DELETE" }),
    );

    expect((await res.json()).decision.action).toBe("clear");
  });

  it("requires an identifier", async () => {
    const res = await collection.DELETE(new NextRequest(BASE, { method: "DELETE" }));
    expect(res.status).toBe(400);
  });
});

describe("POST — collection save with the minimum-hours transform", () => {
  it("raises the value and keeps the supplied original in the response", async () => {
    const res = await collection.POST(
      jsonRequest(BASE, "POST", { spId: SP_ID, overrideMH: 2, minHours: 4 }),
    );
    const body = await res.json();

    expect(body.decision.overrideMH).toBe(4);
    expect(body.decision.suppliedMH).toBe(2);
    expect(body.decision.minHoursApplied).toBe(true);
  });
});

describe("history", () => {
  it("lists changes with before/after values", async () => {
    await item.PUT(jsonRequest(`${BASE}/${SP_ID}`, "PUT", { overrideMH: 9 }), params(SP_ID));
    await item.PUT(jsonRequest(`${BASE}/${SP_ID}`, "PUT", { overrideMH: 12 }), params(SP_ID));

    const body = await (await history.GET(new NextRequest(`${BASE}/history`))).json();

    expect(body.count).toBe(2);
    expect(body.history[0]).toMatchObject({ action: "update", previousMH: 9, newMH: 12 });
  });

  it("exports CSV with a download filename", async () => {
    await item.PUT(jsonRequest(`${BASE}/${SP_ID}`, "PUT", { overrideMH: 9 }), params(SP_ID));

    const res = await history.GET(new NextRequest(`${BASE}/history?format=csv`));

    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(await res.text()).toContain("AALA/L-201125-2");
  });
});
