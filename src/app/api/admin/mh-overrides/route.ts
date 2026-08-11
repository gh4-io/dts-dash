/**
 * /api/admin/mh-overrides — collection endpoints for manual MH overrides (OI-104).
 *
 * GET    list every current override (`?format=csv` to download)
 * POST   create or update one override
 * DELETE clear one override (`?spId=` or `?workPackageId=`)
 *
 * Admin or superadmin only. Every mutation records the acting user and a
 * timestamp, and refreshes the transformer cache so the flight board and
 * /capacity see the change on their next request.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import {
  applyOverride,
  clearOverride,
  listOverrides,
  resolveWorkPackageBySpId,
  toCsv,
  OVERRIDES_CSV_COLUMNS,
} from "@/lib/mh-overrides/data";
import { parseMHValue } from "@/lib/mh-overrides/rules";

const log = createChildLogger("api/admin/mh-overrides");

/**
 * Resolve the target work package from a `spId` / `workPackageId` pair.
 * `spId` is the SharePoint id the flight board exposes as `wp.id`.
 */
function resolveTarget(input: {
  spId?: unknown;
  workPackageId?: unknown;
}): { id: number } | { error: string; status: number } {
  if (input.workPackageId != null) {
    const id = Number(input.workPackageId);
    if (!Number.isInteger(id) || id < 1) {
      return { error: "workPackageId must be a positive integer", status: 400 };
    }
    return { id };
  }

  if (input.spId != null) {
    const spId = Number(input.spId);
    if (!Number.isInteger(spId) || spId < 1) {
      return { error: "spId must be a positive integer", status: 400 };
    }
    const id = resolveWorkPackageBySpId(spId);
    if (!id) return { error: "Work package not found", status: 404 };
    return { id };
  }

  return { error: "spId or workPackageId is required", status: 400 };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = listOverrides();

    if (request.nextUrl.searchParams.get("format") === "csv") {
      return new NextResponse(toCsv(rows, OVERRIDES_CSV_COLUMNS), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="mh-overrides-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ overrides: rows, count: rows.length });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const target = resolveTarget(body);
    if ("error" in target) {
      return NextResponse.json({ error: target.error }, { status: target.status });
    }

    const parsed = parseMHValue(body.overrideMH);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    let minHours: number | null = null;
    if (body.minHours != null && body.minHours !== "") {
      const parsedMin = parseMHValue(body.minHours);
      if ("error" in parsedMin) {
        return NextResponse.json({ error: `minHours: ${parsedMin.error}` }, { status: 400 });
      }
      minHours = parsedMin.value;
    }

    const result = applyOverride({
      workPackageId: target.id,
      suppliedMH: parsed.value,
      minHours,
      userId: getSessionUserId(session),
      source: "api",
      note: typeof body.note === "string" ? body.note : null,
    });

    log.info(
      { workPackageId: target.id, action: result.decision.action },
      "MH override save processed",
    );

    return NextResponse.json(result);
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const target = resolveTarget({
      spId: params.get("spId"),
      workPackageId: params.get("workPackageId"),
    });
    if ("error" in target) {
      return NextResponse.json({ error: target.error }, { status: target.status });
    }

    const result = clearOverride({
      workPackageId: target.id,
      userId: getSessionUserId(session),
      source: "api",
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
