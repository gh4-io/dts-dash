import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  parseCustomerCSV,
  parseCustomerJSON,
  commitCustomerImport,
} from "@/lib/data/master-data-import-utils";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";

const log = createChildLogger("api/admin/import/customers/commit");

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      content,
      format,
      source,
      fileName,
      overrideConflicts = false,
    } = body as {
      content: string;
      format: "csv" | "json";
      source: "file" | "paste" | "api";
      fileName?: string;
      overrideConflicts?: boolean;
    };

    if (!content || !format || !source) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Parse records
    const parseResult = format === "csv" ? parseCustomerCSV(content) : parseCustomerJSON(content);

    if (!parseResult.valid) {
      return NextResponse.json(
        {
          success: false,
          errors: parseResult.errors,
          warnings: parseResult.warnings,
        },
        { status: 422 },
      );
    }

    // Commit import
    const userId = getSessionUserId(session);
    const result = await commitCustomerImport(parseResult.data, {
      source,
      fileName,
      userId,
      overrideConflicts,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    log.error({ err: error }, "Error");
    return NextResponse.json(
      {
        success: false,
        error: "Import failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
