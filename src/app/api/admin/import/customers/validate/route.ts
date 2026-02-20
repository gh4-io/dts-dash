import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  parseCustomerCSV,
  parseCustomerJSON,
  validateCustomerImport,
} from "@/lib/data/master-data-import-utils";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/import/customers/validate");

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
        ? parseCustomerCSV(content)
        : parseCustomerJSON(content);

    if (!parseResult.valid) {
      return NextResponse.json(
        {
          valid: false,
          summary: { total: 0, toAdd: 0, toUpdate: 0, conflicts: 0 },
          records: { add: [], update: [] },
          warnings: parseResult.warnings,
          errors: parseResult.errors,
        },
        { status: 422 }
      );
    }

    // Validate import
    const validation = await validateCustomerImport(parseResult.data, "warn");

    return NextResponse.json({
      valid: validation.valid,
      summary: validation.summary,
      records: {
        add: validation.details.add,
        update: validation.details.update,
      },
      warnings: validation.details.warnings,
      errors: validation.details.errors,
    });
  } catch (error) {
    log.error({ err: error }, "Error");
    return NextResponse.json(
      {
        error: "Validation failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
