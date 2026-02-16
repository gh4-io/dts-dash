/**
 * Aircraft Master Data Import Utilities
 * Includes fuzzy matching for operator FK lookups
 */

import { db } from "@/lib/db/client";
import {
  customers,
  aircraft,
  manufacturers,
  aircraftModels,
  engineTypes,
  masterDataImportLog,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseCSV, toCSV } from "@/lib/utils/csv-parser";
import { parseODataJSON } from "@/lib/utils/odata-parser";
import { fuzzyMatchCustomer } from "@/lib/utils/fuzzy-match";
import type {
  AircraftImportRecord,
  ValidationResult,
  ImportSummary,
  ValidationDetails,
  UpdateDetail,
  CommitResult,
} from "./master-data-types";
import type { Aircraft, Customer } from "@/types";

// ─── Aircraft Import ────────────────────────────────────────────────────────

/**
 * Parse aircraft CSV
 */
export function parseAircraftCSV(
  csvContent: string
): ValidationResult<AircraftImportRecord> {
  const requiredHeaders = ["registration", "model", "operator"];
  const result = parseCSV<AircraftImportRecord>(
    csvContent,
    requiredHeaders,
    (row) => {
      if (!row.registration || row.registration.trim() === "") {
        throw new Error("registration is required");
      }
      if (!row.model || row.model.trim() === "") {
        throw new Error("model is required");
      }
      if (!row.operator || row.operator.trim() === "") {
        throw new Error("operator is required");
      }

      return {
        registration: row.registration.trim(),
        model: row.model.trim(),
        operator: row.operator.trim(),
        manufacturer: row.manufacturer?.trim(),
        engineType: row.engineType?.trim() || row.engine_type?.trim(),
        serialNumber: row.serialNumber?.trim() || row.serial_number?.trim(),
        lessor: row.lessor?.trim(),
        age: row.age?.trim(),
        category: row.category?.trim(),
        source:
          (row.source?.trim() as "imported" | "confirmed" | undefined) ||
          "imported",
      };
    }
  );

  return {
    valid: result.errors.length === 0,
    data: result.data,
    errors: result.errors,
    warnings: [],
  };
}

/**
 * Parse aircraft JSON (supports OData formats + simplified)
 */
export function parseAircraftJSON(
  jsonContent: string
): ValidationResult<AircraftImportRecord> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const data: AircraftImportRecord[] = [];

  try {
    const parsed = parseODataJSON<Record<string, unknown>>(jsonContent);

    for (let i = 0; i < parsed.records.length; i++) {
      const record = parsed.records[i];

      // SharePoint format (ac.json)
      if ("Title" in record) {
        const registration = String(record.Title || "").trim();
        const operator = record.field_2 ? String(record.field_2).trim() : "";
        const model = record.field_5 ? String(record.field_5).trim() : "";

        if (!registration) {
          errors.push(`Record ${i + 1}: Missing registration (Title)`);
          continue;
        }

        data.push({
          registration,
          model: model || "Unknown",
          operator: operator || "Unknown",
          manufacturer: record.field_4
            ? String(record.field_4).trim()
            : undefined,
          lessor: record.field_1 ? String(record.field_1).trim() : undefined,
          category: record.field_3 ? String(record.field_3).trim() : undefined,
          age: record.field_6 ? String(record.field_6).trim() : undefined,
          source: "imported",
        });
      }
      // Simplified format
      else if ("registration" in record) {
        const registration = String(record.registration || "").trim();
        const model = record.model ? String(record.model).trim() : "";
        const operator = record.operator ? String(record.operator).trim() : "";

        if (!registration) {
          errors.push(`Record ${i + 1}: Missing registration`);
          continue;
        }

        data.push({
          registration,
          model: model || "Unknown",
          operator: operator || "Unknown",
          manufacturer: record.manufacturer
            ? String(record.manufacturer).trim()
            : undefined,
          engineType: record.engineType
            ? String(record.engineType).trim()
            : undefined,
          serialNumber: record.serialNumber
            ? String(record.serialNumber).trim()
            : undefined,
          lessor: record.lessor ? String(record.lessor).trim() : undefined,
          age: record.age ? String(record.age).trim() : undefined,
          category: record.category
            ? String(record.category).trim()
            : undefined,
          source:
            (record.source as "imported" | "confirmed" | undefined) ||
            "imported",
        });
      } else {
        errors.push(`Record ${i + 1}: Missing 'registration' or 'Title' field`);
      }
    }

    return {
      valid: errors.length === 0,
      data,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      valid: false,
      data: [],
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
    };
  }
}

