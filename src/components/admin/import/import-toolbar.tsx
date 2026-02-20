"use client";

/**
 * Import Toolbar
 *
 * Persistent toolbar above the wizard with Import, Export, Download Template actions.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SerializableSchema } from "@/lib/import/types";
import { ExportDialog } from "./export-dialog";

interface ImportToolbarProps {
  schemas: SerializableSchema[];
  onStartImport: () => void;
  onToggleHelp: () => void;
  helpOpen: boolean;
}

export function ImportToolbar({
  schemas,
  onStartImport,
  onToggleHelp,
  helpOpen,
}: ImportToolbarProps) {
  const [exportSchema, setExportSchema] = useState<SerializableSchema | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const exportableSchemas = schemas.filter((s) => s.hasExport);

  const handleExportSelect = (schema: SerializableSchema) => {
    setExportSchema(schema);
    setExportOpen(true);
  };

  const handleTemplateDownload = async (schemaId: string, format: "json" | "csv") => {
    try {
      const res = await fetch(`/api/admin/import/template?schemaId=${schemaId}&format=${format}`);
      if (!res.ok) throw new Error("Template download failed");

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `${schemaId}-template.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Silent fail for template download
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Import button */}
        <Button onClick={onStartImport}>
          <i className="fa-solid fa-file-import mr-2" />
          Import
        </Button>

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <i className="fa-solid fa-file-export mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {exportableSchemas.map((schema) => (
              <DropdownMenuItem key={schema.id} onClick={() => handleExportSelect(schema)}>
                <i className={`${schema.display.icon} mr-2 w-4 text-center`} />
                {schema.display.name}
              </DropdownMenuItem>
            ))}
            {exportableSchemas.length === 0 && (
              <DropdownMenuItem disabled>No exportable schemas</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Template dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <i className="fa-solid fa-file-arrow-down mr-2" />
              Template
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {schemas
              .filter((s) => s.hasTemplate)
              .map((schema) => (
                <DropdownMenuSub key={schema.id}>
                  <DropdownMenuSubTrigger>
                    <i className={`${schema.display.icon} mr-2 w-4 text-center`} />
                    {schema.display.name}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => handleTemplateDownload(schema.id, "json")}>
                      <i className="fa-solid fa-code mr-2" />
                      JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleTemplateDownload(schema.id, "csv")}>
                      <i className="fa-solid fa-table mr-2" />
                      CSV
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Help toggle */}
        <Button variant={helpOpen ? "default" : "ghost"} size="icon" onClick={onToggleHelp}>
          <i className="fa-solid fa-circle-question" />
        </Button>
      </div>

      {/* Export dialog */}
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} schema={exportSchema} />
    </>
  );
}
