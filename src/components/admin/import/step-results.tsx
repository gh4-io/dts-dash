"use client";

/**
 * Step 6: Import Results
 *
 * Shows CommitResult — inserted/updated/skipped/errors.
 */

import { Button } from "@/components/ui/button";
import type { CommitResult } from "@/lib/import/types";

interface StepResultsProps {
  result: CommitResult;
  onImportMore: () => void;
}

/** Escape one CSV cell — quotes doubled, field quoted when it needs to be. */
function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * Build the audit/error report for this commit.
 *
 * Errors and warnings are the per-row outcomes a schema chose to surface —
 * for MH overrides (OI-104) that is every unmatched, duplicate, redundant and
 * minimum-hours-transformed row — so the CSV is the record of what the batch
 * actually did, not just that it succeeded.
 */
function buildReportCsv(result: CommitResult): string {
  const lines = ["severity,message"];

  lines.push(`summary,${csvCell(`Log ID ${result.logId}`)}`);
  lines.push(`summary,${csvCell(`Records: ${result.recordCount}`)}`);
  lines.push(`summary,${csvCell(`Inserted: ${result.recordsInserted}`)}`);
  lines.push(`summary,${csvCell(`Updated: ${result.recordsUpdated}`)}`);
  lines.push(`summary,${csvCell(`Skipped: ${result.recordsSkipped}`)}`);

  for (const err of result.errors) lines.push(`error,${csvCell(err)}`);
  for (const warn of result.warnings) lines.push(`warning,${csvCell(warn)}`);

  return lines.join("\n");
}

export function StepResults({ result, onImportMore }: StepResultsProps) {
  const downloadReport = () => {
    const blob = new Blob([buildReportCsv(result)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `import-report-${result.logId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div
        className={`rounded-lg border p-4 ${
          result.success
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-destructive/30 bg-destructive/10"
        }`}
      >
        <div className="flex items-center gap-2">
          <i
            className={`fa-solid text-lg ${
              result.success
                ? "fa-circle-check text-emerald-500"
                : "fa-circle-xmark text-destructive"
            }`}
          />
          <span
            className={`text-base font-medium ${result.success ? "text-emerald-500" : "text-destructive"}`}
          >
            {result.success ? "Import Successful" : "Import Failed"}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={result.recordCount} icon="fa-solid fa-database" />
        <StatCard
          label="Inserted"
          value={result.recordsInserted}
          icon="fa-solid fa-plus"
          variant="success"
        />
        <StatCard
          label="Updated"
          value={result.recordsUpdated}
          icon="fa-solid fa-pen"
          variant="info"
        />
        <StatCard
          label="Skipped"
          value={result.recordsSkipped}
          icon="fa-solid fa-forward"
          variant="muted"
        />
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-destructive">
            Errors
          </h4>
          <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            {result.errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                <i className="fa-solid fa-xmark mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-500">
            Warnings
          </h4>
          <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            {result.warnings.map((warn, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-500">
                <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" />
                <span>{warn}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={onImportMore}>
          <i className="fa-solid fa-plus mr-2" />
          Import More
        </Button>
        <Button variant="outline" onClick={downloadReport}>
          <i className="fa-solid fa-file-csv mr-2" />
          Download Report
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  variant = "default",
}: {
  label: string;
  value: number;
  icon: string;
  variant?: "default" | "success" | "info" | "muted";
}) {
  const colorMap = {
    default: "text-foreground",
    success: "text-emerald-500",
    info: "text-blue-500",
    muted: "text-muted-foreground",
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <div className="flex items-center justify-center gap-1.5">
        <i className={`${icon} text-xs ${colorMap[variant]}`} />
        <span className={`text-xl font-bold ${colorMap[variant]}`}>{value}</span>
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
