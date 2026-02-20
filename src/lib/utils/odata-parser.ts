/**
 * Dynamic OData Parser
 * Handles varied OData wrapper formats and field naming conventions
 */

export type ODataFormat = "simple" | "nested" | "bare";

export interface ParsedOData<T> {
  records: T[];
  format: ODataFormat;
  metadata?: Record<string, unknown>;
}

/**
 * Parse OData JSON from various formats
 * - Simple OData: { "value": [...] }
 * - Nested OData: { "d": { "results": [...] } }
 * - Bare array: [...]
 */
export function parseODataJSON<T>(jsonContent: string): ParsedOData<T> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Detect format and extract records
  if (Array.isArray(parsed)) {
    // Bare array format
    return {
      records: parsed as T[],
      format: "bare",
    };
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;

    // Simple OData format: { "value": [...] }
    if (obj.value && Array.isArray(obj.value)) {
      return {
        records: obj.value as T[],
        format: "simple",
        metadata: obj["odata.metadata"]
          ? { odataMetadata: obj["odata.metadata"] }
          : undefined,
      };
    }

    // Nested OData format: { "d": { "results": [...] } }
    if (obj.d && typeof obj.d === "object" && obj.d !== null) {
      const d = obj.d as Record<string, unknown>;
      if (d.results && Array.isArray(d.results)) {
        return {
          records: d.results as T[],
          format: "nested",
          metadata: d.__metadata as Record<string, unknown> | undefined,
        };
      }
    }
  }

  throw new Error(
    "Unrecognized OData format. Expected bare array, { value: [...] }, or { d: { results: [...] } }"
  );
}

/**
 * Map SharePoint aircraft data (ac.json) to normalized aircraft record
 */
export interface SharePointAircraftRecord {
  Title: string; // Registration
  field_1?: string; // Lessor
  field_2?: string; // Operator (raw)
  field_3?: string; // Category
  field_4?: string; // Manufacturer
  field_5?: string; // Model
  field_6?: string; // Age
}

/**
 * Map SharePoint customer data (cust.json) to normalized customer record
 */
export interface SharePointCustomerRecord {
  Title: string; // Name
  country?: string;
  established?: string;
  group?: string; // Group parent
  base?: string; // Base airport
  website?: string;
  mocphone?: string;
  fleetmatrix?: string; // Ignore (reference only)
  iata?: string;
  icao?: string;
}
