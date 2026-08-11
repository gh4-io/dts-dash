/**
 * Shared guard for the admin cron API.
 *
 * A greyed-out button is presentation, not enforcement. Every route that can
 * change or execute a cron job calls this so the deployment gate is refused
 * server-side too — including for a direct `curl` that never saw the UI.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFeatures } from "@/lib/config/loader";
import { isSchedulerMutable, SCHEDULER_DISABLED_ERROR } from "./scheduler-status";

const ADMIN_ROLES = ["admin", "superadmin"];

/**
 * Role check for the cron admin API. Returns a 403 response to return
 * directly, or null when the caller is permitted.
 */
export async function requireCronAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Deployment-gate check for any mutating or executing cron route. Returns a
 * 409 response to return directly, or null when the gate is on.
 *
 * 409 rather than 403: the caller's credentials are fine, the server is simply
 * in a state where the request cannot be honoured.
 */
export function requireCronGate(): NextResponse | null {
  if (isSchedulerMutable(getFeatures().cronEnabled)) return null;

  return NextResponse.json(
    { error: SCHEDULER_DISABLED_ERROR, reason: "scheduler-disabled-by-config" },
    { status: 409 },
  );
}
