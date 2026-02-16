/**
 * Master Data Import Utilities
 * Validation and commit logic for customer and aircraft master data
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
import { eq, and } from "drizzle-orm";
import { parseCSV, toCSV } from "@/lib/utils/csv-parser";
import { parseODataJSON } from "@/lib/utils/odata-parser";
import { fuzzyMatchCustomer } from "@/lib/utils/fuzzy-match";
import type {
  CustomerImportRecord,
  AircraftImportRecord,
  ValidationResult,
  ImportSummary,
  ValidationDetails,
  UpdateDetail,
  CommitResult,
} from "./master-data-types";
import type { Customer, Aircraft } from "@/types";

// ─── Color Palette for Auto-Assignment ─────────────────────────────────────

const COLOR_PALETTE = [
  "#EF4444",
  "#F97316",
  "#EABC42",
  "#22C55E",
  "#14B8A6",
  "#84CC16",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#F43F5E",
];

function getNextAvailableColor(existingColors: string[]): string {
  const used = new Set(existingColors);
  for (const color of COLOR_PALETTE) {
    if (!used.has(color)) return color;
  }
  // If all colors used, cycle back
  return COLOR_PALETTE[existingColors.length % COLOR_PALETTE.length];
}

// ─── Customer Import ────────────────────────────────────────────────────────

/**
 * Parse customer CSV
 */
