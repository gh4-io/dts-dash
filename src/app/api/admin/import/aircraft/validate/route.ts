import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  parseAircraftCSV,
  parseAircraftJSON,
  validateAircraftImport,
} from "@/lib/data/aircraft-import-utils";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { content, format } = body as {
      content: string;
      format: "csv" | "json";
    };

    if (!content || !format) {
      return NextResponse.json(
        { error: "Missing content or format" },
        { status: 400 }
      );
    }

    // Parse records
    const parseResult =
      format === "csv"
        ? parseAircraftCSV(content)
        : parseAircraftJSON(content);

    if (!parseResult.valid) {
      return NextResponse.json(
        {
          valid: false,
          summary: {
            total: 0,
            toAdd: 0,
            toUpdate: 0,
            conflicts: 0,
            invalidOperators: 0,
          },
          records: { add: [], update: [], fuzzyMatches: [] },
          warnings: parseResult.warnings,
          errors: parseResult.errors,
        },
        { status: 422 }
      );
    }

    // Validate import
    const validation = await validateAircraftImport(parseResult.data, "warn");

    return NextResponse.json({
      valid: validation.valid,
      summary: validation.summary,
      records: {
        add: validation.details.add,
        update: validation.details.update,
        fuzzyMatches: validation.details.fuzzyMatches,
      },
      warnings: validation.details.warnings,
      errors: validation.details.errors,
    });
  } catch (error) {
    console.error("[aircraft-validate] Error:", error);
    return NextResponse.json(
      {
        error: "Validation failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
      );
  }
}
