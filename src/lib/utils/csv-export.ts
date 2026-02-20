/**
 * CSV Export Utility
 * Downloads tabular data as a CSV file
 */

interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

export function exportToCsv<T>(
  filename: string,
  data: T[],
  columns: CsvColumn<T>[]
): void {
  if (data.length === 0) return;

  const header = columns.map((c) => escapeCsvField(c.header)).join(",");
  const rows = data.map((row) =>
    columns.map((c) => escapeCsvField(String(c.accessor(row)))).join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
