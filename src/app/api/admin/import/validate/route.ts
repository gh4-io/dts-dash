import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * POST /api/admin/import/validate
 * Validate JSON content before import — returns summary + warnings + errors
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { jsonContent } = body;

    if (!jsonContent || typeof jsonContent !== "string") {
      return NextResponse.json(
        { valid: false, errors: ["jsonContent (string) is required"] },
        { status: 400 }
      );
    }

    // Limit size (~10MB)
    if (jsonContent.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { valid: false, errors: ["JSON content exceeds 10MB limit"] },
        { status: 400 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      return NextResponse.json(
        { valid: false, summary: null, warnings: [], errors: ["Invalid JSON format"] },
        { status: 400 }
      );
    }

    // Handle both OData format ({ value: [...] }) and bare array
    const records = Array.isArray(parsed)
      ? parsed
      : (parsed as Record<string, unknown>).value ?? [];

    if (!Array.isArray(records)) {
      return NextResponse.json({
        valid: false,
        summary: null,
        warnings: [],
        errors: ["Expected an array of records or { value: [...] } OData format"],
      });
    }

    if (records.length === 0) {
      return NextResponse.json({
        valid: false,
        summary: null,
        warnings: [],
        errors: ["No records found in JSON data"],
      });
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    records.forEach((rec: Record<string, unknown>, idx: number) => {
      const aircraft = rec.Aircraft as Record<string, unknown> | undefined;
      if (!aircraft?.Title) {
        errors.push(`Record ${idx + 1}: missing Aircraft.Title`);
      }
      if (!rec.Arrival && !rec.Departure) {
        errors.push(`Record ${idx + 1}: missing both Arrival and Departure dates`);
      }
    });

    // Cap error reporting
    if (errors.length > 20) {
      const total = errors.length;
      errors.length = 20;
      errors.push(`... and ${total - 20} more errors`);
    }

    // Compute summary stats
    const customerSet = new Set<string>();
    const aircraftSet = new Set<string>();
    const timestamps: number[] = [];

    for (const rec of records) {
      const r = rec as Record<string, unknown>;
      if (r.Customer) customerSet.add(String(r.Customer));
      const aircraft = r.Aircraft as Record<string, unknown> | undefined;
      if (aircraft?.Title) aircraftSet.add(String(aircraft.Title));

      for (const field of ["Arrival", "Departure"]) {
        const val = r[field];
        if (val) {
          const ts = new Date(String(val)).getTime();
          if (!isNaN(ts)) timestamps.push(ts);
        }
      }
    }

    const dateRange = timestamps.length > 0
      ? {
          start: new Date(Math.min(...timestamps)).toISOString(),
          end: new Date(Math.max(...timestamps)).toISOString(),
        }
      : null;

    // Warnings
    const missingMH = records.filter(
      (r: Record<string, unknown>) => r.TotalMH == null
    ).length;
    if (missingMH > 0) {
      warnings.push(`${missingMH} record${missingMH !== 1 ? "s" : ""} missing TotalMH (will use default 3.0)`);
    }

    const missingType = records.filter((r: Record<string, unknown>) => {
      const aircraft = r.Aircraft as Record<string, unknown> | undefined;
      return !aircraft?.AircraftType;
    }).length;
    if (missingType > 0) {
      warnings.push(`${missingType} record${missingType !== 1 ? "s" : ""} missing AircraftType`);
    }

    return NextResponse.json({
      valid: errors.length === 0,
      summary: {
        recordCount: records.length,
        customerCount: customerSet.size,
        aircraftCount: aircraftSet.size,
        dateRange,
      },
      warnings,
      errors,
    });
  } catch (error) {
    console.error("[api/admin/import/validate] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
