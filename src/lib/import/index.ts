/**
 * Universal Import Hub — Public API
 */

// Types
export type {
  FieldType,
  CommitStrategy,
  FieldDef,
  ExportFilterDef,
  ExportConfig,
  SchemaHelp,
  ImportSchema,
  ImportContext,
  FieldMapping,
  CommitResult,
  ImportSummaryBadge,
  ValidationPreview,
  ParseResult,
  SerializableSchema,
} from "./types";

// Registry
export {
  registerSchema,
  getSchema,
  getAllSchemas,
  getSchemasByCategory,
  toSerializable,
  ensureSchemasLoaded,
} from "./registry";

// Mapping
export { autoMap, applyMapping, extractSourceFields } from "./mapping";

// Parser
export { parseContent, detectFormat, checkContentSize } from "./parser";

// Validator
export { validateRecords } from "./validator";

// Exporter
export { exportData, generateTemplate } from "./exporter";
export type { ExportOutput } from "./exporter";
