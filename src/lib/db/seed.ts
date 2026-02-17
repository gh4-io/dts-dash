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

function generateId(): string {
  return crypto.randomUUID();
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

export async function seedData() {
  const now = new Date().toISOString();

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
          id: generateId(),
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
              id: u.id || generateId(),
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

  const systemUser = SEED_USERS.find((u) => u.password === "");
  if (systemUser) {
    const existingSystem = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, systemUser.id!))
      .get();

    if (!existingSystem) {
      db.insert(schema.users)
        .values({
          id: systemUser.id!,
          email: systemUser.email,
          displayName: systemUser.displayName,
          passwordHash: "",
          role: systemUser.role,
          isActive: systemUser.isActive,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      log.info("Seeded system user for API ingestion");
    }
  }

  // ─── Customers ────────────────────────────────────────────────────────────

  const existingCustomers = db.select().from(schema.customers).all();

  if (existingCustomers.length === 0) {
    db.insert(schema.customers)
      .values(
        SEED_CUSTOMERS.map((c) => ({
          id: generateId(),
          ...c,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .run();

    log.info(`Seeded ${SEED_CUSTOMERS.length} customers with colors`);
  }

  // ─── Aircraft Type Mappings ───────────────────────────────────────────────

  const existingMappings = db.select().from(schema.aircraftTypeMappings).all();

  if (existingMappings.length === 0) {
    db.insert(schema.aircraftTypeMappings)
      .values(
        SEED_AIRCRAFT_TYPE_MAPPINGS.map((m) => ({
          id: generateId(),
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

  const existingCronJobs = db.select().from(schema.cronJobs).all();

  if (existingCronJobs.length === 0) {
    db.insert(schema.cronJobs)
      .values({
        id: "cleanup-canceled",
        name: "Cleanup Canceled WPs",
        schedule: "0 */6 * * *",
        enabled: true,
        graceHours: 6,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    log.info("Seeded cron job: cleanup-canceled (every 6 hours, 6h grace)");
  } else {
    // Ensure cleanup-canceled job exists (idempotent)
    const existing = db
      .select()
      .from(schema.cronJobs)
      .where(eq(schema.cronJobs.id, "cleanup-canceled"))
      .get();
    if (!existing) {
      db.insert(schema.cronJobs)
        .values({
          id: "cleanup-canceled",
          name: "Cleanup Canceled WPs",
          schedule: "0 */6 * * *",
          enabled: true,
          graceHours: 6,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      log.info("Seeded missing cron job: cleanup-canceled");
    }
  }

  // ─── Manufacturers ────────────────────────────────────────────────────────

  const existingManufacturers = db.select().from(schema.manufacturers).all();

  if (existingManufacturers.length === 0) {
    db.insert(schema.manufacturers)
      .values(
        SEED_MANUFACTURERS.map((m) => ({
          id: generateId(),
          ...m,
          isActive: true,
        })),
      )
      .run();

    log.info(`Seeded ${SEED_MANUFACTURERS.length} manufacturers`);
  }

  // ─── Aircraft Models ──────────────────────────────────────────────────────

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
          id: generateId(),
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

  // ─── Engine Types ─────────────────────────────────────────────────────────

  const existingEngines = db.select().from(schema.engineTypes).all();

  if (existingEngines.length === 0) {
    db.insert(schema.engineTypes)
      .values(
        SEED_ENGINE_TYPES.map((e) => ({
          id: generateId(),
          ...e,
          isActive: true,
        })),
      )
      .run();

    log.info(`Seeded ${SEED_ENGINE_TYPES.length} engine types`);
  }

  // ─── Work Packages (D-029) ────────────────────────────────────────────────

  const existingWPs = db.select().from(schema.workPackages).all();

  // Filter out any canceled WPs from seed data (defensive)
  const activeWPs = SEED_WORK_PACKAGES.filter((wp) => !isCanceled(wp.Workpackage_x0020_Status));

  if (existingWPs.length === 0 && activeWPs.length > 0) {
    const now = new Date().toISOString();

    // Create a seed import log entry
    const seedLogId = generateId();
    db.insert(schema.importLog)
      .values({
        id: seedLogId,
        importedAt: now,
        recordCount: activeWPs.length,
        source: "file",
        fileName: "work-packages.json (seed)",
        importedBy: systemUser?.id ?? "00000000-0000-0000-0000-000000000000",
        status: "success",
        errors: null,
      })
      .run();

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
          importLogId: seedLogId,
          importedAt: now,
        })
        .run();
    }

    log.info(`Seeded ${activeWPs.length} work packages`);
  }

  log.info("Seeding complete.");
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function seed() {
  log.info("Seeding database...");
  createTables();
  runMigrations();
  await seedData();
}

// Allow running directly
if (require.main === module) {
  seed().catch((err) => log.error({ err }, "Seed failed"));
}
