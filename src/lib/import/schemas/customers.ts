/**
 * Customers Import Schema
 *
 * Operator/customer master data with color coding and metadata.
 * Migrated from master-data-import-utils.ts into the universal import schema system.
 */

import { db } from "@/lib/db/client";
import { customers, unifiedImportLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { parseODataJSON } from "@/lib/utils/odata-parser";
import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult } from "../types";

const log = createChildLogger("import/customers");

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

/**
 * Get the next available color from the palette that isn't already in use.
 * Cycles back through the palette if all colors are taken.
 */
function getNextAvailableColor(existingColors: string[]): string {
  const used = new Set(existingColors);
  for (const color of COLOR_PALETTE) {
    if (!used.has(color)) return color;
  }
  // All colors used — cycle back
  return COLOR_PALETTE[existingColors.length % COLOR_PALETTE.length];
}

// ─── Helper: Detect SharePoint format and normalize ────────────────────────

/**
 * Detect whether raw data uses SharePoint field names (Title, group, base, etc.)
 * vs simplified field names (name, groupParent, baseAirport, etc.) and normalize
 * all records to the simplified schema format.
 */
function normalizeRecords(rawData: unknown): Record<string, unknown>[] {
  // Handle OData-wrapped or bare array input
  let records: Record<string, unknown>[];

  if (typeof rawData === "string") {
    const parsed = parseODataJSON<Record<string, unknown>>(rawData);
    records = parsed.records;
  } else if (Array.isArray(rawData)) {
    records = rawData as Record<string, unknown>[];
  } else if (typeof rawData === "object" && rawData !== null) {
    // Could be OData wrapper: { value: [...] } or { d: { results: [...] } }
    const obj = rawData as Record<string, unknown>;
    if (Array.isArray(obj.value)) {
      records = obj.value as Record<string, unknown>[];
    } else if (
      obj.d &&
      typeof obj.d === "object" &&
      obj.d !== null &&
      Array.isArray((obj.d as Record<string, unknown>).results)
    ) {
      records = (obj.d as Record<string, unknown>).results as Record<string, unknown>[];
    } else {
      // Single object — wrap in array
      records = [obj];
    }
  } else {
    return [];
  }

  return records.map((record) => {
    // SharePoint format detection: has "Title" field
    if ("Title" in record) {
      return {
        name: str(record.Title),
        displayName: str(record.Title),
        country: strOpt(record.country),
        established: strOpt(record.established),
        groupParent: strOpt(record.group),
        baseAirport: strOpt(record.base),
        website: strOpt(record.website),
        mocPhone: strOpt(record.mocphone),
        iataCode: strOpt(record.iata),
        icaoCode: strOpt(record.icao),
        guid: strOpt(record.GUID),
        spId: record.ID != null ? Number(record.ID) : undefined,
        source: "imported",
      };
    }

    // Simplified / already-normalized format — pass through with alias resolution
    return {
      name: str(record.name ?? record.Name),
      displayName:
        strOpt(record.displayName ?? record.display_name) || str(record.name ?? record.Name),
      color: strOpt(record.color),
      colorText: strOpt(record.colorText ?? record.color_text),
      country: strOpt(record.country),
      established: strOpt(record.established),
      groupParent: strOpt(record.groupParent ?? record.group_parent ?? record.group),
      baseAirport: strOpt(record.baseAirport ?? record.base_airport ?? record.base),
      website: strOpt(record.website),
      mocPhone: strOpt(record.mocPhone ?? record.moc_phone ?? record.mocphone),
      iataCode: strOpt(record.iataCode ?? record.iata_code ?? record.iata),
      icaoCode: strOpt(record.icaoCode ?? record.icao_code ?? record.icao),
      guid: strOpt(record.guid ?? record.GUID),
      spId:
        record.spId != null
          ? Number(record.spId)
          : record.ID != null
            ? Number(record.ID)
            : undefined,
      source: strOpt(record.source) || "imported",
      isActive: record.isActive ?? record.is_active,
      sortOrder:
        record.sortOrder != null
          ? Number(record.sortOrder)
          : record.sort_order != null
            ? Number(record.sort_order)
            : undefined,
    };
  });
}

