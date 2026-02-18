import { db } from "./client";
import { createTables, runMigrations } from "./schema-init";
import * as schema from "./schema";
import { hashSync } from "bcryptjs";
import { eq } from "drizzle-orm";
import { isCanceled } from "@/lib/utils/status";
import {
  SEED_USERS,
  SEED_CUSTOMERS,
  SEED_AIRCRAFT_TYPE_MAPPINGS,
  SEED_APP_CONFIG,
  SEED_MANUFACTURERS,
  SEED_AIRCRAFT_MODELS,
  SEED_ENGINE_TYPES,
  SEED_WORK_PACKAGES,
} from "./seed-data";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("seed");

// ─── Seed Options ─────────────────────────────────────────────────────────────

export interface SeedOptions {
  /** Seed ALL data (customers, manufacturers, models, engines, work packages).
   *  When false, seeds only: users, system user, aircraft type mappings, app config.
   *  @default true */
  full?: boolean;
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

export async function seedData(options: SeedOptions = {}) {
  const { full = true } = options;
  const now = new Date().toISOString();

  // Track system user ID for later FK references
  let systemUserId: number | null = null;

  // ─── Users ─────────────────────────────────────────────────────────────────

  const existingAdmin = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "admin@local"))
    .get();

  if (!existingAdmin) {
    const isProd = process.env.NODE_ENV === "production";
    const envEmail = process.env.INITIAL_ADMIN_EMAIL;
    const envPassword = process.env.INITIAL_ADMIN_PASSWORD;

    if (envEmail && envPassword) {
      // Use env-provided credentials
      db.insert(schema.users)
        .values({
          authId: crypto.randomUUID(),
          email: envEmail.toLowerCase(),
          username: null,
          displayName: "Admin",
          passwordHash: hashSync(envPassword, 10),
          role: "superadmin" as const,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      log.info("Seeded admin user from INITIAL_ADMIN_EMAIL env var.");
    } else if (!isProd) {
      // Development only: use seed file defaults
      const regularUsers = SEED_USERS.filter((u) => u.password !== "");
      if (regularUsers.length > 0) {
        db.insert(schema.users)
          .values(
            regularUsers.map((u) => ({
              authId: u.authId || crypto.randomUUID(),
              email: u.email,
              username: u.username,
              displayName: u.displayName,
              passwordHash: hashSync(u.password, 10),
              role: u.role,
              isActive: u.isActive,
              createdAt: now,
              updatedAt: now,
            })),
          )
          .run();
        log.info(
          `Seeded ${regularUsers.length} dev users. Default passwords — change after first login.`,
        );
      }
    } else {
      log.warn(
        "No INITIAL_ADMIN_EMAIL/PASSWORD set. Skipping user seed — use /setup for first-run.",
      );
    }
  }

  // ─── System User ──────────────────────────────────────────────────────────

  const systemUserSeed = SEED_USERS.find((u) => u.password === "");
  if (systemUserSeed) {
    const systemAuthId = systemUserSeed.authId || "00000000-0000-0000-0000-000000000000";
    const existingSystem = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.authId, systemAuthId))
      .get();

    if (!existingSystem) {
      const row = db
        .insert(schema.users)
        .values({
          authId: systemAuthId,
          email: systemUserSeed.email,
          displayName: systemUserSeed.displayName,
          passwordHash: "",
          role: systemUserSeed.role,
          isActive: systemUserSeed.isActive,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.users.id })
        .get();
      systemUserId = row.id;
      log.info("Seeded system user for API ingestion");
    } else {
      systemUserId = existingSystem.id;
    }
  }

  // ─── Customers (full only) ─────────────────────────────────────────────────

  if (full) {
    const existingCustomers = db.select().from(schema.customers).all();

    if (existingCustomers.length === 0) {
      db.insert(schema.customers)
        .values(
          SEED_CUSTOMERS.map((c) => ({
            ...c,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .run();

      log.info(`Seeded ${SEED_CUSTOMERS.length} customers with colors`);
    }
  }

  // ─── Aircraft Type Mappings ───────────────────────────────────────────────

  const existingMappings = db.select().from(schema.aircraftTypeMappings).all();

  if (existingMappings.length === 0) {
    db.insert(schema.aircraftTypeMappings)
      .values(
        SEED_AIRCRAFT_TYPE_MAPPINGS.map((m) => ({
          ...m,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .run();

    log.info(`Seeded ${SEED_AIRCRAFT_TYPE_MAPPINGS.length} aircraft type mappings`);
  }

  // ─── App Config ───────────────────────────────────────────────────────────

  const existingConfig = db.select().from(schema.appConfig).all();

  if (existingConfig.length === 0) {
    db.insert(schema.appConfig)
      .values(SEED_APP_CONFIG.map((d) => ({ ...d, updatedAt: now })))
      .run();
    log.info("Seeded default app configuration");
  } else {
    // Idempotent: add any missing config keys
    for (const d of SEED_APP_CONFIG) {
      const existing = db
        .select()
        .from(schema.appConfig)
        .where(eq(schema.appConfig.key, d.key))
        .get();
      if (!existing) {
        db.insert(schema.appConfig)
          .values({ ...d, updatedAt: now })
          .run();
        log.info(`Seeded config: ${d.key} = ${d.value || "(empty)"}`);
      }
    }
  }

  // ─── Cron Jobs ──────────────────────────────────────────────────────────
  // Built-in cron jobs are defined in code (src/lib/cron/index.ts),
  // overrides live in server.config.yml. No DB seeding needed.

  // ─── Manufacturers (full only) ─────────────────────────────────────────────

  if (full) {
    const existingManufacturers = db.select().from(schema.manufacturers).all();

    if (existingManufacturers.length === 0) {
      db.insert(schema.manufacturers)
        .values(
          SEED_MANUFACTURERS.map((m) => ({
            ...m,
            isActive: true,
          })),
        )
        .run();

      log.info(`Seeded ${SEED_MANUFACTURERS.length} manufacturers`);
    }
  }

  // ─── Aircraft Models (full only) ───────────────────────────────────────────

  if (full) {
    const existingModels = db.select().from(schema.aircraftModels).all();

    if (existingModels.length === 0) {
      // Map manufacturer name to ID for FK reference
      const manufacturerMap = new Map(
        db
          .select()
          .from(schema.manufacturers)
          .all()
          .map((m) => [m.name, m.id]),
      );

      db.insert(schema.aircraftModels)
        .values(
          SEED_AIRCRAFT_MODELS.map((m) => ({
            modelCode: m.modelCode,
            canonicalType: m.canonicalType,
            manufacturerId: manufacturerMap.get(m.manufacturer) || null,
            displayName: m.displayName,
            sortOrder: m.sortOrder,
            isActive: true,
          })),
        )
        .run();

      log.info(`Seeded ${SEED_AIRCRAFT_MODELS.length} aircraft models`);
    }
  }

  // ─── Engine Types (full only) ──────────────────────────────────────────────

  if (full) {
    const existingEngines = db.select().from(schema.engineTypes).all();

    if (existingEngines.length === 0) {
      db.insert(schema.engineTypes)
        .values(
          SEED_ENGINE_TYPES.map((e) => ({
            ...e,
            isActive: true,
          })),
        )
        .run();

      log.info(`Seeded ${SEED_ENGINE_TYPES.length} engine types`);
    }
  }

  // ─── Work Packages (full only, D-029) ──────────────────────────────────────

  if (full) {
    const existingWPs = db.select().from(schema.workPackages).all();

    // Filter out any canceled WPs from seed data (defensive)
    const activeWPs = SEED_WORK_PACKAGES.filter((wp) => !isCanceled(wp.Workpackage_x0020_Status));

    if (existingWPs.length === 0 && activeWPs.length > 0) {
      const now = new Date().toISOString();

      // Resolve system user ID for the import log FK
      if (!systemUserId) {
        const sysUser = db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.authId, "00000000-0000-0000-0000-000000000000"))
          .get();
        systemUserId = sysUser?.id ?? null;
      }

      // Create a seed import log entry
      const logRow = db
        .insert(schema.importLog)
        .values({
          importedAt: now,
          recordCount: activeWPs.length,
          source: "file",
          fileName: "work-packages.json (seed)",
          importedBy: systemUserId ?? 1,
          status: "success",
          errors: null,
        })
        .returning({ id: schema.importLog.id })
        .get();

      for (const wp of activeWPs) {
        db.insert(schema.workPackages)
          .values({
            guid: wp.GUID,
            spId: wp.ID ?? null,
            title: wp.Title ?? null,
            aircraftReg: wp.Aircraft.Title,
            aircraftType: wp.Aircraft.field_5 ?? null,
            customer: wp.Customer,
            customerRef: wp.CustomerReference ?? null,
            flightId: wp.FlightId ?? null,
            arrival: wp.Arrival,
            departure: wp.Departure,
            totalMH: wp.TotalMH ?? null,
            totalGroundHours: wp.TotalGroundHours ?? null,
            status: wp.Workpackage_x0020_Status ?? "New",
            description: wp.Description ?? null,
            parentId: wp.ParentID ?? null,
            hasWorkpackage: wp.HasWorkpackage ?? null,
            workpackageNo: wp.WorkpackageNo ?? null,
            calendarComments: wp.CalendarComments ?? null,
            isNotClosedOrCanceled: wp.IsNotClosedOrCanceled ?? null,
            documentSetId: wp.DocumentSetID ?? null,
            aircraftSpId: wp.AircraftId ?? null,
            spModified: wp.Modified ?? null,
            spCreated: wp.Created ?? null,
            spVersion: wp.OData__UIVersionString ?? null,
            importLogId: logRow.id,
            importedAt: now,
          })
          .run();
      }

      log.info(`Seeded ${activeWPs.length} work packages`);
    }
  }

  log.info(full ? "Full seeding complete." : "Minimal seeding complete.");
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function seed() {
  log.info("Seeding database...");
  createTables();
  runMigrations();
  await seedData();
}

export async function devSeed(full = false) {
  log.info(full ? "Dev-seeding database (full)..." : "Dev-seeding database (minimal)...");
  createTables();
  runMigrations();
  await seedData({ full });
}

// Allow running directly
if (require.main === module) {
  seed().catch((err) => log.error({ err }, "Seed failed"));
}
