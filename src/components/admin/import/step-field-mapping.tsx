"use client";

/**
 * Step 3: Field Mapping
 *
 * Target fields × source select dropdowns.
 */

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { FieldMapping, SerializableSchema } from "@/lib/import/types";
import { DataPreviewTable } from "./data-preview-table";

interface StepFieldMappingProps {
  schema: SerializableSchema;
  sourceFields: string[];
  mapping: FieldMapping[];
  previewRows: Record<string, unknown>[];
  onMappingChange: (mapping: FieldMapping[]) => void;
  onAutoMap: () => void;
  onNext: () => void;
  onBack: () => void;
  loading?: boolean;
}

export function StepFieldMapping({
  schema,
  sourceFields,
  mapping,
  previewRows,
  onMappingChange,
  onAutoMap,
  onNext,
  onBack,
  loading,
}: StepFieldMappingProps) {
  const updateMapping = (targetField: string, sourceField: string | null) => {
    const next = mapping.map((m) => (m.targetField === targetField ? { ...m, sourceField } : m));
    onMappingChange(next);
  };

  const clearAll = () => {
    onMappingChange(mapping.map((m) => ({ ...m, sourceField: null })));
  };

  // Check required coverage
  const requiredFields = schema.fields.filter((f) => f.required);
  const mappedRequired = requiredFields.filter((f) =>
    mapping.find((m) => m.targetField === f.name && m.sourceField),
  );
  const allRequiredMapped = mappedRequired.length === requiredFields.length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onAutoMap}>
            <i className="fa-solid fa-wand-magic-sparkles mr-2" />
            Auto-Map
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <i className="fa-solid fa-eraser mr-2" />
            Clear All
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {mappedRequired.length}/{requiredFields.length} required fields mapped
        </div>
      </div>

      {/* Mapping table */}
      <div className="rounded-lg border border-border">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-muted/50 px-4 py-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Target Field
          </div>
          <div />
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Source Column
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {schema.fields.map((field) => {
            const m = mapping.find((x) => x.targetField === field.name);
            const isMapped = !!m?.sourceField;

            return (
              <div
                key={field.name}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border/50 px-4 py-2 last:border-0"
              >
                {/* Target field */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{field.label}</span>
                  {field.required && <span className="text-xs text-destructive">*</span>}
                  {field.isKey && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      key
                    </Badge>
                  )}
                </div>

                {/* Arrow */}
                <i
                  className={`fa-solid fa-arrow-left text-xs ${
                    isMapped ? "text-emerald-500" : "text-muted-foreground/30"
                  }`}
                />

                {/* Source select */}
                <Select
                  value={m?.sourceField || "__none__"}
                  onValueChange={(val) =>
                    updateMapping(field.name, val === "__none__" ? null : val)
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="— unmapped —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— unmapped —</SelectItem>
                    {sourceFields.map((sf) => (
                      <SelectItem key={sf} value={sf}>
                        {sf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      {previewRows.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Preview (first {previewRows.length} rows after mapping)
          </h4>
          <DataPreviewTable rows={previewRows} maxRows={5} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <i className="fa-solid fa-arrow-left mr-2" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!allRequiredMapped || loading}>
          {loading ? (
            <>
              <i className="fa-solid fa-spinner fa-spin mr-2" />
              Validating...
            </>
          ) : (
            <>
              Next
              <i className="fa-solid fa-arrow-right ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