export function parseCustomerCSV(
  csvContent: string
): ValidationResult<CustomerImportRecord> {
  const requiredHeaders = ["name"];
  const result = parseCSV<CustomerImportRecord>(
    csvContent,
    requiredHeaders,
    (row) => {
      if (!row.name || row.name.trim() === "") {
        throw new Error("name is required");
      }

      return {
        name: row.name.trim(),
        displayName: row.displayName?.trim() || row.name.trim(),
        color: row.color?.trim(),
        colorText: row.colorText?.trim(),
        country: row.country?.trim(),
        established: row.established?.trim(),
        groupParent: row.groupParent?.trim() || row.group_parent?.trim(),
        baseAirport: row.baseAirport?.trim() || row.base_airport?.trim(),
        website: row.website?.trim(),
        mocPhone: row.mocPhone?.trim() || row.moc_phone?.trim(),
        iataCode: row.iataCode?.trim() || row.iata_code?.trim(),
        icaoCode: row.icaoCode?.trim() || row.icao_code?.trim(),
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
 * Parse customer JSON (supports OData formats + simplified)
 */
export function parseCustomerJSON(
  jsonContent: string
): ValidationResult<CustomerImportRecord> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const data: CustomerImportRecord[] = [];

  try {
    // Try OData parser first
    const parsed = parseODataJSON<Record<string, unknown>>(jsonContent);

    for (let i = 0; i < parsed.records.length; i++) {
      const record = parsed.records[i];

      // SharePoint format (cust.json)
      if ("Title" in record) {
        data.push({
          name: String(record.Title || "").trim(),
          displayName: String(record.Title || "").trim(),
          country: record.country ? String(record.country).trim() : undefined,
          established: record.established
            ? String(record.established).trim()
            : undefined,
          groupParent: record.group ? String(record.group).trim() : undefined,
          baseAirport: record.base ? String(record.base).trim() : undefined,
          website: record.website ? String(record.website).trim() : undefined,
          mocPhone: record.mocphone
            ? String(record.mocphone).trim()
            : undefined,
          iataCode: record.iata ? String(record.iata).trim() : undefined,
          icaoCode: record.icao ? String(record.icao).trim() : undefined,
          source: "imported",
        });
      }
      // Simplified format
      else if ("name" in record) {
        data.push({
          name: String(record.name || "").trim(),
          displayName: record.displayName
            ? String(record.displayName).trim()
            : String(record.name || "").trim(),
          color: record.color ? String(record.color).trim() : undefined,
          colorText: record.colorText
            ? String(record.colorText).trim()
            : undefined,
          country: record.country ? String(record.country).trim() : undefined,
          established: record.established
            ? String(record.established).trim()
            : undefined,
          groupParent: record.groupParent
            ? String(record.groupParent).trim()
            : undefined,
          baseAirport: record.baseAirport
            ? String(record.baseAirport).trim()
            : undefined,
          website: record.website ? String(record.website).trim() : undefined,
          mocPhone: record.mocPhone
            ? String(record.mocPhone).trim()
            : undefined,
          iataCode: record.iataCode
            ? String(record.iataCode).trim()
            : undefined,
          icaoCode: record.icaoCode
            ? String(record.icaoCode).trim()
            : undefined,
          source:
            (record.source as "imported" | "confirmed" | undefined) ||
            "imported",
        });
      } else {
        errors.push(`Record ${i + 1}: Missing 'name' or 'Title' field`);
      }
    }

    // Validate all have names
    data.forEach((rec, idx) => {
      if (!rec.name || rec.name === "") {
        errors.push(`Record ${idx + 1}: name is required`);
      }
    });

    return {
      valid: errors.length === 0,
      data: data.filter((d) => d.name && d.name !== ""),
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
 * Validate customer import and compute summary
 */
export async function validateCustomerImport(
  records: CustomerImportRecord[],
  overwriteConfirmedMode: "allow" | "warn" | "reject"
): Promise<{
  valid: boolean;
  summary: ImportSummary;
  details: ValidationDetails<Customer>;
}> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const toAdd: Customer[] = [];
  const toUpdate: UpdateDetail<Customer>[] = [];
  let conflicts = 0;

  // Fetch existing customers
  const existingCustomers = await db.select().from(customers);
  const existingMap = new Map(existingCustomers.map((c) => [c.name, c]));

  // Get used colors for auto-assignment
  const usedColors = existingCustomers.map((c) => c.color);

  const now = new Date().toISOString();

  for (const record of records) {
    const existing = existingMap.get(record.name);

    if (!existing) {
      // New customer - assign color if not provided
      const color = record.color || getNextAvailableColor(usedColors);
      const colorText = record.colorText || "#ffffff";

      toAdd.push({
        id: crypto.randomUUID(),
        name: record.name,
        displayName: record.displayName || record.name,
        color,
        colorText,
        isActive: true,
        sortOrder: existingCustomers.length + toAdd.length + 1,
        country: record.country || null,
        established: record.established || null,
        groupParent: record.groupParent || null,
        baseAirport: record.baseAirport || null,
        website: record.website || null,
        mocPhone: record.mocPhone || null,
        iataCode: record.iataCode || null,
        icaoCode: record.icaoCode || null,
        source: record.source || "imported",
        createdAt: now,
        updatedAt: now,
        createdBy: null,
        updatedBy: null,
      });

      usedColors.push(color);
    } else {
      // Update existing customer
      const isConfirmed = existing.source === "confirmed";
      const willOverwrite = isConfirmed && overwriteConfirmedMode !== "allow";

      const updated: Customer = {
        ...existing,
        displayName: record.displayName || existing.displayName,
        color: record.color || existing.color,
        colorText: record.colorText || existing.colorText,
        country: record.country || existing.country,
        established: record.established || existing.established,
        groupParent: record.groupParent || existing.groupParent,
        baseAirport: record.baseAirport || existing.baseAirport,
        website: record.website || existing.website,
        mocPhone: record.mocPhone || existing.mocPhone,
        iataCode: record.iataCode || existing.iataCode,
        icaoCode: record.icaoCode || existing.icaoCode,
        source: isConfirmed ? "imported" : record.source || "imported", // Downgrade if confirmed
        updatedAt: now,
      };

      if (willOverwrite) {
        conflicts++;
        if (overwriteConfirmedMode === "reject") {
          errors.push(
            `Customer "${record.name}" has confirmed source and cannot be overwritten (mode: reject)`
          );
        } else {
          warnings.push(
            `Customer "${record.name}" has confirmed source and will be downgraded to imported`
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
    },
    details: {
      add: toAdd,
      update: toUpdate,
      warnings,
      errors,
    },
  };
}

/**
 * Commit customer import
 */
export async function commitCustomerImport(
  records: CustomerImportRecord[],
  options: {
    source: "file" | "paste" | "api";
    fileName?: string;
    userId: string;
    overrideConflicts: boolean;
  }
): Promise<CommitResult> {
  const config = await db
    .select()
    .from(customers)
    .then((rows) => rows[0]);
  const overwriteMode = config
    ? ("warn" as "allow" | "warn" | "reject")
    : ("warn" as const);

  const validation = await validateCustomerImport(records, overwriteMode);

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
    // Insert new customers
    if (validation.details.add.length > 0) {
      await db.insert(customers).values(
        validation.details.add.map((c) => ({
          ...c,
          createdBy: options.userId,
          updatedBy: options.userId,
        }))
      );
    }

    // Update existing customers
    for (const update of validation.details.update) {
      if (update.conflict && !options.overrideConflicts) {
        continue; // Skip conflicting updates
      }

      await db
        .update(customers)
        .set({
          ...update.new,
          updatedBy: options.userId,
        })
        .where(eq(customers.id, update.existing.id));
    }

    // Log import
    await db.insert(masterDataImportLog).values({
      id: logId,
      importedAt: now,
      dataType: "customer",
      source: options.source,
      format: "csv", // Simplified for now
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
      warnings: JSON.stringify(validation.details.warnings),
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
      dataType: "customer",
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
 * Export customers to CSV
 */
export async function exportCustomersCSV(): Promise<string> {
  const allCustomers = await db.select().from(customers);

  const headers = [
    "id",
    "name",
    "displayName",
    "color",
    "colorText",
    "country",
    "iataCode",
    "icaoCode",
    "isActive",
    "source",
  ];

  return toCSV(allCustomers, headers);
}
