"use client";

/**
 * Step 4: Validation Results
 *
 * Shows errors, warnings, summary badges, and data preview.
 */

import { Button } from "@/components/ui/button";
import type { ValidationPreview } from "@/lib/import/types";
import { DataPreviewTable } from "./data-preview-table";

interface StepValidationProps {
  validation: ValidationPreview;
  onNext: () => void;
  onBack: () => void;
}

export function StepValidation({ validation, onNext, onBack }: StepValidationProps) {
  const hasErrors = validation.errors.length > 0;

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div
        className={`rounded-lg border p-3 ${
          hasErrors
            ? "border-destructive/30 bg-destructive/10"
            : "border-emerald-500/30 bg-emerald-500/10"
        }`}
      >
        <div className="flex items-center gap-2">
          <i
            className={`fa-solid ${
              hasErrors ? "fa-circle-xmark text-destructive" : "fa-circle-check text-emerald-500"
            }`}
          />
          <span
            className={`text-sm font-medium ${hasErrors ? "text-destructive" : "text-emerald-500"}`}
          >
            {hasErrors
              ? `Validation failed — ${validation.errors.length} error(s)`
              : `Validation passed — ${validation.recordCount} records ready`}
          </span>
        </div>
      </div>

      {/* Summary badges */}
      {validation.badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {validation.badges.map((badge, i) => (
            <div
              key={i}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${
                badge.variant === "destructive"
                  ? "border-destructive/30 bg-destructive/10"
                  : badge.variant === "warning"
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-border bg-card"
              }`}
            >
              {badge.icon && <i className={`${badge.icon} text-xs text-muted-foreground`} />}
              <span className="text-xs text-muted-foreground">{badge.label}</span>
              <span className="text-sm font-semibold">{badge.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Field coverage */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          <i className="fa-solid fa-table-columns mr-1" />
          Fields mapped: {validation.fieldCoverage.mapped}/{validation.fieldCoverage.total}
        </span>
        <span>
          <i className="fa-solid fa-asterisk mr-1" />
          Required: {validation.fieldCoverage.requiredMapped}/{validation.fieldCoverage.required}
        </span>
      </div>

      {/* Errors */}
      {validation.errors.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-destructive">
            Errors ({validation.errors.length})
          </h4>
          <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            {validation.errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                <i className="fa-solid fa-xmark mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-500">
            Warnings ({validation.warnings.length})
          </h4>
          <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            {validation.warnings.map((warn, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-500">
                <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" />
                <span>{warn}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {validation.previewRows.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Data Preview
          </h4>
          <DataPreviewTable rows={validation.previewRows} maxRows={5} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <i className="fa-solid fa-arrow-left mr-2" />
          Back
        </Button>
        <Button onClick={onNext} disabled={hasErrors}>
          {hasErrors ? (
            "Fix errors to continue"
          ) : (
            <>
              Import
              <i className="fa-solid fa-arrow-right ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
