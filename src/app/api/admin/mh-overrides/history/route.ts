/**
 * GET /api/admin/mh-overrides/history — MH override audit trail (OI-104).
 *
 * Query: `?workPackageId=` to narrow, `?limit=` (default 500),
 *        `?format=csv` to download the before/after export.
 *
 * Admin or superadmin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { listHistory, toCsv, HISTORY_CSV_COLUMNS } from "@/lib/mh-overrides/data";

const log = createChildLogger("api/admin/mh-overrides/history");

const MAX_LIMIT = 5000;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const isCsv = params.get("format") === "csv";

    const rawLimit = Number(params.get("limit"));
    const limit =
      Number.isInteger(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, MAX_LIMIT)
        : isCsv
          ? MAX_LIMIT
          : 500;

    const rawWpId = Number(params.get("workPackageId"));
    const workPackageId = Number.isInteger(rawWpId) && rawWpId > 0 ? rawWpId : undefined;

    const rows = listHistory({ workPackageId, limit });

    if (isCsv) {
      return new NextResponse(toCsv(rows, HISTORY_CSV_COLUMNS), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="mh-override-history-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ history: rows, count: rows.length });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
