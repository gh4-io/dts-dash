import { DataImport } from "@/components/admin/data-import";

export default function DataImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Data Import</h1>
        <p className="text-sm text-muted-foreground">
          Upload or paste work package data in OData JSON format.
        </p>
      </div>
      <DataImport />
    </div>
  );
}
