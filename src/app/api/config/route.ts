import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { appConfig } from "@/lib/db/schema";
import { invalidateTransformerCache } from "@/lib/data/transformer";
import { createChildLogger } from "@/lib/logger";
import {
  DEFAULT_MH,
  DEFAULT_THEORETICAL_CAPACITY_PER_PERSON,
  DEFAULT_REAL_CAPACITY_PER_PERSON,
  DEFAULT_SHIFTS_JSON,
  DEFAULT_INGEST_RATE_LIMIT_SECONDS,
  DEFAULT_INGEST_MAX_SIZE_MB,
  DEFAULT_INGEST_CHUNK_TIMEOUT_SECONDS,
} from "@/lib/data/config-defaults";

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
      defaultMH: parseFloat(configMap.defaultMH ?? String(DEFAULT_MH)),
      wpMHMode: configMap.wpMHMode ?? "exclude",
      theoreticalCapacityPerPerson: parseFloat(
        configMap.theoreticalCapacityPerPerson ?? String(DEFAULT_THEORETICAL_CAPACITY_PER_PERSON),
      ),
      realCapacityPerPerson: parseFloat(
        configMap.realCapacityPerPerson ?? String(DEFAULT_REAL_CAPACITY_PER_PERSON),
      ),
      shifts: JSON.parse(configMap.shifts ?? DEFAULT_SHIFTS_JSON),
      ingestApiKey: configMap.ingestApiKey ?? "",
      ingestRateLimitSeconds: parseInt(
        configMap.ingestRateLimitSeconds ?? String(DEFAULT_INGEST_RATE_LIMIT_SECONDS),
        10,
      ),
      ingestMaxSizeMB: parseInt(
        configMap.ingestMaxSizeMB ?? String(DEFAULT_INGEST_MAX_SIZE_MB),
        10,
      ),
      ingestChunkTimeoutSeconds: parseInt(
        configMap.ingestChunkTimeoutSeconds ?? String(DEFAULT_INGEST_CHUNK_TIMEOUT_SECONDS),
        10,
      ),
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
      registrationEnabled: configMap.registrationEnabled === "true",
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
      "ingestApiKey",
      "ingestRateLimitSeconds",
      "ingestMaxSizeMB",
      "ingestChunkTimeoutSeconds",
      "allowedHostnames",
      "registrationEnabled",
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
