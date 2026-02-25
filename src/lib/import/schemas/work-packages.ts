/**
 * Work Packages Import Schema
 *
 * Defines the universal import schema for work package data sourced from
 * SharePoint OData exports. Handles field mapping, OData unwrapping,
 * GUID-based upsert with version comparison, and cache invalidation.
 *
 * Migrated from src/lib/data/import-utils.ts into the universal import
 * schema system.
 */

import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult, ImportSummaryBadge } from "../types";
import { db } from "@/lib/db/client";
import { workPackages, unifiedImportLog } from "@/lib/db/schema";
import { eq, inArray, and, gte, lte } from "drizzle-orm";
import { isCanceled } from "@/lib/utils/status";
import { invalidateCache } from "@/lib/data/reader";
import { invalidateTransformerCache } from "@/lib/data/transformer";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("import:work-packages");

const BATCH_SIZE = 250;

// ─── SharePoint Source Record Shape ─────────────────────────────────────────

interface SPWorkPackageRecord {
  GUID: string;
  ID?: number;
  Title?: string;
  Aircraft?: {
    Title?: string;
    ID?: number;
    field_5?: string;
    AircraftType?: string;
  };
  Customer?: string;
  CustomerReference?: string;
  FlightId?: string;
  Arrival?: string;
  Departure?: string;
  TotalMH?: number;
  TotalGroundHours?: string;
  Workpackage_x0020_Status?: string;
  Description?: string;
  ParentID?: string;
  HasWorkpackage?: boolean;
  WorkpackageNo?: string;
  CalendarComments?: string;
  IsNotClosedOrCanceled?: string;
  DocumentSetID?: number;
  Modified?: string;
  Created?: string;
  OData__UIVersionString?: string;
}

// ─── DB Value Object ────────────────────────────────────────────────────────

interface WorkPackageDbValues {
  guid: string;
  spId: number | null;
  title: string | null;
  aircraftReg: string;
  aircraftType: string | null;
  customer: string;
  customerRef: string | null;
  flightId: string | null;
  arrival: string;
  departure: string;
  totalMH: number | null;
  totalGroundHours: string | null;
  status: string;
  description: string | null;
  parentId: string | null;
  hasWorkpackage: boolean | null;
  workpackageNo: string | null;
  calendarComments: string | null;
  isNotClosedOrCanceled: string | null;
  documentSetId: number | null;
  aircraftSpId: number | null;
  customerSpId: number | null;
  spModified: string | null;
  spCreated: string | null;
  spVersion: string | null;
  importLogId: number | null;
  importedAt: string;
}

// ─── OData Unwrap (works on already-parsed data) ───────────────────────────

function unwrapOData(rawData: unknown): Record<string, unknown>[] {
  if (Array.isArray(rawData)) {
    return rawData as Record<string, unknown>[];
  }

  if (typeof rawData === "object" && rawData !== null) {
    const obj = rawData as Record<string, unknown>;

    // Simple OData: { "value": [...] }
    if (obj.value && Array.isArray(obj.value)) {
      return obj.value as Record<string, unknown>[];
    }

    // Nested OData: { "d": { "results": [...] } }
    if (obj.d && typeof obj.d === "object" && obj.d !== null) {
      const d = obj.d as Record<string, unknown>;
      if (d.results && Array.isArray(d.results)) {
        return d.results as Record<string, unknown>[];
      }
    }
  }

  throw new Error(
    'Unrecognized data format. Expected a JSON array, { "value": [...] }, or { "d": { "results": [...] } }.',
  );
}

// ─── Map Source Record to DB Values ─────────────────────────────────────────

