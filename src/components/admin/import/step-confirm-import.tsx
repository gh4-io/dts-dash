"use client";

/**
 * Step 5: Confirm Import
 *
 * Final confirmation before committing.
 */

import { Button } from "@/components/ui/button";
import type { SerializableSchema, ValidationPreview, FieldMapping } from "@/lib/import/types";

interface StepConfirmImportProps {
  schema: SerializableSchema;
  validation: ValidationPreview;
  mapping: FieldMapping[];
  source: "file" | "paste";
  fileName?: string;
  onConfirm: () => void;
  onBack: () => void;
  loading?: boolean;
}

export function StepConfirmImport({
  schema,
  validation,
  mapping,
  source,
  fileName,
  onConfirm,
  onBack,
  loading,
}: StepConfirmImportProps) {
  const mappedCount = mapping.filter((m) => m.sourceField).length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="text-lg font-medium">Confirm Import</h3>
        <p className="text-sm text-muted-foreground">
          Review the import details below before committing.
        </p>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="text-muted-foreground">Data Type</div>
          <div className="font-medium">
            <i className={`${schema.display.icon} mr-2`} />
            {schema.display.name}
          </div>

          <div className="text-muted-foreground">Records</div>
          <div className="font-medium">{validation.recordCount}</div>

          <div className="text-muted-foreground">Strategy</div>
          <div className="font-medium capitalize">{schema.commitStrategy}</div>

          <div className="text-muted-foreground">Source</div>
          <div className="font-medium capitalize">
            {source}
            {fileName && ` — ${fileName}`}
          </div>

          <div className="text-muted-foreground">Fields Mapped</div>
          <div className="font-medium">
            {mappedCount} / {schema.fields.length}
          </div>

          {validation.warnings.length > 0 && (
            <>
              <div className="text-amber-500">Warnings</div>
              <div className="font-medium text-amber-500">{validation.warnings.length}</div>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <i className="fa-solid fa-arrow-left mr-2" />
          Back
        </Button>
        <Button onClick={onConfirm} disabled={loading}>
          {loading ? (
            <>
              <i className="fa-solid fa-spinner fa-spin mr-2" />
              Importing...
            </>
          ) : (
            <>
              <i className="fa-solid fa-check mr-2" />
              Confirm Import
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
