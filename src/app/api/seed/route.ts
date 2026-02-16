import { seed } from "@/lib/db/seed";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  // Require explicit opt-in via env var
  if (process.env.ENABLE_SEED_ENDPOINT !== "true") {
    return NextResponse.json(null, { status: 404 });
  }

  // In production, require superadmin auth
  if (process.env.NODE_ENV === "production") {
    const session = await auth();
    if (!session || session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    await seed();
    return NextResponse.json({ success: true, message: "Database seeded successfully" });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