/** Coerce value to trimmed string */
function str(value: unknown): string {
  return String(value ?? "").trim();
}

/** Coerce value to trimmed string or undefined if empty */
function strOpt(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === "" ? undefined : s;
}

// ─── Schema Definition ────────────────────────────────────────────────────

const customersSchema: ImportSchema = {
  id: "customers",
  display: {
    name: "Customers",
    description: "Operator/customer master data with color coding",
    icon: "fa-solid fa-palette",
    category: "Master Data",
  },
  fields: [
    {
      name: "name",
      label: "Name",
      type: "string",
      required: true,
      isKey: true,
      aliases: ["Title", "Name"],
      description: "Customer/operator name (unique identifier)",
      validate: (value) => {
        if (!value || String(value).trim() === "") {
          return "Customer name is required";
        }
        return null;
      },
    },
    {
      name: "displayName",
      label: "Display Name",
      type: "string",
      required: false,
      aliases: ["display_name"],
      description: "Display name (defaults to name if not provided)",
    },
    {
      name: "color",
      label: "Color",
      type: "string",
      required: false,
      description: "Hex color code for UI display (auto-assigned if not provided)",
      validate: (value) => {
        if (value && !/^#[0-9A-Fa-f]{6}$/.test(String(value))) {
          return "Color must be a valid hex code (e.g., #EF4444)";
        }
        return null;
      },
    },
    {
      name: "colorText",
      label: "Text Color",
      type: "string",
      required: false,
      aliases: ["color_text"],
      description: "Hex color code for text on the color background",
      validate: (value) => {
        if (value && !/^#[0-9A-Fa-f]{6}$/.test(String(value))) {
          return "Text color must be a valid hex code (e.g., #ffffff)";
        }
        return null;
      },
    },
    {
      name: "country",
      label: "Country",
      type: "string",
      required: false,
    },
    {
      name: "established",
      label: "Established",
      type: "string",
      required: false,
      description: "Date the airline was established (ISO string or year)",
    },
    {
      name: "groupParent",
      label: "Group Parent",
      type: "string",
      required: false,
      aliases: ["group_parent", "group"],
      description: "Parent company or airline group",
    },
    {
      name: "baseAirport",
      label: "Base Airport",
      type: "string",
      required: false,
      aliases: ["base_airport", "base"],
      description: "Primary hub/base airport code",
    },
    {
      name: "website",
      label: "Website",
      type: "string",
      required: false,
    },
    {
      name: "mocPhone",
      label: "MOC Phone",
      type: "string",
      required: false,
      aliases: ["moc_phone", "mocphone"],
      description: "Maintenance Operations Center phone number",
    },
    {
      name: "iataCode",
      label: "IATA Code",
      type: "string",
      required: false,
      aliases: ["iata_code", "iata"],
      description: "2-letter IATA airline code",
    },
    {
      name: "icaoCode",
      label: "ICAO Code",
      type: "string",
      required: false,
      aliases: ["icao_code", "icao"],
      description: "3-letter ICAO airline code",
    },
    {
      name: "guid",
      label: "GUID",
      type: "string",
      required: false,
      isKey: true,
      aliases: ["GUID"],
      description: "SharePoint GUID (primary dedup key when present)",
    },
    {
      name: "spId",
      label: "SP ID",
      type: "number",
      required: false,
      aliases: ["ID"],
      description: "SharePoint list item ID",
    },
    {
      name: "source",
      label: "Source",
      type: "string",
      required: false,
      defaultValue: "imported",
      description: "Data source: inferred, imported, or confirmed",
    },
    {
      name: "isActive",
      label: "Active",
      type: "boolean",
      required: false,
      defaultValue: true,
      aliases: ["is_active"],
    },
    {
      name: "sortOrder",
      label: "Sort Order",
      type: "number",
      required: false,
      aliases: ["sort_order"],
      description: "Display sort order",
    },
  ],
  formats: ["json", "csv"],
  commitStrategy: "upsert",
  dedupKey: ["guid", "name"],
  maxSizeMB: 10,

  help: {
    description:
      "Customer/operator master data. Used for color coding and operator matching. " +
      "Colors are auto-assigned from a built-in palette if not provided.",
    expectedFormat: 'JSON array, OData { value: [...] }, or CSV with "name" header',
    sampleSnippet: `[
  { "name": "Atlas Air", "displayName": "Atlas Air", "color": "#3B82F6", "iataCode": "5Y" },
  { "name": "DHL", "displayName": "DHL Aviation", "color": "#EABC42", "iataCode": "D0" }
]`,
    notes: [
      "Colors auto-assigned from palette if not provided",
      "GUID is the primary dedup key; name is the fallback",
      "SharePoint OData format (with Title field) is auto-detected and normalized",
      "Existing non-null values are preserved when import value is null/empty",
      'Records with source "confirmed" are protected from casual overwrites',
    ],
    troubleshooting: [
      {
        error: "Missing name field",
        fix: 'Ensure each record has a "name" (simplified format) or "Title" (SharePoint format) field',
      },
      {
        error: "Duplicate customer names",
        fix: "Use unique names or provide GUID values for deduplication. GUID takes priority over name matching.",
      },
    ],
  },

  // ─── preProcess ─────────────────────────────────────────────────────────

  preProcess(rawData: unknown): Record<string, unknown>[] {
    return normalizeRecords(rawData);
  },

  // ─── Export ─────────────────────────────────────────────────────────────

  export: {
    query: async () => {
      const rows = await db.select().from(customers).orderBy(customers.sortOrder);
      return rows.map((r) => ({
        name: r.name,
        displayName: r.displayName,
        color: r.color,
        colorText: r.colorText,
        country: r.country,
        established: r.established,
        groupParent: r.groupParent,
        baseAirport: r.baseAirport,
        website: r.website,
        mocPhone: r.mocPhone,
        iataCode: r.iataCode,
        icaoCode: r.icaoCode,
        guid: r.guid,
        spId: r.spId,
        source: r.source,
        isActive: r.isActive,
        sortOrder: r.sortOrder,
      }));
    },
    defaultSort: "sortOrder",
  },

  // ─── Template Records ──────────────────────────────────────────────────

  templateRecords: [
    {
      name: "Atlas Air",
      displayName: "Atlas Air",
      color: "#3B82F6",
      iataCode: "5Y",
    },
    {
      name: "DHL Aviation",
      displayName: "DHL",
      color: "#EABC42",
      iataCode: "D0",
    },
    {
      name: "Cargolux",
      displayName: "Cargolux",
      color: "#22C55E",
      iataCode: "CV",
    },
  ],

  // ─── Commit ─────────────────────────────────────────────────────────────

  async commit(records: Record<string, unknown>[], ctx: ImportContext): Promise<CommitResult> {
    const now = new Date().toISOString();
    const errors: string[] = [];
    const warnings: string[] = [];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // Create log entry
    const logEntry = db
      .insert(unifiedImportLog)
      .values({
        importedAt: now,
        dataType: "customers",
        source: ctx.source,
        format: ctx.format,
        fileName: ctx.fileName || null,
        importedBy: ctx.userId,
        status: "success",
        recordsTotal: records.length,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
      })
      .returning({ id: unifiedImportLog.id })
      .get();

    const logId = logEntry.id;

    try {
      // Fetch existing customers for cascading dedup
      const existingCustomers = await db.select().from(customers);

      // Build lookup maps: GUID -> customer, name -> customer
      const guidMap = new Map(existingCustomers.filter((c) => c.guid).map((c) => [c.guid!, c]));
      const nameMap = new Map(existingCustomers.map((c) => [c.name, c]));

      // Track used colors for auto-assignment
      const usedColors = existingCustomers.map((c) => c.color);

      for (const record of records) {
        const name = str(record.name);

        if (!name) {
          errors.push(`Skipping record with empty name`);
          skipped++;
          continue;
        }

        const guid = strOpt(record.guid);

        // Cascading dedup: GUID first, then name
        let existing: (typeof existingCustomers)[number] | undefined;
        if (guid) {
          existing = guidMap.get(guid);
        }
        if (!existing) {
          existing = nameMap.get(name);
        }

        if (!existing) {
          // ── New customer ──────────────────────────────────────────────
          const color = strOpt(record.color) || getNextAvailableColor(usedColors);
          const colorText = strOpt(record.colorText) || "#ffffff";
          const sortOrder =
            record.sortOrder != null
              ? Number(record.sortOrder)
              : existingCustomers.length + inserted + 1;

          db.insert(customers)
            .values({
              name,
              displayName: strOpt(record.displayName) || name,
              color,
              colorText,
              isActive: record.isActive !== false && record.isActive !== 0,
              sortOrder,
              country: strOpt(record.country) || null,
              established: strOpt(record.established) || null,
              groupParent: strOpt(record.groupParent) || null,
              baseAirport: strOpt(record.baseAirport) || null,
              website: strOpt(record.website) || null,
              mocPhone: strOpt(record.mocPhone) || null,
              iataCode: strOpt(record.iataCode) || null,
              icaoCode: strOpt(record.icaoCode) || null,
              spId: record.spId != null ? Number(record.spId) : null,
              guid: guid || null,
              source:
                (strOpt(record.source) as "inferred" | "imported" | "confirmed") || "imported",
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
            })
            .run();

          usedColors.push(color);
          inserted++;
        } else {
          // ── Update existing customer ──────────────────────────────────
          const isConfirmed = existing.source === "confirmed";

          if (isConfirmed) {
            warnings.push(
              `Customer "${name}" has "confirmed" source — updating fields but preserving confirmed status`,
            );
          }

          // Detect name change via GUID match
          let newName = existing.name;
          if (guid && existing.guid === guid && name !== existing.name) {
            const nameConflict = nameMap.get(name);
            if (nameConflict && nameConflict.id !== existing.id) {
              warnings.push(
                `Customer GUID "${guid}": name changed from "${existing.name}" to "${name}" but "${name}" already exists — keeping old name`,
              );
            } else {
              warnings.push(
                `Customer GUID "${guid}": name changed from "${existing.name}" to "${name}"`,
              );
              newName = name;
            }
          }

          // Preserve existing non-null values when import value is null/empty
          db.update(customers)
            .set({
              name: newName,
              displayName: strOpt(record.displayName) || existing.displayName,
              color: strOpt(record.color) || existing.color,
              colorText: strOpt(record.colorText) || existing.colorText,
              country: strOpt(record.country) || existing.country,
              established: strOpt(record.established) || existing.established,
              groupParent: strOpt(record.groupParent) || existing.groupParent,
              baseAirport: strOpt(record.baseAirport) || existing.baseAirport,
              website: strOpt(record.website) || existing.website,
              mocPhone: strOpt(record.mocPhone) || existing.mocPhone,
              iataCode: strOpt(record.iataCode) || existing.iataCode,
              icaoCode: strOpt(record.icaoCode) || existing.icaoCode,
              spId: record.spId != null ? Number(record.spId) : existing.spId,
              guid: guid || existing.guid,
              source: isConfirmed
                ? "confirmed"
                : (strOpt(record.source) as "inferred" | "imported" | "confirmed") ||
                  existing.source,
              updatedAt: now,
              updatedBy: ctx.userId,
            })
            .where(eq(customers.id, existing.id))
            .run();

          updated++;
        }
      }

      // Update log with final counts
      db.update(unifiedImportLog)
        .set({
          recordsInserted: inserted,
          recordsUpdated: updated,
          recordsSkipped: skipped,
          status: errors.length > 0 ? "partial" : "success",
          warnings: warnings.length > 0 ? JSON.stringify(warnings) : null,
          errors: errors.length > 0 ? JSON.stringify(errors) : null,
        })
        .where(eq(unifiedImportLog.id, logId))
        .run();

      log.info({ logId, inserted, updated, skipped }, "Customer import committed");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      log.error({ err, logId }, "Customer import failed");

      db.update(unifiedImportLog)
        .set({
          status: "failed",
          errors: JSON.stringify([errMsg]),
        })
        .where(eq(unifiedImportLog.id, logId))
        .run();
    }

    return {
      success: errors.length === 0,
      logId,
      recordsTotal: records.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
      recordsSkipped: skipped,
      errors,
      warnings,
    };
  },
};

registerSchema(customersSchema);
