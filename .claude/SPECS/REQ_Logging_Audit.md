# REQ: Logging & Audit

## Error Logging
- Console.error for all caught exceptions
- Error boundaries log component tree path
- API route errors return `{ error: string }` with appropriate HTTP status

## Import Logging (D-016)

Each data import is logged to SQLite `import_log` table:

```typescript
interface ImportLogEntry {
  id: string;                        // UUID
  userId: string;                    // Who imported
  source: "file_upload" | "paste_json" | "api_ingest";  // How it was imported
  recordCount: number;               // Records imported
  customerCount: number;             // Distinct customers
  aircraftCount: number;             // Distinct aircraft
  dateRangeStart: string;            // Earliest arrival in imported data
  dateRangeEnd: string;              // Latest departure in imported data
  warnings: string[];                // e.g., "66 records missing TotalMH"
  timestamp: Date;
}
```

- Stats displayed on Admin Import page under "Import History"
- Retained indefinitely (small records, useful for audit)

## Audit Trail

### v1 Scope
- Import log (above) tracks all data imports with user + timestamp
- Config changes logged via `import_log` (lightweight)

### vNext Scope (Admin Audit Log page)
- Full audit table tracking: customer color changes, user CRUD, config changes, data imports
- Each entry records: user, action, target, previous value, new value, timestamp
- See [REQ_Admin.md](REQ_Admin.md) → Audit Log section for data model