/**
 * Validate aircraft import with fuzzy operator matching
 */
export async function validateAircraftImport(
  records: AircraftImportRecord[],
  overwriteConfirmedMode: "allow" | "warn" | "reject"
): Promise<{
  valid: boolean;
  summary: ImportSummary;
  details: ValidationDetails<Aircraft> & {
    fuzzyMatches: Array<{
      registration: string;
      rawOperator: string;
      matchedCustomer: string;
      confidence: number;
    }>;
  };
}> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const toAdd: Aircraft[] = [];
  const toUpdate: UpdateDetail<Aircraft>[] = [];
  const fuzzyMatches: Array<{
    registration: string;
    rawOperator: string;
    matchedCustomer: string;
    confidence: number;
  }> = [];
  let conflicts = 0;
  let invalidOperators = 0;

  // Fetch existing data
  const existingAircraft = await db.select().from(aircraft);
  const existingMap = new Map(existingAircraft.map((a) => [a.registration, a]));

  const allCustomers = await db.select().from(customers);
  const allManufacturers = await db.select().from(manufacturers);
  const allModels = await db.select().from(aircraftModels);
  const allEngines = await db.select().from(engineTypes);

  const manufacturerMap = new Map(allManufacturers.map((m) => [m.name, m.id]));
  const modelMap = new Map(allModels.map((m) => [m.modelCode, m.id]));
  const engineMap = new Map(allEngines.map((e) => [e.name, e.id]));

  const now = new Date().toISOString();

  for (const record of records) {
    const existing = existingMap.get(record.registration);

    // Fuzzy match operator
    const fuzzyResult = fuzzyMatchCustomer(record.operator, allCustomers);

    if (!fuzzyResult.matched) {
      invalidOperators++;
      warnings.push(
        `Aircraft "${record.registration}": Operator "${record.operator}" not found (confidence: ${fuzzyResult.confidence}%)`
      );
    } else if (fuzzyResult.confidence < 100) {
      fuzzyMatches.push({
        registration: record.registration,
        rawOperator: record.operator,
        matchedCustomer: fuzzyResult.customerName,
        confidence: fuzzyResult.confidence,
      });
    }

    // Lookup FKs
    const manufacturerId = record.manufacturer
      ? manufacturerMap.get(record.manufacturer) || null
      : null;
    const modelId = record.model ? modelMap.get(record.model) || null : null;
    const engineId = record.engineType
      ? engineMap.get(record.engineType) || null
      : null;

    if (!existing) {
      // New aircraft
      toAdd.push({
        registration: record.registration,
        aircraftModelId: modelId,
        operatorId: fuzzyResult.matched ? fuzzyResult.customerId : null,
        manufacturerId,
        engineTypeId: engineId,
        serialNumber: record.serialNumber || null,
        age: record.age || null,
        lessor: record.lessor || null,
        category: record.category || null,
        operatorRaw: record.operator,
        operatorMatchConfidence: fuzzyResult.confidence,
        source: record.source || "imported",
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: null,
        updatedBy: null,
      });
    } else {
      // Update existing aircraft
      const isConfirmed = existing.source === "confirmed";
      const willOverwrite = isConfirmed && overwriteConfirmedMode !== "allow";

      const updated: Aircraft = {
        ...existing,
        aircraftModelId: modelId || existing.aircraftModelId,
        operatorId: fuzzyResult.matched
          ? fuzzyResult.customerId
          : existing.operatorId,
        manufacturerId: manufacturerId || existing.manufacturerId,
        engineTypeId: engineId || existing.engineTypeId,
        serialNumber: record.serialNumber || existing.serialNumber,
        age: record.age || existing.age,
        lessor: record.lessor || existing.lessor,
        category: record.category || existing.category,
        operatorRaw: record.operator,
        operatorMatchConfidence: fuzzyResult.confidence,
        source: isConfirmed ? "imported" : record.source || "imported",
        updatedAt: now,
      };

      if (willOverwrite) {
        conflicts++;
        if (overwriteConfirmedMode === "reject") {
          errors.push(
            `Aircraft "${record.registration}" has confirmed source and cannot be overwritten (mode: reject)`
          );
        } else {
          warnings.push(
            `Aircraft "${record.registration}" has confirmed source and will be downgraded to imported`
          );
        }
      }

      toUpdate.push({
        existing,
        new: updated,
        conflict: isConfirmed,
      });
    }
  }

  return {
    valid: errors.length === 0,
    summary: {
      total: records.length,
      toAdd: toAdd.length,
      toUpdate: toUpdate.length,
      conflicts,
      invalidOperators,
    },
    details: {
      add: toAdd,
      update: toUpdate,
      warnings,
      errors,
      fuzzyMatches,
    },
  };
}

