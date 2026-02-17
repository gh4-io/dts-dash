import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { userPreferences, appConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/account/preferences");

const VALID_COLOR_MODES = ["light", "dark", "system"] as const;
const VALID_PRESETS = [
  "neutral",
  "ocean",
  "purple",
  "black",
  "vitepress",
  "dusk",
  "catppuccin",
  "solar",
  "emerald",
  "ruby",
  "aspen",
] as const;
const VALID_DATE_RANGES = ["1d", "3d", "1w"] as const;
const VALID_ZOOM_LEVELS = ["6h", "12h", "1d", "3d", "1w", "all"] as const;

/** Read timeline defaults from appConfig (DB). Returns hardcoded fallbacks if no rows. */
function getSystemTimelineConfig(): {
  defaultTimezone: string;
  timelineStartOffset: number;
  timelineEndOffset: number;
  timelineDefaultZoom: string;
  timelineDefaultCompact: boolean;
} {
  const rows = db.select().from(appConfig).all();
  const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    defaultTimezone: cfg.defaultTimezone ?? "America/New_York",
    timelineStartOffset: parseInt(cfg.timelineStartOffset ?? "-3", 10),
    timelineEndOffset: parseInt(cfg.timelineEndOffset ?? "7", 10),
    timelineDefaultZoom: cfg.timelineDefaultZoom ?? "3d",
    timelineDefaultCompact: (cfg.timelineDefaultCompact ?? "false") === "true",
  };
}
const VALID_TIME_FORMATS = ["12h", "24h"] as const;
const VALID_PAGE_SIZES = [10, 25, 30, 50, 100] as const;

/**
 * GET /api/account/preferences
 * Fetch current user's preferences.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prefs = db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, session.user.id))
      .get();

    const sys = getSystemTimelineConfig();

    if (!prefs) {
      // New user — return system config as defaults
      return NextResponse.json({
        colorMode: "dark",
        themePreset: "vitepress",
        accentColor: null,
        compactMode: sys.timelineDefaultCompact,
        defaultTimezone: sys.defaultTimezone,
        defaultDateRange: null,
        defaultStartOffset: sys.timelineStartOffset,
        defaultEndOffset: sys.timelineEndOffset,
        defaultZoom: sys.timelineDefaultZoom,
        timeFormat: "24h",
        tablePageSize: 30,
      });
    }

    return NextResponse.json({
      colorMode: prefs.colorMode,
      themePreset: prefs.themePreset,
      accentColor: prefs.accentColor,
      compactMode: prefs.compactMode,
      defaultTimezone: prefs.defaultTimezone,
      defaultDateRange: prefs.defaultDateRange ?? null,
      defaultStartOffset: sys.timelineStartOffset,
      defaultEndOffset: sys.timelineEndOffset,
      defaultZoom: prefs.defaultZoom ?? sys.timelineDefaultZoom,
      timeFormat: prefs.timeFormat,
      tablePageSize: prefs.tablePageSize,
    });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/account/preferences
 * Update current user's preferences.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate fields
    if (body.colorMode && !VALID_COLOR_MODES.includes(body.colorMode)) {
      return NextResponse.json({ error: "Invalid color mode" }, { status: 400 });
    }
    if (body.themePreset && !VALID_PRESETS.includes(body.themePreset)) {
      return NextResponse.json({ error: "Invalid theme preset" }, { status: 400 });
    }
    if (body.defaultDateRange && !VALID_DATE_RANGES.includes(body.defaultDateRange)) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    if (body.defaultZoom && !VALID_ZOOM_LEVELS.includes(body.defaultZoom)) {
      return NextResponse.json({ error: "Invalid zoom level" }, { status: 400 });
    }
    if (body.timeFormat && !VALID_TIME_FORMATS.includes(body.timeFormat)) {
      return NextResponse.json({ error: "Invalid time format" }, { status: 400 });
    }
    if (body.tablePageSize && !VALID_PAGE_SIZES.includes(body.tablePageSize)) {
      return NextResponse.json({ error: "Invalid page size" }, { status: 400 });
    }
    if (
      body.accentColor !== null &&
      body.accentColor !== undefined &&
      typeof body.accentColor === "string" &&
      body.accentColor.length > 0 &&
      !/^[0-9]+\s+[0-9.]+%\s+[0-9.]+%$/.test(body.accentColor) &&
      !/^#[0-9a-fA-F]{6}$/.test(body.accentColor)
    ) {
      return NextResponse.json({ error: "Invalid accent color format" }, { status: 400 });
    }

    const values = {
      userId: session.user.id,
      colorMode: body.colorMode ?? "dark",
      themePreset: body.themePreset ?? "vitepress",
      accentColor: body.accentColor ?? null,
      compactMode: body.compactMode ?? false,
      defaultTimezone: body.defaultTimezone ?? "UTC",
      defaultDateRange: body.defaultDateRange ?? null,
      defaultZoom: body.defaultZoom ?? null,
      timeFormat: body.timeFormat ?? "24h",
      tablePageSize: body.tablePageSize ?? 30,
    };

    // Upsert
    db.insert(userPreferences)
      .values(values)
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          colorMode: values.colorMode,
          themePreset: values.themePreset,
          accentColor: values.accentColor,
          compactMode: values.compactMode,
          defaultTimezone: values.defaultTimezone,
          defaultDateRange: values.defaultDateRange,
          defaultZoom: values.defaultZoom,
          timeFormat: values.timeFormat,
          tablePageSize: values.tablePageSize,
        },
      })
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
