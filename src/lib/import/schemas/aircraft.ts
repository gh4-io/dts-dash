/**
 * Universal Import Hub — Aircraft Schema
 *
 * Defines the import schema for aircraft registration and fleet data.
 * Migrated from src/lib/data/aircraft-import-utils.ts into the universal
 * import schema system.
 *
 * Operators are fuzzy-matched to customers (70% confidence threshold).
 * Manufacturer, model, and engine type are resolved to FK IDs on commit.
 */

import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult } from "../types";
import { db } from "@/lib/db/client";
import {
  aircraft,
  customers,
  manufacturers,
  aircraftModels,
  engineTypes,
  unifiedImportLog,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { fuzzyMatchCustomer } from "@/lib/utils/fuzzy-match";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("import:aircraft");

// ─── Field Definitions ──────────────────────────────────────────────────────

const aircraftSchema: ImportSchema = {
  id: "aircraft",

  display: {
    name: "Aircraft",
    description: "Aircraft registrations with operator matching",
    icon: "fa-solid fa-plane",
    category: "Master Data",
  },

  formats: ["json", "csv"],
  commitStrategy: "upsert",
  dedupKey: ["guid", "registration"],
  maxSizeMB: 10,

  fields: [
    {
      name: "registration",
      label: "Registration",
      type: "string",
      required: true,
      isKey: true,
      aliases: ["Title", "reg"],
      description: "Aircraft registration code (e.g., C-FOIJ)",
      filterable: true,
      validate: (value) => {
        if (!value || String(value).trim() === "") {
          return "Registration is required";
        }
        return null;
      },
      transform: (value) => String(value).trim(),
    },
    {
      name: "guid",
      label: "GUID",
      type: "string",
      required: false,
      isKey: true,
      aliases: ["GUID"],
      description: "SharePoint GUID — primary dedup key when present",
      transform: (value) => (value ? String(value).trim() : undefined),
    },
    {
      name: "spId",
      label: "SharePoint ID",
      type: "number",
      required: false,
      aliases: ["ID"],
      description: "SharePoint list item ID",
      transform: (value) => (value != null ? Number(value) : undefined),
    },
    {
      name: "aircraftType",
      label: "Aircraft Type",
      type: "string",
      required: false,
      aliases: ["model", "field_5", "type"],
      description: "Aircraft type/model string (e.g., 767-200(F))",
      filterable: true,
      transform: (value) => (value ? String(value).trim() : undefined),
    },
    {
      name: "operatorRaw",
      label: "Operator",
      type: "string",
      required: true,
      aliases: ["operator", "field_2"],
      description: "Operator name — fuzzy-matched to customers table",
      filterable: true,
      validate: (value) => {
        if (!value || String(value).trim() === "") {
          return "Operator is required";
        }
        return null;
      },
      transform: (value) => String(value).trim(),
    },
    {
      name: "serialNumber",
      label: "Serial Number",
      type: "string",
      required: false,
      aliases: ["serial_number", "serial"],
      description: "Aircraft serial number",
      transform: (value) => (value ? String(value).trim() : undefined),
    },
    {
      name: "lessor",
      label: "Lessor",
      type: "string",
      required: false,
      aliases: ["field_1"],
      description: "Leasing company",
      transform: (value) => (value ? String(value).trim() : undefined),
    },
    {
      name: "age",
      label: "Age",
      type: "string",
      required: false,
      aliases: ["field_6"],
      description: "Aircraft age (e.g., 41.1 Years)",
      transform: (value) => (value ? String(value).trim() : undefined),
    },
    {
      name: "category",
      label: "Category",
      type: "string",
      required: false,
      aliases: ["field_3"],
      description: "Aircraft category (e.g., Cargo)",
      filterable: true,
      transform: (value) => (value ? String(value).trim() : undefined),
    },
    {
      name: "source",
      label: "Source",
      type: "string",
      required: false,
      description: "Source tracking: inferred, imported, or confirmed",
      defaultValue: "imported",
      transform: (value) => {
        const v = value ? String(value).trim() : "imported";
        if (["inferred", "imported", "confirmed"].includes(v)) return v;
        return "imported";
      },
    },
    {
      name: "isActive",
      label: "Active",
      type: "boolean",
      required: false,
      aliases: ["is_active"],
      description: "Whether the aircraft is active",
      defaultValue: true,
      transform: (value) => {
        if (value === undefined || value === null) return true;
        if (typeof value === "boolean") return value;
        if (typeof value === "string") {
          return !["false", "0", "no", "inactive"].includes(value.toLowerCase());
        }
        return Boolean(value);
      },
    },
    // ── Additional fields resolved to FKs during commit ──
    {
      name: "manufacturer",
      label: "Manufacturer",
      type: "string",
      required: false,
      aliases: ["field_4"],
      description: "Manufacturer name — resolved to manufacturerId FK",
      exportInclude: false,
      transform: (value) => (value ? String(value).trim() : undefined),
    },
    {
      name: "engineType",
      label: "Engine Type",
      type: "string",
      required: false,
      aliases: ["engine_type"],
      description: "Engine type name — resolved to engineTypeId FK",
      exportInclude: false,
      transform: (value) => (value ? String(value).trim() : undefined),
    },
    {
      name: "model",
      label: "Model Code",
      type: "string",
      required: false,
      aliases: ["field_5"],
      description: "Aircraft model code — resolved to aircraftModelId FK",
      exportInclude: false,
      transform: (value) => (value ? String(value).trim() : undefined),
    },
  ],

  // ─── Pre-process: Detect SharePoint vs simplified format ────────────────

  preProcess(rawData: unknown): Record<string, unknown>[] {
    if (!Array.isArray(rawData)) return [];

    return rawData.map((record: Record<string, unknown>) => {
      // SharePoint format: has "Title" field
      if ("Title" in record) {
        return {
          registration: record.Title,
          operatorRaw: record.field_2,
          aircraftType: record.field_5,
          model: record.field_5,
          manufacturer: record.field_4,
          lessor: record.field_1,
          category: record.field_3,
          age: record.field_6,
          guid: record.GUID,
          spId: record.ID,
          serialNumber: record.serial_number ?? record.serialNumber,
          engineType: record.engine_type ?? record.engineType,
          source: record.source ?? "imported",
          isActive: record.is_active ?? record.isActive ?? true,
        };
      }

      // Simplified format: has "registration" field — pass through with
      // alias normalization for operator field
      if ("registration" in record) {
        return {
          ...record,
          // Ensure operatorRaw is populated from operator alias if present
          operatorRaw: record.operatorRaw ?? record.operator ?? record.field_2,
        };
      }

      // Unknown format — return as-is and let validation catch missing fields
      return record;
    });
  },

  // ─── Post-map validation: fuzzy match operators ─────────────────────────

  async postMapValidate(
    records: Record<string, unknown>[],
    _ctx: ImportContext,
  ): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const allCustomers = await db.select().from(customers);

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const operatorRaw = rec.operatorRaw ? String(rec.operatorRaw).trim() : "";
      const registration = rec.registration ? String(rec.registration).trim() : `Record ${i + 1}`;

      if (!operatorRaw) {
        errors.push(`${registration}: Operator is required`);
        continue;
      }

      const fuzzyResult = fuzzyMatchCustomer(operatorRaw, allCustomers);

      if (!fuzzyResult.matched) {
        warnings.push(
          `${registration}: Operator "${operatorRaw}" not matched to any customer (confidence: ${fuzzyResult.confidence}%)`,
        );
      } else if (fuzzyResult.confidence < 100) {
        warnings.push(
          `${registration}: Operator "${operatorRaw}" fuzzy-matched to "${fuzzyResult.customerName}" (${fuzzyResult.confidence}%)`,
        );
      }
    }

    return { errors, warnings };
  },

  // ─── Commit: Insert/update aircraft with FK resolution ──────────────────

  async commit(records: Record<string, unknown>[], ctx: ImportContext): Promise<CommitResult> {
    const now = new Date().toISOString();
    const allWarnings: string[] = [];
    const allErrors: string[] = [];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    try {
      // ── Fetch reference data ──────────────────────────────────────────
      const existingAircraft = await db.select().from(aircraft);
      const allCustomers = await db.select().from(customers);
      const allManufacturers = await db.select().from(manufacturers);
      const allModels = await db.select().from(aircraftModels);
      const allEngines = await db.select().from(engineTypes);

      // ── Build lookup maps ─────────────────────────────────────────────
      const guidMap = new Map(existingAircraft.filter((a) => a.guid).map((a) => [a.guid!, a]));
      const regSerialMap = new Map(
        existingAircraft
          .filter((a) => a.serialNumber)
          .map((a) => [`${a.registration}|${a.serialNumber}`, a]),
      );
      const regMap = new Map(existingAircraft.map((a) => [a.registration, a]));

      const manufacturerMap = new Map(allManufacturers.map((m) => [m.name, m.id]));
      const modelMap = new Map(allModels.map((m) => [m.modelCode, m.id]));
      const engineMap = new Map(allEngines.map((e) => [e.name, e.id]));

      // ── Cascading dedup: GUID → registration+serialNumber → registration
      function findExisting(rec: Record<string, unknown>) {
        const guid = rec.guid ? String(rec.guid).trim() : null;
        const registration = rec.registration ? String(rec.registration).trim() : "";
        const serialNumber = rec.serialNumber ? String(rec.serialNumber).trim() : null;

        // 1. GUID match (highest priority)
        if (guid) {
          const byGuid = guidMap.get(guid);
          if (byGuid) return byGuid;
        }
        // 2. Registration + serialNumber (when both present)
        if (serialNumber) {
          const key = `${registration}|${serialNumber}`;
          const byRegSerial = regSerialMap.get(key);
          if (byRegSerial) return byRegSerial;
        }
        // 3. Registration fallback
        return regMap.get(registration) ?? null;
      }

      // ── Process each record ───────────────────────────────────────────
      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const registration = rec.registration ? String(rec.registration).trim() : "";
        const operatorRaw = rec.operatorRaw
          ? String(rec.operatorRaw).trim()
          : rec.operator
            ? String(rec.operator).trim()
            : "";
        const model = rec.aircraftType
          ? String(rec.aircraftType).trim()
          : rec.model
            ? String(rec.model).trim()
            : null;
        const manufacturer = rec.manufacturer ? String(rec.manufacturer).trim() : null;
        const engineType = rec.engineType ? String(rec.engineType).trim() : null;
        const serialNumber = rec.serialNumber ? String(rec.serialNumber).trim() : null;
        const lessor = rec.lessor ? String(rec.lessor).trim() : null;
        const age = rec.age ? String(rec.age).trim() : null;
        const category = rec.category ? String(rec.category).trim() : null;
        const guid = rec.guid ? String(rec.guid).trim() : null;
        const spId = rec.spId != null ? Number(rec.spId) : null;
        const source = rec.source ? String(rec.source).trim() : "imported";
        const isActive = rec.isActive !== false && rec.isActive !== "false";

        if (!registration) {
          allErrors.push(`Record ${i + 1}: Missing registration — skipped`);
          skipped++;
          continue;
        }

        // Fuzzy match operator
        const fuzzyResult = fuzzyMatchCustomer(operatorRaw, allCustomers);
        if (!fuzzyResult.matched) {
          allWarnings.push(
            `"${registration}": Operator "${operatorRaw}" not matched (confidence: ${fuzzyResult.confidence}%)`,
          );
        } else if (fuzzyResult.confidence < 100) {
          allWarnings.push(
            `"${registration}": "${operatorRaw}" → "${fuzzyResult.customerName}" (${fuzzyResult.confidence}%)`,
          );
        }

        // Resolve FK IDs
        const manufacturerId = manufacturer ? (manufacturerMap.get(manufacturer) ?? null) : null;
        const aircraftModelId = model ? (modelMap.get(model) ?? null) : null;
        const engineTypeId = engineType ? (engineMap.get(engineType) ?? null) : null;

        const existing = findExisting(rec);

        if (!existing) {
          // ── Insert new aircraft ──────────────────────────────────────
          await db.insert(aircraft).values({
            registration,
            spId,
            guid,
            aircraftType: model !== "Unknown" ? model : null,
            aircraftModelId,
            operatorId: fuzzyResult.matched ? fuzzyResult.customerId : null,
            manufacturerId,
            engineTypeId,
            serialNumber,
            age,
            lessor,
            category,
            operatorRaw,
            operatorMatchConfidence: fuzzyResult.confidence,
            source: source === "confirmed" || source === "inferred" ? source : "imported",
            isActive,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          });
          inserted++;
        } else {
          // ── Update existing aircraft ─────────────────────────────────

          // Protect "confirmed" source records — downgrade with warning
          const isConfirmed = existing.source === "confirmed";
          if (isConfirmed) {
            allWarnings.push(
              `"${registration}": Has confirmed source — will be updated but source stays "confirmed"`,
            );
          }

          // Handle registration change (found by GUID but registration differs)
          let newRegistration = existing.registration;
          if (guid && existing.guid === guid && registration !== existing.registration) {
            const regConflict = regMap.get(registration);
            if (regConflict && regConflict.id !== existing.id) {
              allWarnings.push(
                `GUID "${guid}": Registration changed "${existing.registration}" → "${registration}" but "${registration}" already exists — keeping old`,
              );
            } else {
              allWarnings.push(
                `GUID "${guid}": Registration changed "${existing.registration}" → "${registration}"`,
              );
              newRegistration = registration;
            }
          }

          await db
            .update(aircraft)
            .set({
              registration: newRegistration,
              spId: spId ?? existing.spId,
              guid: guid ?? existing.guid,
              aircraftType: (model !== "Unknown" ? model : null) ?? existing.aircraftType,
              aircraftModelId: aircraftModelId ?? existing.aircraftModelId,
              operatorId: fuzzyResult.matched ? fuzzyResult.customerId : existing.operatorId,
              manufacturerId: manufacturerId ?? existing.manufacturerId,
              engineTypeId: engineTypeId ?? existing.engineTypeId,
              serialNumber: serialNumber ?? existing.serialNumber,
              age: age ?? existing.age,
              lessor: lessor ?? existing.lessor,
              category: category ?? existing.category,
              operatorRaw,
              operatorMatchConfidence: fuzzyResult.confidence,
              source: isConfirmed
                ? "confirmed"
                : source === "confirmed" || source === "inferred"
                  ? source
                  : "imported",
              isActive,
              updatedAt: now,
              updatedBy: ctx.userId,
            })
            .where(eq(aircraft.id, existing.id));
          updated++;
        }
      }

      // ── Log to unifiedImportLog ─────────────────────────────────────
      const logEntry = await db
        .insert(unifiedImportLog)
        .values({
          importedAt: now,
          dataType: "aircraft",
          source: ctx.source,
          format: ctx.format,
          fileName: ctx.fileName ?? null,
          importedBy: ctx.userId,
          status:
            allErrors.length > 0 ? (inserted > 0 || updated > 0 ? "partial" : "failed") : "success",
          recordsTotal: records.length,
          recordsInserted: inserted,
          recordsUpdated: updated,
          recordsSkipped: skipped,
          warnings: allWarnings.length > 0 ? JSON.stringify(allWarnings) : null,
          errors: allErrors.length > 0 ? JSON.stringify(allErrors) : null,
        })
        .returning({ id: unifiedImportLog.id })
        .get();

      log.info(
        {
          logId: logEntry.id,
          total: records.length,
          inserted,
          updated,
          skipped,
          warnings: allWarnings.length,
        },
        "Aircraft import committed",
      );

      return {
        success: allErrors.length === 0,
        logId: logEntry.id,
        recordsTotal: records.length,
        recordsInserted: inserted,
        recordsUpdated: updated,
        recordsSkipped: skipped,
        errors: allErrors,
        warnings: allWarnings,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error({ error: errorMessage }, "Aircraft import failed");

      // Log failure
      const failEntry = await db
        .insert(unifiedImportLog)
        .values({
          importedAt: now,
          dataType: "aircraft",
          source: ctx.source,
          format: ctx.format,
          fileName: ctx.fileName ?? null,
          importedBy: ctx.userId,
          status: "failed",
          recordsTotal: records.length,
          recordsInserted: 0,
          recordsUpdated: 0,
          recordsSkipped: records.length,
          warnings: null,
          errors: JSON.stringify([errorMessage]),
        })
        .returning({ id: unifiedImportLog.id })
        .get();

      return {
        success: false,
        logId: failEntry.id,
        recordsTotal: records.length,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsSkipped: records.length,
        errors: [errorMessage],
        warnings: [],
      };
    }
  },

  // ─── Summarize: badges for validation preview ───────────────────────────

  summarize(records: Record<string, unknown>[]) {
    const operators = new Set(
      records
        .map((r) =>
          r.operatorRaw ? String(r.operatorRaw) : r.operator ? String(r.operator) : null,
        )
        .filter(Boolean),
    );
    const types = new Set(
      records
        .map((r) => (r.aircraftType ? String(r.aircraftType) : r.model ? String(r.model) : null))
        .filter(Boolean),
    );

    return [
      {
        label: "Aircraft",
        value: records.length,
        icon: "fa-solid fa-plane",
      },
      {
        label: "Operators",
        value: operators.size,
        icon: "fa-solid fa-building",
      },
      {
        label: "Types",
        value: types.size,
        icon: "fa-solid fa-tags",
      },
    ];
  },

  // ─── Export ─────────────────────────────────────────────────────────────

  export: {
    defaultSort: "registration",
    async query(filters: Record<string, unknown>) {
      // No special filters — export all aircraft with operator name join
      void filters;
      const allAircraft = await db.select().from(aircraft);
      const allCustomers = await db.select().from(customers);
      const customerMap = new Map(allCustomers.map((c) => [c.id, c.name]));

      return allAircraft
        .map((a) => ({
          registration: a.registration,
          guid: a.guid,
          spId: a.spId,
          aircraftType: a.aircraftType,
          operator: a.operatorId ? (customerMap.get(a.operatorId) ?? a.operatorRaw) : a.operatorRaw,
          operatorRaw: a.operatorRaw,
          serialNumber: a.serialNumber,
          lessor: a.lessor,
          age: a.age,
          category: a.category,
          source: a.source,
          isActive: a.isActive,
        }))
        .sort((a, b) => a.registration.localeCompare(b.registration));
    },
  },

  // ─── Help ───────────────────────────────────────────────────────────────

  help: {
    description: "Aircraft registration and fleet data. Operators are fuzzy-matched to customers.",
    expectedFormat:
      "JSON array, OData { value: [...] }, or CSV with registration/model/operator headers",
    sampleSnippet: `[
  {
    "registration": "C-FOIJ",
    "model": "767-200(F)",
    "operator": "Cargojet Airways"
  },
  {
    "registration": "N409MC",
    "model": "747-47UF",
    "operator": "Atlas Air"
  }
]`,
    notes: [
      "Operator names are fuzzy-matched to existing customers (70% confidence threshold)",
      "Manufacturer, model, and engine type strings are resolved to FK IDs when matching records exist",
      "SharePoint format (with Title, field_2, etc.) is auto-detected and normalized",
      "GUID is the primary dedup key; falls back to registration+serialNumber, then registration alone",
      'Records with source "confirmed" are protected — updated but source is preserved',
    ],
    troubleshooting: [
      {
        error: 'Operator "XYZ Corp" not matched to any customer',
        fix: "Add the customer in Admin > Customers first, or check spelling. The fuzzy match requires at least 70% similarity.",
      },
      {
        error: "Missing registration",
        fix: 'Every aircraft record must have a "registration" (or "Title" in SharePoint format). Check your data source.',
      },
    ],
  },

  // ─── Template Records ──────────────────────────────────────────────────

  templateRecords: [
    {
      registration: "C-FOIJ",
      model: "767-200(F)",
      operator: "Cargojet Airways",
      manufacturer: "Boeing",
    },
    {
      registration: "N409MC",
      model: "747-47UF",
      operator: "Atlas Air",
      manufacturer: "Boeing",
      serialNumber: "33749",
    },
    {
      registration: "D-ALFA",
      model: "777F",
      operator: "Lufthansa Cargo",
      manufacturer: "Boeing",
      engineType: "GE90-110B1",
    },
  ],
};

// ─── Self-register ──────────────────────────────────────────────────────────

registerSchema(aircraftSchema);
