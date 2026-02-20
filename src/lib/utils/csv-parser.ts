/**
 * Generic CSV Parser
 * Handles header validation, row parsing, and field type checking
 */

export interface ParsedCSV<T> {
  data: T[];
  headers: string[];
  rowCount: number;
  errors: string[];
}

/**
 * Parse CSV string into typed records
 * - Validates header presence
 * - Handles quoted fields with commas
 * - Trims whitespace
 * - Returns errors for malformed rows
 */
export function parseCSV<T>(
  csvContent: string,
  requiredHeaders: string[],
  mapper: (row: Record<string, string>, index: number) => T | null
): ParsedCSV<T> {
  const errors: string[] = [];
  const data: T[] = [];

  // Split into lines (handle CRLF and LF)
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) {
    return {
      data: [],
      headers: [],
      rowCount: 0,
      errors: ["CSV is empty"],
    };
  }

  // Parse header row
  const headers = parseCSVRow(lines[0]);

  // Validate required headers
  const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    errors.push(
      `Missing required headers: ${missingHeaders.join(", ")}. Found: ${headers.join(", ")}`
    );
    return { data: [], headers, rowCount: 0, errors };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    try {
      const values = parseCSVRow(line);

      // Create row object
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || "";
      });

      // Map to typed record
      const record = mapper(row, i);
      if (record) {
        data.push(record);
      }
    } catch (error) {
      errors.push(
        `Row ${i + 1}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    data,
    headers,
    rowCount: data.length,
    errors,
  };
}

/**
 * Parse a single CSV row
 * Handles quoted fields with embedded commas and quotes
 */
function parseCSVRow(row: string): string[] {
  const fields: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    const nextChar = row[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      fields.push(currentField.trim());
      currentField = "";
    } else {
      currentField += char;
    }
  }

  // Add last field
  fields.push(currentField.trim());

  return fields;
}

/**
 * Convert array of objects to CSV string
 */
export function toCSV<T extends Record<string, unknown>>(
  records: T[],
  headers: string[]
): string {
  if (records.length === 0) {
    return headers.join(",");
  }

  const rows: string[] = [];

  // Add header row
  rows.push(headers.join(","));

  // Add data rows
  for (const record of records) {
    const values = headers.map((header) => {
      const value = record[header];
      if (value === null || value === undefined) return "";

      const str = String(value);

      // Quote if contains comma, quote, or newline
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }

      return str;
    });

    rows.push(values.join(","));
  }

  return rows.join("\n");
}
