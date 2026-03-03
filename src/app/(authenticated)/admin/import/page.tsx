import { ImportHub } from "@/components/admin/import/import-hub";

export default function DataHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Data Hub</h1>
        <p className="text-sm text-muted-foreground">
          Import, export, and manage all data types from a single interface.
        </p>
      </div>

      <ImportHub />
    </div>
  );
}
