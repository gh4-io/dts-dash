import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadFlightEvent, updateFlightEvent, deleteFlightEvent } from "@/lib/capacity";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { createChildLogger } from "@/lib/logger";
import type { FlightEventStatus, FlightEventSource } from "@/types";

const log = createChildLogger("api/admin/capacity/flight-events/[id]");

const VALID_STATUSES: FlightEventStatus[] = ["planned", "scheduled", "actual", "cancelled"];
const VALID_SOURCES: FlightEventSource[] = ["work_package", "manual", "import"];

/**
 * GET /api/admin/capacity/flight-events/[id]
 * Get a single flight event. Admin only.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const numId = parseIntParam(id);
    if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const event = loadFlightEvent(numId);
    if (!event) {
      return NextResponse.json({ error: "Flight event not found" }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/capacity/flight-events/[id]
 * Update a flight event. Admin only.
 * Supports `addSuppressedDate` field for appending a single exception date.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const numId = parseIntParam(id);
    if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const existing = loadFlightEvent(numId);
    if (!existing) {
      return NextResponse.json({ error: "Flight event not found" }, { status: 404 });
    }

    const body = await request.json();

    // Handle addSuppressedDate — quick PATCH-like action
    if (body.addSuppressedDate) {
      const date = String(body.addSuppressedDate);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { error: "addSuppressedDate must be YYYY-MM-DD" },
          { status: 400 },
        );
      }
      const existingDates = existing.suppressedDates ?? [];
      if (!existingDates.includes(date)) {
        existingDates.push(date);
        existingDates.sort();
        updateFlightEvent(numId, { suppressedDates: existingDates });
      }
      const refreshed = loadFlightEvent(numId);
      return NextResponse.json(refreshed);
    }

    const updates: Record<string, unknown> = {};

    // aircraftReg — now nullable
    if (body.aircraftReg !== undefined) {
      if (body.aircraftReg === null || body.aircraftReg === "") {
        updates.aircraftReg = null;
      } else if (typeof body.aircraftReg === "string") {
        updates.aircraftReg = body.aircraftReg.trim();
      } else {
        return NextResponse.json(
          { error: "aircraftReg must be a string or null" },
          { status: 400 },
        );
      }
    }

    if (body.customer !== undefined) {
      if (typeof body.customer !== "string" || !body.customer.trim()) {
        return NextResponse.json({ error: "customer must be a non-empty string" }, { status: 400 });
      }
      updates.customer = body.customer.trim();
    }

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 },
        );
      }
      updates.status = body.status;
    }

    if (body.source !== undefined) {
      if (!VALID_SOURCES.includes(body.source)) {
        return NextResponse.json(
          { error: `source must be one of: ${VALID_SOURCES.join(", ")}` },
          { status: 400 },
        );
      }
      updates.source = body.source;
    }

    // Datetime fields — validate parseability
    const dtFields = [
      "scheduledArrival",
      "actualArrival",
      "scheduledDeparture",
      "actualDeparture",
    ] as const;
    for (const field of dtFields) {
      if (body[field] !== undefined) {
        if (body[field] !== null && body[field] !== "") {
          const d = new Date(body[field]);
          if (isNaN(d.getTime())) {
            return NextResponse.json(
              { error: `${field} is not a valid datetime` },
              { status: 400 },
            );
          }
        }
        updates[field] = body[field] || null;
      }
    }

    // Window durations
    if (body.arrivalWindowMinutes !== undefined) {
      const n = Number(body.arrivalWindowMinutes);
      if (isNaN(n) || n < 0) {
        return NextResponse.json(
          { error: "arrivalWindowMinutes must be a non-negative number" },
          { status: 400 },
        );
      }
      updates.arrivalWindowMinutes = n;
    }
    if (body.departureWindowMinutes !== undefined) {
      const n = Number(body.departureWindowMinutes);
      if (isNaN(n) || n < 0) {
        return NextResponse.json(
          { error: "departureWindowMinutes must be a non-negative number" },
          { status: 400 },
        );
      }
      updates.departureWindowMinutes = n;
    }

    if (body.workPackageId !== undefined) updates.workPackageId = body.workPackageId;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    // Recurrence fields
    if (body.isRecurring !== undefined) updates.isRecurring = body.isRecurring;
    if (body.dayPattern !== undefined) updates.dayPattern = body.dayPattern;
    if (body.recurrenceStart !== undefined) updates.recurrenceStart = body.recurrenceStart;
    if (body.recurrenceEnd !== undefined) updates.recurrenceEnd = body.recurrenceEnd;
    if (body.arrivalTimeUtc !== undefined) updates.arrivalTimeUtc = body.arrivalTimeUtc;
    if (body.departureTimeUtc !== undefined) updates.departureTimeUtc = body.departureTimeUtc;
    if (body.suppressedDates !== undefined) updates.suppressedDates = body.suppressedDates;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = updateFlightEvent(numId, updates);
    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/capacity/flight-events/[id]
 * Delete a flight event. Admin only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const numId = parseIntParam(id);
    if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const deleted = deleteFlightEvent(numId);
    if (!deleted) {
      return NextResponse.json({ error: "Flight event not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