function mapRecordToDb(rec: Record<string, unknown>, importedAt: string): WorkPackageDbValues {
  const aircraft = rec.Aircraft as SPWorkPackageRecord["Aircraft"] | undefined;
  const rawStatus = String(rec.Workpackage_x0020_Status ?? rec.status ?? "New");
  const status = isCanceled(rawStatus) ? "Canceled" : rawStatus;

  return {
    guid: String(rec.GUID ?? rec.guid ?? ""),
    spId: rec.ID != null ? Number(rec.ID) : rec.spId != null ? Number(rec.spId) : null,
    title: rec.Title != null ? String(rec.Title) : rec.title != null ? String(rec.title) : null,
    aircraftReg: String(aircraft?.Title ?? rec.aircraftReg ?? "Unknown"),
    aircraftType:
      aircraft?.field_5 != null
        ? String(aircraft.field_5)
        : aircraft?.AircraftType != null
          ? String(aircraft.AircraftType)
          : rec.aircraftType != null
            ? String(rec.aircraftType)
            : null,
    customer: String(rec.Customer ?? rec.customer ?? "Unknown"),
    customerRef:
      rec.CustomerReference != null
        ? String(rec.CustomerReference)
        : rec.customerRef != null
          ? String(rec.customerRef)
          : null,
    flightId:
      rec.FlightId != null
        ? String(rec.FlightId)
        : rec.flightId != null
          ? String(rec.flightId)
          : null,
    arrival: String(rec.Arrival ?? rec.arrival ?? ""),
    departure: String(rec.Departure ?? rec.departure ?? ""),
    totalMH:
      rec.TotalMH != null ? Number(rec.TotalMH) : rec.totalMH != null ? Number(rec.totalMH) : null,
    totalGroundHours:
      rec.TotalGroundHours != null
        ? String(rec.TotalGroundHours)
        : rec.totalGroundHours != null
          ? String(rec.totalGroundHours)
          : null,
    status,
    description:
      rec.Description != null
        ? String(rec.Description)
        : rec.description != null
          ? String(rec.description)
          : null,
    parentId:
      rec.ParentID != null
        ? String(rec.ParentID)
        : rec.parentId != null
          ? String(rec.parentId)
          : null,
    hasWorkpackage:
      rec.HasWorkpackage != null
        ? Boolean(rec.HasWorkpackage)
        : rec.hasWorkpackage != null
          ? Boolean(rec.hasWorkpackage)
          : null,
    workpackageNo:
      rec.WorkpackageNo != null
        ? String(rec.WorkpackageNo)
        : rec.workpackageNo != null
          ? String(rec.workpackageNo)
          : null,
    calendarComments:
      rec.CalendarComments != null
        ? String(rec.CalendarComments)
        : rec.calendarComments != null
          ? String(rec.calendarComments)
          : null,
    isNotClosedOrCanceled:
      rec.IsNotClosedOrCanceled != null
        ? String(rec.IsNotClosedOrCanceled)
        : rec.isNotClosedOrCanceled != null
          ? String(rec.isNotClosedOrCanceled)
          : null,
    documentSetId:
      rec.DocumentSetID != null
        ? Number(rec.DocumentSetID)
        : rec.documentSetId != null
          ? Number(rec.documentSetId)
          : null,
    aircraftSpId:
      aircraft?.ID != null
        ? Number(aircraft.ID)
        : rec.aircraftSpId != null
          ? Number(rec.aircraftSpId)
          : null,
    customerSpId: rec.customerSpId != null ? Number(rec.customerSpId) : null,
    spModified:
      rec.Modified != null
        ? String(rec.Modified)
        : rec.spModified != null
          ? String(rec.spModified)
          : null,
    spCreated:
      rec.Created != null
        ? String(rec.Created)
        : rec.spCreated != null
          ? String(rec.spCreated)
          : null,
    spVersion:
      rec.OData__UIVersionString != null
        ? String(rec.OData__UIVersionString)
        : rec.spVersion != null
          ? String(rec.spVersion)
          : null,
    importLogId: null,
    importedAt,
  };
}

// ─── Schema Definition ──────────────────────────────────────────────────────