/**
 * Commit aircraft import
 */
export async function commitAircraftImport(
  records: AircraftImportRecord[],
  options: {
    source: "file" | "paste" | "api";
    fileName?: string;
    userId: string;
    overrideConflicts: boolean;
  }
): Promise<CommitResult> {
  const overwriteMode = "warn" as "allow" | "warn" | "reject";

  const validation = await validateAircraftImport(records, overwriteMode);

  if (!validation.valid && !options.overrideConflicts) {
    return {
      success: false,
      logId: "",
      summary: { added: 0, updated: 0, skipped: 0 },
      errors: validation.details.errors,
      warnings: validation.details.warnings,
    };
  }

  const now = new Date().toISOString();
  const logId = crypto.randomUUID();

  try {
    // Insert new aircraft
    if (validation.details.add.length > 0) {
      await db.insert(aircraft).values(
        validation.details.add.map((a) => ({
          ...a,
          createdBy: options.userId,
          updatedBy: options.userId,
        }))
      );
    }

    // Update existing aircraft
    for (const update of validation.details.update) {
      if (update.conflict && !options.overrideConflicts) {
        continue;
      }

      await db
        .update(aircraft)
        .set({
          ...update.new,
          updatedBy: options.userId,
        })
        .where(eq(aircraft.registration, update.existing.registration));
    }

    // Log import
    await db.insert(masterDataImportLog).values({
      id: logId,
      importedAt: now,
      dataType: "aircraft",
      source: options.source,
      format: "csv",
      fileName: options.fileName || null,
      recordsTotal: records.length,
      recordsAdded: validation.details.add.length,
      recordsUpdated: validation.details.update.filter(
        (u) => !u.conflict || options.overrideConflicts
      ).length,
      recordsSkipped: validation.details.update.filter(
        (u) => u.conflict && !options.overrideConflicts
      ).length,
      importedBy: options.userId,
      status: "success",
      warnings: JSON.stringify([
        ...validation.details.warnings,
        ...validation.details.fuzzyMatches.map(
          (m) =>
            `${m.registration}: "${m.rawOperator}" → "${m.matchedCustomer}" (${m.confidence}%)`
        ),
      ]),
      errors: null,
    });

    return {
      success: true,
      logId,
      summary: {
        added: validation.details.add.length,
        updated: validation.details.update.filter(
          (u) => !u.conflict || options.overrideConflicts
        ).length,
        skipped: validation.details.update.filter(
          (u) => u.conflict && !options.overrideConflicts
        ).length,
      },
      warnings: validation.details.warnings,
    };
  } catch (error) {
    await db.insert(masterDataImportLog).values({
      id: logId,
      importedAt: now,
      dataType: "aircraft",
      source: options.source,
      format: "csv",
      fileName: options.fileName || null,
      recordsTotal: records.length,
      recordsAdded: 0,
      recordsUpdated: 0,
      recordsSkipped: records.length,
      importedBy: options.userId,
      status: "failed",
      warnings: null,
      errors: JSON.stringify([
        error instanceof Error ? error.message : String(error),
      ]),
    });

    return {
      success: false,
      logId,
      summary: { added: 0, updated: 0, skipped: records.length },
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Export aircraft to CSV
 */
export async function exportAircraftCSV(): Promise<string> {
  const allAircraft = await db.select().from(aircraft);

  const headers = [
    "registration",
    "aircraftModelId",
    "operatorId",
    "manufacturerId",
    "engineTypeId",
    "serialNumber",
    "age",
    "lessor",
    "category",
    "operatorRaw",
    "operatorMatchConfidence",
    "source",
    "isActive",
  ];

  return toCSV(allAircraft, headers);
}
