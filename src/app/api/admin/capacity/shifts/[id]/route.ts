import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateShiftEndDate } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/shifts/[id]");

type Params = { params: Promise<{ id: string }> };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * PATCH /api/admin/capacity/shifts/:id
 * Update effectiveEndDate on a single shift.
 * Body: { effectiveEndDate: "YYYY-MM-DD" | null }
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const shiftId = parseInt(id, 10);
    if (isNaN(shiftId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const { effectiveEndDate } = body;

    // Validate: must be null or ISO date string
    if (effectiveEndDate !== null && effectiveEndDate !== undefined) {
      if (typeof effectiveEndDate !== "string" || !ISO_DATE_RE.test(effectiveEndDate)) {
        return NextResponse.json(
          { error: "effectiveEndDate must be null or ISO date (YYYY-MM-DD)" },
          { status: 400 },
        );
      }
      // Validate it's a real date
      const parsed = new Date(effectiveEndDate + "T00:00:00Z");
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "effectiveEndDate is not a valid date" },
          { status: 400 },
        );
      }
    }

    const updated = updateShiftEndDate(shiftId, effectiveEndDate ?? null);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    log.info({ shiftId, effectiveEndDate: effectiveEndDate ?? null }, "Updated shift end date");
    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PATCH error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