const workPackagesSchema: ImportSchema = {
  id: "work-packages",

  display: {
    name: "Work Packages",
    description: "Aircraft ground time events from SharePoint",
    icon: "fa-solid fa-plane-arrival",
    category: "Operations",
  },

  formats: ["json"],
  commitStrategy: "upsert",
  dedupKey: ["guid"],
  maxSizeMB: 50,

  // ─── Field Definitions ──────────────────────────────────────────────────

  fields: [
    {
      name: "guid",
      label: "GUID",
      type: "string",
      required: true,
      isKey: true,
      aliases: ["GUID"],
      description: "Unique identifier from SharePoint. Used as dedup key for upsert.",
    },
    {
      name: "spId",
      label: "SP ID",
      type: "number",
      required: false,
      aliases: ["ID"],
      description: "SharePoint list item ID.",
    },
    {
      name: "title",
      label: "Title",
      type: "string",
      required: false,
      aliases: ["Title"],
      description: "Work package title.",
    },
    {
      name: "aircraftReg",
      label: "Aircraft Registration",
      type: "string",
      required: true,
      aliases: ["Aircraft.Title"],
      description: "Aircraft registration (tail number). Nested under Aircraft.Title in SP data.",
      filterable: true,
    },
    {
      name: "aircraftType",
      label: "Aircraft Type",
      type: "string",
      required: false,
      aliases: ["Aircraft.field_5", "Aircraft.AircraftType"],
      description:
        "Aircraft type/model. May be nested under Aircraft.field_5 or Aircraft.AircraftType.",
      filterable: true,
    },
    {
      name: "customer",
      label: "Customer",
      type: "string",
      required: false,
      aliases: ["Customer"],
      defaultValue: "Unknown",
      description: "Customer/operator name.",
      filterable: true,
    },
    {
      name: "customerRef",
      label: "Customer Reference",
      type: "string",
      required: false,
      aliases: ["CustomerReference"],
      description: "Customer reference number.",
    },
    {
      name: "flightId",
      label: "Flight ID",
      type: "string",
      required: false,
      aliases: ["FlightId"],
      description: "Associated flight identifier.",
    },
    {
      name: "arrival",
      label: "Arrival",
      type: "string",
      required: false,
      aliases: ["Arrival"],
      description: "Arrival date/time (ISO 8601 string).",
      filterable: true,
    },
    {
      name: "departure",
      label: "Departure",
      type: "string",
      required: false,
      aliases: ["Departure"],
      description: "Departure date/time (ISO 8601 string).",
      filterable: true,
    },
    {
      name: "totalMH",
      label: "Total MH",
      type: "number",
      required: false,
      aliases: ["TotalMH"],
      defaultValue: null,
      description: "Total man-hours. Defaults to 3.0 when null in downstream calculations.",
    },
    {
      name: "totalGroundHours",
      label: "Total Ground Hours",
      type: "string",
      required: false,
      aliases: ["TotalGroundHours"],
      description: "Total ground hours as string (SP data quirk).",
    },
    {
      name: "status",
      label: "Status",
      type: "string",
      required: false,
      aliases: ["Workpackage_x0020_Status"],
      defaultValue: "New",
      description: "Work package status. Canceled variants are normalized.",
      filterable: true,
      transform: (value: unknown) => {
        const str = String(value ?? "New");
        return isCanceled(str) ? "Canceled" : str;
      },
    },
    {
      name: "description",
      label: "Description",
      type: "string",
      required: false,
      aliases: ["Description"],
      description: "Free-text description of the work package.",
    },
    {
      name: "parentId",
      label: "Parent ID",
      type: "string",
      required: false,
      aliases: ["ParentID"],
      description: "Parent work package identifier for hierarchical grouping.",
    },
    {
      name: "hasWorkpackage",
      label: "Has Workpackage",
      type: "boolean",
      required: false,
      aliases: ["HasWorkpackage"],
      description: "Whether this item has an associated work package.",
    },
    {
      name: "workpackageNo",
      label: "Workpackage No",
      type: "string",
      required: false,
      aliases: ["WorkpackageNo"],
      description: "Work package number.",
    },
    {
      name: "calendarComments",
      label: "Calendar Comments",
      type: "string",
      required: false,
      aliases: ["CalendarComments"],
      description: "Comments displayed on calendar views.",
    },
    {
      name: "isNotClosedOrCanceled",
      label: "Is Not Closed or Canceled",
      type: "string",
      required: false,
      aliases: ["IsNotClosedOrCanceled"],
      description: "SharePoint computed field indicating open status.",
    },
    {
      name: "documentSetId",
      label: "Document Set ID",
      type: "number",
      required: false,
      aliases: ["DocumentSetID"],
      description: "SharePoint document set identifier.",
    },
    {
      name: "aircraftSpId",
      label: "Aircraft SP ID",
      type: "number",
      required: false,
      aliases: ["Aircraft.ID"],
      description: "SharePoint ID of the linked aircraft record.",
    },
    {
      name: "customerSpId",
      label: "Customer SP ID",
      type: "number",
      required: false,
      aliases: [],
      description: "SharePoint ID of the linked customer record. Not present in current exports.",
    },
    {
      name: "spModified",
      label: "SP Modified",
      type: "string",
      required: false,
      aliases: ["Modified"],
      description: "SharePoint last modified timestamp. Used for change detection.",
      exportInclude: false,
    },
    {
      name: "spCreated",
      label: "SP Created",
      type: "string",
      required: false,
      aliases: ["Created"],
      description: "SharePoint created timestamp.",
      exportInclude: false,
    },
    {
      name: "spVersion",
      label: "SP Version",
      type: "string",
      required: false,
      aliases: ["OData__UIVersionString"],
      description: "SharePoint version string. Used with spModified for change detection.",
      exportInclude: false,
    },
  ],

  // ─── Help ───────────────────────────────────────────────────────────────

  help: {
    description:
      "Work package (aircraft ground time event) data from SharePoint OData exports. " +
      "Each record represents an aircraft visit at CVG with arrival/departure times, " +
      "customer, man-hours, and status information.",
    expectedFormat: 'JSON array or OData { "value": [...] } format',
    sampleSnippet: `{
  "value": [
    {
      "GUID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "Aircraft": {
        "Title": "N12345",
        "field_5": "B737-800"
      },
      "Customer": "Acme Airlines",
      "Arrival": "2025-01-15T08:00:00Z",
      "Departure": "2025-01-15T14:00:00Z",
      "TotalMH": 4.5,
      "Workpackage_x0020_Status": "New"
    }
  ]
}`,
    notes: [
      "OData wrapper formats are auto-detected and unwrapped (bare array, { value: [...] }, or { d: { results: [...] } }).",
      "TotalMH defaults to 3.0 in downstream calculations when null or missing.",
      "Canceled records (including 'Cancelled' spelling) are imported but hidden from default views.",
      "Records are upserted by GUID. Unchanged records (same spModified + spVersion) are skipped.",
      "Nested Aircraft fields (Aircraft.Title, Aircraft.field_5) are flattened automatically.",
    ],
    troubleshooting: [
      {
        error: "Invalid JSON format",
        fix: "Ensure the file contains valid JSON. Common issues: trailing commas, unquoted keys, BOM characters.",
      },
      {
        error: "Missing GUID",
        fix: "Every record must have a GUID field. This is the unique identifier from SharePoint used for dedup.",
      },
      {
        error: "Missing Aircraft.Title",
        fix: 'Each record needs Aircraft.Title (registration/tail number). Records with "Unknown" registration may indicate missing Aircraft data.',
      },
      {
        error: "Records skipped (unchanged)",
        fix: "This is normal. Records with identical spModified and spVersion are skipped to avoid unnecessary updates.",
      },
    ],
  },

  // ─── Template Records ───────────────────────────────────────────────────

  templateRecords: [
    {
      GUID: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      ID: 1001,
      Title: "WP-2025-001",
      Aircraft: {
        Title: "N12345",
        ID: 42,
        field_5: "B737-800",
      },
      Customer: "Acme Airlines",
      CustomerReference: "ACM-REF-001",
      FlightId: "AA1234",
      Arrival: "2025-01-15T08:00:00Z",
      Departure: "2025-01-15T14:00:00Z",
      TotalMH: 4.5,
      TotalGroundHours: "6.0",
      Workpackage_x0020_Status: "New",
      Description: "Routine maintenance check",
      HasWorkpackage: true,
      WorkpackageNo: "WP001",
      Modified: "2025-01-15T14:30:00Z",
      Created: "2025-01-14T10:00:00Z",
      OData__UIVersionString: "2.0",
    },
    {
      GUID: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      ID: 1002,
      Title: "WP-2025-002",
      Aircraft: {
        Title: "N67890",
        ID: 43,
        field_5: "A320-200",
      },
      Customer: "Global Express",
      CustomerReference: "GEX-REF-002",
      FlightId: "GX5678",
      Arrival: "2025-01-16T22:00:00Z",
      Departure: "2025-01-17T06:00:00Z",
      TotalMH: null,
      TotalGroundHours: "8.0",
      Workpackage_x0020_Status: "In Progress",
      Description: "Engine inspection",
      HasWorkpackage: true,
      WorkpackageNo: "WP002",
      Modified: "2025-01-17T07:00:00Z",
      Created: "2025-01-16T09:00:00Z",
      OData__UIVersionString: "3.0",
    },
  ],

  // ─── Lifecycle Hooks ────────────────────────────────────────────────────

  preProcess(rawData: unknown): Record<string, unknown>[] {
    return unwrapOData(rawData);
  },

  async postMapValidate(records, _ctx) {
    const errors: string[] = [];
    const warnings: string[] = [];

    records.forEach((rec: Record<string, unknown>, idx: number) => {
      const aircraft = rec.Aircraft as SPWorkPackageRecord["Aircraft"] | undefined;
      const guid = rec.GUID ?? rec.guid;
      const aircraftReg = aircraft?.Title ?? rec.aircraftReg;
      const arrival = rec.Arrival ?? rec.arrival;
      const departure = rec.Departure ?? rec.departure;

      if (!guid) {
        errors.push(`Record ${idx + 1}: missing GUID (required for upsert)`);
      }
      if (!aircraftReg) {
        errors.push(`Record ${idx + 1}: missing Aircraft.Title (registration)`);
      }
      if (!arrival && !departure) {
        errors.push(`Record ${idx + 1}: missing both Arrival and Departure dates`);
      }
    });

    // Cap error reporting to keep responses manageable
    if (errors.length > 20) {
      const total = errors.length;
      errors.length = 20;
      errors.push(`... and ${total - 20} more errors`);
    }

    // Warnings for common data quality issues
    const missingMH = records.filter(
      (r: Record<string, unknown>) => r.TotalMH == null && r.totalMH == null,
    ).length;
    if (missingMH > 0) {
      warnings.push(
        `${missingMH} record${missingMH !== 1 ? "s" : ""} missing TotalMH (downstream default: 3.0 MH)`,
      );
    }

    const missingType = records.filter((r: Record<string, unknown>) => {
      const aircraft = r.Aircraft as SPWorkPackageRecord["Aircraft"] | undefined;
      return !aircraft?.field_5 && !aircraft?.AircraftType && !r.aircraftType;
    }).length;
    if (missingType > 0) {
      warnings.push(`${missingType} record${missingType !== 1 ? "s" : ""} missing aircraft type`);
    }

    const canceledCount = records.filter((r: Record<string, unknown>) => {
      const raw = r.Workpackage_x0020_Status ?? r.status;
      return isCanceled(raw != null ? String(raw) : null);
    }).length;
    if (canceledCount > 0) {
      warnings.push(
        `${canceledCount} canceled record${canceledCount !== 1 ? "s" : ""} will be imported but hidden from default views`,
      );
    }

    return { errors, warnings };
  },

  // ─── Commit (UPSERT by GUID) ───────────────────────────────────────────

  async commit(records: Record<string, unknown>[], ctx: ImportContext): Promise<CommitResult> {
    const importedAt = new Date().toISOString();
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Create unified import log entry
    let logId: number;
    try {
      const inserted = db
        .insert(unifiedImportLog)
        .values({
          importedAt,
          dataType: "work-packages",
          source: ctx.source,
          format: ctx.format,
          fileName: ctx.fileName ?? null,
          importedBy: ctx.userId,
          status: "success",
          recordsTotal: records.length,
          recordsInserted: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          warnings: null,
          errors: null,
        })
        .returning({ id: unifiedImportLog.id })
        .get();

      logId = inserted.id;
      log.info({ logId, source: ctx.source }, "Import log entry created");
    } catch (logErr) {
      log.error({ err: logErr }, "Failed to create import log entry");
      return {
        success: false,
        logId: 0,
        recordsTotal: records.length,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [`Failed to create import log: ${(logErr as Error).message}`],
        warnings: [],
      };
    }

    // 2. Map all records to DB value objects
    const valueBatch = records.map((rec) => mapRecordToDb(rec, importedAt));

    // 3. Fetch existing records by GUID for change detection
    const allGuids = valueBatch.map((v) => v.guid);
    const existing = db
      .select({
        guid: workPackages.guid,
        spModified: workPackages.spModified,
        spVersion: workPackages.spVersion,
      })
      .from(workPackages)
      .where(inArray(workPackages.guid, allGuids))
      .all();

    const existingMap = new Map(
      existing.map((e) => [e.guid, { spModified: e.spModified, spVersion: e.spVersion }]),
    );

    // 4. Partition into new / changed / skipped
    const newRecords: WorkPackageDbValues[] = [];
    const changedRecords: WorkPackageDbValues[] = [];
    let skippedCount = 0;

    for (const record of valueBatch) {
      const prev = existingMap.get(record.guid);
      if (!prev) {
        newRecords.push(record);
      } else if (prev.spModified !== record.spModified || prev.spVersion !== record.spVersion) {
        changedRecords.push(record);
      } else {
        skippedCount++;
      }
    }

    log.info(
      {
        logId,
        newCount: newRecords.length,
        changedCount: changedRecords.length,
        skippedCount,
      },
      "Import partitioned: new/changed/skipped",
    );

    // 5. Execute UPSERT in a transaction
    try {
      db.transaction(() => {
        // Batch insert new records
        for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
          const chunk = newRecords.slice(i, i + BATCH_SIZE);
          if (chunk.length > 0) {
            db.insert(workPackages).values(chunk).run();
          }
        }

        // Update changed records individually
        for (const record of changedRecords) {
          db.update(workPackages)
            .set({
              spId: record.spId,
              title: record.title,
              aircraftReg: record.aircraftReg,
              aircraftType: record.aircraftType,
              customer: record.customer,
              customerRef: record.customerRef,
              flightId: record.flightId,
              arrival: record.arrival,
              departure: record.departure,
              totalMH: record.totalMH,
              totalGroundHours: record.totalGroundHours,
              status: record.status,
              description: record.description,
              parentId: record.parentId,
              hasWorkpackage: record.hasWorkpackage,
              workpackageNo: record.workpackageNo,
              calendarComments: record.calendarComments,
              isNotClosedOrCanceled: record.isNotClosedOrCanceled,
              documentSetId: record.documentSetId,
              aircraftSpId: record.aircraftSpId,
              customerSpId: record.customerSpId,
              spModified: record.spModified,
              spCreated: record.spCreated,
              spVersion: record.spVersion,
              importLogId: record.importLogId,
              importedAt: record.importedAt,
            })
            .where(eq(workPackages.guid, record.guid))
            .run();
        }
      });
    } catch (err) {
      log.error({ err, logId, recordCount: records.length }, "Failed to upsert work packages");

      // Update import log to failed
      try {
        db.update(unifiedImportLog)
          .set({
            status: "failed",
            errors: (err as Error).message,
          })
          .where(eq(unifiedImportLog.id, logId))
          .run();
      } catch (updateErr) {
        log.error({ err: updateErr, logId }, "Failed to update import log status");
      }

      return {
        success: false,
        logId,
        recordsTotal: records.length,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [`Database upsert failed: ${(err as Error).message}`],
        warnings,
      };
    }

    // 6. Update import log with final counts
    try {
      db.update(unifiedImportLog)
        .set({
          recordsInserted: newRecords.length,
          recordsUpdated: changedRecords.length,
          recordsSkipped: skippedCount,
          warnings: warnings.length > 0 ? JSON.stringify(warnings) : null,
        })
        .where(eq(unifiedImportLog.id, logId))
        .run();
    } catch (updateErr) {
      log.error({ err: updateErr, logId }, "Failed to update import log counts");
    }

    log.info(
      {
        logId,
        source: ctx.source,
        recordsTotal: records.length,
        inserted: newRecords.length,
        updated: changedRecords.length,
        skipped: skippedCount,
      },
      "Import committed successfully",
    );

    return {
      success: true,
      logId,
      recordsTotal: records.length,
      recordsInserted: newRecords.length,
      recordsUpdated: changedRecords.length,
      recordsSkipped: skippedCount,
      errors,
      warnings,
    };
  },

  // ─── Post-Commit ────────────────────────────────────────────────────────

  async postCommit() {
    invalidateCache();
    invalidateTransformerCache();
    log.debug("Reader and transformer caches invalidated");
  },

  // ─── Summarize (badges for validation preview) ──────────────────────────

  summarize(records: Record<string, unknown>[]) {
    const customerSet = new Set<string>();
    const aircraftSet = new Set<string>();
    const timestamps: number[] = [];
    let canceledCount = 0;

    for (const rec of records) {
      // Customer
      const customer = rec.Customer ?? rec.customer;
      if (customer) customerSet.add(String(customer));

      // Aircraft registration
      const aircraft = rec.Aircraft as SPWorkPackageRecord["Aircraft"] | undefined;
      const reg = aircraft?.Title ?? rec.aircraftReg;
      if (reg) aircraftSet.add(String(reg));

      // Date range
      for (const field of ["Arrival", "Departure", "arrival", "departure"]) {
        const val = rec[field];
        if (val) {
          const ts = new Date(String(val)).getTime();
          if (!isNaN(ts)) timestamps.push(ts);
        }
      }

      // Canceled count
      const rawStatus = rec.Workpackage_x0020_Status ?? rec.status;
      if (isCanceled(rawStatus != null ? String(rawStatus) : null)) {
        canceledCount++;
      }
    }

    const badges: ImportSummaryBadge[] = [
      {
        label: "Total Records",
        value: records.length,
        icon: "fa-solid fa-hashtag",
      },
      {
        label: "Customers",
        value: customerSet.size,
        icon: "fa-solid fa-building",
      },
      {
        label: "Aircraft",
        value: aircraftSet.size,
        icon: "fa-solid fa-plane",
      },
    ];

    if (timestamps.length > 0) {
      const start = new Date(Math.min(...timestamps));
      const end = new Date(Math.max(...timestamps));
      badges.push({
        label: "Date Range",
        value: `${start.toISOString().slice(0, 10)} - ${end.toISOString().slice(0, 10)}`,
        icon: "fa-solid fa-calendar",
      });
    }

    if (canceledCount > 0) {
      badges.push({
        label: "Canceled",
        value: canceledCount,
        icon: "fa-solid fa-ban",
        variant: "warning" as const,
      });
    }

    return badges;
  },

  // ─── Export Config ──────────────────────────────────────────────────────

  export: {
    filters: [
      {
        field: "arrival",
        label: "Arrival Date Range",
        type: "dateRange",
      },
      {
        field: "customer",
        label: "Customer",
        type: "select",
        async loadOptions() {
          const rows = db
            .selectDistinct({ customer: workPackages.customer })
            .from(workPackages)
            .orderBy(workPackages.customer)
            .all();
          return rows.map((r) => r.customer);
        },
      },
      {
        field: "status",
        label: "Status",
        type: "select",
        async loadOptions() {
          const rows = db
            .selectDistinct({ status: workPackages.status })
            .from(workPackages)
            .orderBy(workPackages.status)
            .all();
          return rows.map((r) => r.status);
        },
      },
    ],
    defaultSort: "arrival",
    async query(filters: Record<string, unknown>) {
      const conditions = [];

      // Date range filter on arrival
      if (filters.arrival && typeof filters.arrival === "object") {
        const range = filters.arrival as { start?: string; end?: string };
        if (range.start) {
          conditions.push(gte(workPackages.arrival, range.start));
        }
        if (range.end) {
          conditions.push(lte(workPackages.arrival, range.end));
        }
      }

      // Customer filter
      if (filters.customer && typeof filters.customer === "string") {
        conditions.push(eq(workPackages.customer, filters.customer));
      }

      // Status filter
      if (filters.status && typeof filters.status === "string") {
        conditions.push(eq(workPackages.status, filters.status));
      }

      const query = db.select().from(workPackages);

      const rows = conditions.length > 0 ? query.where(and(...conditions)).all() : query.all();

      return rows as unknown as Record<string, unknown>[];
    },
  },
};

// ─── Self-Register ────────────────────────────────────────────────────────

registerSchema(workPackagesSchema);

export default workPackagesSchema;
