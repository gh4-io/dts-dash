/**
 * Shared seed data constants — loaded from external JSON files in data/seed/.
 * Used by seed.ts and reset-defaults API routes.
 */

import fs from "fs";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SeedUser {
  authId: string | null;
  email: string;
  username: string | null;
  displayName: string;
  password: string;
  role: "user" | "admin" | "superadmin";
  isActive: boolean;
}

export interface SeedCustomer {
  name: string;
  displayName: string;
  color: string;
  colorText: string;
  sortOrder: number;
  guid?: string; // SharePoint GUID — optional in seed data
}

export interface SeedAircraftTypeMapping {
  pattern: string;
  canonicalType: "B777" | "B767" | "B747" | "B757" | "B737" | "Unknown";
  description: string;
  priority: number;
}

export interface SeedAppConfig {
  key: string;
  value: string;
}

export interface SeedManufacturer {
  name: string;
  sortOrder: number;
}

export interface SeedAircraftModel {
  modelCode: string;
  canonicalType: string;
  manufacturer: string;
  displayName: string;
  sortOrder: number;
}

export interface SeedEngineType {
  name: string;
  manufacturer: string | null;
  sortOrder: number;
}

// ─── Loader ───────────────────────────────────────────────────────────────────

function loadSeedFile<T extends unknown[]>(filename: string): T {
  const filePath = path.join(process.cwd(), "data", "seed", filename);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    // Seed files are optional — return empty array if missing.
    // This allows clean builds without seed data present.
    return [] as unknown as T;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export const SEED_USERS: readonly SeedUser[] = loadSeedFile<SeedUser[]>("users.json");

export const SEED_CUSTOMERS: readonly SeedCustomer[] =
  loadSeedFile<SeedCustomer[]>("customers.json");

export const SEED_AIRCRAFT_TYPE_MAPPINGS: readonly SeedAircraftTypeMapping[] = loadSeedFile<
  SeedAircraftTypeMapping[]
>("aircraft-type-mappings.json");

export const SEED_APP_CONFIG: readonly SeedAppConfig[] =
  loadSeedFile<SeedAppConfig[]>("app-config.json");

export const SEED_MANUFACTURERS: readonly SeedManufacturer[] =
  loadSeedFile<SeedManufacturer[]>("manufacturers.json");

export const SEED_AIRCRAFT_MODELS: readonly SeedAircraftModel[] =
  loadSeedFile<SeedAircraftModel[]>("aircraft-models.json");

export const SEED_ENGINE_TYPES: readonly SeedEngineType[] =
  loadSeedFile<SeedEngineType[]>("engine-types.json");

export interface SeedWorkPackage {
  GUID: string;
  Aircraft: { Title: string; field_5?: string };
  Customer: string;
  Arrival: string;
  Departure: string;
  TotalMH: number | null;
  TotalGroundHours: string;
  Workpackage_x0020_Status: string;
  Title?: string;
  CustomerReference?: string;
  Description?: string;
  FlightId?: string | null;
  ParentID?: string | null;
  ID?: number;
  DocumentSetID?: number;
  AircraftId?: number;
  HasWorkpackage?: boolean;
  WorkpackageNo?: string | null;
  CalendarComments?: string | null;
  IsNotClosedOrCanceled?: "1" | "0";
  Modified?: string;
  Created?: string;
  OData__UIVersionString?: string;
}

export const SEED_WORK_PACKAGES: readonly SeedWorkPackage[] =
  loadSeedFile<SeedWorkPackage[]>("work-packages.json");
