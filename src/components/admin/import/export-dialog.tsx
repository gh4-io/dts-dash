"use client";

/**
 * Export Dialog
 *
 * Modal for exporting data with format selection.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SerializableSchema } from "@/lib/import/types";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: SerializableSchema | null;
}

export function ExportDialog({ open, onOpenChange, schema }: ExportDialogProps) {
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [exporting, setExporting] = useState(false);

  if (!schema) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/import/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemaId: schema.id, format, filters: {} }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Export failed");
      }

      // Download the file
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `${schema.id}-export.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onOpenChange(false);
    } catch {
      // Error handled by UI state
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className={`${schema.display.icon} text-primary`} />
            Export {schema.display.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">{schema.display.description}</p>

          {/* Format selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Format
            </label>
            <div className="flex gap-2">
              {(["json", "csv"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    format === f
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground/50"
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Export all note */}
          <p className="text-xs text-muted-foreground">
            <i className="fa-solid fa-circle-info mr-1" />
            This will export all {schema.display.name.toLowerCase()} data.
          </p>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-download mr-2" />
                  Export
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
