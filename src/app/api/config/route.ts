import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { appConfig } from "@/lib/db/schema";
import { invalidateTransformerCache } from "@/lib/data/transformer";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/config");

/**
 * GET /api/config
 * Returns app configuration
 * Requires authentication
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const configRows = await db.select().from(appConfig);
    const configMap = Object.fromEntries(configRows.map((r) => [r.key, r.value]));

    // Parse JSON values
    const config = {
      defaultMH: parseFloat(configMap.defaultMH ?? "3.0"),
      wpMHMode: configMap.wpMHMode ?? "exclude",
      theoreticalCapacityPerPerson: parseFloat(configMap.theoreticalCapacityPerPerson ?? "8.0"),
      realCapacityPerPerson: parseFloat(configMap.realCapacityPerPerson ?? "6.5"),
      shifts: JSON.parse(
        configMap.shifts ??
          JSON.stringify([
            { name: "Day", startHour: 7, endHour: 15, headcount: 8 },
            { name: "Swing", startHour: 15, endHour: 23, headcount: 6 },
            { name: "Night", startHour: 23, endHour: 7, headcount: 4 },
          ]),
      ),
      timelineDefaultDays: parseInt(configMap.timelineDefaultDays ?? "3", 10),
      defaultTimezone: configMap.defaultTimezone ?? "America/New_York",
      timelineStartOffset: parseInt(configMap.timelineStartOffset ?? "-3", 10),
      timelineEndOffset: parseInt(configMap.timelineEndOffset ?? "7", 10),
      timelineDefaultZoom: configMap.timelineDefaultZoom ?? "3d",
      timelineDefaultCompact: (configMap.timelineDefaultCompact ?? "false") === "true",
      ingestApiKey: configMap.ingestApiKey ?? "",
      ingestRateLimitSeconds: parseInt(configMap.ingestRateLimitSeconds ?? "60", 10),
      ingestMaxSizeMB: parseInt(configMap.ingestMaxSizeMB ?? "50", 10),
      ingestChunkTimeoutSeconds: parseInt(configMap.ingestChunkTimeoutSeconds ?? "300", 10),
      allowedHostnames: JSON.parse(
        configMap.allowedHostnames ??
          JSON.stringify([
            {
              id: "default-localhost",
              hostname: "localhost",
              port: 3000,
              protocol: "http",
              enabled: true,
              label: "Local Development",
            },
          ]),
      ),
    };

    return NextResponse.json(config);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/config
 * Update app configuration
 * Requires admin role
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Whitelist of allowed config keys
    const ALLOWED_CONFIG_KEYS = new Set([
      "defaultMH",
      "wpMHMode",
      "theoreticalCapacityPerPerson",
      "realCapacityPerPerson",
      "shifts",
      "timelineDefaultDays",
      "defaultTimezone",
      "timelineStartOffset",
      "timelineEndOffset",
      "timelineDefaultZoom",
      "timelineDefaultCompact",
      "ingestApiKey",
      "ingestRateLimitSeconds",
      "ingestMaxSizeMB",
      "ingestChunkTimeoutSeconds",
      "allowedHostnames",
    ]);

    // Update config keys
    const updates = Object.entries(body)
      .filter(([key]) => {
        if (!ALLOWED_CONFIG_KEYS.has(key)) {
          log.warn(`Rejected unknown config key: ${key}`);
          return false;
        }
        return true;
      })
      .map(([key, value]) => {
        let stringValue: string;
        if (typeof value === "object") {
          stringValue = JSON.stringify(value);
        } else {
          stringValue = String(value);
        }

        return { key, value: stringValue };
      });

    for (const update of updates) {
      await db
        .insert(appConfig)
        .values({
          key: update.key,
          value: update.value,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: appConfig.key,
          set: {
            value: update.value,
            updatedAt: new Date().toISOString(),
          },
        });
    }

    // Invalidate transformer cache (affects effectiveMH calculation)
    invalidateTransformerCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
