/**
 * /api/admin/mh-overrides/[spId] — per-work-package override CRUD (OI-104).
 *
 * GET    read the MH picture for one work package (imported / override / who)
 * PUT    save an override
 * DELETE clear it
 *
 * `[spId]` is the SharePoint id, matching the convention of
 * `/api/work-packages/[id]/…` and the `wp.id` the flight board drawer holds.
 * Admin or superadmin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import {
  applyOverride,
  clearOverride,
  getOverrideDetail,
  listHistory,
  resolveWorkPackageBySpId,
} from "@/lib/mh-overrides/data";
import { parseMHValue } from "@/lib/mh-overrides/rules";

const log = createChildLogger("api/admin/mh-overrides/[spId]");

/** Resolve `[spId]` to an internal work package id, or an error response. */
async function resolveParam(
  params: Promise<{ spId: string }>,
): Promise<{ id: number } | { response: NextResponse }> {
  const { spId } = await params;
  const parsed = Number(spId);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return { response: NextResponse.json({ error: "Invalid spId" }, { status: 400 }) };
  }

  const id = resolveWorkPackageBySpId(parsed);
  if (!id) {
    return { response: NextResponse.json({ error: "Work package not found" }, { status: 404 }) };
  }

  return { id };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ spId: string }> }) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const target = await resolveParam(params);
    if ("response" in target) return target.response;

    return NextResponse.json({
      detail: getOverrideDetail(target.id),
      history: listHistory({ workPackageId: target.id, limit: 50 }),
    });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ spId: string }> }) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const target = await resolveParam(params);
    if ("response" in target) return target.response;

    const body = await request.json();
    const parsed = parseMHValue(body.overrideMH);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = applyOverride({
      workPackageId: target.id,
      suppliedMH: parsed.value,
      userId: getSessionUserId(session),
      source: "drawer",
      note: typeof body.note === "string" ? body.note : null,
    });

    log.info(
      { workPackageId: target.id, action: result.decision.action },
      "MH override save processed",
    );

    return NextResponse.json(result);
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ spId: string }> },
) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const target = await resolveParam(params);
    if ("response" in target) return target.response;

    const result = clearOverride({
      workPackageId: target.id,
      userId: getSessionUserId(session),
      source: "drawer",
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
