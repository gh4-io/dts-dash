import { AircraftTypeEditor } from "@/components/admin/aircraft-type-editor";

export default function AircraftTypesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Aircraft Type Mappings</h1>
        <p className="text-sm text-muted-foreground">
          Manage pattern-based normalization rules for aircraft types.
        </p>
      </div>
      <AircraftTypeEditor />
    </div>
  );
}
