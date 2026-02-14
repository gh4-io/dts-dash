import { seed } from "@/lib/db/seed";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await seed();
    return NextResponse.json({ success: true, message: "Database seeded successfully" });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
