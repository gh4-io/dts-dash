#!/usr/bin/env npx tsx
/**
 * db:seed-reference — Seed reference/lookup tables only.
 * Never touches users, customers, work_packages, or aircraft.
 * Idempotent — uses ON CONFLICT DO NOTHING for all inserts.
 *
 * Seeds:
 *   - aircraft_type_mappings
 *   - manufacturers
 *   - aircraft_models
 *   - engine_types
 *   - app_config (missing keys only)
 *
 * After seeding, backfills aircraft.aircraft_type from work_packages
 * for any aircraft row that has no type yet.
 *
 * Usage: npm run db:seed-reference
 */

import { banner, log, success, error, warn } from "./_cli-utils";
import { db, sqlite } from "../../src/lib/db/client";
import * as schema from "../../src/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import {
  SEED_AIRCRAFT_TYPE_MAPPINGS,
  SEED_MANUFACTURERS,
  SEED_AIRCRAFT_MODELS,
  SEED_ENGINE_TYPES,
  SEED_APP_CONFIG,
} from "../../src/lib/db/seed-data";

async function main() {
  banner("Seed Reference Data");

  const now = new Date().toISOString();
  let totalInserted = 0;

  // ─── Aircraft Type Mappings ──────────────────────────────────────────────────

  log("Seeding aircraft_type_mappings...");
  const existingMappings = db.select().from(schema.aircraftTypeMappings).all();
  const existingPatterns = new Set(existingMappings.map((m) => m.pattern));

  const newMappings = SEED_AIRCRAFT_TYPE_MAPPINGS.filter((m) => !existingPatterns.has(m.pattern));

  if (newMappings.length > 0) {
    db.insert(schema.aircraftTypeMappings)
      .values(
        newMappings.map((m) => ({
          ...m,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .run();
    log(`  +${newMappings.length} mappings inserted`, "green");
    totalInserted += newMappings.length;
  } else {
    log(`  ${existingMappings.length} existing — no new mappings`, "dim");
  }

  // ─── Manufacturers ───────────────────────────────────────────────────────────

  log("Seeding manufacturers...");
  const existingManufacturers = db.select().from(schema.manufacturers).all();
  const existingMfrs = new Set(existingManufacturers.map((m) => m.name));

  const newMfrs = SEED_MANUFACTURERS.filter((m) => !existingMfrs.has(m.name));

  if (newMfrs.length > 0) {
    db.insert(schema.manufacturers)
      .values(newMfrs.map((m) => ({ ...m, isActive: true })))
      .run();
    log(`  +${newMfrs.length} manufacturers inserted`, "green");
    totalInserted += newMfrs.length;
  } else {
    log(`  ${existingManufacturers.length} existing — no new manufacturers`, "dim");
  }

  // ─── Aircraft Models ─────────────────────────────────────────────────────────

  log("Seeding aircraft_models...");
  const allManufacturers = db.select().from(schema.manufacturers).all();
  const manufacturerMap = new Map(allManufacturers.map((m) => [m.name, m.id]));

  const existingModels = db.select().from(schema.aircraftModels).all();
  const existingModelCodes = new Set(existingModels.map((m) => m.modelCode));

  const newModels = SEED_AIRCRAFT_MODELS.filter((m) => !existingModelCodes.has(m.modelCode));

  if (newModels.length > 0) {
    db.insert(schema.aircraftModels)
      .values(
        newModels.map(({ manufacturer, ...m }) => ({
          ...m,
          manufacturerId: manufacturer ? (manufacturerMap.get(manufacturer) ?? null) : null,
          isActive: true,
        })),
      )
      .run();
    log(`  +${newModels.length} models inserted`, "green");
    totalInserted += newModels.length;
  } else {
    log(`  ${existingModels.length} existing — no new models`, "dim");
  }

  // ─── Engine Types ────────────────────────────────────────────────────────────

  log("Seeding engine_types...");
  const existingEngines = db.select().from(schema.engineTypes).all();
  const existingEngineNames = new Set(existingEngines.map((e) => e.name));

  const newEngines = SEED_ENGINE_TYPES.filter((e) => !existingEngineNames.has(e.name));

  if (newEngines.length > 0) {
    db.insert(schema.engineTypes)
      .values(newEngines.map((e) => ({ ...e, isActive: true })))
      .run();
    log(`  +${newEngines.length} engine types inserted`, "green");
    totalInserted += newEngines.length;
  } else {
    log(`  ${existingEngines.length} existing — no new engine types`, "dim");
  }

  // ─── App Config ──────────────────────────────────────────────────────────────

  log("Seeding app_config (missing keys only)...");
  let configInserted = 0;

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
      log(`  +${d.key}`, "green");
      configInserted++;
      totalInserted++;
    }
  }

  if (configInserted === 0) {
    log(`  All ${SEED_APP_CONFIG.length} config keys already present`, "dim");
  }

  // ─── Backfill aircraft.aircraft_type from work_packages ──────────────────────
  // For each aircraft row with no type, pull the first non-null aircraft_type
  // from work_packages where aircraft_reg matches.

  log("Backfilling aircraft.aircraft_type from work_packages...");

  const countBefore = db
    .select()
    .from(schema.aircraft)
    .where(isNull(schema.aircraft.aircraftType))
    .all().length;

  // Use raw SQL — single-pass UPDATE via correlated subquery
  const backfillResult = sqlite
    .prepare(
      `UPDATE aircraft
       SET aircraft_type = (
         SELECT wp.aircraft_type
         FROM work_packages wp
         WHERE wp.aircraft_reg = aircraft.registration
           AND wp.aircraft_type IS NOT NULL
         LIMIT 1
       )
       WHERE aircraft_type IS NULL`,
    )
    .run();

  const backfilled = backfillResult.changes;

  if (backfilled > 0) {
    log(`  Backfilled aircraft_type for ${backfilled} aircraft`, "green");
  } else {
    log(
      countBefore === 0
        ? "  All aircraft already have a type"
        : `  ${countBefore} aircraft have no type in work_packages either`,
      "dim",
    );
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────

  log("");
  if (totalInserted > 0 || backfilled > 0) {
    success(
      `Reference seed complete — ${totalInserted} rows inserted, ${backfilled} aircraft types backfilled.`,
    );
  } else {
    success("Reference data already up to date — nothing to do.");
  }

  if (SEED_AIRCRAFT_TYPE_MAPPINGS.length === 0) {
    warn(
      "data/seed/aircraft-type-mappings.json is empty — add mapping rules for canonical type names.",
    );
  }
}

main().catch((err) => {
  error(`Seed-reference failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
