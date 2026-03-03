/**
 * Universal Import Hub — Core Types
 *
 * Defines the schema system, field definitions, mapping, validation,
 * export, and commit interfaces used by all import schemas.
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Reserved key name for auto-detecting schema type from imported data.
 *
 * When present in JSON or CSV data, its value selects the import schema
 * automatically (e.g. `"customers"`, `"work-packages"`).
 *
 * Detection priority:
 *   1. Explicit `_importType` key in the data → use that schema ID
 *   2. No key found → default to `"work-packages"` (most common type)
 *   3. User can always override via "Choose Type" in the UI
 *
 * Templates downloaded from the Data Hub include this key automatically.
 */
export const IMPORT_TYPE_KEY = "_importType";

/** Default schema when no `_importType` key is found */
export const DEFAULT_SCHEMA_ID = "work-packages";

// ─── Field & Schema Types ────────────────────────────────────────────────────

export type FieldType = "string" | "number" | "boolean" | "date" | "json";
export type CommitStrategy = "insert" | "upsert" | "replace-all";

export interface FieldDef {
  /** DB column / target field name */
  name: string;
  /** Human-readable label */
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue?: unknown;
  /** Return error message string or null if valid */
  validate?: (value: unknown, record: Record<string, unknown>) => string | null;
  /** Transform value before commit */
  transform?: (value: unknown) => unknown;
  /** Source field names for auto-mapping (case-sensitive) */
  aliases?: string[];
  description?: string;
  /** Part of dedup key for upsert */
  isKey?: boolean;
  /** Can be used as export filter */
  filterable?: boolean;
  /** Include in export output (default true) */
  exportInclude?: boolean;
}

// ─── Export Types ────────────────────────────────────────────────────────────

export interface ExportFilterDef {
  /** FieldDef.name to filter on */
  field: string;
  label: string;
  type: "dateRange" | "select" | "text" | "boolean";
  /** For 'select' type: static options or async loader */
  options?: string[];
  /** For 'select' type: load options dynamically */
  loadOptions?: () => Promise<string[]>;
}

export interface ExportConfig {
  /** Available export filters (plus "all" is always an option) */
  filters?: ExportFilterDef[];
  /** Query data with optional filters */
  query: (filters: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  /** Field name to sort by */
  defaultSort?: string;
}

// ─── Schema Help ─────────────────────────────────────────────────────────────

export interface SchemaHelp {
  /** What this data type is and when to use it */
  description: string;
  /** e.g., "JSON array or OData { value: [...] }" */
  expectedFormat: string;
  /** Small example of valid input (shown in code block) */
  sampleSnippet?: string;
  /** General notes, tips, explanations */
  notes?: string[];
  /** Hard requirements beyond field validation */
  requirements?: string[];
  /** Common errors + fixes */
  troubleshooting?: Array<{ error: string; fix: string }>;
}

// ─── Import Schema ───────────────────────────────────────────────────────────

export interface ImportSchema<T = Record<string, unknown>> {
  id: string;
  display: {
    name: string;
    description: string;
    icon: string;
    category: string;
  };
  fields: FieldDef[];
  formats: Array<"json" | "csv">;
  commitStrategy: CommitStrategy;
  dedupKey?: string[];
  maxSizeMB?: number;

  help: SchemaHelp;

  /** Export configuration (omit to disable export for this type) */
  export?: ExportConfig;

  /** Example records for template download (2-3 rows) */
  templateRecords?: Record<string, unknown>[];

  // ─── Lifecycle Hooks ───────────────────────────────────────────────────

  /** Extract records array from raw parsed data (e.g., OData unwrap) */
  preProcess?: (rawData: unknown) => Record<string, unknown>[];

  /** Validate mapped records (e.g., cross-record checks, FK lookups) */
  postMapValidate?: (
    records: T[],
    ctx: ImportContext,
  ) => Promise<{ errors: string[]; warnings: string[] }>;

  /** Commit records to database */
  commit: (records: T[], ctx: ImportContext) => Promise<CommitResult>;

  /** Post-commit actions (e.g., cache invalidation) */
  postCommit?: (result: CommitResult, ctx: ImportContext) => Promise<void>;

  /** Generate summary badges for validation preview */
  summarize?: (records: T[]) => ImportSummaryBadge[];
}

// ─── Context & Mapping ───────────────────────────────────────────────────────

export interface ImportContext {
  userId: number;
  source: "file" | "paste" | "api";
  fileName?: string;
  format: "json" | "csv";
  schemaId: string;
}

export interface FieldMapping {
  /** FieldDef.name */
  targetField: string;
  /** Source column name, null = unmapped */
  sourceField: string | null;
}

// ─── Results ─────────────────────────────────────────────────────────────────

export interface CommitResult {
  success: boolean;
  logId: number;
  recordCount: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: string[];
  warnings: string[];
}

export interface ImportSummaryBadge {
  label: string;
  value: string | number;
  icon?: string;
  variant?: "default" | "destructive" | "warning";
}

export interface ValidationPreview {
  valid: boolean;
  recordCount: number;
  errors: string[];
  warnings: string[];
  badges: ImportSummaryBadge[];
  /** First N mapped rows for preview table */
  previewRows: Record<string, unknown>[];
  fieldCoverage: {
    mapped: number;
    total: number;
    required: number;
    requiredMapped: number;
  };
}

// ─── Parse Result ────────────────────────────────────────────────────────────

export interface ParseResult {
  records: Record<string, unknown>[];
  sourceFields: string[];
  detectedFormat: "json" | "csv";
  recordCount: number;
}

// ─── Serializable Schema (for API response, no functions) ────────────────────

export interface SerializableSchema {
  id: string;
  display: ImportSchema["display"];
  fields: FieldDef[];
  formats: Array<"json" | "csv">;
  commitStrategy: CommitStrategy;
  dedupKey?: string[];
  maxSizeMB?: number;
  help: SchemaHelp;
  hasExport: boolean;
  hasTemplate: boolean;
  exportFilters?: ExportFilterDef[];
}
