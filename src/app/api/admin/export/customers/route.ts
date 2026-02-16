import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportCustomersCSV } from "@/lib/data/master-data-import-utils";

export async function GET() {
  const session = await auth();

  if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const csv = await exportCustomersCSV();
    const date = new Date().toISOString().split("T")[0];

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="customers_${date}.csv"`,
      },
    });
  } catch (error) {
    console.error("[export-customers] Error:", error);
    return NextResponse.json(
      {
        error: "Export failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
