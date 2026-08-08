// @vitest-environment node
/**
 * Server-side enforcement for the cron admin API (OI-105).
 *
 * A greyed-out button is presentation. The point of these tests is that a
 * request which never went near the UI — a stale tab, a `curl`, a non-admin
 * poking at the endpoint — is refused by the server on both axes: role and
 * deployment gate.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { role: string } } | null,
  cronEnabled: true,
}));

vi.mock("@/lib/auth", () => ({
  auth: async () => state.session,
}));

vi.mock("@/lib/config/loader", () => ({
  getFeatures: () => ({ cronEnabled: state.cronEnabled, enableSeedEndpoint: false }),
}));

import { requireCronAdmin, requireCronGate } from "@/lib/cron/api-guard";

beforeEach(() => {
  state.session = { user: { role: "admin" } };
  state.cronEnabled = true;
});

describe("requireCronAdmin — role matrix", () => {
  it.each(["admin", "superadmin"] as const)("permits %s", async (role) => {
    state.session = { user: { role } };
    expect(await requireCronAdmin()).toBeNull();
  });

  it("rejects a plain user with 403", async () => {
    state.session = { user: { role: "user" } };
    const res = await requireCronAdmin();

    expect(res?.status).toBe(403);
    await expect(res!.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("rejects an unauthenticated caller with 403", async () => {
    state.session = null;
    expect((await requireCronAdmin())?.status).toBe(403);
  });

  it("rejects a plain user even when the gate is on — role is checked independently", async () => {
    state.session = { user: { role: "user" } };
    state.cronEnabled = true;
    expect((await requireCronAdmin())?.status).toBe(403);
  });
});

describe("requireCronGate — deployment gate", () => {
  it("permits mutations while features.cronEnabled is on", () => {
    expect(requireCronGate()).toBeNull();
  });

  it("refuses mutations with 409 while the gate is off, even for a superadmin", async () => {
    state.session = { user: { role: "superadmin" } };
    state.cronEnabled = false;

    const res = requireCronGate();
    expect(res?.status).toBe(409);

    const body = await res!.json();
    expect(body.reason).toBe("scheduler-disabled-by-config");
    expect(body.error).toMatch(/features\.cronEnabled/);
  });

  it("names the config key and the restart so an admin knows who can fix it", async () => {
    state.cronEnabled = false;
    const body = await requireCronGate()!.json();

    expect(body.error).toMatch(/server administrator/i);
    expect(body.error).toMatch(/restart/i);
  });
});
